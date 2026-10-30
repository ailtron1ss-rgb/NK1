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

const clamp = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const isRecord = (value:unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function recordOrEmpty(value:unknown): UnknownRecord {
  // Only own enumerable data properties are eligible for restoration. Never invoke
  // getters while rebuilding a persisted projection.
  if (!isRecord(value)) return Object.create(null) as UnknownRecord;
  const result = Object.create(null) as UnknownRecord;
  let keys: string[];
  try { keys = Object.keys(value); } catch { return result; }
  for (const key of keys.slice(0, 64)) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) continue;
      Object.defineProperty(result, key, { value: descriptor.value, enumerable: true, writable: true, configurable: true });
    } catch {
      // Invalid/proxy-backed persisted entries are omitted; callers use domain defaults.
    }
  }
  return result;
}

/** Persisted counters are untrusted: never coerce strings, fractions or infinities. */
function safeCounter(value:unknown, fallback:number):number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

/** Normalized signals are finite numbers in [0, 1]; malformed values use their domain default. */
function safeMetric(value:unknown, fallback:number):number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value)
    : fallback;
}

/** Bounded labels keep restored metadata inert and prevent control-character injection. */
function safeLabel(value:unknown, fallback:string, maxLength=160):string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f-\u009f]/u.test(normalized)) return fallback;
  return normalized;
}

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

/**
 * Bounded cross-system projection. It never owns canonical domain state.
 *
 * Restore is deliberately an allow-list projection: persisted snapshots may be
 * old, partial or malformed, so unknown fields and non-finite values must not
 * leak back into the live cognitive runtime.
 */
export class UnifiedCognitiveSubstrate {
  private state = defaultUnifiedCognitiveSubstrate();

  restore(raw?: Partial<UnifiedCognitiveSubstrateState> | null):void {
    const d = defaultUnifiedCognitiveSubstrate();
    const r = recordOrEmpty(raw);
    if (r.version !== undefined && r.version !== 1) {
      throw new RangeError('unsupported unified cognitive substrate state version');
    }

    const self = recordOrEmpty(r.self);
    const world = recordOrEmpty(r.world);
    const prediction = recordOrEmpty(r.prediction);
    const resources = recordOrEmpty(r.resources);
    const coupling = recordOrEmpty(r.coupling);
    const provenance = recordOrEmpty(r.provenance);

    this.state = {
      version:1,
      cycles:safeCounter(r.cycles,d.cycles),
      lastTick:safeCounter(r.lastTick,d.lastTick),
      self:{
        continuity01:safeMetric(self.continuity01,d.self.continuity01),
        coherence01:safeMetric(self.coherence01,d.self.coherence01),
        agency01:safeMetric(self.agency01,d.self.agency01),
        realityAlignment01:safeMetric(self.realityAlignment01,d.self.realityAlignment01),
        mode:safeLabel(self.mode,d.self.mode,48),
        lastAction:safeLabel(self.lastAction,d.self.lastAction,96),
      },
      world:{
        confidence01:safeMetric(world.confidence01,d.world.confidence01),
        uncertainty01:safeMetric(world.uncertainty01,d.world.uncertainty01),
        entityCount:safeCounter(world.entityCount,d.world.entityCount),
        eventCount:safeCounter(world.eventCount,d.world.eventCount),
        relationCount:safeCounter(world.relationCount,d.world.relationCount),
        conflict01:safeMetric(world.conflict01,d.world.conflict01),
        newEntityRate01:safeMetric(world.newEntityRate01,d.world.newEntityRate01),
      },
      prediction:{
        error01:safeMetric(prediction.error01,d.prediction.error01),
        openCount:safeCounter(prediction.openCount,d.prediction.openCount),
        agingCount:safeCounter(prediction.agingCount,d.prediction.agingCount),
        expiredCount:safeCounter(prediction.expiredCount,d.prediction.expiredCount),
        priority01:safeMetric(prediction.priority01,d.prediction.priority01),
      },
      resources:{
        battery01:safeMetric(resources.battery01,d.resources.battery01),
        thermal01:safeMetric(resources.thermal01,d.resources.thermal01),
        ramPressure01:safeMetric(resources.ramPressure01,d.resources.ramPressure01),
        computeCapacity01:safeMetric(resources.computeCapacity01,d.resources.computeCapacity01),
        scarcity01:safeMetric(resources.scarcity01,d.resources.scarcity01),
        efficiency01:safeMetric(resources.efficiency01,d.resources.efficiency01),
      },
      coupling:{
        selfWorld01:safeMetric(coupling.selfWorld01,d.coupling.selfWorld01),
        predictionGrounding01:safeMetric(coupling.predictionGrounding01,d.coupling.predictionGrounding01),
        memoryPressure01:safeMetric(coupling.memoryPressure01,d.coupling.memoryPressure01),
        actionReadiness01:safeMetric(coupling.actionReadiness01,d.coupling.actionReadiness01),
      },
      provenance:{
        evidenceCoverage01:safeMetric(provenance.evidenceCoverage01,d.provenance.evidenceCoverage01),
        realObservationCoverage01:safeMetric(provenance.realObservationCoverage01,d.provenance.realObservationCoverage01),
        unknown01:safeMetric(provenance.unknown01,d.provenance.unknown01),
      },
      lastReason:safeLabel(r.lastReason,d.lastReason,240),
    };
  }

  snapshot():UnifiedCognitiveSubstrateState {
    return structuredClone(this.state);
  }

