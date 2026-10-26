export interface UnifiedCognitiveSubstrateState {
  version: 1;
  cycles: number;
  lastTick: number;
  self: { continuity01:number; coherence01:number; agency01:number; realityAlignment01:number; mode:string; lastAction:string };
  world: { confidence01:number; uncertainty01:number; entityCount:number; eventCount:number; relationCount:number; conflict01:number; newEntityRate01:number };
  prediction: { error01:number; openCount:number; agingCount:number; expiredCount:number; priority01:number };
  resources: { battery01:number; thermal01:number; ramPressure01:number; computeCapacity01:number; scarcity01:number; efficiency01:number };
  coupling: { selfWorld01:number; predictionGrounding01:number; memoryPressure01:number; actionReadiness01:number };
  provenance: { evidenceCoverage01:number; realObservationCoverage01:number; unknown01:number };
  lastReason: string;
}

const clamp = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const isRecord = (value:unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (record:Record<string, unknown>, key:string):unknown =>
  Object.hasOwn(record, key) ? record[key] : undefined;
const section = (record:Record<string, unknown>, key:string):Record<string, unknown> => {
  const value = own(record, key);
  return isRecord(value) ? value : {};
};
const metric = (value:unknown, fallback:number):number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value) : fallback;
const trustedMetric = (value:unknown, missingFallback:number, invalidFallback:number):number => {
  if (value === undefined) return missingFallback;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : invalidFallback;
};
const sectionMetric = (
  record:Record<string, unknown>,
  malformedSection:boolean,
  key:string,
  missingFallback:number,
  invalidFallback:number,
):number => trustedMetric(malformedSection ? null : own(record, key), missingFallback, invalidFallback);
const counter = (value:unknown, fallback=0):number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
const cleanText = (value:unknown, fallback:string, maxLength:number):string => {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maxLength);
  return text || fallback;
};

export const defaultUnifiedCognitiveSubstrate = (): UnifiedCognitiveSubstrateState => ({
  version:1, cycles:0, lastTick:0,
  self:{continuity01:.7,coherence01:.7,agency01:.5,realityAlignment01:.5,mode:'wait',lastAction:'wait'},
  world:{confidence01:.35,uncertainty01:.65,entityCount:0,eventCount:0,relationCount:0,conflict01:0,newEntityRate01:0},
  prediction:{error01:.5,openCount:0,agingCount:0,expiredCount:0,priority01:0},
  resources:{battery01:.82,thermal01:.18,ramPressure01:.18,computeCapacity01:.82,scarcity01:.18,efficiency01:.82},
  coupling:{selfWorld01:.35,predictionGrounding01:.35,memoryPressure01:0,actionReadiness01:.4},
  provenance:{evidenceCoverage01:0,realObservationCoverage01:0,unknown01:1},
  lastReason:'initial',
});

export interface UnifiedCognitiveWorkPolicy {
  maxCounterfactualBranches: number;
  allowMatchedCounterfactual: boolean;
  reason: string;
}

/**
 * Bound optional simulation work by the same cross-system state frame used for
 * continuity diagnostics. This policy can only reduce speculative work; it
 * cannot select or replace the action chosen by OrganismCore.
 */
