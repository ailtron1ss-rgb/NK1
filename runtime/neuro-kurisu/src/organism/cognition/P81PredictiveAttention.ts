export interface P81Candidate { action:string; score:number; predictedUtility:number; confidence:number; }
export interface P81Input { tick:number; candidates:P81Candidate[]; uncertainty01:number; predictionError01:number; goalPressure01:number; noveltyPressure01:number; attentionBudget01:number; externalInput:boolean; }
export interface P81State { version:1; cycles:number; selectedAction:string; attentionFocus:string; expectedInformationGain01:number; exploitation01:number; exploration01:number; uncertainty01:number; recentFocus:string[]; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultP81=():P81State=>({version:1,cycles:0,selectedAction:'wait',attentionFocus:'none',expectedInformationGain01:0.2,exploitation01:.5,exploration01:.5,uncertainty01:.35,recentFocus:[]});
export class P81PredictiveAttention {
 private state=defaultP81();
 restore(raw:Partial<P81State>|undefined){if(!raw)return;const d=defaultP81();this.state={...d,...raw,recentFocus:Array.isArray(raw.recentFocus)?raw.recentFocus.slice(-24):[]};}
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P81State;}
 evaluate(i:P81Input){
  const candidates=i.candidates;
  const uncertainty=clamp(i.uncertainty01); const novelty=clamp(i.noveltyPressure01); const attention=clamp(i.attentionBudget01);
  const expectedInfo=clamp(uncertainty*.45+i.predictionError01*.25+novelty*.2+(1-attention)*.1);
  const exploration=clamp(expectedInfo*.72+novelty*.18); const exploitation=clamp(1-exploration);
  const ranked=[...candidates].sort((a,b)=>{
    const ai=a.score*.62+a.predictedUtility*.18+a.confidence*.08+(a.action==='explore'?exploration*.08:0)+(a.action==='verify'?expectedInfo*.08:0);
    const bi=b.score*.62+b.predictedUtility*.18+b.confidence*.08+(b.action==='explore'?exploration*.08:0)+(b.action==='verify'?expectedInfo*.08:0);
    return bi-ai;
  });
  const selected=ranked[0]?.action??'wait';
  const focus = uncertainty>.65?'uncertainty':i.goalPressure01>.62?'goal':i.predictionError01>.55?'prediction':novelty>.65?'novelty':'current';
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
