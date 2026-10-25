import { isTrustedDecisionLinkedExternalPostcondition, type OutcomeVerification } from '../system/OutcomeVerificationService.ts';
import type { ActionKind, OrganismState } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();

/** Restore bounded identifier caches as plain, typed data; persisted IDs never restore verifier authority. */
function restorePersistedIdentifiers(value:unknown,maxLength:number,limit:number):string[]{
  if(!Array.isArray(value))return [];
  const identifiers:string[]=[];
  const seen=new Set<string>();
  for(const candidate of value as unknown[]){
    if(typeof candidate!=='string'||candidate.length===0||candidate.length>maxLength||candidate.trim()!==candidate)continue;
    if(Array.from(candidate).some(character=>{const code=character.charCodeAt(0);return code<32||(code>=127&&code<=159);}))continue;
    if(seen.has(candidate))continue;
    seen.add(candidate);
    identifiers.push(candidate);
  }
  return identifiers.slice(-limit);
}

export type DevelopmentArea = 'memory'|'learning'|'world-model'|'self-model'|'relationship'|'agency'|'resource-discipline'|'perception';
export type DevelopmentStatus = 'proposed'|'running'|'completed'|'rejected'|'rolled-back'|'preview-only'|'awaiting-evidence';

export interface DevelopmentHypothesis {
  id:string;
  area:DevelopmentArea;
  title:string;
  hypothesis:string;
  evidence:string[];
  expectedGain01:number;
  estimatedCost01:number;
  priority01:number;
  status:DevelopmentStatus;
  createdAt:number;
  completedAt:number;
  result01:number|null;
  evidenceGate?: 'none'|'external-verified'|'holdout-verified'|'replicated';
}

export interface DevelopmentExperiment {
  id:string;
  hypothesisId:string;
  control01:number;
  treatment01:number;
  delta01:number;
  replicated:boolean;
  safeSandbox:boolean;
  runs:number;
  informationGain01:number;
  status:'completed'|'insufficient'|'rejected';
  at:number;
  evidenceGate?: 'sandbox-preview'|'external-verified'|'holdout-verified'|'replicated';
}

export interface DevelopmentCampaignSlot {
  id:string;
  sequence:number;
  hypothesisId:string;
  cycleId:string;
  phase:'baseline'|'delayed-test'|'holdout';
  contextKey:string;
  delayMs:number;
  holdout:boolean;
  requestedAction:ActionKind;
}

export interface DevelopmentCycleRecord {
  id:string;
  hypothesisId:string;
  goalId?:string;
  objective:string;
  origin:'autonomous-gap'|'goal-pressure'|'user-directed';
  requestedAction:ActionKind;
  requiredContexts:number;
  requiredPositiveDelays:number;
  requiredHoldout:number;
  stage:'proposed'|'task-ready'|'awaiting-evidence'|'holdout-verified'|'replicated'|'closed';
  createdAt:number;
  taskCount:number;
  verifiedEvidenceCount:number;
  lastEvidenceAt:number;
}

export interface DevelopmentEvidenceRecord {
  id:string;
  hypothesisId:string;
  contextKey:string;
  control01:number;
  treatment01:number;
  delta01:number;
  independentVerified:boolean;
  holdout:boolean;
  delayMs:number;
  evaluatorVersion:string;
  evidenceSource:'external-evaluator'|'manual-observer';
  protocolId?:string;
  sessionId?:string;
  trialId?:string;
  baselineMethod?:string;
  treatmentMethod?:string;
  taskFamily?:string;
  manifestFingerprint?:string;
  /** ActionGateway execution tuple that the verifier receipt is bound to. */
  toolId?:string;
  executionId?:string;
  decisionId?:string;
  /** Opaque process-local verifier output ID; this alone is never a trust token. */
  observationId?:string;
  at:number;
}

export interface DevelopmentEvidenceVerificationBinding {
  hypothesisId:string;
  contextKey:string;
  control01:number;
  treatment01:number;
  holdout:boolean;
  delayMs:number;
  evaluatorVersion:string;
  evidenceSource:'external-evaluator'|'manual-observer';
  protocolId?:string;
  sessionId?:string;
  trialId?:string;
  /** Optional canonical verified-outcome-ledger comparison provenance. */
  baselineMethod?:string;
  treatmentMethod?:string;
  taskFamily?:string;
  manifestFingerprint?:string;
}

export interface NormalizedDevelopmentEvidenceVerificationBinding extends Omit<DevelopmentEvidenceVerificationBinding,'evidenceSource'> {
  evidenceSource:DevelopmentEvidenceVerificationBinding['evidenceSource']|'invalid';
  [key:string]:unknown;
}

function canonicalEvidenceText(value:unknown,max:number):string|undefined{
  if(typeof value!=='string')return undefined;
  const normalized=value.normalize('NFKC').trim();
  if(!normalized||normalized.length>max||Array.from(normalized).some(character=>{
    const code=character.codePointAt(0)??0;
    return code<=0x1f||(code>=0x7f&&code<=0x9f);
  }))return undefined;
  return normalized;
}

/** Exact, normalized tuple that the canonical external verifier must bind its receipt to. */
export function developmentEvidenceVerificationInput(input:DevelopmentEvidenceVerificationBinding):NormalizedDevelopmentEvidenceVerificationBinding{
  const binding:NormalizedDevelopmentEvidenceVerificationBinding={
    hypothesisId:canonicalEvidenceText(input.hypothesisId,180)??'',
    contextKey:canonicalEvidenceText(input.contextKey,96)??'',
    control01:clamp(input.control01),
    treatment01:clamp(input.treatment01),
    holdout:input.holdout===true,
    delayMs:Number.isFinite(input.delayMs)?Math.max(0,Math.floor(input.delayMs)):0,
    evaluatorVersion:canonicalEvidenceText(input.evaluatorVersion,64)??'',
    evidenceSource:input.evidenceSource==='external-evaluator'||input.evidenceSource==='manual-observer'?input.evidenceSource:'invalid',
  };
  for(const key of ['protocolId','sessionId','trialId','baselineMethod','treatmentMethod','taskFamily','manifestFingerprint'] as const){
    const value=input[key];
    if(value!==undefined){
      const max=key==='baselineMethod'||key==='treatmentMethod'?180:key==='taskFamily'?96:key==='manifestFingerprint'?64:96;
      binding[key]=canonicalEvidenceText(value,max)??'';
    }
  }
  return binding;
}

export interface DevelopmentalOutcomeVerificationBinding {
  /** Discriminant consumed by OrganismCore.finalizeToolOutcome; never inferred from a score. */
  kind?:'developmental-outcome';
  area?:DevelopmentArea|null;
  outcome01:number;
  delayed?:boolean;
  transfer?:boolean;
}

export interface NormalizedDevelopmentalOutcomeVerificationBinding extends Omit<DevelopmentalOutcomeVerificationBinding,'area'|'delayed'|'transfer'> {
  kind:'developmental-outcome';
  area:DevelopmentArea|null;
  outcome01:number;
  delayed:boolean;
  transfer:boolean;
  [key:string]:unknown;
}

/** Bind an outcome receipt to its exact normalized score, domain, retention and transfer claims. */
export function developmentalOutcomeVerificationInput(input:DevelopmentalOutcomeVerificationBinding):NormalizedDevelopmentalOutcomeVerificationBinding{
  const areas:DevelopmentArea[]=['memory','learning','world-model','self-model','relationship','agency','resource-discipline','perception'];
  return {
    kind:'developmental-outcome',
    area:input.area===null||input.area===undefined?null:(areas.includes(input.area)?input.area:null),
    outcome01:clamp(input.outcome01),
    delayed:input.delayed===true,
    transfer:input.transfer===true,
  };
}

