/**
 * BIG PASS 162 — Cognitive Resource Economy.
 *
 * A bounded, persisted allocator for attention/computation/exploration budget.
 * It intentionally does not replace the existing CognitiveBudgetManager; it
 * provides an organism-level policy that converts current need/load/debt into
 * concrete cognitive resource envelopes. Host execution pressure is retained as
 * diagnostic state but intentionally excluded from this allocation math so that
 * V8/CPU/RSS fluctuations cannot silently rewrite cognitive semantics.
 */
export interface CognitiveResourceEconomyState {
  version: 1;
  cycles: number;
  totalBudget01: number;
  attentionBudget01: number;
  simulationBudget01: number;
  learningBudget01: number;
  memoryBudget01: number;
  externalInteractionBudget01: number;
  predictionDebt01: number;
  scarcity01: number;
  lastMode: 'abundant'|'balanced'|'scarce'|'critical';
  performancePressure01: number;
  lastAt: number;
  lastTick: number;
}

export interface CognitiveResourceAllocation {
  mode: CognitiveResourceEconomyState['lastMode'];
  totalBudget01: number;
  attention01: number;
  simulation01: number;
  learning01: number;
  memory01: number;
  externalInteraction01: number;
  scarcity01: number;
  maxCounterfactualBranches: number;
  permitExpensiveLanguage: boolean;
}

const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safeCounter=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const safeTick=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=-1?value:-1;
const safeTimestamp=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:0;
const safeUnit=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)?clamp01(value):fallback;

export const defaultCognitiveResourceEconomy = (): CognitiveResourceEconomyState => ({
  version: 1, cycles: 0,
  totalBudget01: .82, attentionBudget01: .82, simulationBudget01: .55,
  learningBudget01: .50, memoryBudget01: .70, externalInteractionBudget01: .55,
  predictionDebt01: 0, scarcity01: .18, lastMode: 'abundant', performancePressure01: 0, lastAt: 0, lastTick: -1,
});

export class CognitiveResourceEconomy {
  private state = defaultCognitiveResourceEconomy();

  restore(raw?: Partial<CognitiveResourceEconomyState> | null): void {
    const source=isRecord(raw)?raw:{};
    if(source.version!==undefined&&source.version!==1)throw new RangeError('unsupported cognitive-resource-economy state version');
    const base=defaultCognitiveResourceEconomy();
    this.state={
      version:1,
      cycles:safeCounter(source.cycles),
      totalBudget01:safeUnit(source.totalBudget01,base.totalBudget01),
      attentionBudget01:safeUnit(source.attentionBudget01,base.attentionBudget01),
      simulationBudget01:safeUnit(source.simulationBudget01,base.simulationBudget01),
      learningBudget01:safeUnit(source.learningBudget01,base.learningBudget01),
      memoryBudget01:safeUnit(source.memoryBudget01,base.memoryBudget01),
      externalInteractionBudget01:safeUnit(source.externalInteractionBudget01,base.externalInteractionBudget01),
      predictionDebt01:safeUnit(source.predictionDebt01,0),
      scarcity01:safeUnit(source.scarcity01,base.scarcity01),
      lastMode:['abundant','balanced','scarce','critical'].includes(String(source.lastMode))?source.lastMode as CognitiveResourceEconomyState['lastMode']:base.lastMode,
      performancePressure01:safeUnit(source.performancePressure01,base.performancePressure01),
      lastAt:safeTimestamp(source.lastAt),
      lastTick:safeTick(source.lastTick),
    };
  }

  allocate(input:{tick:number;at?:number;energy01?:number;cognitiveLoad01?:number;uncertainty01?:number;novelty01?:number;predictionDebt01?:number;thermalStrain01?:number;ramPressure01?:number;performancePressure01?:number;awake?:boolean}):CognitiveResourceAllocation {
    const energy = clamp01(input.energy01 ?? .8);
    const load = clamp01(input.cognitiveLoad01 ?? .2);
    const uncertainty = clamp01(input.uncertainty01 ?? .35);
    const novelty = clamp01(input.novelty01 ?? .4);
    const debt = clamp01(input.predictionDebt01 ?? 0);
    const thermal = clamp01(input.thermalStrain01 ?? .2);
    const ram = clamp01(input.ramPressure01 ?? .2);
    const awake = input.awake !== false;
    const tick = typeof input.tick==='number'&&Number.isFinite(input.tick)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(input.tick))):0;
    const at = typeof input.at==='number'&&Number.isFinite(input.at)&&input.at>=0?input.at:Date.now();
    const performancePressure = clamp01(input.performancePressure01 ?? this.state.performancePressure01);

    const scarcity = clamp01(
      (1-energy)*.30 + load*.22 + thermal*.18 + ram*.14 + (awake ? 0 : .08) + debt*.08
    );
    const total = clamp01(.92 - scarcity*.70);
    const attention = clamp01(total * (.55 + uncertainty*.30 + novelty*.15));
    const simulation = clamp01(total * (.28 + uncertainty*.48 + debt*.24));
    const learning = clamp01(total * (.25 + novelty*.35 + uncertainty*.40));
    const memory = clamp01(total * (.62 + debt*.28 + novelty*.10));
    const external = clamp01(total * (.35 + energy*.25 + (1-thermal)*.20 + (1-ram)*.20));

    const mode:CognitiveResourceEconomyState['lastMode'] =
      scarcity >= .78 ? 'critical' : scarcity >= .52 ? 'scarce' : scarcity >= .28 ? 'balanced' : 'abundant';
    const maxCounterfactualBranches = scarcity >= .78 ? 0 : scarcity >= .60 ? 1 : scarcity >= .38 ? 2 : 3;
    const permitExpensiveLanguage = awake && external >= .38 && thermal < .82 && ram < .90;

    this.state = {
      ...this.state,
      cycles: Math.min(Number.MAX_SAFE_INTEGER, this.state.cycles + 1),
      totalBudget01: total,
      attentionBudget01: attention,
      simulationBudget01: simulation,
      learningBudget01: learning,
      memoryBudget01: memory,
      externalInteractionBudget01: external,
      predictionDebt01: debt,
      scarcity01: scarcity,
      // Diagnostic-only: preserved for observability/backward-compatible state.
      performancePressure01: performancePressure,
      lastMode: mode,
      lastAt: at,
      lastTick: tick,
    };
    return { mode, totalBudget01:total, attention01:attention, simulation01:simulation, learning01:learning, memory01:memory, externalInteraction01:external, scarcity01:scarcity, maxCounterfactualBranches, permitExpensiveLanguage };
  }

  snapshot():CognitiveResourceEconomyState { return structuredClone(this.state); }
  planningSnapshot():CognitiveResourceEconomyState { return { ...this.state }; }
  externalInteractionBudget01():number { return this.state.externalInteractionBudget01; }
}
