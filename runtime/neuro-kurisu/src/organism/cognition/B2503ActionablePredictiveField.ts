import type { ActionKind } from '../core/types.ts';
import { cosineSimilarity01 as cosine } from '../core/NumericPrimitives.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));

const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:.5;

export interface B2503Transition{state:number[];next:number[];action:ActionKind;reward01:number;confidence01:number;surprise01:number;mass01:number;tick:number;verified01:number}
export interface B2503State{version:1;enabled:boolean;tick:number;cycles:number;learningUpdates:number;rollouts:number;predictionError01:number;uncertainty01:number;calibration01:number;causalEffect01:number;actionPredictions:number[];actionUncertainty:number[];actionBias:number[];transitions:B2503Transition[];lastState:number[];lastPredictions:number[];horizon:number;lesion:boolean}
export interface B2503Input{tick:number;state01:number[];baseUtilities:Record<ActionKind,number>;uncertainty01:number;predictionError01:number;novelty01:number;energy01:number;goalPressure01:number;body01?:number[];self01?:number[]}
export interface B2503Output{predictedUtility:Record<ActionKind,number>;predictionConfidence:Record<ActionKind,number>;predictionUncertainty:Record<ActionKind,number>;actionBias:Record<ActionKind,number>;counterfactualSpread01:number;informationGain01:number;bottleneckGate:Record<ActionKind,number>;selectedAction:ActionKind}

export const defaultB2503State=():B2503State=>({version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,rollouts:0,predictionError01:.45,uncertainty01:.5,calibration01:.5,causalEffect01:0,actionPredictions:ACTIONS.map(()=>.5),actionUncertainty:ACTIONS.map(()=>.5),actionBias:ACTIONS.map(()=>0),transitions:[],lastState:Array(24).fill(.5),lastPredictions:ACTIONS.map(()=>.5),horizon:3,lesion:false});