export interface LearningInvestmentDecision {
  id:string;
  tick:number;
  at:number;
  decision:'invest'|'defer'|'recover'|'observe';
  area:DevelopmentArea|null;
  score01:number;
  expectedGain01:number;
  estimatedCost01:number;
  opportunityCost01:number;
  resourcePressure01:number;
  reason:string;
}

export interface DevelopmentAgendaRecord {
  version:1;
  selectedArea:DevelopmentArea|null;
  selectedHypothesisId:string|null;
  score01:number;
  expectedGain01:number;
  estimatedCost01:number;
  reason:string;
  lastSelectedAt:number;
  selectionCount:number;
  lastDecisionTick:number;
}

export type DevelopmentalMaturityStage = 'seed'|'acquisition'|'integration'|'transfer'|'consolidation'|'stable';

export interface DevelopmentalMaturityRecord {
  cycle:number;
  stage:DevelopmentalMaturityStage;
  area:DevelopmentArea|null;
  verified01:number;
  retention01:number;
  transfer01:number;
  failed01:number;
  at:number;
}

export interface SelfDevelopmentState {
  version:6;
  cycles:number;
  lastCycleAt:number;
  agenda:DevelopmentAgendaRecord;
  currentHypothesisId:string|null;
  hypotheses:DevelopmentHypothesis[];
  experiments:DevelopmentExperiment[];
  developmentCycles:DevelopmentCycleRecord[];
  externalEvidence:DevelopmentEvidenceRecord[];
  /** Bounded idempotency ledger; stored IDs never grant verification authority. */
  developmentalEvidenceReceiptIds:string[];
  /** Cross-path observation IDs prevent the same verifier observation from being counted twice. */
  developmentalEvidenceObservationIds:string[];
  investmentDecisions:LearningInvestmentDecision[];
  learningBudget01:number;
  spentBudget01:number;
  recovery01:number;
  acceptedChanges:number;
  rejectedChanges:number;
  rollbackCount:number;
  /** Count attempts that supplied caller data or failed canonical proof checks. */
  unverifiedEvidenceAttempts:number;
  rejectedMaturityReceipts:number;
  metrics:{
    selfDevelopmentCoherence01:number;
    experimentSuccess01:number;
    autonomy01:number;
    developmentalReadiness01:number;
    longHorizonImprovement01:number;
  };
  developmentalMaturity:{
    stage:DevelopmentalMaturityStage;
    score01:number;
    verifiedOutcomeCount:number;
    retainedOutcomeCount:number;
    transferredOutcomeCount:number;
    regressionCount:number;
    lastTransitionAt:number;
    history:DevelopmentalMaturityRecord[];
  };
  curriculum:{
    focus:DevelopmentArea;
    mastery:Record<DevelopmentArea,number>;
    plannedSteps:number;
    completedSteps:number;
  };
  actionBias:Record<ActionKind,number>;
}

const defaultState=():SelfDevelopmentState=>({
  version:6,
  cycles:0,
  lastCycleAt:0,
  agenda:{version:1,selectedArea:null,selectedHypothesisId:null,score01:0,expectedGain01:0,estimatedCost01:0,reason:'no-development-decision',lastSelectedAt:0,selectionCount:0,lastDecisionTick:0},
  currentHypothesisId:null,
  hypotheses:[],
  experiments:[],
  developmentCycles:[],
  externalEvidence:[],
  developmentalEvidenceReceiptIds:[],
  developmentalEvidenceObservationIds:[],
  investmentDecisions:[],
  learningBudget01:.82,
  spentBudget01:0,
  recovery01:0,
  acceptedChanges:0,
  rejectedChanges:0,
  rollbackCount:0,
  unverifiedEvidenceAttempts:0,
  rejectedMaturityReceipts:0,
  metrics:{selfDevelopmentCoherence01:.28,experimentSuccess01:.5,autonomy01:.82,developmentalReadiness01:.35,longHorizonImprovement01:.5},
  developmentalMaturity:{stage:'seed',score01:0,verifiedOutcomeCount:0,retainedOutcomeCount:0,transferredOutcomeCount:0,regressionCount:0,lastTransitionAt:0,history:[]},
  curriculum:{
    focus:'learning',
    mastery:{memory:.5,learning:.5,'world-model':.4,'self-model':.4,relationship:.35,agency:.45,'resource-discipline':.5,perception:.35},
    plannedSteps:0,
    completedSteps:0,
  },
  actionBias:{respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0},
});

const hash=(s:string)=>{
  let h=2166136261>>>0;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return h.toString(16).padStart(8,'0');
};

function bootstrapCI(values:number[],seed:number,resamples=384){
  if(values.length<2)return {low:null as number|null,high:null as number|null};
  let x=(seed>>>0)||0x9e3779b9; const rnd=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
  const means:number[]=[];
  for(let r=0;r<Math.min(512,Math.max(64,resamples));r++){let sum=0;for(let i=0;i<values.length;i++)sum+=values[Math.floor(rnd()*values.length)];means.push(sum/values.length);}
  means.sort((a,b)=>a-b);
  return {low:means[Math.floor(means.length*.025)],high:means[Math.floor(means.length*.975)]};
}

function focusFromState(state:OrganismState, extras:{worldError01?:number; selfError01?:number; relationship01?:number; perception01?:number; resourceRisk01?:number}={}):DevelopmentArea{
  const scores:Record<DevelopmentArea,number>={
    learning:state.predictionError*.34 + (1-state.needs.identityCoherence)*.12,
    'world-model':(extras.worldError01??state.predictionError)*.42,
    'self-model':(extras.selfError01??state.selfPredictionError)*.42 + (1-state.autonomyScore)*.1,
    relationship:(extras.relationship01??state.needs.socialNeed)*.35,
    agency:(1-state.autonomyScore)*.36 + state.needs.goalPressure*.12,
    'resource-discipline':(extras.resourceRisk01??state.needs.cognitiveLoad)*.4 + (1-state.attentionBudget)*.18,
    perception:(extras.perception01??state.needs.uncertainty)*.3,
    memory:state.needs.novelty*.16 + state.predictionError*.18,
  };
  return (Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'learning') as DevelopmentArea;
}

/** Reserved ActionGateway tool ID for host-owned independent P36 evaluation. */
export const P36_EXTERNAL_EVIDENCE_TOOL_ID = 'organism.learning.p36.evaluate-evidence';
/** Separate host authority for longitudinal maturity/retention observations. */
export const P36_DEVELOPMENTAL_OUTCOME_TOOL_ID = 'organism.learning.p36.evaluate-maturity';

