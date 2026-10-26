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

type UnknownRecord = Record<string, unknown>;

const clamp = (x:number):number => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const isRecord = (value:unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Read only own data properties. Persisted JSON normally has no accessors, but
 * callers can pass JS objects directly; inspecting state must never execute a
 * getter supplied by an untrusted snapshot or live input.
 */
const own = (record:UnknownRecord, key:string):unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
};

const section = (record:UnknownRecord, key:string):UnknownRecord => {
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
  record:UnknownRecord,
  malformedSection:boolean,
  key:string,
  missingFallback:number,
  invalidFallback:number,
):number => trustedMetric(malformedSection ? null : own(record, key), missingFallback, invalidFallback);

const counter = (value:unknown, fallback=0):number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;

const cleanText = (value:unknown, fallback:string, maxLength:number):string => {
  if (typeof value !== 'string') return fallback;
  const text = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
  return text || fallback;
};

const validMetric = (value:unknown, label:string):number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('unified-cognitive-substrate-invalid-metric:' + label);
  }
  return value;
};

const validCounter = (value:unknown, label:string):number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('unified-cognitive-substrate-invalid-counter:' + label);
  }
  return value;
};

const requiredSection = (record:UnknownRecord, key:string):UnknownRecord => {
  const value = own(record, key);
  if (!isRecord(value)) {
    throw new TypeError('unified-cognitive-substrate-section-required:' + key);
  }
  return value;
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
  maxCounterfactualBranches:number;
  allowMatchedCounterfactual:boolean;
  reason:string;
}

/** Governs optional simulations only; OrganismCore remains the action arbiter. */
export function resolveUnifiedCognitiveWorkPolicy(
  state:UnifiedCognitiveSubstrateState,
  requestedMaxBranches:number,
):UnifiedCognitiveWorkPolicy {
  const rejected = (reason:string):UnifiedCognitiveWorkPolicy => ({
    maxCounterfactualBranches:0, allowMatchedCounterfactual:false, reason,
  });
  if (!Number.isSafeInteger(requestedMaxBranches) || requestedMaxBranches < 0) {
    return rejected('invalid-resource-budget');
  }
  if (requestedMaxBranches === 0) return rejected('upstream-budget-zero');
  if (!isRecord(state)) return rejected('invalid-substrate-state');
  const root = state as unknown as UnknownRecord;
  const nested = ['coupling','provenance','resources','world','prediction'];
  const sections = nested.map(key => own(root, key));
  if (own(root, 'version') !== 1 || sections.some(value => !isRecord(value))) {
    return rejected('invalid-substrate-state');
  }
  const coupling=section(root,'coupling'), provenance=section(root,'provenance');
  const resources=section(root,'resources'), world=section(root,'world');
  const prediction=section(root,'prediction');
  const m = {
    readiness:own(coupling,'actionReadiness01'),
    grounding:own(coupling,'predictionGrounding01'),
    unknown:own(provenance,'unknown01'),
    evidence:own(provenance,'evidenceCoverage01'),
    battery:own(resources,'battery01'),
    compute:own(resources,'computeCapacity01'),
    efficiency:own(resources,'efficiency01'),
    scarcity:own(resources,'scarcity01'),
    ram:own(resources,'ramPressure01'),
    thermal:own(resources,'thermal01'),
    conflict:own(world,'conflict01'),
    error:own(prediction,'error01'),
    priority:own(prediction,'priority01'),
  };
  if (Object.values(m).some(value =>
        typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) ||
      !['openCount','agingCount','expiredCount'].every(key => {
        const value=own(prediction,key);
        return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
      })) return rejected('invalid-substrate-state');

  if (m.readiness < .25 || m.conflict > .9 || m.scarcity > .94 || m.thermal > .98 ||
      m.battery < .05 || m.compute < .1 || m.efficiency < .1 || m.error > .98 || m.priority > .98) {
    return rejected('substrate-critical-pressure');
  }
  const constrained = m.readiness < .55 || m.grounding < .45 || m.error > .75 ||
    m.priority > .8 || m.unknown > .75 || m.battery < .25 || m.compute < .35 ||
    m.efficiency < .35 || m.scarcity > .75 || m.ram > .85 || m.thermal > .9;
  const maxCounterfactualBranches = constrained ? Math.min(1, requestedMaxBranches) : requestedMaxBranches;
  const allowMatchedCounterfactual = maxCounterfactualBranches > 0 &&
    m.readiness >= .45 && m.grounding >= .5 && m.error <= .65 && m.priority <= .7 &&
    m.evidence >= .3 && m.unknown <= .7 && m.battery >= .2 && m.compute >= .5 &&
    m.efficiency >= .4 && m.scarcity <= .8 && m.conflict <= .5;
  return {
    maxCounterfactualBranches,
    allowMatchedCounterfactual,
    reason: (constrained ? 'substrate-budget-constrained' : 'substrate-budget-open') + ';' +
      (allowMatchedCounterfactual ? 'matched-counterfactual-grounded' : 'matched-counterfactual-withheld'),
  };
}

