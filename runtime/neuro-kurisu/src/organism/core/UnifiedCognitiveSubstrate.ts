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

/** Bounded cross-system projection. It never owns canonical domain state. */
export class UnifiedCognitiveSubstrate {
  private state = defaultUnifiedCognitiveSubstrate();

  restore(raw?: Partial<UnifiedCognitiveSubstrateState> | null) {
    const d = defaultUnifiedCognitiveSubstrate();
    const r = raw ?? {};
    this.state = {
      ...d, ...r,
      self:{...d.self,...(r.self??{})},
      world:{...d.world,...(r.world??{})},
      prediction:{...d.prediction,...(r.prediction??{})},
      resources:{...d.resources,...(r.resources??{})},
      coupling:{...d.coupling,...(r.coupling??{})},
      provenance:{...d.provenance,...(r.provenance??{})},
    };
  }

  snapshot() { return structuredClone(this.state); }

  integrate(input: {
    tick:number;
    self:UnifiedCognitiveSubstrateState['self'];
    world:UnifiedCognitiveSubstrateState['world'];
    prediction:UnifiedCognitiveSubstrateState['prediction'];
    resources:UnifiedCognitiveSubstrateState['resources'];
    memoryPressure01:number; evidenceCoverage01:number; realObservationCoverage01:number; unknown01:number; reason?:string;
  }) {
    const selfWorld = clamp(
      input.self.realityAlignment01*.30 +
      input.world.confidence01*.34 +
      (1-input.world.conflict01)*.18 +
      input.self.coherence01*.18
    );
    const predictionGrounding = clamp(
      (1-input.prediction.error01)*.28 +
      input.world.confidence01*.28 +
      input.self.realityAlignment01*.22 +
      input.evidenceCoverage01*.22
    );
    const actionReadiness = clamp(
      input.self.agency01*.26 +
      input.self.coherence01*.18 +
      input.resources.computeCapacity01*.20 +
      (1-input.world.uncertainty01)*.18 +
      (1-input.prediction.error01)*.18
    );
    this.state = {
      version:1, cycles:this.state.cycles+1, lastTick:input.tick,
      self:{...input.self,continuity01:clamp(input.self.continuity01),coherence01:clamp(input.self.coherence01),agency01:clamp(input.self.agency01),realityAlignment01:clamp(input.self.realityAlignment01)},
      world:{...input.world,confidence01:clamp(input.world.confidence01),uncertainty01:clamp(input.world.uncertainty01),conflict01:clamp(input.world.conflict01),newEntityRate01:clamp(input.world.newEntityRate01)},
      prediction:{...input.prediction,error01:clamp(input.prediction.error01),priority01:clamp(input.prediction.priority01)},
      resources:{...input.resources,battery01:clamp(input.resources.battery01),thermal01:clamp(input.resources.thermal01),ramPressure01:clamp(input.resources.ramPressure01),computeCapacity01:clamp(input.resources.computeCapacity01),scarcity01:clamp(input.resources.scarcity01),efficiency01:clamp(input.resources.efficiency01)},
      coupling:{selfWorld01:selfWorld,predictionGrounding01:predictionGrounding,memoryPressure01:clamp(input.memoryPressure01),actionReadiness01:actionReadiness},
      provenance:{evidenceCoverage01:clamp(input.evidenceCoverage01),realObservationCoverage01:clamp(input.realObservationCoverage01),unknown01:clamp(input.unknown01)},
      lastReason:input.reason ?? `tick=${input.tick};selfWorld=${selfWorld.toFixed(2)};predictionGrounding=${predictionGrounding.toFixed(2)}`,
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