export class P36AutonomousSelfDevelopmentEngine{
  private state=defaultState();
  restore(raw?:Partial<SelfDevelopmentState>|null){
    const d=defaultState(); const r=raw??{};
    const sourceHypotheses=Array.isArray(r.hypotheses)?r.hypotheses.slice(-96):[];
    const revokedHypothesisIds=new Set<string>();
    const seenHypothesisIds=new Set<string>();
    const safeTimestamp=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?Number(value):0;
    const areas:DevelopmentArea[]=['memory','learning','world-model','self-model','relationship','agency','resource-discipline','perception'];
    const statuses:DevelopmentStatus[]=['proposed','running','completed','rejected','rolled-back','preview-only','awaiting-evidence'];
    const evidenceGates=new Set(['none','external-verified','holdout-verified','replicated']);
    const restoredHypotheses=sourceHypotheses.map((rawHypothesis:any)=>{
      let h:any;
      try { h=structuredClone(rawHypothesis); } catch { return null; }
      if(!h||typeof h!=='object'||Array.isArray(h))return null;
      const id=canonicalEvidenceText(h.id,180);
      const title=canonicalEvidenceText(h.title,180);
      const hypothesis=canonicalEvidenceText(h.hypothesis,800);
      if(!id||!title||!hypothesis||seenHypothesisIds.has(id)||!areas.includes(h.area))return null;
      seenHypothesisIds.add(id);
      const status:DevelopmentStatus=statuses.includes(h.status)?h.status:'proposed';
      const gate=evidenceGates.has(h.evidenceGate)?h.evidenceGate:'none';
      const hasUnreplayablePromotion=status==='completed'||gate==='external-verified'||gate==='holdout-verified'||gate==='replicated';
      if(hasUnreplayablePromotion)revokedHypothesisIds.add(id);
      const score=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
      return {
        id,area:h.area,title,hypothesis,
        evidence:Array.isArray(h.evidence)?h.evidence.filter((value:unknown):value is string=>typeof value==='string'&&Boolean(canonicalEvidenceText(value,160))).slice(0,8).map((value:string)=>canonicalEvidenceText(value,160)!):[],
        expectedGain01:score(h.expectedGain01,.2),
        estimatedCost01:score(h.estimatedCost01,.2),
        priority01:score(h.priority01,.2),
        status:hasUnreplayablePromotion?'awaiting-evidence':status,
        createdAt:safeTimestamp(h.createdAt),
        completedAt:hasUnreplayablePromotion?0:safeTimestamp(h.completedAt),
        result01:hasUnreplayablePromotion?null:(h.result01===null?null:score(h.result01,.5)),
        evidenceGate:hasUnreplayablePromotion?'none':gate,
      } as DevelopmentHypothesis;
    }).filter((hypothesis):hypothesis is DevelopmentHypothesis=>hypothesis!==null);
    const validActions=new Set<ActionKind>(ACTIONS);
    const restoredCycles=Array.isArray((r as any).developmentCycles)?(r as any).developmentCycles.slice(-64).map((rawCycle:any)=>{
      let cycle:any;
      try { cycle=structuredClone(rawCycle); } catch { return null; }
      if(!cycle||typeof cycle!=='object'||Array.isArray(cycle)||
         typeof cycle.id!=='string'||cycle.id.length>180||typeof cycle.hypothesisId!=='string'||
         !restoredHypotheses.some(hypothesis=>hypothesis.id===cycle.hypothesisId))return null;
      const stageValues=['proposed','task-ready','awaiting-evidence','holdout-verified','replicated','closed'];
      const stage=stageValues.includes(cycle.stage)?cycle.stage:'awaiting-evidence';
      const revoke=revokedHypothesisIds.has(cycle.hypothesisId)||stage==='replicated'||stage==='holdout-verified';
      return {
        id:cycle.id.slice(0,180),hypothesisId:cycle.hypothesisId,
        ...(typeof cycle.goalId==='string'&&cycle.goalId.length<=96?{goalId:cycle.goalId}:{}),
        objective:canonicalEvidenceText(cycle.objective,240)??'Re-evaluate prior self-development hypothesis',
        origin:['autonomous-gap','goal-pressure','user-directed'].includes(cycle.origin)?cycle.origin:'autonomous-gap',
        requestedAction:validActions.has(cycle.requestedAction)?cycle.requestedAction:'verify',
        requiredContexts:Number.isSafeInteger(cycle.requiredContexts)?Math.max(2,Math.min(8,cycle.requiredContexts)):2,
        requiredPositiveDelays:Number.isSafeInteger(cycle.requiredPositiveDelays)?Math.max(2,Math.min(8,cycle.requiredPositiveDelays)):2,
        requiredHoldout:Number.isSafeInteger(cycle.requiredHoldout)?Math.max(4,Math.min(16,cycle.requiredHoldout)):4,
        stage:revoke?'awaiting-evidence':stage,createdAt:safeTimestamp(cycle.createdAt),
        taskCount:Number.isSafeInteger(cycle.taskCount)?Math.max(0,Math.min(1024,cycle.taskCount)):0,
        verifiedEvidenceCount:0,lastEvidenceAt:0,
      } as DevelopmentCycleRecord;
    }).filter((cycle:DevelopmentCycleRecord|null):cycle is DevelopmentCycleRecord=>cycle!==null):[];
    this.state={...d,...r,version:6,
      currentHypothesisId:typeof r.currentHypothesisId==='string'&&restoredHypotheses.some(hypothesis=>
        hypothesis.id===r.currentHypothesisId&&['proposed','running','awaiting-evidence'].includes(hypothesis.status))
        ?r.currentHypothesisId:null,
      lastCycleAt:Number.isSafeInteger(r.lastCycleAt)&&Number(r.lastCycleAt)>=0?Number(r.lastCycleAt):0,
      cycles:Number.isSafeInteger(r.cycles)&&Number(r.cycles)>=0?Math.min(1_000_000_000,Number(r.cycles)):0,
      // Cached maturity aggregates and promotion effects cannot be re-authenticated from a snapshot alone.
      developmentalMaturity:{...d.developmentalMaturity,history:Array.isArray((r as any).developmentalMaturity?.history)?(r as any).developmentalMaturity.history.slice(-64).map((x:any)=>({...x,verified01:0,retention01:0,transfer01:0,failed01:0})):[]},
      agenda:{...d.agenda},
      hypotheses:restoredHypotheses,
      experiments:Array.isArray(r.experiments)?r.experiments.slice(-128).map((x:any)=>({...x,replicated:false,status:'insufficient',evidenceGate:'sandbox-preview'})):[],
      developmentCycles:restoredCycles,
      // Verifier receipts are WeakMap-backed capabilities and do not survive JSON snapshots.
      // Preserve observations for audit, but never restore serialized trust booleans.
      externalEvidence:Array.isArray(r.externalEvidence)?(r.externalEvidence as unknown[]).slice(-512)
        .filter((e):e is DevelopmentEvidenceRecord=>Boolean(e&&typeof e==='object'&&!Array.isArray(e)&&
          typeof (e as DevelopmentEvidenceRecord).id==='string'&&
          typeof (e as DevelopmentEvidenceRecord).hypothesisId==='string'&&
          typeof (e as DevelopmentEvidenceRecord).contextKey==='string'&&
          typeof (e as DevelopmentEvidenceRecord).control01==='number'&&Number.isFinite((e as DevelopmentEvidenceRecord).control01)&&
          typeof (e as DevelopmentEvidenceRecord).treatment01==='number'&&Number.isFinite((e as DevelopmentEvidenceRecord).treatment01)&&
          typeof (e as DevelopmentEvidenceRecord).delta01==='number'&&Number.isFinite((e as DevelopmentEvidenceRecord).delta01)&&
          typeof (e as DevelopmentEvidenceRecord).at==='number'&&Number.isFinite((e as DevelopmentEvidenceRecord).at)&&
          typeof (e as DevelopmentEvidenceRecord).evaluatorVersion==='string'&&
          ((e as DevelopmentEvidenceRecord).evidenceSource==='external-evaluator'||(e as DevelopmentEvidenceRecord).evidenceSource==='manual-observer')))
        .map(e=>({...e,independentVerified:false,observationId:undefined})):[],
      developmentalEvidenceReceiptIds:restorePersistedIdentifiers((r as any).developmentalEvidenceReceiptIds,256,512),
      developmentalEvidenceObservationIds:restorePersistedIdentifiers((r as any).developmentalEvidenceObservationIds,180,512),
      investmentDecisions:Array.isArray((r as any).investmentDecisions)?(r as any).investmentDecisions.slice(-96):[],
      learningBudget01:d.learningBudget01,spentBudget01:0,recovery01:d.recovery01,
      // Outcome-derived metrics, learned policy weights and mastery are not re-authenticated by JSON.
      metrics:{...d.metrics},
      curriculum:{...d.curriculum},
      actionBias:{...d.actionBias},
      acceptedChanges:0,
      unverifiedEvidenceAttempts:Number.isSafeInteger(r.unverifiedEvidenceAttempts)?Math.max(0,Math.min(1_000_000_000,r.unverifiedEvidenceAttempts!)):0,
      rejectedMaturityReceipts:Number.isSafeInteger(r.rejectedMaturityReceipts)?Math.max(0,Math.min(1_000_000_000,r.rejectedMaturityReceipts!)):0,
    };
  }
  snapshot(){return structuredClone(this.state);}