export function resolveUnifiedCognitiveWorkPolicy(
  state: UnifiedCognitiveSubstrateState,
  requestedMaxBranches: number,
): UnifiedCognitiveWorkPolicy {
  if (!Number.isSafeInteger(requestedMaxBranches) || requestedMaxBranches < 0) {
    return { maxCounterfactualBranches: 0, allowMatchedCounterfactual: false, reason: 'invalid-resource-budget' };
  }
  if (requestedMaxBranches === 0) {
    return { maxCounterfactualBranches: 0, allowMatchedCounterfactual: false, reason: 'upstream-budget-zero' };
  }
  if (!isRecord(state) || !isRecord(state.coupling) || !isRecord(state.provenance) ||
      !isRecord(state.resources) || !isRecord(state.world)) {
    return { maxCounterfactualBranches: 0, allowMatchedCounterfactual: false, reason: 'invalid-substrate-state' };
  }
  const requiredMetrics = [
    state.coupling.actionReadiness01,
    state.coupling.predictionGrounding01,
    state.provenance.unknown01,
    state.provenance.evidenceCoverage01,
    state.resources.battery01,
    state.resources.computeCapacity01,
    state.resources.efficiency01,
    state.resources.scarcity01,
    state.resources.ramPressure01,
    state.resources.thermal01,
    state.world.conflict01,
  ];
  if (requiredMetrics.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
    return { maxCounterfactualBranches: 0, allowMatchedCounterfactual: false, reason: 'invalid-substrate-state' };
  }

  const { actionReadiness01, predictionGrounding01 } = state.coupling;
  const unknown01 = state.provenance.unknown01;
  const evidenceCoverage01 = state.provenance.evidenceCoverage01;
  const scarcity01 = state.resources.scarcity01;
  const ramPressure01 = state.resources.ramPressure01;
  const thermal01 = state.resources.thermal01;
  const conflict01 = state.world.conflict01;
  const { battery01, computeCapacity01, efficiency01 } = state.resources;
  if (actionReadiness01 < 0.25 || conflict01 > 0.9 || scarcity01 > 0.94 || thermal01 > 0.98 ||
      battery01 < 0.05 || computeCapacity01 < 0.1 || efficiency01 < 0.1) {
    return { maxCounterfactualBranches: 0, allowMatchedCounterfactual: false, reason: 'substrate-critical-pressure' };
  }

  const constrained =
    actionReadiness01 < 0.55 ||
    predictionGrounding01 < 0.45 ||
    unknown01 > 0.75 ||
    battery01 < 0.25 ||
    computeCapacity01 < 0.35 ||
    efficiency01 < 0.35 ||
    scarcity01 > 0.75 ||
    ramPressure01 > 0.85 ||
    thermal01 > 0.9;
  const maxCounterfactualBranches = constrained ? Math.min(1, requestedMaxBranches) : requestedMaxBranches;
  const allowMatchedCounterfactual =
    maxCounterfactualBranches > 0 &&
    actionReadiness01 >= 0.45 &&
    predictionGrounding01 >= 0.5 &&
    evidenceCoverage01 >= 0.3 &&
    unknown01 <= 0.7 &&
    battery01 >= 0.2 &&
    computeCapacity01 >= 0.5 &&
    efficiency01 >= 0.4 &&
    scarcity01 <= 0.8 &&
    conflict01 <= 0.5;

  const reasons = [
    constrained ? 'substrate-budget-constrained' : 'substrate-budget-open',
    allowMatchedCounterfactual ? 'matched-counterfactual-grounded' : 'matched-counterfactual-withheld',
  ];
  return { maxCounterfactualBranches, allowMatchedCounterfactual, reason: reasons.join(';') };
}

/**
 * Bounded cross-system projection. It never owns canonical domain state.
 * Persisted snapshots and live inputs are treated as untrusted data: no spread
 * of an arbitrary object is allowed to bypass the finite/range/schema boundary.
 */
export class UnifiedCognitiveSubstrate {
  private state = defaultUnifiedCognitiveSubstrate();

