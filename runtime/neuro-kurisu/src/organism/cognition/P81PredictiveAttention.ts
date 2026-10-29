export interface P81Candidate { action:string; score:number; predictedUtility:number; confidence:number; }
export interface P81Input { tick:number; candidates:P81Candidate[]; uncertainty01:number; predictionError01:number; goalPressure01:number; noveltyPressure01:number; attentionBudget01:number; externalInput:boolean; }
export interface P81State { version:1; cycles:number; selectedAction:string; attentionFocus:string; expectedInformationGain01:number; exploitation01:number; exploration01:number; uncertainty01:number; recentFocus:string[]; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultP81=():P81State=>({version:1,cycles:0,selectedAction:'wait',attentionFocus:'none',expectedInformationGain01:0.2,exploitation01:.5,exploration01:.5,uncertainty01:.35,recentFocus:[]});
export class P81PredictiveAttention {
 private state=defaultP81();
 restore(raw:Partial<P81State>|undefined){
   if(!raw||typeof raw!=='object')return;
   const d=defaultP81();
   // WorkPass-A03: a persisted state could smuggle non-finite metrics or an
   // unrestricted action string into candidate ranking.
   this.state={...d,...raw,
     cycles:typeof raw.cycles==='number'&&Number.isSafeInteger(raw.cycles)&&raw.cycles>=0?raw.cycles:0,
     selectedAction:typeof raw.selectedAction==='string'?raw.selectedAction.slice(0,32):d.selectedAction,
     attentionFocus:typeof raw.attentionFocus==='string'?raw.attentionFocus.slice(0,32):d.attentionFocus,
     expectedInformationGain01:clamp(raw.expectedInformationGain01 as number),
     exploitation01:clamp(raw.exploitation01 as number),
     exploration01:clamp(raw.exploration01 as number),
     uncertainty01:clamp(raw.uncertainty01 as number),
     recentFocus:Array.isArray(raw.recentFocus)?raw.recentFocus.filter((x):x is string=>typeof x==='string').slice(-24):[]};
 }
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P81State;}
 evaluate(i:P81Input){
  // Non-finite or missing candidates used to either score as NaN (breaking the
  // comparator) or crash on `[...undefined]`.
  const candidates=Array.isArray(i.candidates)?i.candidates.filter(c=>c&&typeof c==='object'&&typeof c.action==='string'&&c.action.length>0).slice(0,32):[];
  const uncertainty=clamp(i.uncertainty01); const novelty=clamp(i.noveltyPressure01); const attention=clamp(i.attentionBudget01);
  const predictionError=clamp(i.predictionError01);
  const expectedInfo=clamp(uncertainty*.45+predictionError*.25+novelty*.2+(1-attention)*.1);
  const exploration=clamp(expectedInfo*.72+novelty*.18); const exploitation=clamp(1-exploration);
  const utility=(c:P81Candidate)=>clamp(c.score)*.62+clamp(c.predictedUtility)*.18+clamp(c.confidence)*.08+(c.action==='explore'?exploration*.08:0)+(c.action==='verify'?expectedInfo*.08:0);
  const ranked=[...candidates].sort((a,b)=>utility(b)-utility(a)||(a.action<b.action?-1:a.action>b.action?1:0));
  const selected=ranked[0]?.action??'wait';
  const focus = uncertainty>.65?'uncertainty':clamp(i.goalPressure01)>.62?'goal':predictionError>.55?'prediction':novelty>.65?'novelty':'current';
  this.state.cycles++; this.state.selectedAction=selected; this.state.attentionFocus=focus; this.state.expectedInformationGain01=expectedInfo; this.state.exploitation01=exploitation; this.state.exploration01=exploration; this.state.uncertainty01=uncertainty; this.state.recentFocus=[...this.state.recentFocus,focus].slice(-24);
  return {selectedAction:selected,attentionFocus:focus,expectedInformationGain01:expectedInfo,exploration01:exploration,exploitation01:exploitation};
 }
 actionBias(action:string):number {
  const explorationBoost=(this.state.exploration01-(this.state.exploitation01))*0.055;
  if(action==='explore') return explorationBoost;
  if(action==='verify') return this.state.expectedInformationGain01*.045;
  if(action==='reflect') return this.state.attentionFocus==='uncertainty'?0.025:0;
  return 0;
 }
}