  beginCycle(){
    this.state.cycles++;
    this.state.lastCycleAt=now();
    this.state.recovery01=clamp(this.state.recovery01+.028);
    this.state.spentBudget01=clamp(Math.max(0,this.state.spentBudget01-.018));
    this.state.metrics.developmentalReadiness01=clamp(this.state.metrics.developmentalReadiness01*.985+.015*(this.state.learningBudget01-this.state.spentBudget01+.25));
  }

  propose(state:OrganismState,input:{worldError01?:number;selfError01?:number;relationship01?:number;perception01?:number;resourceRisk01?:number}={}):DevelopmentHypothesis|null{
    const decision=this.selectDevelopmentFocus(state,input);
    const area=decision.area;
    const mastery=this.state.curriculum.mastery[area]??.3;
    const uncertainty=clamp(state.needs.uncertainty+(input.worldError01??0)*.4+(input.selfError01??0)*.25);
    const expectedGain=decision.expectedGain01;
    const cost=decision.estimatedCost01;
    const remaining=this.state.learningBudget01-this.state.spentBudget01;
    const priority=decision.score01;
    this.state.agenda={version:1,selectedArea:area,selectedHypothesisId:this.state.currentHypothesisId,score01:priority,expectedGain01:expectedGain,estimatedCost01:cost,reason:decision.reason,lastSelectedAt:now(),selectionCount:this.state.agenda.selectionCount+1,lastDecisionTick:state.tick};
    if(priority<.36 || remaining<cost*.5) return null;
    const title=`self-development:${area}`;
    const key=`${state.tick}:${area}:${Math.round(expectedGain*100)}`;
    const existing=this.state.hypotheses.find(h=>h.area===area && (['proposed','running','awaiting-evidence'].includes(h.status) || (h.status==='completed' && h.evidenceGate==='holdout-verified')));
    if(existing){this.state.currentHypothesisId=existing.id;return structuredClone(existing);}
    const row:DevelopmentHypothesis={
      id:`p36-h-${hash(key)}-${now().toString(36)}`,
      area,
      title,
      hypothesis:this.hypothesisText(area),
      evidence:[`tick:${state.tick}`,`predictionError:${state.predictionError.toFixed(3)}`,`uncertainty:${state.needs.uncertainty.toFixed(3)}`].slice(0,8),
      expectedGain01:expectedGain,
      estimatedCost01:cost,
      priority01:priority,
      status:'proposed',
      createdAt:now(),
      completedAt:0,
      result01:null,
    };
    this.state.hypotheses=[row,...this.state.hypotheses].slice(0,96);
    this.state.currentHypothesisId=row.id;
    this.state.agenda.selectedArea=area;
    this.state.agenda.selectedHypothesisId=row.id;
    this.state.agenda.lastDecisionTick=state.tick;
    this.state.curriculum.focus=area;
    this.state.curriculum.plannedSteps+=1;
    return structuredClone(row);
  }

  selectDevelopmentFocus(state:OrganismState,input:{worldError01?:number;selfError01?:number;relationship01?:number;perception01?:number;resourceRisk01?:number}={}):{area:DevelopmentArea;score01:number;expectedGain01:number;estimatedCost01:number;reason:string}{
    const raw:Record<DevelopmentArea,number>={
      learning:state.predictionError*.56+(1-state.needs.identityCoherence)*.10,
      'world-model':(input.worldError01??state.predictionError)*.64+state.needs.uncertainty*.12,
      'self-model':(input.selfError01??state.selfPredictionError)*.64+(1-state.autonomyScore)*.14,
      relationship:(input.relationship01??state.needs.socialNeed)*.58+state.needs.socialNeed*.16,
      agency:(1-state.autonomyScore)*.62+state.needs.goalPressure*.18,
      'resource-discipline':(input.resourceRisk01??state.needs.cognitiveLoad)*.52+(1-state.attentionBudget)*.24,
      perception:(input.perception01??state.needs.uncertainty)*.48+state.predictionError*.16,
      memory:state.needs.novelty*.20+state.predictionError*.26,
    };
    const lastArea=this.state.agenda.selectedArea;
    const options=Object.entries(raw).map(([name,rawScore])=>{
      const area=name as DevelopmentArea;
      const mastery=this.state.curriculum.mastery[area]??.3;
      const cost=clamp(.08+state.needs.cognitiveLoad*.24+(1-state.attentionBudget)*.16+(1-state.needs.energy)*.08);
      const noveltyBonus=area===lastArea?0:.035;
      const repetitionPenalty=area===lastArea?Math.min(.14,.045+this.state.agenda.selectionCount*.004):0;
      const feasibility=clamp(.7+state.needs.energy*.18-state.needs.cognitiveLoad*.20);
      const expectedGain=clamp(.14+rawScore*.44+(1-mastery)*.30+state.needs.uncertainty*.08);
      const voi=clamp(expectedGain*.62+(1-mastery)*.18+feasibility*.10+noveltyBonus-repetitionPenalty);
      const score=clamp(voi/(.72+cost*.5));
      return {area,score01:score,expectedGain01:expectedGain,estimatedCost01:cost,rawScore,mastery};
    }).sort((a,b)=>b.score01-a.score01);
    const best=options[0]??{area:'learning' as DevelopmentArea,score01:0,expectedGain01:.2,estimatedCost01:.2,rawScore:0,mastery:.5};
    const reason=`d-voi:${best.area}:deficit=${(1-best.mastery).toFixed(2)}:uncertainty=${state.needs.uncertainty.toFixed(2)}:cost=${best.estimatedCost01.toFixed(2)}:feasibility=${clamp(.7+state.needs.energy*.18-state.needs.cognitiveLoad*.20).toFixed(2)}`;
    return {area:best.area,score01:best.score01,expectedGain01:best.expectedGain01,estimatedCost01:best.estimatedCost01,reason};
  }

  learningAgenda(){ return structuredClone(this.state.agenda); }

