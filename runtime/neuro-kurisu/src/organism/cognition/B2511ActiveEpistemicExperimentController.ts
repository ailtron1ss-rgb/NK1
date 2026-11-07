import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

type B2511ActionStats={count:number;infoGain01:number;reward01:number;predictionError01:number;confidence01:number};

export interface B2511State{
  version:1;
  enabled:boolean;
  tick:number;
  cycles:number;
  outcomes:number;
  learningUpdates:number;
  informationActions:number;
  selectedAction:ActionKind;
  selectedScore01:number;
  expectedInfoGain01:number;
  observedInfoGain01:number;
  epistemicPressure01:number;
  epistemicEfficiency01:number;
  risk01:number;
  causalEffect01:number;
  sampleEfficiency01:number;
  actionBias:number[];
  actionInfoGain:number[];
  actionRisk:number[];
  actionStats:Record<ActionKind,B2511ActionStats>;
  lastUncertainty01:number;
  lastPredictionError01:number;
  lesionFraction01:number;
}

export interface B2511Input{
  tick:number;
  baseUtilities:Record<ActionKind,number>;
  predictedUtilities:Record<ActionKind,number>;
  actionUncertainty:Record<ActionKind,number>;
  counterfactualSpread01:number;
  informationGain01:number;
  hypothesisEntropy01:number;
  uncertainty01:number;
  predictionError01:number;
  novelty01:number;
  goalPressure01:number;
  energy01:number;
  thermal01:number;
  actionCosts?:Partial<Record<ActionKind,number>>;
  personalityBias?:Partial<Record<ActionKind,number>>;
  homeostaticPressure01?:number;
}

export interface B2511Output{
  actionBias:Record<ActionKind,number>;
  informationValue:Record<ActionKind,number>;
  risk:Record<ActionKind,number>;
  expectedInfoGain01:number;
  epistemicPressure01:number;
  epistemicEfficiency01:number;
  selectedAction:ActionKind;
  selectedScore01:number;
}

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const actOr=(v:unknown,f:ActionKind):ActionKind=>ACTIONS.includes(v as ActionKind)?v as ActionKind:f;
function blankStats():Record<ActionKind,B2511ActionStats>{
  return Object.fromEntries(ACTIONS.map(a=>[a,{count:0,infoGain01:.2,reward01:.5,predictionError01:.5,confidence01:.5}])) as Record<ActionKind,B2511ActionStats>;
}

export const defaultB2511State=():B2511State=>({
  version:1,enabled:true,tick:0,cycles:0,outcomes:0,learningUpdates:0,informationActions:0,
  selectedAction:'wait',selectedScore01:.5,expectedInfoGain01:.2,observedInfoGain01:0,
  epistemicPressure01:.3,epistemicEfficiency01:.5,risk01:.2,causalEffect01:0,sampleEfficiency01:0,
  actionBias:ACTIONS.map(()=>0),actionInfoGain:ACTIONS.map((_,i)=>.18+.012*i),actionRisk:ACTIONS.map((_,i)=>.10+.01*i),
  actionStats:blankStats(),lastUncertainty01:.5,lastPredictionError01:.5,lesionFraction01:0,
});