/** Bounded cross-system projection. It never owns canonical domain state. */
export class UnifiedCognitiveSubstrate {
  private state = defaultUnifiedCognitiveSubstrate();

  restore(raw?: Partial<UnifiedCognitiveSubstrateState> | null): void {
    if (raw === undefined || raw === null) {
      this.state = defaultUnifiedCognitiveSubstrate();
      return;
    }
    if (!isRecord(raw)) {
      throw new TypeError('unified-cognitive-substrate-state-must-be-a-record');
    }
    const source = raw as UnknownRecord;
    const storedVersion = own(source, 'version');
    if (storedVersion !== undefined && storedVersion !== 1) {
      throw new RangeError('unsupported unified-cognitive-substrate-state-version');
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

    const predictionCountersInvalid = ['openCount','agingCount','expiredCount'].some(key => {
      const value = own(prediction, key);
      return value !== undefined && !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
    });

    // Construct a fresh allow-listed snapshot. Never spread untrusted persisted
    // objects into live state; unknown keys and prototype properties are ignored.
    this.state = {
      version:1,
      cycles:counter(own(source, 'cycles'), d.cycles),
      lastTick:counter(own(source, 'lastTick'), d.lastTick),
      self:{
        continuity01:metric(own(self, 'continuity01'), d.self.continuity01),
        coherence01:sectionMetric(self, selfMalformed, 'coherence01', d.self.coherence01, 0),
        agency01:sectionMetric(self, selfMalformed, 'agency01', d.self.agency01, 0),
        realityAlignment01:sectionMetric(self, selfMalformed, 'realityAlignment01', d.self.realityAlignment01, 0),
        mode:cleanText(own(self, 'mode'), d.self.mode, 64),
        lastAction:cleanText(own(self, 'lastAction'), d.self.lastAction, 64),
      },
      world:{
        confidence01:sectionMetric(world, worldMalformed, 'confidence01', d.world.confidence01, 0),
        uncertainty01:sectionMetric(world, worldMalformed, 'uncertainty01', d.world.uncertainty01, 1),
        entityCount:counter(own(world, 'entityCount'), d.world.entityCount),
        eventCount:counter(own(world, 'eventCount'), d.world.eventCount),
        relationCount:counter(own(world, 'relationCount'), d.world.relationCount),
        conflict01:sectionMetric(world, worldMalformed, 'conflict01', d.world.conflict01, 1),
        newEntityRate01:sectionMetric(world, worldMalformed, 'newEntityRate01', d.world.newEntityRate01, 1),
      },
      prediction:{
        error01:predictionMalformed || predictionCountersInvalid
          ? 1 : sectionMetric(prediction, false, 'error01', d.prediction.error01, 1),
        openCount:counter(own(prediction, 'openCount'), d.prediction.openCount),
        agingCount:counter(own(prediction, 'agingCount'), d.prediction.agingCount),
        expiredCount:counter(own(prediction, 'expiredCount'), d.prediction.expiredCount),
        priority01:predictionMalformed || predictionCountersInvalid
          ? 1 : sectionMetric(prediction, false, 'priority01', d.prediction.priority01, 1),
      },
      resources:{
        battery01:sectionMetric(resources, resourcesMalformed, 'battery01', d.resources.battery01, 0),
        thermal01:sectionMetric(resources, resourcesMalformed, 'thermal01', d.resources.thermal01, 1),
        ramPressure01:sectionMetric(resources, resourcesMalformed, 'ramPressure01', d.resources.ramPressure01, 1),
        computeCapacity01:sectionMetric(resources, resourcesMalformed, 'computeCapacity01', d.resources.computeCapacity01, 0),
        scarcity01:sectionMetric(resources, resourcesMalformed, 'scarcity01', d.resources.scarcity01, 1),
        efficiency01:sectionMetric(resources, resourcesMalformed, 'efficiency01', d.resources.efficiency01, 0),
      },
      coupling:{
        selfWorld01:sectionMetric(coupling, couplingMalformed, 'selfWorld01', d.coupling.selfWorld01, 0),
        predictionGrounding01:sectionMetric(coupling, couplingMalformed, 'predictionGrounding01', d.coupling.predictionGrounding01, 0),
        memoryPressure01:sectionMetric(coupling, couplingMalformed, 'memoryPressure01', d.coupling.memoryPressure01, 1),
        actionReadiness01:sectionMetric(coupling, couplingMalformed, 'actionReadiness01', d.coupling.actionReadiness01, 0),
      },
      provenance:{
        evidenceCoverage01:sectionMetric(provenance, provenanceMalformed, 'evidenceCoverage01', d.provenance.evidenceCoverage01, 0),
        realObservationCoverage01:sectionMetric(provenance, provenanceMalformed, 'realObservationCoverage01', d.provenance.realObservationCoverage01, 0),
        unknown01:sectionMetric(provenance, provenanceMalformed, 'unknown01', d.provenance.unknown01, 1),
      },
      lastReason:cleanText(own(source, 'lastReason'), d.lastReason, 256),
    };
  }

  snapshot(): UnifiedCognitiveSubstrateState {
    return structuredClone(this.state);
  }

  integrate(input: {
    tick:number;
    self:UnifiedCognitiveSubstrateState['self'];
    world:UnifiedCognitiveSubstrateState['world'];
    prediction:UnifiedCognitiveSubstrateState['prediction'];
    resources:UnifiedCognitiveSubstrateState['resources'];
    memoryPressure01:number;
    evidenceCoverage01:number;
    realObservationCoverage01:number;
    unknown01:number;
    reason?:string;
  }): UnifiedCognitiveSubstrateState {
    if (!isRecord(input)) {
      throw new TypeError('unified-cognitive-substrate-input-must-be-a-record');
    }
    const root = input as unknown as UnknownRecord;
    const tick = validCounter(own(root, 'tick'), 'tick');
    if (tick <= this.state.lastTick) {
      throw new RangeError('unified-cognitive-substrate-tick-must-increase-monotonically');
    }
    if (this.state.cycles >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('unified-cognitive-substrate-cycle-counter-exhausted');
    }

    const selfRaw = requiredSection(root, 'self');
    const worldRaw = requiredSection(root, 'world');
    const predictionRaw = requiredSection(root, 'prediction');
    const resourcesRaw = requiredSection(root, 'resources');

    const self = {
      continuity01:validMetric(own(selfRaw, 'continuity01'), 'self.continuity01'),
      coherence01:validMetric(own(selfRaw, 'coherence01'), 'self.coherence01'),
      agency01:validMetric(own(selfRaw, 'agency01'), 'self.agency01'),
      realityAlignment01:validMetric(own(selfRaw, 'realityAlignment01'), 'self.realityAlignment01'),
      mode:cleanText(own(selfRaw, 'mode'), '', 64),
      lastAction:cleanText(own(selfRaw, 'lastAction'), '', 64),
    };
    if (!self.mode || !self.lastAction) {
      throw new TypeError('unified-cognitive-substrate-self-mode-and-action-required');
    }
    const world = {
      confidence01:validMetric(own(worldRaw, 'confidence01'), 'world.confidence01'),
      uncertainty01:validMetric(own(worldRaw, 'uncertainty01'), 'world.uncertainty01'),
      entityCount:validCounter(own(worldRaw, 'entityCount'), 'world.entityCount'),
      eventCount:validCounter(own(worldRaw, 'eventCount'), 'world.eventCount'),
      relationCount:validCounter(own(worldRaw, 'relationCount'), 'world.relationCount'),
      conflict01:validMetric(own(worldRaw, 'conflict01'), 'world.conflict01'),
      newEntityRate01:validMetric(own(worldRaw, 'newEntityRate01'), 'world.newEntityRate01'),
    };
    const prediction = {
      error01:validMetric(own(predictionRaw, 'error01'), 'prediction.error01'),
      openCount:validCounter(own(predictionRaw, 'openCount'), 'prediction.openCount'),
      agingCount:validCounter(own(predictionRaw, 'agingCount'), 'prediction.agingCount'),
      expiredCount:validCounter(own(predictionRaw, 'expiredCount'), 'prediction.expiredCount'),
      priority01:validMetric(own(predictionRaw, 'priority01'), 'prediction.priority01'),
    };
    const resources = {
      battery01:validMetric(own(resourcesRaw, 'battery01'), 'resources.battery01'),
      thermal01:validMetric(own(resourcesRaw, 'thermal01'), 'resources.thermal01'),
      ramPressure01:validMetric(own(resourcesRaw, 'ramPressure01'), 'resources.ramPressure01'),
      computeCapacity01:validMetric(own(resourcesRaw, 'computeCapacity01'), 'resources.computeCapacity01'),
      scarcity01:validMetric(own(resourcesRaw, 'scarcity01'), 'resources.scarcity01'),
      efficiency01:validMetric(own(resourcesRaw, 'efficiency01'), 'resources.efficiency01'),
    };
    const memoryPressure01 = validMetric(own(root, 'memoryPressure01'), 'memoryPressure01');
    const evidenceCoverage01 = validMetric(own(root, 'evidenceCoverage01'), 'evidenceCoverage01');
    const realObservationCoverage01 = validMetric(own(root, 'realObservationCoverage01'), 'realObservationCoverage01');
    const unknown01 = validMetric(own(root, 'unknown01'), 'unknown01');
    const reasonValue = own(root, 'reason');
    if (reasonValue !== undefined && typeof reasonValue !== 'string') {
      throw new TypeError('unified-cognitive-substrate-reason-must-be-a-string');
    }

    // All untrusted values have been checked before the next state object is
    // constructed. A rejected tick/input leaves the previous snapshot untouched.
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
    const nextState:UnifiedCognitiveSubstrateState = {
      version:1,
      cycles:this.state.cycles+1,
      lastTick:tick,
      self,
      world,
      prediction,
      resources,
      coupling:{
        selfWorld01:selfWorld,
        predictionGrounding01:predictionGrounding,
        memoryPressure01,
        actionReadiness01:actionReadiness,
      },
      provenance:{evidenceCoverage01,realObservationCoverage01,unknown01},
      lastReason:cleanText(
        reasonValue,
        'tick=' + tick + ';selfWorld=' + selfWorld.toFixed(2) + ';predictionGrounding=' + predictionGrounding.toFixed(2),
        256,
      ),
    };
    this.state = nextState;
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