  decideLearningInvestment(state:OrganismState,input:{worldError01?:number;selfError01?:number;relationship01?:number;perception01?:number;resourceRisk01?:number}={}):LearningInvestmentDecision{
    const focus=this.selectDevelopmentFocus(state,input);
    const energyPressure=clamp((.42-state.needs.energy)/.42);
    const loadPressure=clamp((state.needs.cognitiveLoad-.58)/.42);
    const uncertaintyPressure=clamp(state.needs.uncertainty*.72+state.predictionError*.28);
    const resourcePressure=clamp(energyPressure*.42+loadPressure*.34+(1-state.attentionBudget)*.24);
    const currentCycle=this.activeDevelopmentCycle();
    if(currentCycle){
      const activeHypothesis=this.state.hypotheses.find(x=>x.id===currentCycle.hypothesisId);
      const area=activeHypothesis?.area ?? this.state.curriculum.focus;
      const expectedGain=activeHypothesis?.expectedGain01 ?? .25;
      const estimatedCost=activeHypothesis?.estimatedCost01 ?? .12;
      const row:LearningInvestmentDecision={id:`p36-li-${hash(`${state.tick}:${currentCycle.id}`)}-${now().toString(36)}`,tick:state.tick,at:now(),decision:'invest',area,score01:clamp(.72-resourcePressure*.22),expectedGain01:expectedGain,estimatedCost01:estimatedCost,opportunityCost01:clamp(resourcePressure*.42),resourcePressure01:resourcePressure,reason:'active-development-cycle'};
      this.state.investmentDecisions=[row,...this.state.investmentDecisions].slice(0,96);
      return structuredClone(row);
    }
    const remaining=clamp(this.state.learningBudget01-this.state.spentBudget01);
    const opportunityCost=clamp(resourcePressure*.52 + Math.max(0,focus.estimatedCost01-remaining)*.7);
    const expectedValue=clamp(focus.expectedGain01*.72 + uncertaintyPressure*.16 + (1-(this.state.curriculum.mastery[focus.area]??.3))*.12);
    const net=clamp(expectedValue-opportunityCost);
    let decision:LearningInvestmentDecision['decision']='invest';
    if(state.needs.energy<.18 || resourcePressure>.86) decision='recover';
    else if(remaining<focus.estimatedCost01*.55 || net<.075) decision='defer';
    else if(net<.14) decision='observe';
    const reason=`d-voi-gated:${decision}:value=${expectedValue.toFixed(2)}:opportunity=${opportunityCost.toFixed(2)}:resources=${resourcePressure.toFixed(2)}:remaining=${remaining.toFixed(2)}`;
    const row:LearningInvestmentDecision={id:`p36-li-${hash(`${state.tick}:${focus.area}:${decision}`)}-${now().toString(36)}`,tick:state.tick,at:now(),decision,area:focus.area,score01:focus.score01,expectedGain01:focus.expectedGain01,estimatedCost01:focus.estimatedCost01,opportunityCost01:opportunityCost,resourcePressure01:resourcePressure,reason};
    this.state.investmentDecisions=[row,...this.state.investmentDecisions].slice(0,96);
    this.state.agenda.reason=reason;
    return structuredClone(row);
  }

  learningInvestmentHistory(limit=32){ return structuredClone(this.state.investmentDecisions.slice(0,Math.max(1,Math.min(96,Math.floor(limit))))); }

  beginAutonomousDevelopmentCycle(input:{
    hypothesisId:string;
    origin:'autonomous-gap'|'goal-pressure'|'user-directed';
    objective?:string;
    goalId?:string;
    requestedAction?:ActionKind;
    requiredContexts?:number;
    requiredPositiveDelays?:number;
    requiredHoldout?:number;
  }):DevelopmentCycleRecord|null{
    const h=this.state.hypotheses.find(x=>x.id===input.hypothesisId);
    if(!h || h.status==='completed' || h.status==='rejected') return null;
    const active=this.state.developmentCycles.find(c=>c.hypothesisId===h.id && c.stage!=='closed' && c.stage!=='replicated');
    if(active) return structuredClone(active);
    const cycle:DevelopmentCycleRecord={
      id:`p36-c-${hash(`${h.id}:${input.origin}:${input.requestedAction??this.preferredAction(h.area)}`)}-${now().toString(36)}`,
      hypothesisId:h.id,
      goalId:input.goalId ? String(input.goalId).slice(0,96) : undefined,
      objective:(input.objective??h.hypothesis).slice(0,240),
      origin:input.origin,
      requestedAction:input.requestedAction??this.preferredAction(h.area),
      requiredContexts:Math.max(2,Math.min(8,Math.floor(input.requiredContexts??(h.area==='relationship'||h.area==='agency'?3:2)))),
      requiredPositiveDelays:Math.max(2,Math.min(8,Math.floor(input.requiredPositiveDelays??(h.area==='memory'||h.area==='learning'?3:2)))),
      requiredHoldout:Math.max(4,Math.min(16,Math.floor(input.requiredHoldout??(h.area==='resource-discipline'?5:4)))),
      stage:'task-ready',createdAt:now(),taskCount:0,verifiedEvidenceCount:0,lastEvidenceAt:0,
    };
    this.state.developmentCycles=[cycle,...this.state.developmentCycles].slice(0,64);
    h.status='awaiting-evidence';
    return structuredClone(cycle);
  }

  activeDevelopmentCycle(options:{clone?:boolean}={clone:true}):DevelopmentCycleRecord|null{
    const cycle=this.state.developmentCycles.find(c=>c.stage!=='closed'&&c.stage!=='replicated')??null;
    return options.clone===false ? cycle : structuredClone(cycle);
  }

  noteDevelopmentTaskIssued(hypothesisId:string){
    const c=this.state.developmentCycles.find(x=>x.hypothesisId===hypothesisId && x.stage!=='closed');
    if(c){c.taskCount=Math.min(1024,c.taskCount+1);c.stage='awaiting-evidence';}
  }

  developmentTaskRequest(){
    const c=this.activeDevelopmentCycle();
    if(!c) return null;
    return {cycleId:c.id,hypothesisId:c.hypothesisId,requestedAction:c.requestedAction,objective:c.objective,requiredContexts:c.requiredContexts,requiredPositiveDelays:c.requiredPositiveDelays,requiredHoldout:c.requiredHoldout,issuedTasks:c.taskCount};
  }

  developmentCampaignPlan(){
    const c=this.activeDevelopmentCycle();
    if(!c) return [];
    const delays=[1000,6000,36000,216000];
    const slots:DevelopmentCampaignSlot[]=[];
    let sequence=0;
    for(let context=0;context<c.requiredContexts;context++){
      const contextKey=`dev-${c.hypothesisId.slice(-8)}-ctx-${context+1}`;
      slots.push({id:`${c.id}:baseline:${context+1}`,sequence:++sequence,hypothesisId:c.hypothesisId,cycleId:c.id,phase:'baseline',contextKey,delayMs:0,holdout:false,requestedAction:c.requestedAction});
      for(let d=0;d<c.requiredPositiveDelays;d++){
        const delayMs=delays[d%delays.length];
        slots.push({id:`${c.id}:delay:${context+1}:${d+1}`,sequence:++sequence,hypothesisId:c.hypothesisId,cycleId:c.id,phase:'delayed-test',contextKey,delayMs,holdout:false,requestedAction:c.requestedAction});
      }
    }
    for(let i=0;i<c.requiredHoldout;i++){
      const contextKey=`dev-${c.hypothesisId.slice(-8)}-holdout-${(i%Math.max(1,c.requiredContexts))+1}`;
      const delayMs=delays[i%c.requiredPositiveDelays];
      slots.push({id:`${c.id}:holdout:${i+1}`,sequence:++sequence,hypothesisId:c.hypothesisId,cycleId:c.id,phase:'holdout',contextKey,delayMs,holdout:true,requestedAction:c.requestedAction});
    }
    return slots.slice(0,96);
  }

