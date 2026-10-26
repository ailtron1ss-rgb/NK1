import {
  CognitiveEventFabric,
  type CognitiveEventNode,
  type CognitiveStage,
  type OperationalCycleLineageCheck,
} from '../system/CognitiveEventFabric.ts';
import {
  UnifiedCognitiveCycle,
  type UnifiedCognitiveCycleResult,
  type UnifiedCycleStage,
} from '../system/UnifiedCognitiveCycle.ts';
import { sha256Stable } from './StableSerialization.ts';

export interface CanonicalCognitiveStageInput {
  source: string;
  external?: boolean;
  confidence01: number;
  payload: Record<string, unknown>;
}

export interface CanonicalCognitiveCycleAnchors {
  tick?: number;
  at?: number;
  observation?: string;
  prediction?: string;
  appraisal?: string;
  attention?: string;
  memory?: string;
  goal?: string;
  plan?: string;
  action?: string;
}

export interface CanonicalDecisionCycleAnchors extends CanonicalCognitiveCycleAnchors {
  tick: number;
  at: number;
  observation: string;
  prediction: string;
  appraisal: string;
  attention: string;
  memory: string;
  goal: string;
  plan: string;
  action: string;
}

export interface CanonicalDecisionCycleEvents {
  anchors: CanonicalDecisionCycleAnchors;
  observationEvent: CognitiveEventNode;
  predictionEvent: CognitiveEventNode;
  appraisalEvent: CognitiveEventNode;
  attentionEvent: CognitiveEventNode;
  memoryEvent: CognitiveEventNode;
  goalEvent: CognitiveEventNode;
  planEvent: CognitiveEventNode;
  actionEvent: CognitiveEventNode;
}

export interface CanonicalCycleCompletion {
  tick: number;
  outcomeEvent: CognitiveEventNode;
  learningEvent: CognitiveEventNode;
  selfUpdateEvent: CognitiveEventNode;
  cycleLineage: OperationalCycleLineageCheck;
  cycleResult: UnifiedCognitiveCycleResult | null;
  completionRecorded: boolean;
  replayed: boolean;
}

type CanonicalEventFingerprintInput = {
  tick: number;
  at: number;
  stage: CognitiveStage;
  source: string;
  parentIds: string[];
  external: boolean;
  confidence01: number;
  payload: Record<string, unknown>;
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const eventFingerprint = (event: CanonicalEventFingerprintInput | CognitiveEventNode): string =>
  sha256Stable({
    tick: event.tick,
    at: event.at,
    stage: event.stage,
    source: event.source,
    parentIds: event.parentIds,
    external: event.external,
    confidence01: event.confidence01,
    payload: event.payload,
  });

function assertStageInput(label: string, value: unknown): asserts value is CanonicalCognitiveStageInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`canonical-cognitive-kernel-${label}-stage-required`);
  }
  const stage = value as Record<string, unknown>;
  if (typeof stage.source !== 'string' || !stage.source.trim()) {
    throw new TypeError(`canonical-cognitive-kernel-${label}-source-required`);
  }
  if (
    typeof stage.confidence01 !== 'number' ||
    !Number.isFinite(stage.confidence01) ||
    stage.confidence01 < 0 ||
    stage.confidence01 > 1
  ) {
    throw new RangeError(`canonical-cognitive-kernel-${label}-confidence-must-be-in-0-1`);
  }
  if (stage.external !== undefined && typeof stage.external !== 'boolean') {
    throw new TypeError(`canonical-cognitive-kernel-${label}-external-must-be-boolean`);
  }
  if (!stage.payload || typeof stage.payload !== 'object' || Array.isArray(stage.payload)) {
    throw new TypeError(`canonical-cognitive-kernel-${label}-payload-must-be-a-record`);
  }
}

/**
 * The single coordinator for NK1's internal cognitive cycle.
 * OrganismCore owns domain computation; this class binds those results into one
 * causal chain and closes it with outcome, learning and self-update evidence.
 * The event and cycle classes remain ledgers/verifiers, not parallel decision-makers.
 */
export class CanonicalCognitiveKernel {
  private readonly eventFabric: CognitiveEventFabric;
  private readonly unifiedCycle: UnifiedCognitiveCycle;

