import type { ActionKind } from '../core/types.ts';

export type P50NodeKind = 'self'|'world'|'action'|'outcome'|'belief'|'goal';
export interface P50Node { id:string; kind:P50NodeKind; label:string; confidence01:number; lastAt:number; }
export interface P50Edge { from:string; to:string; relation:'causes'|'predicts'|'supports'|'contradicts'|'precedes'; strength01:number; observations:number; lastAt:number; }
export interface P50Counterfactual { id:string; action:ActionKind; predictedReward01:number; actualReward01:number; regret01:number; confidence01:number; at:number; }
export interface P50State {
  version:1; samples:number; interventions:number; correctAttributions:number; totalAttributions:number;
  meanCausalError01:number; selfWorldAlignment01:number; counterfactuals:number; unresolvedCausalQuestions:number;
  nodes:P50Node[]; edges:P50Edge[]; counterfactualHistory:P50Counterfactual[]; lastExplanation:string;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const hash=(s:string)=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(16)};
export const defaultP50=():P50State=>({version:1,samples:0,interventions:0,correctAttributions:0,totalAttributions:0,meanCausalError01:.5,selfWorldAlignment01:.5,counterfactuals:0,unresolvedCausalQuestions:0,nodes:[],edges:[],counterfactualHistory:[],lastExplanation:''});
export class P50CausalSelfWorldEngine {
  private state=defaultP50();
  restore(raw?:Partial<P50State>|null){const d=defaultP50(),r=raw??{};this.state={...d,...r,nodes:Array.isArray(r.nodes)?r.nodes.slice(-256):[],edges:Array.isArray(r.edges)?r.edges.slice(-512):[],counterfactualHistory:Array.isArray(r.counterfactualHistory)?r.counterfactualHistory.slice(-128):[]};}
  snapshot(){return structuredClone(this.state);}
  private upsertNode(kind:P50NodeKind,label:string,confidence01:number,at:number){const id=`${kind}:${hash(label)}`;const found=this.state.nodes.find(n=>n.id===id);if(found){found.confidence01=clamp(found.confidence01*.88+confidence01*.12);found.lastAt=at;return id;}this.state.nodes.push({id,kind,label:label.slice(0,160),confidence01:clamp(confidence01),lastAt:at});this.state.nodes=this.state.nodes.slice(-256);return id;}
  private edge(from:string,to:string,relation:P50Edge['relation'],strength01:number,at:number){const id=`${from}|${relation}|${to}`;const e=this.state.edges.find(x=>`${x.from}|${x.relation}|${x.to}`===id);if(e){e.strength01=clamp(e.strength01*.86+strength01*.14);e.observations++;e.lastAt=at;return;}this.state.edges.push({from,to,relation,strength01:clamp(strength01),observations:1,lastAt:at});this.state.edges=this.state.edges.slice(-512);}
  observe(input:{at:number;action:ActionKind;success01:number;reward01:number;predictionConfidence01:number;predictionError01:number;selfStateLabel:string;worldStateLabel:string}, options:{clone?:boolean}={}):P50State{
    const at=input.at, self=this.upsertNode('self',input.selfStateLabel,1-input.predictionError01,at), world=this.upsertNode('world',input.worldStateLabel,1-input.predictionError01,at), action=this.upsertNode('action',input.action, input.predictionConfidence01,at), outcome=this.upsertNode('outcome',`success:${input.success01>=.5}:reward:${input.reward01.toFixed(2)}`,input.predictionConfidence01,at);
    this.edge(action,outcome,'causes',clamp(1-input.predictionError01),at);this.edge(self,action,'predicts',input.predictionConfidence01,at);this.edge(world,outcome,'supports',clamp(input.success01),at);
    const attributionError=clamp(Math.abs((input.predictionConfidence01-(input.success01)))*.7+input.predictionError01*.3);this.state.meanCausalError01=clamp(this.state.meanCausalError01*.92+attributionError*.08);this.state.selfWorldAlignment01=clamp(this.state.selfWorldAlignment01*.94+(1-attributionError)*.06);this.state.samples++;this.state.totalAttributions++;
    if(attributionError<.35)this.state.correctAttributions++; else this.state.unresolvedCausalQuestions++;
    this.state.lastExplanation=`${input.action}→${input.success01>=.5?'successful':'unsuccessful'} outcome; causalError=${attributionError.toFixed(3)}`;
    return options.clone===false?this.state:this.snapshot();
  }
  intervene(target:string, predicted01:number, actual01:number, at=Date.now()){this.state.interventions++;const err=clamp(Math.abs(predicted01-actual01));this.state.meanCausalError01=clamp(this.state.meanCausalError01*.88+err*.12);const id=`cf:${hash(`${target}|${at}|${this.state.interventions}`)}`;this.state.unresolvedCausalQuestions=err>.45?this.state.unresolvedCausalQuestions+1:Math.max(0,this.state.unresolvedCausalQuestions-1);return id;}
  counterfactual(action:ActionKind,predictedReward01:number,actualReward01:number,confidence01:number,at=Date.now()){const regret=clamp(Math.abs(predictedReward01-actualReward01));this.state.counterfactualHistory.unshift({id:`cf:${hash(`${action}|${at}|${this.state.counterfactuals}`)}`,action,predictedReward01:clamp(predictedReward01),actualReward01:clamp(actualReward01),regret01:regret,confidence01:clamp(confidence01),at});this.state.counterfactualHistory=this.state.counterfactualHistory.slice(0,128);this.state.counterfactuals++;this.state.meanCausalError01=clamp(this.state.meanCausalError01*.9+regret*.1);return this.snapshot();}
  summary(){return {samples:this.state.samples,interventions:this.state.interventions,causalError01:this.state.meanCausalError01,selfWorldAlignment01:this.state.selfWorldAlignment01,counterfactuals:this.state.counterfactuals,unresolvedCausalQuestions:this.state.unresolvedCausalQuestions,lastExplanation:this.state.lastExplanation};}
}