  runSafeExperiment(hypothesisId:string,state:OrganismState,seed=1):DevelopmentExperiment|null{
    const h=this.state.hypotheses.find(x=>x.id===hypothesisId); if(!h)return null;
    if(h.status==='completed'||h.status==='rejected')return null;
    const budget=this.state.learningBudget01-this.state.spentBudget01;
    if(budget<h.estimatedCost01*.45){h.status='rejected';this.state.rejectedChanges++;return null;}
    h.status='running';
    const baseline=this.baseline(state,h.area);
    const treatment=this.safeTreatment(state,h.area,seed);
    const delta=treatment-baseline;
    const informationGain=clamp(Math.abs(delta)*.82+(1-(this.state.curriculum.mastery[h.area]??.3))*.18);
    const result:DevelopmentExperiment={id:`p36-x-${hash(`${hypothesisId}:${seed}`)}-${now().toString(36)}`,hypothesisId,control01:baseline,treatment01:treatment,delta01:delta,replicated:false,safeSandbox:true,runs:1,informationGain01:informationGain,status:'insufficient',at:now(),evidenceGate:'sandbox-preview'};
    this.state.experiments=[result,...this.state.experiments].slice(0,128);
    this.state.spentBudget01=clamp(this.state.spentBudget01+h.estimatedCost01*.04);
    // A sandbox preview is not an observed organism outcome; it must not move outcome-derived metrics.
    h.completedAt=now(); h.result01=null; h.status='preview-only'; h.evidenceGate='none';
    this.state.currentHypothesisId=null;
    return structuredClone(result);
  }

  recordExternalEvidence(input:{hypothesisId:string;contextKey:string;control01:number;treatment01:number;independentVerified?:boolean;verification?:OutcomeVerification;toolId?:string;executionId?:string;decisionId?:string;holdout:boolean;delayMs:number;evaluatorVersion:string;evidenceSource:'external-evaluator'|'manual-observer';protocolId?:string;sessionId?:string;trialId?:string;baselineMethod?:string;treatmentMethod?:string;taskFamily?:string;manifestFingerprint?:string;at?:number}):{eligible:boolean;evidenceCount:number;distinctContexts:number;distinctDelays:number;holdoutCount:number;independentCount:number;meanDelta01:number|null;ci95Low01:number|null;ci95High01:number|null;status:'insufficient'|'holdout-verified'|'replicated';promoted:boolean} {
    // The legacy independentVerified boolean is caller-controlled data and has no authority.
    const binding=developmentEvidenceVerificationInput(input);
    if(typeof input.control01!=='number'||!Number.isFinite(input.control01)||input.control01<0||input.control01>1||
       typeof input.treatment01!=='number'||!Number.isFinite(input.treatment01)||input.treatment01<0||input.treatment01>1||
       typeof input.holdout!=='boolean'||typeof input.delayMs!=='number'||!Number.isSafeInteger(input.delayMs)||input.delayMs<0||input.delayMs>604_800_000||
       !binding.hypothesisId||!binding.contextKey||!binding.evaluatorVersion||
       (input.evidenceSource!=='external-evaluator'&&input.evidenceSource!=='manual-observer')||
       (input.protocolId!==undefined&&!binding.protocolId)||(input.sessionId!==undefined&&!binding.sessionId)||
       (input.trialId!==undefined&&!binding.trialId)||
       (input.baselineMethod!==undefined&&!binding.baselineMethod)||(input.treatmentMethod!==undefined&&!binding.treatmentMethod)||
       (input.taskFamily!==undefined&&!binding.taskFamily)||(input.manifestFingerprint!==undefined&&!/^[a-f0-9]{64}$/i.test(binding.manifestFingerprint??'')))throw new Error('invalid-development-evidence');
    const h=this.state.hypotheses.find(x=>x.id===binding.hypothesisId);
    if(!h) throw new Error('unknown-development-hypothesis');

    const actionBinding=typeof input.toolId==='string'&&typeof input.executionId==='string'&&typeof input.decisionId==='string'
      ? {toolId:input.toolId,input:binding,executionId:input.executionId,decisionId:input.decisionId}
      : null;
    const exactReceipt=input.evidenceSource==='external-evaluator'&&input.toolId===P36_EXTERNAL_EVIDENCE_TOOL_ID&&Boolean(actionBinding)&&
      isTrustedDecisionLinkedExternalPostcondition(input.verification,actionBinding!);
    const observationId=exactReceipt?input.verification?.observationId:undefined;
    const sameProtocol=(x:DevelopmentEvidenceRecord)=>x.hypothesisId===binding.hypothesisId&&
      x.evaluatorVersion===binding.evaluatorVersion&&x.evidenceSource===input.evidenceSource&&
      x.protocolId===binding.protocolId&&x.baselineMethod===binding.baselineMethod&&
      x.treatmentMethod===binding.treatmentMethod&&x.taskFamily===binding.taskFamily&&
      x.manifestFingerprint===binding.manifestFingerprint;
    const sameEvidenceKey=(x:DevelopmentEvidenceRecord)=>sameProtocol(x)&&
      x.contextKey===binding.contextKey&&x.holdout===binding.holdout&&x.delayMs===binding.delayMs;
    // One observation ID cannot be reused across contexts/splits to inflate replication.
    const duplicateVerifiedReceipt=Boolean(observationId&&this.state.externalEvidence.some(x=>
      sameEvidenceKey(x)&&x.independentVerified&&x.observationId===observationId));
    const receiptReused=Boolean(observationId&&this.state.developmentalEvidenceObservationIds.includes(observationId)&&!duplicateVerifiedReceipt);
    const independentVerified=Boolean(exactReceipt&&!receiptReused);
    if(!independentVerified)this.state.unverifiedEvidenceAttempts=Math.min(1_000_000_000,this.state.unverifiedEvidenceAttempts+1);
    const acceptedAt=now();
    const row:DevelopmentEvidenceRecord={
      id:`p36-e-${hash(`${binding.hypothesisId}:${binding.contextKey}:${acceptedAt}`)}-${acceptedAt.toString(36)}`,
      hypothesisId:binding.hypothesisId,contextKey:binding.contextKey,control01:binding.control01,treatment01:binding.treatment01,
      delta01:binding.treatment01-binding.control01,independentVerified,holdout:binding.holdout,delayMs:binding.delayMs,
      evaluatorVersion:binding.evaluatorVersion,evidenceSource:input.evidenceSource,
      ...(binding.protocolId?{protocolId:binding.protocolId}:{}),
      ...(binding.sessionId?{sessionId:binding.sessionId}:{}),
      ...(binding.trialId?{trialId:binding.trialId}:{}),
      ...(binding.baselineMethod?{baselineMethod:binding.baselineMethod}:{}),
      ...(binding.treatmentMethod?{treatmentMethod:binding.treatmentMethod}:{}),
      ...(binding.taskFamily?{taskFamily:binding.taskFamily}:{}),
      ...(binding.manifestFingerprint?{manifestFingerprint:binding.manifestFingerprint}:{}),
      ...(independentVerified&&input.toolId?{toolId:input.toolId}:{}),
      ...(independentVerified&&input.executionId?{executionId:input.executionId}:{}),
      ...(independentVerified&&input.decisionId?{decisionId:input.decisionId}:{}),
      ...(independentVerified&&observationId?{observationId}:{}),at:acceptedAt,
    };
    const duplicateIndex=this.state.externalEvidence.findIndex(sameEvidenceKey);
    let storedOrExactDuplicate=false;
    if(duplicateIndex<0){this.state.externalEvidence=[row,...this.state.externalEvidence].slice(0,512);storedOrExactDuplicate=independentVerified;}
    else if(independentVerified&&!this.state.externalEvidence[duplicateIndex].independentVerified){
      // A forged first attempt cannot poison the idempotency slot for a later verified receipt.
      const next=[...this.state.externalEvidence];next[duplicateIndex]=row;this.state.externalEvidence=next;storedOrExactDuplicate=true;
    }else if(independentVerified&&this.state.externalEvidence[duplicateIndex].observationId===observationId){
      storedOrExactDuplicate=true;
    }
    if(storedOrExactDuplicate&&observationId&&!this.state.developmentalEvidenceObservationIds.includes(observationId)){
      this.state.developmentalEvidenceObservationIds=[...this.state.developmentalEvidenceObservationIds,observationId].slice(-512);
    }
    // Never combine counts from different evaluator versions, manifests, task families or method pairs.
    const rows=this.state.externalEvidence.filter(x=>sameProtocol(x)&&x.independentVerified);
    const contexts=new Set(rows.map(x=>x.contextKey));
    const holdoutCount=rows.filter(x=>x.holdout).length;
    const independentCount=rows.length;
    const mean=rows.length?rows.reduce((a,b)=>a+b.delta01,0)/rows.length:null;
    const delays=new Set(rows.filter(x=>x.delayMs>0).map(x=>x.delayMs));
    const ci=mean===null?{low:null,high:null}:bootstrapCI(rows.map(x=>x.delta01),parseInt(hash(`${h.id}:ci`),16));
    const hasHoldout=independentCount>=4&&holdoutCount>=2&&contexts.size>=2&&delays.size>=2&&mean!==null&&mean>.015&&ci.low!==null&&ci.low>0;
    const repeatedContexts=new Set(rows.filter(x=>x.holdout).map(x=>x.contextKey)).size;
    const replicated=hasHoldout&&holdoutCount>=4&&repeatedContexts>=3&&mean!==null&&mean>.03&&ci.low!==null&&ci.low>0;
    const status=replicated?'replicated':hasHoldout?'holdout-verified':'insufficient';
    const cycle=this.state.developmentCycles.find(c=>c.hypothesisId===h.id&&c.stage!=='closed');
    if(cycle){cycle.verifiedEvidenceCount=independentCount;cycle.lastEvidenceAt=row.at;cycle.stage=replicated?'replicated':hasHoldout?'holdout-verified':'awaiting-evidence';}
    let promoted=false;
    if(status==='replicated'&&h.evidenceGate==='holdout-verified'){
      // Holdout passage is provisional; only independently replicated evidence changes the organism.
      h.evidenceGate='replicated';h.status='completed';h.completedAt=now();h.result01=clamp(.5+(mean??0));
      this.state.agenda.selectedHypothesisId=null;this.state.agenda.selectedArea=null;
      const gain=Math.min(.08,Math.max(0,mean??0)*.12);
      this.state.curriculum.mastery[h.area]=clamp((this.state.curriculum.mastery[h.area]??.3)+gain);
      this.state.curriculum.completedSteps+=1;this.state.acceptedChanges++;promoted=true;
      const preferred=this.preferredAction(h.area);const signed=(mean??0)>=0?1:-1;
      this.state.actionBias[preferred]=Math.max(-.12,Math.min(.12,this.state.actionBias[preferred]+signed*Math.min(.035,Math.abs(mean??0)*.08)));
      const positiveRate=rows.filter(x=>x.delta01>0).length/Math.max(1,rows.length);
      this.state.metrics.experimentSuccess01=clamp(this.state.metrics.experimentSuccess01*.9+positiveRate*.1);
      this.state.metrics.longHorizonImprovement01=clamp(this.state.metrics.longHorizonImprovement01*.94+clamp(.5+(mean??0))*.06);
    }else if(status==='holdout-verified'&&(!h.evidenceGate||h.evidenceGate==='none')){
      // Preserve the holdout gate and continue collecting delayed evidence without changing skill weights.
      h.evidenceGate='holdout-verified';h.status='awaiting-evidence';
    }
    return {eligible:status!=='insufficient',evidenceCount:independentCount,distinctContexts:contexts.size,distinctDelays:delays.size,holdoutCount,independentCount,meanDelta01:mean,ci95Low01:ci.low,ci95High01:ci.high,status,promoted};
  }

