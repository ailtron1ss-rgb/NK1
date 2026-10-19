/**
 * BIG PASS 165 — Memory Economy 2.0.
 *
 * Policy layer over the canonical MemoryOS2 store. This is intentionally not a
 * second memory database: it only scores, consolidates, and records evidence
 * about retention/reconsolidation decisions. Canonical bytes remain owned by
 * MemoryOS2.
 */
export type RetentionAction='retain'|'dormant'|'discard-candidate';
export type ConsolidationMode='preserve'|'strengthen'|'cool'|'quarantine-candidate';
export interface RetentionAssessment {
  id?:string;
  score01:number;
  action:RetentionAction;
  utility:{salience01:number;identity01:number;goal01:number;social01:number;prediction01:number;emotion01:number;recency01:number;novelty01:number;redundancyPenalty01:number;cost01:number};
  reason:string;
  consolidation:ConsolidationMode;
}
export interface MemoryConsolidationRecord {
  id:string; memoryId:string; tick:number; at:number; mode:ConsolidationMode;
  score01:number; emotionalGain01:number; identityGain01:number; goalGain01:number;
  reason:string;
}
export interface MemoryRetentionEconomyState {
  version:2;
  evaluations:number;
  retained:number;
  dormantCandidates:number;
  discardCandidates:number;
  consolidations:number;
  reconsolidations:number;
  meanScore01:number;
  meanRedundancyPenalty01:number;
  lastAt:number;
  lastTick:number;
  recent:RetentionAssessment[];
  consolidationHistory:MemoryConsolidationRecord[];
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const empty=():MemoryRetentionEconomyState=>({version:2,evaluations:0,retained:0,dormantCandidates:0,discardCandidates:0,consolidations:0,reconsolidations:0,meanScore01:0,meanRedundancyPenalty01:0,lastAt:0,lastTick:-1,recent:[],consolidationHistory:[]});
export class MemoryRetentionEconomy{
  private state=empty();
  restore(raw?:Partial<MemoryRetentionEconomyState>|null){
    const d=empty();
    this.state={...d,...(raw??{}),version:2,
      recent:Array.isArray(raw?.recent)?raw!.recent.slice(0,96).map((x:any)=>({...x,score01:clamp(Number(x?.score01??0)),consolidation:['preserve','strengthen','cool','quarantine-candidate'].includes(x?.consolidation)?x.consolidation:'preserve'})):[],
      consolidationHistory:Array.isArray((raw as any)?.consolidationHistory)?(raw as any).consolidationHistory.slice(0,128):[]};
  }
  assess(input:{tick:number;at?:number;id?:string;salience01?:number;identity01?:number;goal01?:number;social01?:number;predictionError01?:number;emotion01?:number;recency01?:number;novelty01?:number;redundancy01?:number;storageCost01?:number;pressure01?:number}):RetentionAssessment{
    const u={salience01:clamp(input.salience01??0),identity01:clamp(input.identity01??0),goal01:clamp(input.goal01??0),social01:clamp(input.social01??0),prediction01:clamp(input.predictionError01??0),emotion01:clamp(input.emotion01??0),recency01:clamp(input.recency01??0),novelty01:clamp(input.novelty01??0),redundancyPenalty01:clamp(input.redundancy01??0),cost01:clamp(input.storageCost01??0)};
    const pressure=clamp(input.pressure01??0);
    const positive=.18*u.salience01+.18*u.identity01+.15*u.goal01+.09*u.social01+.14*u.prediction01+.10*u.emotion01+.07*u.recency01+.09*u.novelty01;
    const score=clamp(positive-u.redundancyPenalty01*.15-u.cost01*.08+pressure*.04);
    const action:RetentionAction=score>=.40?'retain':score>=.22?'dormant':'discard-candidate';
    const consolidation:ConsolidationMode=action==='retain'?(u.emotion01>.62||u.identity01>.7||u.goal01>.72?'strengthen':'preserve'):action==='dormant'?'cool':'quarantine-candidate';
    const reason=action==='retain'?'future-value-dominates-cost':action==='dormant'?'useful-but-low-current-pressure':'low-future-value-or-high-redundancy';
    const assessment={id:input.id,score01:score,action,utility:u,reason,consolidation};
    const next=this.state.evaluations+1;
    this.state={...this.state,evaluations:next,retained:this.state.retained+(action==='retain'?1:0),dormantCandidates:this.state.dormantCandidates+(action==='dormant'?1:0),discardCandidates:this.state.discardCandidates+(action==='discard-candidate'?1:0),meanScore01:clamp(this.state.meanScore01*(next-1)/next+score/next),meanRedundancyPenalty01:clamp(this.state.meanRedundancyPenalty01*(next-1)/next+u.redundancyPenalty01/next),lastAt:Number(input.at??Date.now()),lastTick:Math.max(0,Math.floor(input.tick)),recent:[assessment,...this.state.recent].slice(0,96)};
    return structuredClone(assessment);
  }
  recordConsolidation(input:{memoryId:string;tick:number;at?:number;mode:ConsolidationMode;score01?:number;emotionalGain01?:number;identityGain01?:number;goalGain01?:number;reason:string}){
    const row:MemoryConsolidationRecord={id:`mcon:${input.at??Date.now()}:${this.state.consolidations+1}`,memoryId:String(input.memoryId),tick:Math.max(0,Math.floor(input.tick)),at:Number(input.at??Date.now()),mode:input.mode,score01:clamp(input.score01??0),emotionalGain01:clamp(input.emotionalGain01??0),identityGain01:clamp(input.identityGain01??0),goalGain01:clamp(input.goalGain01??0),reason:String(input.reason).slice(0,240)};
    const isRecon=input.mode==='strengthen'||input.mode==='cool';
    this.state={...this.state,consolidations:this.state.consolidations+1,reconsolidations:this.state.reconsolidations+(isRecon?1:0),consolidationHistory:[row,...this.state.consolidationHistory].slice(0,128)};
    return structuredClone(row);
  }
  snapshot(){return structuredClone(this.state);}
}
export const defaultMemoryRetentionEconomy=()=>empty();