  constructor(eventFabric: CognitiveEventFabric, unifiedCycle: UnifiedCognitiveCycle) {
    this.eventFabric = eventFabric;
    this.unifiedCycle = unifiedCycle;
  }

  private resolveAt(at?: number): number {
    if (at === undefined) return Date.now();
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) {
      throw new RangeError('canonical-cognitive-kernel-at-must-be-a-non-negative-finite-number');
    }
    return at;
  }

  private stageEventId(tick:number,stage:CognitiveStage):string {
    return `cef:kernel:${tick}:${stage}`;
  }

  private prepareStageEvent(
    tick:number,
    at:number,
    stage:CognitiveStage,
    input:CanonicalCognitiveStageInput,
    parentIds:string[]=[],
  ):CanonicalEventFingerprintInput {
    return {
      tick,
      at,
      stage,
      source:String(input.source||'unknown').slice(0,120),
      parentIds:parentIds.map(String).slice(0,12),
      external:Boolean(input.external),
      confidence01:clamp01(input.confidence01),
      payload:{...input.payload},
    };
  }

  private appendPreparedStage(
    tick:number,
    stage:CognitiveStage,
    eventInput:CanonicalEventFingerprintInput,
  ):CognitiveEventNode {
    const event=this.eventFabric.append({
      ...eventInput,
      id:this.stageEventId(tick,stage),
    });
    if(eventFingerprint(event)!==eventFingerprint(eventInput)) {
      throw new Error('canonical-cognitive-kernel-event-conflict');
    }
    return event;
  }

  private assertNoConflictingPreparedStages(
    prepared:Array<{stage:CognitiveStage;eventInput:CanonicalEventFingerprintInput}>,
  ):void {
    // Check every replay key before the first write. If a persisted/partial cycle
    // contains one conflicting later stage, do not append the earlier missing stages.
    for(const item of prepared) {
      const existing=this.eventFabric.getById(this.stageEventId(item.eventInput.tick,item.stage));
      if(existing && eventFingerprint(existing)!==eventFingerprint(item.eventInput)) {
        throw new Error('canonical-cognitive-kernel-event-conflict');
      }
    }
  }

  private appendStage(
    tick:number,
    at:number,
    stage:CognitiveStage,
    input:CanonicalCognitiveStageInput,
    parentIds:string[]=[],
  ):CognitiveEventNode {
    return this.appendPreparedStage(
      tick,
      stage,
      this.prepareStageEvent(tick,at,stage,input,parentIds),
    );
  }

  beginDecisionCycle(input: {
    tick: number;
    at?: number;
    observation: CanonicalCognitiveStageInput;
    prediction: CanonicalCognitiveStageInput;
    appraisal: CanonicalCognitiveStageInput;
    attention: CanonicalCognitiveStageInput;
    memory: CanonicalCognitiveStageInput;
    goal: CanonicalCognitiveStageInput;
    plan: CanonicalCognitiveStageInput;
    action: CanonicalCognitiveStageInput;
  }): CanonicalDecisionCycleEvents {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('canonical-cognitive-kernel-input-required');
    }
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
      throw new RangeError('canonical-cognitive-kernel-tick-must-be-a-non-negative-safe-integer');
    }
    const stageInputs = [
      ['observation', input.observation],
      ['prediction', input.prediction],
      ['appraisal', input.appraisal],
      ['attention', input.attention],
      ['memory', input.memory],
      ['goal', input.goal],
      ['plan', input.plan],
      ['action', input.action],
    ] as const;
    for (const [label, value] of stageInputs) assertStageInput(label, value);
    const at=this.resolveAt(input.at);
    const idFor=(stage:CognitiveStage)=>this.stageEventId(input.tick,stage);
    const parents=(...ids:Array<string|undefined>):string[]=>
      ids.filter((id):id is string=>typeof id==='string'&&id.length>0);

    const specifications:Array<{stage:CognitiveStage;input:CanonicalCognitiveStageInput;parentIds:string[]}>= [
      {stage:'observation',input:input.observation,parentIds:[]},
      {stage:'prediction',input:input.prediction,parentIds:parents(idFor('observation'))},
      {stage:'appraisal',input:input.appraisal,parentIds:parents(idFor('observation'),idFor('prediction'))},
      {stage:'attention',input:input.attention,parentIds:parents(idFor('appraisal'),idFor('prediction'))},
      {stage:'memory',input:input.memory,parentIds:parents(idFor('attention'),idFor('observation'))},
      {stage:'goal',input:input.goal,parentIds:parents(idFor('appraisal'),idFor('memory'),idFor('prediction'))},
      {stage:'plan',input:input.plan,parentIds:parents(idFor('goal'),idFor('prediction'))},
      {stage:'action',input:input.action,parentIds:parents(idFor('plan'),idFor('prediction'),idFor('observation'))},
    ];
    const prepared=specifications.map(item=>({
      stage:item.stage,
      eventInput:this.prepareStageEvent(input.tick,at,item.stage,item.input,item.parentIds),
    }));
    // Preflight the full stage set before writing any event. This also covers a
    // partially restored ledger where only a later stage has a conflicting ID.
    this.assertNoConflictingPreparedStages(prepared);

    const events=new Map<CognitiveStage,CognitiveEventNode>();
    for(const item of prepared) {
      events.set(item.stage,this.appendPreparedStage(input.tick,item.stage,item.eventInput));
    }
    const observationEvent=events.get('observation')!;
    const predictionEvent=events.get('prediction')!;
    const appraisalEvent=events.get('appraisal')!;
    const attentionEvent=events.get('attention')!;
    const memoryEvent=events.get('memory')!;
    const goalEvent=events.get('goal')!;
    const planEvent=events.get('plan')!;
    const actionEvent=events.get('action')!;
    const anchors:CanonicalDecisionCycleAnchors={
      tick:input.tick,at,observation:observationEvent.id,prediction:predictionEvent.id,
      appraisal:appraisalEvent.id,attention:attentionEvent.id,memory:memoryEvent.id,
      goal:goalEvent.id,plan:planEvent.id,action:actionEvent.id,
    };
    return {
      anchors,observationEvent,predictionEvent,appraisalEvent,attentionEvent,
      memoryEvent,goalEvent,planEvent,actionEvent,
    };
  }

  completeCycle(input: {
    anchors: CanonicalCognitiveCycleAnchors;
    fallbackTick: number;
    at?: number;
    outcome: CanonicalCognitiveStageInput;
    learning: CanonicalCognitiveStageInput;
    selfUpdate: CanonicalCognitiveStageInput;
  }): CanonicalCycleCompletion {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('canonical-cognitive-kernel-completion-input-required');
    }
    if (!Number.isSafeInteger(input.fallbackTick) || input.fallbackTick < 0) {
      throw new RangeError('canonical-cognitive-kernel-fallback-tick-must-be-a-non-negative-safe-integer');
    }
    if (!input.anchors || typeof input.anchors !== 'object' || Array.isArray(input.anchors)) {
      throw new TypeError('canonical-cognitive-kernel-anchors-required');
    }
    const anchorTick=input.anchors.tick;
    if(anchorTick!==undefined&&(!Number.isSafeInteger(anchorTick)||anchorTick<0)) {
      throw new RangeError('canonical-cognitive-kernel-anchor-tick-must-be-a-non-negative-safe-integer');
    }
    if(input.anchors.at!==undefined&&(
      typeof input.anchors.at!=='number'||!Number.isFinite(input.anchors.at)||input.anchors.at<0
    )) {
      throw new RangeError('canonical-cognitive-kernel-anchor-at-must-be-a-non-negative-finite-number');
    }
    for(const key of ['observation','prediction','appraisal','attention','memory','goal','plan','action'] as const) {
      const value=input.anchors[key];
      if(value!==undefined&&(typeof value!=='string'||!value.trim())) {
        throw new TypeError(`canonical-cognitive-kernel-anchor-${key}-must-be-a-non-empty-string`);
      }
    }
    assertStageInput('outcome',input.outcome);
    assertStageInput('learning',input.learning);
    assertStageInput('self-update',input.selfUpdate);

    // Feedback events retain the original logical action tick while 'at' records
    // the event-arrival time. Stable IDs make replays inspectable across later ticks.
    const tick=anchorTick??input.fallbackTick;
    const at=this.resolveAt(input.at);
    const parents=(...ids:Array<string|undefined>):string[]=>
      ids.filter((id):id is string=>typeof id==='string'&&id.length>0);
    const outcomeId=this.stageEventId(tick,'outcome');
    const learningId=this.stageEventId(tick,'learning');
    const selfUpdateId=this.stageEventId(tick,'self-update');
    const stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>={
      observation:input.anchors.observation,
      prediction:input.anchors.prediction,
      appraisal:input.anchors.appraisal,
      attention:input.anchors.attention,
      memory:input.anchors.memory,
      goal:input.anchors.goal,
      plan:input.anchors.plan,
      action:input.anchors.action,
      outcome:outcomeId,
      learning:learningId,
      'self-update':selfUpdateId,
    };
    const prepared=[
      {
        stage:'outcome' as const,
        eventInput:this.prepareStageEvent(tick,at,'outcome',input.outcome,parents(input.anchors.action,input.anchors.prediction)),
      },
      {
        stage:'learning' as const,
        eventInput:this.prepareStageEvent(tick,at,'learning',input.learning,parents(outcomeId)),
      },
      {
        stage:'self-update' as const,
        eventInput:this.prepareStageEvent(tick,at,'self-update',input.selfUpdate,parents(learningId)),
      },
    ];
    this.assertNoConflictingPreparedStages(prepared);
    const prior=this.unifiedCycle.snapshot();
    const existing=prepared.map(item=>this.eventFabric.getById(this.stageEventId(tick,item.stage)));

    if(tick<=prior.lastTick) {
      // Never append feedback for an older/finalized tick that cannot be evaluated
      // by the monotonic UnifiedCognitiveCycle. Only a byte-for-byte matching
      // already-recorded completion may be replayed after a newer tick has closed.
      if(existing.some(event=>event===null)) {
        throw new Error(tick<prior.lastTick
          ? 'canonical-cognitive-kernel-stale-completion'
          : 'canonical-cognitive-kernel-completion-already-finalized');
      }
      const [outcomeEvent,learningEvent,selfUpdateEvent]=existing as [CognitiveEventNode,CognitiveEventNode,CognitiveEventNode];
      const cycleLineage=this.eventFabric.verifyOperationalCycle(stageIds);
      let cycleResult:UnifiedCognitiveCycleResult;
      if(tick===prior.lastTick) {
        cycleResult={
          tick,
          stageCoverage01:Math.max(0,1-prior.lastMissingStages.length/6),
          causalContinuity01:cycleLineage.integrity01,
          complete:prior.lastComplete&&cycleLineage.complete,
          missingStages:[...prior.lastMissingStages],
        };
      } else {
        const requiredStages:UnifiedCycleStage[]=['observation','prediction','action','outcome','learning','self-update'];
        const seenIds=new Set<string>();
        const missingStages=requiredStages.filter(stage=>{
          const id=stageIds[stage];
          if(typeof id!=='string'||!id||seenIds.has(id))return true;
          const event=this.eventFabric.getById(id);
          if(!event||event.tick!==tick||event.stage!==stage)return true;
          seenIds.add(id);
          return false;
        });
        const continuity=cycleLineage.complete?cycleLineage.integrity01:0;
        cycleResult={
          tick,
          stageCoverage01:(requiredStages.length-missingStages.length)/requiredStages.length,
          causalContinuity01:continuity,
          complete:missingStages.length===0&&continuity>=.5,
          missingStages,
        };
      }
      return {
        tick,outcomeEvent,learningEvent,selfUpdateEvent,cycleLineage,cycleResult,
        completionRecorded:Boolean(cycleResult.complete),
        replayed:true,
      };
    }

    const [outcomeEvent,learningEvent,selfUpdateEvent]=prepared.map(item=>
      this.appendPreparedStage(tick,item.stage,item.eventInput)
    ) as [CognitiveEventNode,CognitiveEventNode,CognitiveEventNode];
    const cycleLineage=this.eventFabric.verifyOperationalCycle(stageIds);
    const cycleResult=this.unifiedCycle.evaluate({
      tick,
      stageIds,
      parentIntegrity01:cycleLineage.complete?cycleLineage.integrity01:0,
    });
    return {
      tick,outcomeEvent,learningEvent,selfUpdateEvent,cycleLineage,cycleResult,
      completionRecorded:Boolean(cycleResult.complete),
      replayed:false,
    };
  }

}