  developmentEvidence(hypothesisId?:string){ return structuredClone(this.state.externalEvidence.filter(e=>!hypothesisId||e.hypothesisId===hypothesisId).slice(-128)); }

  recordRollback(reason:string){this.state.rollbackCount++;this.state.metrics.longHorizonImprovement01=clamp(this.state.metrics.longHorizonImprovement01*.9+.1*.35);const h=this.state.hypotheses.find(x=>x.id===this.state.currentHypothesisId);if(h)h.status='rolled-back';this.state.currentHypothesisId=null;return reason;}


  observeDevelopmentalOutcome(input:{kind?:'developmental-outcome';area?:DevelopmentArea|null;outcome01:number;verified?:boolean;verification?:OutcomeVerification;toolId?:string;executionId?:string;decisionId?:string;delayed?:boolean;transfer?:boolean;at?:number}){
    // The legacy verified boolean is descriptive only; certification needs a verifier-minted receipt.
    const binding=developmentalOutcomeVerificationInput(input);
    if(typeof input.outcome01!=='number'||!Number.isFinite(input.outcome01)||input.outcome01<0||input.outcome01>1||
       (input.delayed!==undefined&&typeof input.delayed!=='boolean')||(input.transfer!==undefined&&typeof input.transfer!=='boolean'))throw new Error('invalid-developmental-outcome');
    if(input.area!==undefined&&input.area!==null&&binding.area===null)throw new Error('invalid-developmental-outcome-area');
    const actionBinding=typeof input.toolId==='string'&&typeof input.executionId==='string'&&typeof input.decisionId==='string'
      ? {toolId:input.toolId,input:binding,executionId:input.executionId,decisionId:input.decisionId}
      : null;
    const verified=Boolean(input.kind==='developmental-outcome'&&input.toolId===P36_DEVELOPMENTAL_OUTCOME_TOOL_ID&&actionBinding&&isTrustedDecisionLinkedExternalPostcondition(input.verification,actionBinding));
    const outcome=binding.outcome01;
    const delayed=binding.delayed;
    const transfer=binding.transfer;
    const observationId=verified?input.verification?.observationId:undefined;
    const receiptKey=observationId?`${observationId}:${hash(JSON.stringify(binding)??'')}`:undefined;
    const alreadyApplied=Boolean(receiptKey&&this.state.developmentalEvidenceReceiptIds.includes(receiptKey));
    const observationAlreadyUsed=Boolean(observationId&&this.state.developmentalEvidenceObservationIds.includes(observationId));
    const applyVerified=Boolean(verified&&receiptKey&&!alreadyApplied&&!observationAlreadyUsed);
    if(!alreadyApplied&&(!verified||observationAlreadyUsed))this.state.rejectedMaturityReceipts=Math.min(1_000_000_000,this.state.rejectedMaturityReceipts+1);
    if(applyVerified){
      this.state.developmentalEvidenceReceiptIds=[...this.state.developmentalEvidenceReceiptIds,receiptKey!].slice(-512);
      if(observationId)this.state.developmentalEvidenceObservationIds=[...this.state.developmentalEvidenceObservationIds,observationId].slice(-512);
      this.state.developmentalMaturity.verifiedOutcomeCount++;
      if(delayed&&outcome>=.62)this.state.developmentalMaturity.retainedOutcomeCount++;
      if(transfer&&outcome>=.62)this.state.developmentalMaturity.transferredOutcomeCount++;
    }
    const failure=applyVerified&&outcome<.4?1:0;
    if(failure)this.state.developmentalMaturity.regressionCount++;
    const evidenceRate=clamp(this.state.developmentalMaturity.verifiedOutcomeCount/Math.max(1,this.state.cycles));
    const retentionRate=clamp(this.state.developmentalMaturity.retainedOutcomeCount/Math.max(1,this.state.developmentalMaturity.verifiedOutcomeCount));
    const transferRate=clamp(this.state.developmentalMaturity.transferredOutcomeCount/Math.max(1,this.state.developmentalMaturity.verifiedOutcomeCount));
    const regressionRate=clamp(this.state.developmentalMaturity.regressionCount/Math.max(1,this.state.developmentalMaturity.verifiedOutcomeCount));
    const score=clamp(evidenceRate*.35+retentionRate*.30+transferRate*.25+(1-regressionRate)*.10);
    const current=this.state.developmentalMaturity.stage;
    let next=current;
    if(this.state.developmentalMaturity.verifiedOutcomeCount<3)next='seed';
    else if(evidenceRate<.18)next='acquisition';
    else if(retentionRate<.45)next='integration';
    else if(transferRate<.40)next='transfer';
    else if(retentionRate<.72)next='consolidation';
    else if(this.state.developmentalMaturity.verifiedOutcomeCount>=12&&regressionRate<.18)next='stable';
    const rank:Record<DevelopmentalMaturityStage,number>={seed:0,acquisition:1,integration:2,transfer:3,consolidation:4,stable:5};
    if(rank[next]<rank[current]&&failure===0)next=current;
    if(failure>0&&current==='stable'&&regressionRate>.25)next='consolidation';
    this.state.developmentalMaturity.score01=score;
    if(next!==current){
      this.state.developmentalMaturity.stage=next;
      this.state.developmentalMaturity.lastTransitionAt=input.at??now();
      this.state.developmentalMaturity.history=[{cycle:this.state.cycles,stage:next,area:binding.area??this.state.curriculum.focus,verified01:applyVerified?1:0,retention01:applyVerified&&delayed&&outcome>=.62?1:0,transfer01:applyVerified&&transfer&&outcome>=.62?1:0,failed01:failure,at:input.at??now()},...this.state.developmentalMaturity.history].slice(0,64);
    }
    return structuredClone(this.state.developmentalMaturity);
  }

