import { createHash } from 'node:crypto';
import type { ActionKind, IntentCandidate, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import type { AdaptivePolicyEngine, AdaptivePolicyState } from './AdaptivePolicyEngine.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const now = () => Date.now();
const safeText = (x:unknown,max=220) => String(x ?? '').slice(0,max);

function bucket(x:number, size=4) { return Math.max(0, Math.min(size-1, Math.round(clamp(x) * (size-1)))); }

export interface LearningExperience {
  id:string;
  traceId:string;
  tick:number;
  at:number;
  contextKey:string;
  nextContextKey:string;
  action:ActionKind;
  predictedUtility:number;
  predictedConfidence:number;
  success:number;
  reward:number;
  surprise:number;
  outcomeAt:number;
}

export interface ReplayUpdateRecord {
  id:string;
  traceId:string;
  contextKey:string;
  nextContextKey:string;
  action:ActionKind;
  reward:number;
  target:number;
  valueBefore:number;
  valueAfter:number;
  tdError:number;
  learningRate:number;
  at:number;
}

export interface ShadowEvaluationRecord {
  traceId:string;
  tick:number;
  contextKey:string;
  actual:ActionKind;
  baseline:ActionKind;
  agreed:boolean;
  actualSuccess:number;
  baselineWasBetterPrediction:boolean;
  baselineReason:string;
  at:number;
}

export interface PolicySkillRecord {
  id:string;
  contextKey:string;
  action:ActionKind;
  totalUses:number;
  trainUses:number;
  validationUses:number;
  trainSuccess01:number;
  validationSuccess01:number;
  confidence01:number;
  status:'candidate'|'promoted'|'rejected';
  createdAt:number;
  updatedAt:number;
  validationWindowStartTick:number;
  validationWindowEndTick:number;
}

export interface AblationRecord {
  traceId:string;
  tick:number;
  module:'adaptive-policy';
  actual:ActionKind;
  ablated:ActionKind;
  changed:boolean;
  scoreLoss01:number;
  reason:string;
  at:number;
}

export interface EvidenceDebtItem {
  id:string;
  contextKey:string;
  action:ActionKind;
  priority01:number;
  uncertainty01:number;
  estimatedVerificationCost01:number;
  informationGainPerCost01:number;
  reason:string;
  createdAt:number;
  lastSeenAt:number;
}

export interface CognitiveChecksum {
  digest:string;
  at:number;
  tick:number;
  verifiedAt:number;
  verificationFailures:number;
}

export interface P23LearningMetrics {
  outcomes:number;
  experiences:number;
  replayUpdates:number;
  shadowComparisons:number;
  shadowAgreement01:number;
  decisionPredictionComparisons:number;
  decisionPredictionCalibration01:number;
  /** @deprecated Compatibility alias; use decisionPredictionComparisons. */
  alternativePredictionComparisons:number;
  /** @deprecated Compatibility alias; use decisionPredictionCalibration01. */
  alternativePredictionCalibration01:number;
  /** @deprecated Compatibility alias; this is model-alternative calibration, not physical counterfactual intervention. */
  counterfactualComparisons:number;
  /** @deprecated Compatibility alias for alternativePredictionCalibration01. */
  counterfactualCalibration01:number;
  skillCandidates:number;
  skillPromotions:number;
  skillRejections:number;
  ablationComparisons:number;
  ablationChangedRate01:number;
  checksumFailures:number;
  evidenceDebtOpen:number;
  learningDelta01:number;
  predictionError01:number;
  recentPredictionError01:number;
  replayMeanAbsTdError01:number;
  lastLearningAt:number;
}

export interface P23LearningState {
  version:1;
  processedTraceIds:string[];
  replayedTraceIds:string[];
  experiences:LearningExperience[];
  replayUpdates:ReplayUpdateRecord[];
  shadow:ShadowEvaluationRecord[];
  skills:PolicySkillRecord[];
  ablations:AblationRecord[];
  evidenceDebt:EvidenceDebtItem[];
  checksum:CognitiveChecksum;
  metrics:P23LearningMetrics;
}

export const defaultP23Learning = ():P23LearningState => ({
  version:1,
  processedTraceIds:[],
  replayedTraceIds:[],
  experiences:[],
  replayUpdates:[],
  shadow:[],
  skills:[],
  ablations:[],
  evidenceDebt:[],
  checksum:{digest:'',at:0,tick:0,verifiedAt:0,verificationFailures:0},
  metrics:{outcomes:0,experiences:0,replayUpdates:0,shadowComparisons:0,shadowAgreement01:0,decisionPredictionComparisons:0,decisionPredictionCalibration01:0,alternativePredictionComparisons:0,alternativePredictionCalibration01:0,counterfactualComparisons:0,counterfactualCalibration01:0,skillCandidates:0,skillPromotions:0,skillRejections:0,ablationComparisons:0,ablationChangedRate01:0,checksumFailures:0,evidenceDebtOpen:0,learningDelta01:0,predictionError01:0,recentPredictionError01:0,replayMeanAbsTdError01:0,lastLearningAt:0},
});

function contextKey(state:Pick<OrganismState,'needs'>):string {
  const n=state.needs;
  return `e${bucket(n.energy)}|c${bucket(n.cognitiveLoad)}|u${bucket(n.uncertainty)}|n${bucket(n.novelty)}|g${bucket(n.goalPressure)}|s${bucket(n.socialNeed)}`;
}

/** Conservative nearest-context matching: transfer is allowed only when at least five of six normalized context buckets match. */
function contextSimilarity(a:string,b:string):number {
  const left=a.split('|'), right=b.split('|');
  if(left.length!==6 || right.length!==6) return 0;
  let matches=0;
  for(let i=0;i<6;i++) if(left[i]===right[i]) matches++;
  return matches/6;
}

function baselineAction(state:OrganismState):{action:ActionKind;reason:string} {
  const n=state.needs;
  if (n.energy < .28 || n.cognitiveLoad > .82) return {action:'rest',reason:'resource preservation'};
  if (n.uncertainty > .68 && n.novelty < .45) return {action:'verify',reason:'uncertainty-first baseline'};
  if (n.novelty > .66) return {action:'explore',reason:'novelty-first baseline'};
  if (n.socialNeed > .62) return {action:'respond',reason:'social-need baseline'};
  if (n.goalPressure > .68) return {action:'verify',reason:'goal-pressure baseline'};
  return {action:'reflect',reason:'low-pressure conservative baseline'};
}

function canonicalize(value:unknown):string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string,unknown>;
  return `{${Object.keys(obj).filter(k=>obj[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export class P23LearningEngine {
  private state = defaultP23Learning();

  restore(raw?:Partial<P23LearningState>|null):void {
    const d = defaultP23Learning();
    this.state = {
      ...d,
      ...(raw ?? {}),
      processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.slice(-2048):[],
      replayedTraceIds:Array.isArray(raw?.replayedTraceIds)?raw!.replayedTraceIds.slice(-2048):[],
      experiences:Array.isArray(raw?.experiences)?raw!.experiences.slice(-1024):[],
      replayUpdates:Array.isArray(raw?.replayUpdates)?raw!.replayUpdates.slice(-512):[],
      shadow:Array.isArray(raw?.shadow)?raw!.shadow.slice(-512):[],
      skills:Array.isArray(raw?.skills)?raw!.skills.slice(0,256):[],
      ablations:Array.isArray(raw?.ablations)?raw!.ablations.slice(-512):[],
      evidenceDebt:Array.isArray(raw?.evidenceDebt)?raw!.evidenceDebt.slice(0,256):[],
      checksum:{...d.checksum,...(raw?.checksum ?? {})},
      metrics:{...d.metrics,...(raw?.metrics ?? {})},
    };
    const restoredLastLearningAt = Number(raw?.metrics?.lastLearningAt ?? d.metrics.lastLearningAt);
    this.recomputeMetrics();
    this.state.metrics.lastLearningAt = restoredLastLearningAt;
  }

  snapshot():P23LearningState { return structuredClone(this.state); }

  recordExperience(trace:OrganismDecisionTrace,stateAfter:OrganismState,outcome:{success:number;reward:number;surprise:number},policy:AdaptivePolicyEngine):void {
    if (!trace.selected || this.state.processedTraceIds.includes(trace.id)) return;
    const key=contextKey(trace.stateBefore), nextKey=contextKey(stateAfter);
    const record:LearningExperience={
      id:`exp-${trace.id}`,
      traceId:trace.id,
      tick:trace.tick,
      at:trace.createdAt,
      contextKey:key,
      nextContextKey:nextKey,
      action:trace.selected.action,
      predictedUtility:clamp(trace.selected.predictedUtility),
      predictedConfidence:clamp(trace.selected.confidence),
      success:clamp(outcome.success),
      reward:clamp(outcome.reward),
      surprise:clamp(outcome.surprise),
      outcomeAt:now(),
    };
    this.state.experiences=[record,...this.state.experiences].slice(0,1024);
    this.state.processedTraceIds=[record.traceId,...this.state.processedTraceIds.filter(id=>id!==record.traceId)].slice(0,2048);
    this.state.metrics.outcomes++;
    this.state.metrics.experiences=this.state.experiences.length;
    this.state.metrics.lastLearningAt=now();
    this.updateEvidenceDebt(record);
    this.evaluateShadow(trace,outcome.success);
    this.evaluateAdaptiveAblation(trace, policy);
    this.recomputeSkills();
    this.recomputeMetrics();
  }

  replayPending(traces:OrganismDecisionTrace[],policy:AdaptivePolicyEngine):number {
    let updates=0;
    const ordered=traces.slice().sort((a,b)=>a.tick-b.tick);
    for (const trace of ordered) {
      if(!trace.selected || !trace.outcome || this.state.replayedTraceIds.includes(trace.id)) continue;
      const exp=this.state.experiences.find(x=>x.traceId===trace.id);
      if(!exp) continue;
      const before=policy.estimate(exp.contextKey,exp.action,.5);
      const nextValues=ACTIONS.map(a=>policy.estimate(exp.nextContextKey,a,.5).value);
      const target=clamp(exp.reward + .76*Math.max(...nextValues,0));
      const tdError=target-before.value;
      const lr=Math.min(.085,.035+exp.surprise*.05)/(1+Math.min(12,before.updates)*.08);
      policy.update(exp.contextKey,exp.action,exp.reward,exp.nextContextKey,ACTIONS,lr,.76,exp.surprise);
      const after=policy.estimate(exp.contextKey,exp.action,.5);
      this.state.replayUpdates=[{
        id:`replay-${trace.id}`,
        traceId:trace.id,
        contextKey:exp.contextKey,
        nextContextKey:exp.nextContextKey,
        action:exp.action,
        reward:exp.reward,
        target,
        valueBefore:before.value,
        valueAfter:after.value,
        tdError,
        learningRate:lr,
        at:now(),
      },...this.state.replayUpdates].slice(0,512);
      this.state.replayedTraceIds=[trace.id,...this.state.replayedTraceIds].slice(0,2048);
      updates++;
    }
    if(updates){
      this.state.metrics.replayUpdates += updates;
      this.state.metrics.lastLearningAt=now();
      this.recomputeSkills();
      this.recomputeMetrics();
    }
    return updates;
  }

  evaluateShadow(trace:OrganismDecisionTrace,success:number):ShadowEvaluationRecord|null {
    if(!trace.selected) return null;
    const baseline=baselineAction(trace.stateBefore);
    const predictedByActual=trace.predictedOutcomes.find(x=>x.action===trace.selected!.action)?.utility ?? trace.selected.predictedUtility;
    const predictedByBaseline=trace.predictedOutcomes.find(x=>x.action===baseline.action)?.utility ?? .5;
    const rec:ShadowEvaluationRecord={
      traceId:trace.id,tick:trace.tick,contextKey:contextKey(trace.stateBefore),actual:trace.selected.action,baseline:baseline.action,agreed:trace.selected.action===baseline.action,
      actualSuccess:clamp(success),baselineWasBetterPrediction:predictedByBaseline>predictedByActual+.08,baselineReason:baseline.reason,at:now(),
    };
    this.state.shadow=[rec,...this.state.shadow.filter(x=>x.traceId!==trace.id)].slice(0,512);
    this.state.metrics.shadowComparisons=this.state.shadow.length;
    this.recomputeMetrics();
    return structuredClone(rec);
  }

  evaluateAdaptiveAblation(trace:OrganismDecisionTrace,policy:AdaptivePolicyEngine):AblationRecord|null {
    if(!trace.selected) return null;
    const key=contextKey(trace.stateBefore);
    const scores=trace.candidates.map(candidate=>{
      const adaptiveBias=policy.bias(key,candidate.action,candidate.predictedUtility);
      return {...candidate, ablatedScore:candidate.score-adaptiveBias};
    });
    scores.sort((a,b)=>b.ablatedScore-a.ablatedScore);
    const ablated=scores[0]?.action ?? trace.selected.action;
    const actualScore=trace.candidates.find(c=>c.action===trace.selected!.action)?.score ?? trace.selected.score;
    const ablatedScore=scores.find(c=>c.action===trace.selected!.action)?.ablatedScore ?? actualScore;
    const rec:AblationRecord={traceId:trace.id,tick:trace.tick,module:'adaptive-policy',actual:trace.selected.action,ablated,changed:ablated!==trace.selected.action,scoreLoss01:clamp(actualScore-ablatedScore),reason:ablated!==trace.selected.action?'adaptive-policy changed action ranking':'adaptive-policy did not change top action',at:now()};
    this.state.ablations=[rec,...this.state.ablations.filter(x=>x.traceId!==trace.id)].slice(0,512);
    this.state.metrics.ablationComparisons=this.state.ablations.length;
    this.recomputeMetrics();
    return structuredClone(rec);
  }

  private recomputeSkills():void {
    const groups=new Map<string,LearningExperience[]>();
    for(const e of this.state.experiences){const key=`${e.contextKey}|${e.action}`; const arr=groups.get(key)??[]; arr.push(e); groups.set(key,arr);}
    let candidates=0;
    for(const [key,itemsRaw] of groups){
      const items=itemsRaw.slice().sort((a,b)=>a.tick-b.tick);
      if(items.length<8) continue;
      const train=Math.max(4,Math.floor(items.length*.6));
      const trainItems=items.slice(0,train), validation=items.slice(train);
      const trainSuccess=trainItems.reduce((s,x)=>s+x.success,0)/trainItems.length;
      const valSuccess=validation.reduce((s,x)=>s+x.success,0)/validation.length;
      const confidence=clamp(.25+Math.min(.5,items.length/24*.5)*(1-Math.abs(valSuccess-trainSuccess)));
      const action=items[0].action;
      const id=`p23-skill-${key}`;
      const existing=this.state.skills.find(s=>s.id===id);
      const status:PolicySkillRecord['status']=valSuccess>=.70 && trainSuccess>=.64 && confidence>=.4 ? 'promoted' : valSuccess<=.42 && validation.length>=4 ? 'rejected' : 'candidate';
      if(status==='candidate') candidates++;
      const record:PolicySkillRecord={id,contextKey:items[0].contextKey,action,totalUses:items.length,trainUses:train,validationUses:validation.length,trainSuccess01:clamp(trainSuccess),validationSuccess01:clamp(valSuccess),confidence01:confidence,status,createdAt:existing?.createdAt??now(),updatedAt:now(),validationWindowStartTick:validation[0]?.tick??items[0].tick,validationWindowEndTick:validation.at(-1)?.tick??items.at(-1)!.tick};
      if(!existing || status!==existing.status || Math.abs(record.validationSuccess01-existing.validationSuccess01)>.02){
        const idx=this.state.skills.findIndex(s=>s.id===id); if(idx>=0)this.state.skills[idx]=record; else this.state.skills.unshift(record);
      }
    }
    this.state.skills=this.state.skills.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,256);
    this.state.metrics.skillCandidates=candidates;
    this.state.metrics.skillPromotions=this.state.skills.filter(s=>s.status==='promoted').length;
    this.state.metrics.skillRejections=this.state.skills.filter(s=>s.status==='rejected').length;
  }

  topSkills(limit=12):PolicySkillRecord[]{return this.state.skills.filter(s=>s.status==='promoted').slice(0,limit).map(x=>structuredClone(x));}
  skillBias(state:OrganismState, action:ActionKind):number {
    const key=contextKey(state);
    const exact=this.state.skills.find(x=>x.contextKey===key&&x.action===action);
    if(exact){
      if(exact.status==='promoted') return clamp(exact.confidence01*.05);
      if(exact.status==='rejected') return -clamp(exact.confidence01*.03);
      return 0;
    }

    // Generalize a mastered skill only to a tightly neighboring state. SkillLearnBench
    // shows that transfer is not automatic, so this is deliberately weaker than an
    // exact match and requires a held-out validation window, not training success alone.
    let best=0;
    for(const row of this.state.skills){
      if(row.action!==action || row.status!=='promoted' || row.validationUses<4 ||
         row.validationSuccess01<.70 || row.confidence01<.4) continue;
      const similarity=contextSimilarity(key,row.contextKey);
      if(similarity<5/6) continue;
      const support=Math.min(1,row.validationUses/8);
      const transfer=clamp(row.confidence01*.02*((similarity-.70)/.30)*support);
      if(transfer>best) best=transfer;
    }
    return best;
  }
  verificationPressure01():number {
    return clamp(this.state.evidenceDebt.filter(x=>x.priority01>.45).reduce((m,x)=>Math.max(m,x.informationGainPerCost01),0));
  }

  evidenceDebt(limit=12):EvidenceDebtItem[]{return this.state.evidenceDebt.slice().sort((a,b)=>b.informationGainPerCost01-a.informationGainPerCost01).slice(0,limit).map(x=>structuredClone(x));}

  private updateEvidenceDebt(e:LearningExperience):void {
    const key=`${e.contextKey}|${e.action}`;
    let row=this.state.evidenceDebt.find(x=>x.id===`debt-${key}`);
    const uncertainty=clamp(.35 + Math.abs(e.success-e.predictedUtility)*.65 + e.surprise*.18);
    const priority=clamp(uncertainty*.72 + (1-e.predictedConfidence)*.28);
    const cost=clamp(.18 + e.predictedUtility*.32 + (e.action==='verify'?.05:0));
    const ig=clamp(priority/Math.max(.08,cost));
    if(e.action==='verify' && e.success>=.7){
      if(row){ row.priority01=clamp(row.priority01*.45); row.uncertainty01=clamp(row.uncertainty01*.55); row.lastSeenAt=now(); }
    } else if(!row){
      row={id:`debt-${key}`,contextKey:e.contextKey,action:e.action,priority01:priority,uncertainty01:uncertainty,estimatedVerificationCost01:cost,informationGainPerCost01:ig,reason:'observed outcome disagreed with or weakly supported prior prediction',createdAt:now(),lastSeenAt:now()};
      this.state.evidenceDebt=[row,...this.state.evidenceDebt].slice(0,256);
    } else {
      row.priority01=clamp(row.priority01*.82+priority*.18);row.uncertainty01=clamp(row.uncertainty01*.82+uncertainty*.18);row.informationGainPerCost01=clamp(row.informationGainPerCost01*.82+ig*.18);row.lastSeenAt=now();
    }
    this.state.evidenceDebt=this.state.evidenceDebt.filter(x=>x.priority01>.08).slice(0,256);
    this.state.metrics.evidenceDebtOpen=this.state.evidenceDebt.filter(x=>x.priority01>.45).length;
  }

  sealChecksum(material:unknown,tick:number):string {
    const digest=createHash('sha256').update(canonicalize(material)).digest('hex');
    this.state.checksum={digest,at:now(),tick,verifiedAt:this.state.checksum.verifiedAt,verificationFailures:this.state.checksum.verificationFailures};
    return digest;
  }

  verifyChecksum(material:unknown):boolean {
    if(!this.state.checksum.digest) { this.state.checksum.verifiedAt=now(); return true; }
    const digest=createHash('sha256').update(canonicalize(material)).digest('hex');
    const ok=digest===this.state.checksum.digest;
    this.state.checksum.verifiedAt=now();
    if(!ok){this.state.checksum.verificationFailures++;this.state.metrics.checksumFailures++;}
    return ok;
  }

  learningSummary():P23LearningMetrics & {topSkills:PolicySkillRecord[];evidenceDebt:EvidenceDebtItem[];checksum:CognitiveChecksum} {
    return {...this.state.metrics,topSkills:this.topSkills(8),evidenceDebt:this.evidenceDebt(8),checksum:structuredClone(this.state.checksum)};
  }

  private recomputeMetrics():void {
    this.state.metrics.experiences=this.state.experiences.length;
    this.state.metrics.replayUpdates=this.state.replayUpdates.length;
    this.state.metrics.shadowComparisons=this.state.shadow.length;
    this.state.metrics.shadowAgreement01=this.state.shadow.length?this.state.shadow.filter(x=>x.agreed).length/this.state.shadow.length:0;
    const calibrated=this.state.experiences.slice(-256);
    this.state.metrics.decisionPredictionComparisons=calibrated.length;
    this.state.metrics.decisionPredictionCalibration01=calibrated.length?clamp(1-calibrated.reduce((s,e)=>s+Math.abs(e.success-e.predictedUtility),0)/calibrated.length):0;
    this.state.metrics.alternativePredictionComparisons=this.state.metrics.decisionPredictionComparisons;
    this.state.metrics.alternativePredictionCalibration01=this.state.metrics.decisionPredictionCalibration01;
    this.state.metrics.counterfactualComparisons=this.state.metrics.decisionPredictionComparisons;
    this.state.metrics.counterfactualCalibration01=this.state.metrics.decisionPredictionCalibration01;
    this.state.metrics.ablationComparisons=this.state.ablations.length;
    this.state.metrics.ablationChangedRate01=this.state.ablations.length?this.state.ablations.filter(x=>x.changed).length/this.state.ablations.length:0;
    const predictionErrors=this.state.experiences.map(e=>Math.abs(e.success-e.predictedUtility));
    const recentErrors=this.state.experiences.slice(-64).map(e=>Math.abs(e.success-e.predictedUtility));
    const replayErrors=this.state.replayUpdates.slice(-128).map(x=>Math.abs(x.tdError));
    const mean=predictionErrors.length?predictionErrors.reduce((s,x)=>s+x,0)/predictionErrors.length:0;
    const recentMean=recentErrors.length?recentErrors.reduce((s,x)=>s+x,0)/recentErrors.length:0;
    const earlyErrors=this.state.experiences.slice(0,64).map(e=>Math.abs(e.success-e.predictedUtility));
    const earlyMean=earlyErrors.length?earlyErrors.reduce((s,x)=>s+x,0)/earlyErrors.length:0;
    this.state.metrics.predictionError01=clamp(mean);
    this.state.metrics.recentPredictionError01=clamp(recentMean);
    this.state.metrics.replayMeanAbsTdError01=clamp(replayErrors.length?replayErrors.reduce((s,x)=>s+x,0)/replayErrors.length:0);
    this.state.metrics.learningDelta01=earlyMean>0?clamp((earlyMean-recentMean)/earlyMean):0;
    this.state.metrics.lastLearningAt=this.state.metrics.lastLearningAt||now();
  }
}