export class B2503ActionablePredictiveField{
 readonly systemName='cognition:b2503-actionable-predictive-field' as const; private state=defaultB2503State();
 snapshot(){return structuredClone(this.state);}
 restore(raw?:Partial<B2503State>|null){const d=defaultB2503State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,transitions:Array.isArray(r.transitions)?r.transitions.slice(-128):[],lastState:Array.from({length:24},(_,i)=>clamp(r.lastState?.[i]??.5)),lastPredictions:ACTIONS.map((_,i)=>clamp(r.lastPredictions?.[i]??.5))};}
 setEnabled(x:boolean){this.state.enabled=!!x;} setHorizon(h:1|2|3|4){this.state.horizon=h;}
 private nearest(state:number[],action:ActionKind){return this.state.transitions.filter(t=>t.action===action).map(t=>({t,q:cosine(state,t.state)})).sort((a,b)=>b.q-a.q).slice(0,6);}
 private project(current:number[],action:ActionKind){
   let cur=current.slice(),reward=0,conf=0,unc=0,ig=0;
   for(let h=0;h<this.state.horizon;h++){
     const near=this.nearest(cur,action);
     if(!near.length){reward+=.5;conf+=.18;unc+=.76;ig+=.22;continue;}
     const w=near.reduce((z,x)=>z+Math.max(0,x.q-.45)*x.t.mass01,0)||.01; const next=Array(cur.length).fill(.5); let rr=0,cc=0;
     for(const x of near){const ww=Math.max(0,x.q-.45)*x.t.mass01/w;for(let k=0;k<next.length;k++)next[k]=next[k]!*(1-ww)+x.t.next[k]! *ww;rr+=ww*x.t.reward01;cc+=ww*x.t.confidence01;}
     reward+=rr;conf+=cc;const spread=near.reduce((z,x)=>z+Math.abs(x.t.reward01-rr),0)/near.length;unc+=clamp(.22+spread+.35*(1-near[0]!.q));ig+=clamp(1-near[0]!.q);cur=next;
   }
   const h=this.state.horizon; return {reward:clamp(reward/h),confidence:clamp(conf/h),uncertainty:clamp(unc/h),next:cur,ig:clamp(ig/h)};
 }
 beforeDecision(i:B2503Input):B2503Output{
   const base=ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5));
   if(!this.state.enabled){const a=ACTIONS[base.indexOf(Math.max(...base))]??'wait';return{predictedUtility:Object.fromEntries(ACTIONS.map((x,k)=>[x,base[k]])) as any,predictionConfidence:Object.fromEntries(ACTIONS.map(x=>[x,.5])) as any,predictionUncertainty:Object.fromEntries(ACTIONS.map(x=>[x,.5])) as any,actionBias:Object.fromEntries(ACTIONS.map(x=>[x,0])) as any,counterfactualSpread01:0,informationGain01:0,bottleneckGate:Object.fromEntries(ACTIONS.map(x=>[x,.5])) as any,selectedAction:a};}
   const state=Array.from({length:24},(_,k)=>clamp(i.state01[k%i.state01.length]??.5)); const preds:number[]=[],confs:number[]=[],uncs:number[]=[],igs:number[]=[];
   for(const a of ACTIONS){const p=this.project(state,a);preds.push(p.reward);confs.push(p.confidence);uncs.push(p.uncertainty);igs.push(p.ig);}
   const spread=Math.max(...preds)-Math.min(...preds), meanIg=mean(igs);
   const precision=clamp(.25+.35*(1-i.uncertainty01)+.20*(1-i.predictionError01)+.20*this.state.calibration01);
   const bias=preds.map((u,k)=>clamp((u-base[k])*(.18+.26*precision),-.11,.11));
   const gate=preds.map((u,k)=>clamp(.45+.38*precision+.17*(1-uncs[k])+(u>=Math.max(...preds)-spread*.35?.03:0)));
   const scores=preds.map((u,k)=>u+base[k]*.36+bias[k]!); const chosen=ACTIONS[scores.indexOf(Math.max(...scores))]??'wait';
   this.state.tick=i.tick;this.state.cycles++;this.state.rollouts+=ACTIONS.length*this.state.horizon;this.state.lastState=state;this.state.lastPredictions=preds;this.state.actionPredictions=preds;this.state.actionUncertainty=uncs;this.state.actionBias=bias;this.state.uncertainty01=mean(uncs);this.state.calibration01=clamp(this.state.calibration01*.95+.05*(1-this.state.uncertainty01));
   return{predictedUtility:Object.fromEntries(ACTIONS.map((a,k)=>[a,preds[k]!])) as any,predictionConfidence:Object.fromEntries(ACTIONS.map((a,k)=>[a,confs[k]!])) as any,predictionUncertainty:Object.fromEntries(ACTIONS.map((a,k)=>[a,uncs[k]!])) as any,actionBias:Object.fromEntries(ACTIONS.map((a,k)=>[a,bias[k]!])) as any,counterfactualSpread01:clamp(spread),informationGain01:meanIg,bottleneckGate:Object.fromEntries(ACTIONS.map((a,k)=>[a,gate[k]!])) as any,selectedAction:chosen};
 }
 afterOutcome(i:{tick:number;action:ActionKind;reward01:number;nextState01?:number[];predictionError01:number;verified01:number;salience01?:number}){
   if(!this.state.enabled)return; const ai=ACTIONS.indexOf(i.action),actual=clamp(i.reward01),pred=this.state.lastPredictions[ai]??.5,err=Math.abs(actual-pred);
   this.state.predictionError01=clamp(this.state.predictionError01*.88+err*.12); this.state.learningUpdates++;
   const state=this.state.lastState.slice(),next=Array.from({length:24},(_,k)=>clamp(i.nextState01?.[k]??state[k]??.5)); const near=this.nearest(state,i.action)[0];
   if(near&&near.q>.94){const rate=.06+.08*clamp(i.verified01);for(let k=0;k<24;k++)near.t.next[k]=clamp(near.t.next[k]!*(1-rate)+next[k]! *rate);near.t.reward01=clamp(near.t.reward01*(1-rate)+actual*rate);near.t.confidence01=clamp(near.t.confidence01*.92+.08*(1-err));near.t.surprise01=clamp(near.t.surprise01*.90+.10*err);near.t.mass01=clamp(near.t.mass01*.95+.05*clamp(i.verified01));}
   else this.state.transitions.push({state,next,action:i.action,reward01:actual,confidence01:clamp(1-err),surprise01:err,mass01:.35+.65*clamp(i.verified01),tick:i.tick,verified01:clamp(i.verified01)});
   if(this.state.transitions.length>128)this.state.transitions.splice(0,this.state.transitions.length-128); this.state.calibration01=clamp(this.state.calibration01*.9+.1*(1-err));
 }
 diagnostics(){return{enabled:this.state.enabled,cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,rollouts:this.state.rollouts,transitionCount:this.state.transitions.length,predictionError01:this.state.predictionError01,uncertainty01:this.state.uncertainty01,calibration01:this.state.calibration01,causalEffect01:this.state.causalEffect01,horizon:this.state.horizon,actionPredictions:this.state.actionPredictions.slice(),actionUncertainty:this.state.actionUncertainty.slice()};}
 lesionFraction(f=.5){
   const n=Math.max(1,Math.floor(this.state.transitions.length*clamp(f)));
   const before=this.state.actionPredictions.slice();
   for(let k=0;k<n;k++)this.state.transitions[k]!.mass01=0;
   this.state.lesion=true;
   const base=Object.fromEntries(ACTIONS.map((a,k)=>[a,before[k]??.5])) as Record<ActionKind,number>;
   const out=this.beforeDecision({tick:this.state.tick+1,state01:this.state.lastState,baseUtilities:base,uncertainty01:.5,predictionError01:this.state.predictionError01,novelty01:.4,energy01:.7,goalPressure01:.5});
   const after=ACTIONS.map(a=>out.predictedUtility[a]??.5);
   const effect=before.reduce((z,x,i)=>z+Math.abs(x-(after[i]??x)),0)/ACTIONS.length;
   this.state.causalEffect01=Math.max(this.state.causalEffect01,effect);
   return{effect01:effect,lesioned:n,total:this.state.transitions.length};
 }
}
