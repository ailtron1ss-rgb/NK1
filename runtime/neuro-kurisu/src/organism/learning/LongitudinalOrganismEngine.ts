import type { ActionKind, OrganismDecisionTrace } from '../core/types.ts';
import type { AdaptivePolicyEngine } from './AdaptivePolicyEngine.ts';
import type { WorldModel2State } from '../developmental/WorldModel2.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface LongitudinalMilestoneRecord {
  id:string;
  kind:'learning'|'memory'|'causal'|'resilience'|'continuity';
  title:string;
  at:number;
  evidence:string[];
  score:number;
}

export interface LongitudinalOrganismState {
  version:1;
  observedCycles:number;
  completedOutcomes:number;
  sleepConsolidations:number;
  replayUpdates:number;
  replayedTraces:number;
  replayedTraceIds:string[];
  causalEvidence01:number;
  predictionCalibration01:number;
  resilience01:number;
  learningDelta01:number;
  behaviorEntropy01:number;
  continuity01:number;
  recoveryCount:number;
  degradedModeEntries:number;
  anomalyCount:number;
  lastHealthAt:number;
  lastHealth:{predictionError:number;calibrationError:number;memoryCount:number;policyUpdates:number;worldTransitions:number;stateSizeBytes?:number;latencyMs?:number;};
  milestones:LongitudinalMilestoneRecord[];
  lastConsolidationAt:number;
}

export const defaultLongitudinalOrganism=():LongitudinalOrganismState=>({
  version:1,observedCycles:0,completedOutcomes:0,sleepConsolidations:0,replayUpdates:0,replayedTraces:0,replayedTraceIds:[],
  causalEvidence01:0,predictionCalibration01:0,resilience01:0,learningDelta01:0,behaviorEntropy01:0,continuity01:1,recoveryCount:0,
  degradedModeEntries:0,anomalyCount:0,lastHealthAt:0,lastHealth:{predictionError:0,calibrationError:1,memoryCount:0,policyUpdates:0,worldTransitions:0},milestones:[],lastConsolidationAt:0,
});

function entropy01(counts:Partial<Record<ActionKind,number>>){
  const total=Object.values(counts).reduce((a,b)=>a+Number(b||0),0); if(total<=1)return 0;
  const raw=ACTIONS.reduce((h,a)=>{const p=Number(counts[a]||0)/total; return p>0?h-p*Math.log2(p):h;},0);
  return clamp(raw/Math.log2(ACTIONS.length));
}