export class B2511ActiveEpistemicExperimentController{
  readonly systemName='cognition:b2511-active-epistemic-experiment-controller' as const;
  private state=defaultB2511State();
  private lastFrame:B2511Output|null=null;

  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B2511State>|null){
    const d=defaultB2511State();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const sRaw=(read('actionStats')&&typeof read('actionStats')==='object')?read('actionStats') as Record<string,unknown>:{};
    const stats=blankStats();
    for(const a of ACTIONS){const q=(sRaw[a]&&typeof sRaw[a]==='object')?sRaw[a] as Record<string,unknown>:{};const base=stats[a];stats[a]={count:cnt(q.count,base.count),infoGain01:C01(q.infoGain01,base.infoGain01),reward01:C01(q.reward01,base.reward01),predictionError01:C01(q.predictionError01,base.predictionError01),confidence01:C01(q.confidence01,base.confidence01)};}
    const ab=read('actionBias'),aig=read('actionInfoGain'),ar=read('actionRisk');
    this.state={version:1,enabled:read('enabled')!==false,tick:cnt(read('tick'),d.tick),cycles:cnt(read('cycles'),d.cycles),outcomes:cnt(read('outcomes'),d.outcomes),learningUpdates:cnt(read('learningUpdates'),d.learningUpdates),informationActions:cnt(read('informationActions'),d.informationActions),
      selectedAction:actOr(read('selectedAction'),d.selectedAction),selectedScore01:C01(read('selectedScore01'),d.selectedScore01),expectedInfoGain01:C01(read('expectedInfoGain01'),d.expectedInfoGain01),observedInfoGain01:C01(read('observedInfoGain01'),d.observedInfoGain01),
      epistemicPressure01:C01(read('epistemicPressure01'),d.epistemicPressure01),epistemicEfficiency01:C01(read('epistemicEfficiency01'),d.epistemicEfficiency01),risk01:C01(read('risk01'),d.risk01),causalEffect01:C01(read('causalEffect01'),d.causalEffect01),sampleEfficiency01:C01(read('sampleEfficiency01'),d.sampleEfficiency01),
      actionBias:ACTIONS.map((_,i)=>Math.max(-.12,Math.min(.12,finN(Array.isArray(ab)?(ab as unknown[])[i]:0,0)))),
      actionInfoGain:ACTIONS.map((_,i)=>C01(Array.isArray(aig)?(aig as unknown[])[i]:d.actionInfoGain[i],d.actionInfoGain[i]!)),
      actionRisk:ACTIONS.map((_,i)=>C01(Array.isArray(ar)?(ar as unknown[])[i]:d.actionRisk[i],d.actionRisk[i]!)),
      actionStats:stats,lastUncertainty01:C01(read('lastUncertainty01'),d.lastUncertainty01),lastPredictionError01:C01(read('lastPredictionError01'),d.lastPredictionError01),lesionFraction01:C01(read('lesionFraction01'),d.lesionFraction01)};
  }

  setEnabled(x:boolean){this.state.enabled=!!x;}

  beforeDecision(i:B2511Input):B2511Output{
    const base=ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5));
    if(!this.state.enabled){
      const idx=base.indexOf(Math.max(...base));const selected=ACTIONS[idx]??'wait';
      const out={actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as any,informationValue:Object.fromEntries(ACTIONS.map(a=>[a,.0])) as any,risk:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as any,expectedInfoGain01:0,epistemicPressure01:0,epistemicEfficiency01:this.state.epistemicEfficiency01,selectedAction:selected,selectedScore01:base[idx]??.5};
      this.lastFrame=out;return out;
    }
    const pressure=clamp(.30*i.uncertainty01+.24*i.predictionError01+.16*i.novelty01+.14*i.hypothesisEntropy01+.10*i.counterfactualSpread01+.06*(1-i.energy01));
    const budget=clamp(.55*i.energy01+.45*(1-i.thermal01));
    const outBias:number[]=[];const infoVals:number[]=[];const risks:number[]=[];const scores:number[]=[];
    for(let k=0;k<ACTIONS.length;k++){
      const a=ACTIONS[k]!;
      const u=clamp(i.actionUncertainty[a]??i.uncertainty01);
      const historical=this.state.actionInfoGain[k]??.2;
      const probeAffinity=a==='verify'?.98:a==='explore'?.72:a==='reflect'?.40:0;
      const expectedInfo=clamp(.46*historical+.19*i.informationGain01+.16*u+.09*i.counterfactualSpread01+.10*probeAffinity*i.novelty01+.08*(a==='verify'?i.uncertainty01:0));
      const cost=clamp(i.actionCosts?.[a]??(a==='explore'?.48:a==='verify'?.34:a==='reflect'?.20:.14));
      const personality=clamp((i.personalityBias?.[a]??0)*.5+.5);
      const homeo=clamp(i.homeostaticPressure01??.3);
      const risk=clamp(.35*u+.20*i.predictionError01+.15*cost+.10*(1-budget)+.10*homeo+.10*(1-personality));
      const infoWeight=pressure*(.12+.38*probeAffinity)*budget;
      const bias=clamp((expectedInfo-.26)*infoWeight*(1-this.state.lesionFraction01),-.12,.12);
      const predicted=clamp(i.predictedUtilities[a]??.5), b=base[k]!;
      const utility=.50*b+.30*predicted+.12*personality+.08*(1-risk);
      const score=clamp(utility+bias+.05*expectedInfo*pressure*probeAffinity-.04*cost);
      infoVals.push(expectedInfo);risks.push(risk);outBias.push(bias);scores.push(score);
    }
    const idx=scores.indexOf(Math.max(...scores));
    const selected=ACTIONS[idx]??'wait';
    const selectedInfo=infoVals[idx]??.2;
    const eff=clamp(this.state.epistemicEfficiency01*.94+.06*(selectedInfo/(.08+risks[idx]!)));
    this.state.tick=i.tick;this.state.cycles++;this.state.selectedAction=selected;this.state.selectedScore01=scores[idx]??.5;
    this.state.expectedInfoGain01=selectedInfo;this.state.epistemicPressure01=pressure;this.state.epistemicEfficiency01=eff;this.state.risk01=risks[idx]??.5;
    this.state.actionBias=outBias;this.state.actionInfoGain=infoVals;this.state.actionRisk=risks;this.state.lastUncertainty01=i.uncertainty01;this.state.lastPredictionError01=i.predictionError01;
    if(selected==='explore'||selected==='verify')this.state.informationActions++;
    const out={actionBias:Object.fromEntries(ACTIONS.map((a,k)=>[a,outBias[k]!])) as any,informationValue:Object.fromEntries(ACTIONS.map((a,k)=>[a,infoVals[k]!])) as any,risk:Object.fromEntries(ACTIONS.map((a,k)=>[a,risks[k]!])) as any,expectedInfoGain01:selectedInfo,epistemicPressure01:pressure,epistemicEfficiency01:eff,selectedAction:selected,selectedScore01:scores[idx]??.5};
    this.lastFrame=out;return out;
  }

  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predicted01?:number;verified01:number;previousUncertainty01:number;nextUncertainty01:number;predictionError01:number}){
    const idx=Math.max(0,ACTIONS.indexOf(i.action));
    const observed=clamp(i.previousUncertainty01-i.nextUncertainty01+.08*clamp(i.verified01));
    const reward=clamp(i.reward01),pred=clamp(i.predicted01??.5),err=Math.abs(reward-pred);
    const s=this.state.actionStats[i.action]??this.state.actionStats.wait;
    const lr=.08/Math.sqrt(1+this.state.outcomes/2000);
    s.count++;s.infoGain01=clamp(s.infoGain01*(1-lr)+observed*lr);s.reward01=clamp(s.reward01*(1-lr)+reward*lr);s.predictionError01=clamp(s.predictionError01*.94+err*.06);s.confidence01=clamp(s.confidence01*.95+(1-err)*.05);
    this.state.actionInfoGain[idx]=clamp(this.state.actionInfoGain[idx]!*0.92+s.infoGain01*.08);
    this.state.observedInfoGain01=observed;this.state.outcomes++;this.state.learningUpdates++;
    const efficiency=clamp(observed/(.05+this.state.risk01));
    this.state.epistemicEfficiency01=clamp(this.state.epistemicEfficiency01*.92+efficiency*.08);
    this.state.sampleEfficiency01=clamp(this.state.sampleEfficiency01*.94+(observed+.5*reward-.35*err)*.06);
    const expected=this.state.expectedInfoGain01;
    const causal=clamp(Math.abs(expected-observed)+Math.abs(this.state.selectedScore01-reward)*.25);
    this.state.causalEffect01=clamp(this.state.causalEffect01*.90+causal*.10);
    this.state.tick=i.tick;
  }

  lesion(fraction01=.5){const before=this.lastFrame?.selectedScore01??.5;const prev=this.state.lesionFraction01;this.state.lesionFraction01=clamp(fraction01);if(this.lastFrame){const after=before-Math.abs(this.lastFrame.actionBias[this.state.selectedAction]??0)*fraction01;this.state.causalEffect01=clamp(Math.abs(before-after));}this.state.lesionFraction01=prev;return {causalEffect01:this.state.causalEffect01,fraction01:clamp(fraction01)};}
  diagnostics(){return structuredClone(this.state);}
}