  integrate(input: {
    tick:number;
    self:UnifiedCognitiveSubstrateState['self'];
    world:UnifiedCognitiveSubstrateState['world'];
    prediction:UnifiedCognitiveSubstrateState['prediction'];
    resources:UnifiedCognitiveSubstrateState['resources'];
    memoryPressure01:number; evidenceCoverage01:number; realObservationCoverage01:number; unknown01:number; reason?:string;
  }):UnifiedCognitiveSubstrateState {
    // The substrate is a projection: accept only own data properties from its
    // callers as well as from persisted snapshots. Accessors never enter state.
    const envelope=recordOrEmpty(input);
    const self=recordOrEmpty(envelope.self);
    const world=recordOrEmpty(envelope.world);
    const prediction=recordOrEmpty(envelope.prediction);
    const resources=recordOrEmpty(envelope.resources);
    const tick=envelope.tick;
    if (typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<1) {
      throw new RangeError('unified cognitive substrate tick must be a positive safe integer');
    }
    if (tick<=this.state.lastTick) {
      throw new RangeError('unified cognitive substrate tick must strictly increase');
    }
    if (this.state.cycles>=Number.MAX_SAFE_INTEGER) {
      throw new RangeError('unified cognitive substrate cycle counter reached its safe integer limit');
    }

    const selfValues={
      continuity01:safeMetric(self.continuity01,this.state.self.continuity01),
      coherence01:safeMetric(self.coherence01,this.state.self.coherence01),
      agency01:safeMetric(self.agency01,this.state.self.agency01),
      realityAlignment01:safeMetric(self.realityAlignment01,this.state.self.realityAlignment01),
      mode:safeLabel(self.mode,this.state.self.mode,48),
      lastAction:safeLabel(self.lastAction,this.state.self.lastAction,96),
    };
    const worldValues={
      confidence01:safeMetric(world.confidence01,this.state.world.confidence01),
      uncertainty01:safeMetric(world.uncertainty01,this.state.world.uncertainty01),
      entityCount:safeCounter(world.entityCount,this.state.world.entityCount),
      eventCount:safeCounter(world.eventCount,this.state.world.eventCount),
      relationCount:safeCounter(world.relationCount,this.state.world.relationCount),
      conflict01:safeMetric(world.conflict01,this.state.world.conflict01),
      newEntityRate01:safeMetric(world.newEntityRate01,this.state.world.newEntityRate01),
    };
    const predictionValues={
      error01:safeMetric(prediction.error01,this.state.prediction.error01),
      openCount:safeCounter(prediction.openCount,this.state.prediction.openCount),
      agingCount:safeCounter(prediction.agingCount,this.state.prediction.agingCount),
      expiredCount:safeCounter(prediction.expiredCount,this.state.prediction.expiredCount),
      priority01:safeMetric(prediction.priority01,this.state.prediction.priority01),
    };
    const resourceValues={
      battery01:safeMetric(resources.battery01,this.state.resources.battery01),
      thermal01:safeMetric(resources.thermal01,this.state.resources.thermal01),
      ramPressure01:safeMetric(resources.ramPressure01,this.state.resources.ramPressure01),
      computeCapacity01:safeMetric(resources.computeCapacity01,this.state.resources.computeCapacity01),
      scarcity01:safeMetric(resources.scarcity01,this.state.resources.scarcity01),
      efficiency01:safeMetric(resources.efficiency01,this.state.resources.efficiency01),
    };
    const memoryPressure01=safeMetric(envelope.memoryPressure01,this.state.coupling.memoryPressure01);
    const evidenceCoverage01=safeMetric(envelope.evidenceCoverage01,this.state.provenance.evidenceCoverage01);
    const realObservationCoverage01=safeMetric(envelope.realObservationCoverage01,this.state.provenance.realObservationCoverage01);
    const unknown01=safeMetric(envelope.unknown01,this.state.provenance.unknown01);

    const selfWorld = clamp(
      selfValues.realityAlignment01*.30 +
      worldValues.confidence01*.34 +
      (1-worldValues.conflict01)*.18 +
      selfValues.coherence01*.18
    );
    const predictionGrounding = clamp(
      (1-predictionValues.error01)*.28 +
      worldValues.confidence01*.28 +
      selfValues.realityAlignment01*.22 +
      evidenceCoverage01*.22
    );
    const actionReadiness = clamp(
      selfValues.agency01*.26 +
      selfValues.coherence01*.18 +
      resourceValues.computeCapacity01*.20 +
      (1-worldValues.uncertainty01)*.18 +
      (1-predictionValues.error01)*.18
    );
    const generatedReason=`tick=${tick};selfWorld=${selfWorld.toFixed(2)};predictionGrounding=${predictionGrounding.toFixed(2)}`;
    this.state = {
      version:1,
      cycles:this.state.cycles+1,
      lastTick:tick,
      self:selfValues,
      world:worldValues,
      prediction:predictionValues,
      resources:resourceValues,
      coupling:{selfWorld01:selfWorld,predictionGrounding01:predictionGrounding,memoryPressure01,actionReadiness01:actionReadiness},
      provenance:{evidenceCoverage01,realObservationCoverage01,unknown01},
      lastReason:safeLabel(envelope.reason,this.state.lastReason || generatedReason,240) || generatedReason,
    };
    return this.snapshot();
  }

  actionBias(action:string) {
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