export class LongitudinalOrganismEngine {
  private state=defaultLongitudinalOrganism();
  restore(value?:Partial<LongitudinalOrganismState>|null){
    this.state={...defaultLongitudinalOrganism(),...(value??{}),lastHealth:{...defaultLongitudinalOrganism().lastHealth,...(value?.lastHealth??{})},milestones:Array.isArray(value?.milestones)?value!.milestones.slice(0,256):[],replayedTraceIds:Array.isArray(value?.replayedTraceIds)?value!.replayedTraceIds.slice(-1024):[]};
  }
  snapshot(){return structuredClone(this.state);}
  observeCycle(input:{predictionError:number;memoryCount:number;policyUpdates:number;worldTransitions:number;continuity01:number}){
    this.state.observedCycles++;
    this.state.continuity01=clamp(input.continuity01);
    if(this.state.observedCycles===1 || this.state.observedCycles%50===0){
      this.milestone('continuity',`Longitudinal checkpoint ${this.state.observedCycles} cycles`,[`cycles=${this.state.observedCycles}`,`memory=${input.memoryCount}`,`policyUpdates=${input.policyUpdates}`],clamp((1-input.predictionError)*.45+input.continuity01*.55));
    }
  }
  recordOutcome(success:number){this.state.completedOutcomes++; if(this.state.completedOutcomes%25===0)this.milestone('learning',`Outcome learning checkpoint ${this.state.completedOutcomes}`,[`outcomes=${this.state.completedOutcomes}`,`success=${clamp(success).toFixed(3)}`],clamp(success));}
  replay(traceList:OrganismDecisionTrace[],policy:AdaptivePolicyEngine){
    let updates=0;
    const replayed=new Set(this.state.replayedTraceIds);
    for(const trace of traceList.slice(0,96)){
      if(!trace.outcome || replayed.has(trace.id) || !trace.selected)continue;
      const beforeState=trace.stateBefore;
      const afterState=trace.stateAfter;
      if(!afterState) continue;
      const before=policy.contextKey(beforeState, beforeState.needs.goalPressure);
      const after=policy.contextKey(afterState, afterState.needs.goalPressure);
      policy.update(before,trace.selected.action,clamp(trace.outcome.success??.5),after,ACTIONS,.10,.68,clamp(trace.outcome.surprise??.2));
      this.state.replayedTraceIds.push(trace.id); replayed.add(trace.id); updates++;
    }
    if(updates){this.state.replayedTraceIds=this.state.replayedTraceIds.slice(-1024);this.state.replayUpdates+=updates;this.state.replayedTraces+=updates;this.state.lastConsolidationAt=Date.now();}
    return updates;
  }
  consolidateMemory(input:{items:Array<{id:string;epistemicStatus:string;confidence:number;source:string;entities:string[];semanticLinks:string[];predictionError:number}>}){
    const repeated=new Map<string,number>();
    for(const item of input.items){for(const e of item.entities.slice(0,8)) repeated.set(e,(repeated.get(e)||0)+1);}
    let promoted=0;
    for(const item of input.items){const repeatedEntity=item.entities.some(e=>(repeated.get(e)||0)>=3); if(item.epistemicStatus==='hypothesis'&&item.confidence>=.74&&item.predictionError<.35&&repeatedEntity){promoted++;}}
    this.state.sleepConsolidations++;
    if(promoted)this.milestone('memory',`Memory consolidation promoted ${promoted} repeated hypotheses`,[`items=${input.items.length}`,`promoted=${promoted}`],clamp(promoted/4));
    return promoted;
  }
  evaluate(world:WorldModel2State, calibrationError:number, recentTraces:OrganismDecisionTrace[], continuity01:number, runtime?:{latencyMs?:number;stateSizeBytes?:number}){
    const counts:Partial<Record<ActionKind,number>>={};
    for(const t of recentTraces.slice(0,128)) if(t.selected) counts[t.selected.action]=(counts[t.selected.action]||0)+1;
    const error=clamp(calibrationError);
    const causalRows=(world.causal??[]).filter(x=>x.samples>=3);
    const causal=causalRows.length?clamp(causalRows.reduce((s,x)=>s+clamp(x.confidence),0)/causalRows.length):0;
    const resilience=clamp((1-error)*.35 + (1-clamp(this.lastHealth().predictionError))*.35 + clamp(continuity01)*.2 + (runtime?.stateSizeBytes&&runtime.stateSizeBytes<8_000_000?0.1:0));
    this.state.causalEvidence01=causal;
    this.state.predictionCalibration01=clamp(1-error);
    this.state.resilience01=resilience;
    this.state.behaviorEntropy01=entropy01(counts);
    this.state.continuity01=clamp(continuity01);
    this.state.lastHealthAt=Date.now();
    this.state.lastHealth={predictionError:this.lastHealth().predictionError,calibrationError:error,memoryCount:this.lastHealth().memoryCount,policyUpdates:this.lastHealth().policyUpdates,worldTransitions:world.learnedTransitions,stateSizeBytes:runtime?.stateSizeBytes,latencyMs:runtime?.latencyMs};
    if(resilience<.35)this.state.degradedModeEntries++;
    if(error>.55||this.lastHealth().predictionError>.75)this.state.anomalyCount++;
    return this.snapshot();
  }
  updateHealth(input:{predictionError:number;memoryCount:number;policyUpdates:number;worldTransitions:number;latencyMs?:number;stateSizeBytes?:number;continuity01:number;calibrationError:number}){
    this.state.lastHealth={predictionError:clamp(input.predictionError),calibrationError:clamp(input.calibrationError),memoryCount:input.memoryCount,policyUpdates:input.policyUpdates,worldTransitions:input.worldTransitions,stateSizeBytes:input.stateSizeBytes,latencyMs:input.latencyMs};
  }
  markRecovery(reason:string){this.state.recoveryCount++;this.milestone('resilience','Runtime recovery recorded',[reason,`recovery=${this.state.recoveryCount}`],clamp(.7-this.state.recoveryCount*.01));}
  markAnomaly(reason:string){this.state.anomalyCount++;this.milestone('resilience','Runtime anomaly recorded',[reason],.25);}
  lastHealth(){return this.state.lastHealth;}
  private milestone(kind:LongitudinalMilestoneRecord['kind'],title:string,evidence:string[],score:number){
    const id=`p18-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.state.milestones=[{id,kind,title,at:Date.now(),evidence,score:clamp(score)},...this.state.milestones].slice(0,256);
  }
}