  developmentalCertification(){
    const d=this.state.developmentalMaturity;
    return {stage:d.stage,score01:d.score01,verifiedOutcomeCount:d.verifiedOutcomeCount,retainedOutcomeCount:d.retainedOutcomeCount,transferredOutcomeCount:d.transferredOutcomeCount,regressionCount:d.regressionCount,certified:d.stage==='stable'&&d.verifiedOutcomeCount>=12&&d.retainedOutcomeCount>=8&&d.transferredOutcomeCount>=6&&d.regressionCount/Math.max(1,d.verifiedOutcomeCount)<.18};
  }

  actionBias(action:ActionKind){return Math.max(-0.12,Math.min(0.12,Number(this.state.actionBias[action]??0)));}
  developmentTaskBias(action:ActionKind){
    const c=this.activeDevelopmentCycle({clone:false}); if(!c) return 0;
    if(this.state.spentBudget01>=this.state.learningBudget01) return 0;
    return action===c.requestedAction ? 0.055 : (['rest','wait','defer'].includes(action)?0:-0.008);
  }

  diagnostics(){
    return {
      cycles:this.state.cycles,
      currentHypothesisId:this.state.currentHypothesisId,
      agenda:{...this.state.agenda},
      hypotheses:this.state.hypotheses.length,
      experiments:this.state.experiments.length,
      developmentCycles:this.state.developmentCycles.length,
      activeDevelopmentCycle:this.activeDevelopmentCycle(),
      developmentTaskRequest:this.developmentTaskRequest(),
      externalEvidence:this.state.externalEvidence.length,
      investmentDecisions:this.state.investmentDecisions.length,
      learningBudget01:this.state.learningBudget01,
      spentBudget01:this.state.spentBudget01,
      acceptedChanges:this.state.acceptedChanges,
      rejectedChanges:this.state.rejectedChanges,
      rollbackCount:this.state.rollbackCount,
      unverifiedEvidenceAttempts:this.state.unverifiedEvidenceAttempts,
      rejectedMaturityReceipts:this.state.rejectedMaturityReceipts,
      metrics:{...this.state.metrics},
      developmentalMaturity:this.developmentalCertification(),
      curriculum:{...this.state.curriculum,mastery:{...this.state.curriculum.mastery}},
      actionBias:{...this.state.actionBias},
    };
  }

  private hypothesisText(area:DevelopmentArea){
    const map:Record<DevelopmentArea,string>={
      memory:'Сжатая и приоритетная работа с памятью должна повышать полезность воспоминаний без роста стоимости извлечения.',
      learning:'Дополнительный локальный learning-pass должен уменьшить ошибку предсказания на отложенных состояниях.',
      'world-model':'Калибровка модели последствий должна улучшить многошаговой прогноз будущего состояния.',
      'self-model':'Более точное самопредсказание должно уменьшить расхождение между ожидаемым и фактическим исходом собственного действия.',
      relationship:'Более точная оценка совместной истории должна улучшить калибровку социальных решений.',
      agency:'Явное разделение собственного выбора и внешнего запроса должно улучшить калибровку автономии.',
      'resource-discipline':'Ограничение вычислений по ожидаемой информационной ценности должно улучшить результат на единицу ресурса.',
      perception:'Дополнительная проверка неоднозначных сигналов должна уменьшить multimodal uncertainty.',
    };return map[area];
  }
  private baseline(state:OrganismState,area:DevelopmentArea){
    const n=state.needs; const base=clamp(.35+n.identityCoherence*.16+n.energy*.12+(1-n.uncertainty)*.16+state.autonomyScore*.12+state.attentionBudget*.08);
    const penalty=area==='resource-discipline'?n.cognitiveLoad*.08:area==='world-model'?state.predictionError*.1:0;
    return clamp(base-penalty);
  }
  private preferredAction(area:DevelopmentArea):ActionKind {
    const map:Record<DevelopmentArea,ActionKind>={memory:'reflect',learning:'verify','world-model':'explore','self-model':'reflect',relationship:'respond',agency:'explore','resource-discipline':'rest',perception:'verify'};
    return map[area];
  }
  private safeTreatment(state:OrganismState,area:DevelopmentArea,seed:number){
    const b=this.baseline(state,area);
    const mastery=this.state.curriculum.mastery[area]??.3;
    const deterministic=((Math.abs(Math.sin(seed*12.9898))+Math.abs(Math.sin(state.tick+7.1)))/2)*.035;
    const boost=clamp((1-mastery)*.18 + this.state.metrics.experimentSuccess01*.05 - state.needs.uncertainty*.025);
    return clamp(b+boost+deterministic);
  }
}

export const defaultP36SelfDevelopment=defaultState;
