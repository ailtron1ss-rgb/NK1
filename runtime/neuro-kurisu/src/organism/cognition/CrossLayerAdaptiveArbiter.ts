import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const SOURCES=['neural','causal','embodied','transfer','hierarchical','taskFree','personality','risk','memory','developmental'] as const;
type Source=typeof SOURCES[number];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;

export interface ArbiterSourceState { reliability01:number; plasticity01:number; uses:number; wins:number; losses:number; lastGain01:number; }
export interface CrossLayerAdaptiveArbiterState {
  version:1; decisions:number; updates:number; disagreements:number; abstentions:number; correctiveReroutes:number;
  fusionQuality01:number; calibration01:number; disagreement01:number; sourceDiversity01:number; learningEfficiency01:number;
  sourceReliability:Record<Source,ArbiterSourceState>;
  selectedAction:ActionKind|null; selectedSource:Source|null; lastWeights:Record<Source,number>;
}

const defaultSource=():ArbiterSourceState=>({reliability01:.5,plasticity01:.18,uses:0,wins:0,losses:0,lastGain01:.5});
const defaultState=():CrossLayerAdaptiveArbiterState=>({
  version:1,decisions:0,updates:0,disagreements:0,abstentions:0,correctiveReroutes:0,
  fusionQuality01:.5,calibration01:.5,disagreement01:0,sourceDiversity01:1,learningEfficiency01:.35,
  sourceReliability:Object.fromEntries(SOURCES.map(s=>[s,defaultSource()])) as Record<Source,ArbiterSourceState>,
  selectedAction:null,selectedSource:null,lastWeights:Object.fromEntries(SOURCES.map(s=>[s,1/SOURCES.length])) as Record<Source,number>
});

export type ArbiterBiases=Record<Source,Record<ActionKind,number>>;

export class CrossLayerAdaptiveArbiter {
  private state=defaultState();
  snapshot(){return deep(this.state);}
  restore(raw?:Partial<CrossLayerAdaptiveArbiterState>|null){const d=defaultState(),r:any=raw??{};const sr:any={...d.sourceReliability,...(r.sourceReliability??{})};
    for(const s of SOURCES){const x=sr[s]??{};sr[s]={...defaultSource(),...x,reliability01:clamp(Number(x.reliability01??.5)),plasticity01:clamp(Number(x.plasticity01??.18),.03,.5),uses:Math.max(0,Number(x.uses)||0),wins:Math.max(0,Number(x.wins)||0),losses:Math.max(0,Number(x.losses)||0),lastGain01:clamp(Number(x.lastGain01??.5))};}
    this.state={...d,...deep(r),version:1,sourceReliability:sr,lastWeights:{...d.lastWeights,...(r.lastWeights??{})}};
  }