  restore(raw?: Partial<UnifiedCognitiveSubstrateState> | null): void {
    const source = isRecord(raw) ? raw : {};
    const storedVersion = own(source, 'version');
    if (storedVersion !== undefined && storedVersion !== 1) {
      throw new RangeError('unsupported unified-cognitive-substrate state version');
    }
    const d = defaultUnifiedCognitiveSubstrate();
    const selfRaw = own(source, 'self');
    const worldRaw = own(source, 'world');
    const predictionRaw = own(source, 'prediction');
    const resourcesRaw = own(source, 'resources');
    const couplingRaw = own(source, 'coupling');
    const provenanceRaw = own(source, 'provenance');
    const selfMalformed = selfRaw !== undefined && !isRecord(selfRaw);
    const worldMalformed = worldRaw !== undefined && !isRecord(worldRaw);
    const predictionMalformed = predictionRaw !== undefined && !isRecord(predictionRaw);
    const resourcesMalformed = resourcesRaw !== undefined && !isRecord(resourcesRaw);
    const couplingMalformed = couplingRaw !== undefined && !isRecord(couplingRaw);
    const provenanceMalformed = provenanceRaw !== undefined && !isRecord(provenanceRaw);
    const self = section(source, 'self');
    const world = section(source, 'world');
    const prediction = section(source, 'prediction');
    const resources = section(source, 'resources');
    const coupling = section(source, 'coupling');
    const provenance = section(source, 'provenance');

    this.state = {
      version: 1,
      cycles: counter(own(source, 'cycles'), d.cycles),
      lastTick: counter(own(source, 'lastTick'), d.lastTick),
      self: {
        continuity01: metric(own(self, 'continuity01'), d.self.continuity01),
        coherence01: sectionMetric(self, selfMalformed, 'coherence01', d.self.coherence01, 0),
        agency01: sectionMetric(self, selfMalformed, 'agency01', d.self.agency01, 0),
        realityAlignment01: sectionMetric(self, selfMalformed, 'realityAlignment01', d.self.realityAlignment01, 0),
        mode: cleanText(own(self, 'mode'), d.self.mode, 64),
        lastAction: cleanText(own(self, 'lastAction'), d.self.lastAction, 64),
      },
      world: {
        confidence01: sectionMetric(world, worldMalformed, 'confidence01', d.world.confidence01, 0),
        uncertainty01: sectionMetric(world, worldMalformed, 'uncertainty01', d.world.uncertainty01, 1),
        entityCount: counter(own(world, 'entityCount'), d.world.entityCount),
        eventCount: counter(own(world, 'eventCount'), d.world.eventCount),
        relationCount: counter(own(world, 'relationCount'), d.world.relationCount),
        conflict01: sectionMetric(world, worldMalformed, 'conflict01', d.world.conflict01, 1),
        newEntityRate01: sectionMetric(world, worldMalformed, 'newEntityRate01', d.world.newEntityRate01, 1),
      },
      prediction: {
        error01: sectionMetric(prediction, predictionMalformed, 'error01', d.prediction.error01, 1),
        openCount: counter(own(prediction, 'openCount'), d.prediction.openCount),
        agingCount: counter(own(prediction, 'agingCount'), d.prediction.agingCount),
        expiredCount: counter(own(prediction, 'expiredCount'), d.prediction.expiredCount),
        priority01: sectionMetric(prediction, predictionMalformed, 'priority01', d.prediction.priority01, 1),
      },
      resources: {
        battery01: sectionMetric(resources, resourcesMalformed, 'battery01', d.resources.battery01, 0),
        thermal01: sectionMetric(resources, resourcesMalformed, 'thermal01', d.resources.thermal01, 1),
        ramPressure01: sectionMetric(resources, resourcesMalformed, 'ramPressure01', d.resources.ramPressure01, 1),
        computeCapacity01: sectionMetric(resources, resourcesMalformed, 'computeCapacity01', d.resources.computeCapacity01, 0),
        scarcity01: sectionMetric(resources, resourcesMalformed, 'scarcity01', d.resources.scarcity01, 1),
        efficiency01: sectionMetric(resources, resourcesMalformed, 'efficiency01', d.resources.efficiency01, 0),
      },
      coupling: {
        selfWorld01: sectionMetric(coupling, couplingMalformed, 'selfWorld01', d.coupling.selfWorld01, 0),
        predictionGrounding01: sectionMetric(coupling, couplingMalformed, 'predictionGrounding01', d.coupling.predictionGrounding01, 0),
        memoryPressure01: sectionMetric(coupling, couplingMalformed, 'memoryPressure01', d.coupling.memoryPressure01, 1),
        actionReadiness01: sectionMetric(coupling, couplingMalformed, 'actionReadiness01', d.coupling.actionReadiness01, 0),
      },
      provenance: {
        evidenceCoverage01: sectionMetric(provenance, provenanceMalformed, 'evidenceCoverage01', d.provenance.evidenceCoverage01, 0),
        realObservationCoverage01: sectionMetric(provenance, provenanceMalformed, 'realObservationCoverage01', d.provenance.realObservationCoverage01, 0),
        unknown01: sectionMetric(provenance, provenanceMalformed, 'unknown01', d.provenance.unknown01, 1),
      },
      lastReason: cleanText(own(source, 'lastReason'), d.lastReason, 256),
    };
  }

  snapshot(): UnifiedCognitiveSubstrateState { return structuredClone(this.state); }

  integrate(input: {
    tick:number;
    self:UnifiedCognitiveSubstrateState['self'];
    world:UnifiedCognitiveSubstrateState['world'];
    prediction:UnifiedCognitiveSubstrateState['prediction'];
    resources:UnifiedCognitiveSubstrateState['resources'];
    memoryPressure01:number; evidenceCoverage01:number; realObservationCoverage01:number; unknown01:number; reason?:string;
  }): UnifiedCognitiveSubstrateState {
    if (!isRecord(input)) throw new TypeError('unified cognitive substrate input must be an object');
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
      throw new RangeError('unified cognitive substrate tick must be a non-negative safe integer');
    }
    if (input.tick <= this.state.lastTick) {
      throw new RangeError('unified cognitive substrate tick must strictly increase');
    }
    if (![input.self, input.world, input.prediction, input.resources].every(isRecord)) {
      throw new TypeError('unified cognitive substrate sections must be objects');
    }