  fuse(input:{baseUtilities:Record<ActionKind,number>; biases:ArbiterBiases; confidence01?:Partial<Record<Source,number>>; uncertainty01:number; computeBudget01:number; risk01?:number}):{actionBias:Record<ActionKind,number>;weights:Record<Source,number>;disagreement01:number;selectedSource:Source|null;abstain:boolean;reroute:ActionKind|null;fusionQuality01:number}{
    this.state.decisions++;
    const confidence=input.confidence01??{};
    const raw=SOURCES.map(s=>{const r=this.state.sourceReliability[s];const c=clamp(confidence[s]??.55);const resource=s==='causal'||s==='neural'?.05*(1-input.computeBudget01):0;return {s,w:Math.max(.02,r.reliability01*.72+c*.28-resource)};});
    const sum=raw.reduce((a,b)=>a+b.w,0)||1;const weights=Object.fromEntries(raw.map(x=>[x.s,x.w/sum])) as Record<Source,number>;
    const perAction=ACTIONS.map(a=>{const vals=SOURCES.map(s=>clamp(input.biases[s]?.[a]??0,-.12,.12));return {a,vals,mean:vals.reduce((z,v,k)=>z+v*(weights[SOURCES[k]]??0),0)};});
    const disagreement=mean(perAction.map(x=>{const mu=x.mean;return mean(SOURCES.map((s,k)=>Math.abs(x.vals[k]!-mu)))}));
    this.state.disagreement01=clamp(this.state.disagreement01*.90+disagreement*4*.10);if(disagreement>.002)this.state.disagreements++;
    const actionBias=Object.fromEntries(perAction.map(x=>[x.a,clamp(x.mean*(.84+.16*(1-this.state.disagreement01)),-.11,.11)])) as Record<ActionKind,number>;
    const ranked=ACTIONS.slice().sort((a,b)=>(actionBias[b]??0)-(actionBias[a]??0));
    const risk=clamp(input.risk01??0), highConflict=this.state.disagreement01>.62;
    let reroute:ActionKind|null=null,abstain=false;
    if(highConflict||risk>.84){if(input.uncertainty01>.72){reroute='verify';this.state.correctiveReroutes++;}else if(risk>.84){reroute='defer';this.state.correctiveReroutes++;}else abstain=true;}
    if(abstain)this.state.abstentions++;
    if(reroute)actionBias[reroute]=clamp((actionBias[reroute]??0)+.032,-.11,.11);
    const top=ranked[0]!,selectedSource=SOURCES.slice().sort((a,b)=>(weights[b]??0)-(weights[a]??0))[0]??null;
    this.state.selectedAction=top;this.state.selectedSource=selectedSource;
    this.state.lastWeights=weights;
    this.state.sourceDiversity01=clamp(1-Math.max(...Object.values(weights))*SOURCES.length*.12);
    this.state.fusionQuality01=clamp(this.state.fusionQuality01*.94+(1-disagreement*3)*(1-risk*.25)*.06);
    this.state.calibration01=clamp(this.state.calibration01*.96+this.state.fusionQuality01*.04);
    return {actionBias,weights,disagreement01:this.state.disagreement01,selectedSource,abstain,reroute,fusionQuality01:this.state.fusionQuality01};
  }

  learn(input:{action:ActionKind;reward01:number;verified01:number;predictionError01:number;biases:ArbiterBiases;weights:Record<Source,number>}):void{
    const reward=clamp(input.reward01),quality=clamp(reward*.50+clamp(input.verified01)*.25+(1-clamp(input.predictionError01))*.25);
    const selected=ACTIONS.indexOf(input.action);this.state.updates++;
    for(const s of SOURCES){const st=this.state.sourceReliability[s];const b=clamp(input.biases[s]?.[input.action]??0,-.12,.12);const usefulness=clamp(.5+b*2.8);const alignment=clamp(.5+(quality-.5)*1.6*(b>=0?1:-1));const gain=clamp(.55*quality+.30*alignment+.15*usefulness);
      const eta=clamp(st.plasticity01/Math.sqrt(st.uses+1),.003,.05);st.reliability01=clamp(st.reliability01+eta*(gain-st.reliability01));st.lastGain01=gain;st.uses++;if(gain>.58)st.wins++;else st.losses++;st.plasticity01=clamp(st.plasticity01*(gain>.55?.999:1.002),.03,.5);
    }
    const ranked=SOURCES.slice().sort((a,b)=>(input.weights[b]??0)-(input.weights[a]??0));const top=ranked[0];if(top){const st=this.state.sourceReliability[top];const actionBias=input.biases[top]?.[input.action]??0;this.state.learningEfficiency01=clamp(this.state.learningEfficiency01*.96+(Math.abs(actionBias)*(quality-.5)*2+.5)*.04);if(selected<0)this.state.abstentions++;}
  }

  metrics(){return {...deep(this.state),sourceWeights:this.state.lastWeights};}
}
export const defaultCrossLayerAdaptiveArbiter=()=>defaultState();