    const d = defaultUnifiedCognitiveSubstrate();
    const rawSelf = input.self as unknown as Record<string, unknown>;
    const rawWorld = input.world as unknown as Record<string, unknown>;
    const rawPrediction = input.prediction as unknown as Record<string, unknown>;
    const rawResources = input.resources as unknown as Record<string, unknown>;
    const self = {
      continuity01: metric(own(rawSelf, 'continuity01'), d.self.continuity01),
      coherence01: trustedMetric(own(rawSelf, 'coherence01'), 0, 0),
      agency01: trustedMetric(own(rawSelf, 'agency01'), 0, 0),
      realityAlignment01: trustedMetric(own(rawSelf, 'realityAlignment01'), 0, 0),
      mode: cleanText(own(rawSelf, 'mode'), d.self.mode, 64),
      lastAction: cleanText(own(rawSelf, 'lastAction'), d.self.lastAction, 64),
    };
    const world = {
      confidence01: trustedMetric(own(rawWorld, 'confidence01'), 0, 0),
      uncertainty01: trustedMetric(own(rawWorld, 'uncertainty01'), 1, 1),
      entityCount: counter(own(rawWorld, 'entityCount')),
      eventCount: counter(own(rawWorld, 'eventCount')),
      relationCount: counter(own(rawWorld, 'relationCount')),
      conflict01: trustedMetric(own(rawWorld, 'conflict01'), 1, 1),
      newEntityRate01: trustedMetric(own(rawWorld, 'newEntityRate01'), 1, 1),
    };
    const prediction = {
      error01: trustedMetric(own(rawPrediction, 'error01'), 1, 1),
      openCount: counter(own(rawPrediction, 'openCount')),
      agingCount: counter(own(rawPrediction, 'agingCount')),
      expiredCount: counter(own(rawPrediction, 'expiredCount')),
      priority01: trustedMetric(own(rawPrediction, 'priority01'), 1, 1),
    };
    const resources = {
      battery01: trustedMetric(own(rawResources, 'battery01'), 0, 0),
      thermal01: trustedMetric(own(rawResources, 'thermal01'), 1, 1),
      ramPressure01: trustedMetric(own(rawResources, 'ramPressure01'), 1, 1),
      computeCapacity01: trustedMetric(own(rawResources, 'computeCapacity01'), 0, 0),
      scarcity01: trustedMetric(own(rawResources, 'scarcity01'), 1, 1),
      efficiency01: trustedMetric(own(rawResources, 'efficiency01'), 0, 0),
    };
    const memoryPressure01 = trustedMetric(input.memoryPressure01, 1, 1);
    const evidenceCoverage01 = trustedMetric(input.evidenceCoverage01, 0, 0);
    const realObservationCoverage01 = trustedMetric(input.realObservationCoverage01, 0, 0);
    const unknown01 = trustedMetric(input.unknown01, 1, 1);

    // All math below consumes normalized values only. A NaN in a restored or
    // live field therefore cannot poison every derived coupling metric.
    const selfWorld = clamp(
      self.realityAlignment01*.30 +
      world.confidence01*.34 +
      (1-world.conflict01)*.18 +
      self.coherence01*.18
    );
    const predictionGrounding = clamp(
      (1-prediction.error01)*.28 +
      world.confidence01*.28 +
      self.realityAlignment01*.22 +
      evidenceCoverage01*.22
    );
    const actionReadiness = clamp(
      self.agency01*.26 +
      self.coherence01*.18 +
      resources.computeCapacity01*.20 +
      (1-world.uncertainty01)*.18 +
      (1-prediction.error01)*.18
    );

    this.state = {
      version:1,
      cycles:Math.min(Number.MAX_SAFE_INTEGER, this.state.cycles + 1),
      lastTick:input.tick,
      self,
      world,
      prediction,
      resources,
      coupling:{selfWorld01:selfWorld,predictionGrounding01:predictionGrounding,memoryPressure01,actionReadiness01:actionReadiness},
      provenance:{evidenceCoverage01,realObservationCoverage01,unknown01},
      lastReason:cleanText(input.reason, `tick=${input.tick};selfWorld=${selfWorld.toFixed(2)};predictionGrounding=${predictionGrounding.toFixed(2)}`, 256),
    };
    return this.snapshot();
  }

  actionBias(action:string):number {
    const readiness=this.state.coupling.actionReadiness01;
    const grounding=this.state.coupling.predictionGrounding01;
    const resource=this.state.resources.efficiency01;
    const map:Record<string,number> = {
      respond:this.state.self.agency01*.02,
      explore:this.state.world.uncertainty01*.035,
      verify:(1-grounding)*.045,
      rest:(1-resource)*.045,
      reflect:this.state.prediction.error01*.03,
      wait:this.state.world.conflict01*.035,
      defer:(1-resource)*.05,
    };
    return clamp((map[action]??0)+readiness*.005)-.0025;
  }
}
