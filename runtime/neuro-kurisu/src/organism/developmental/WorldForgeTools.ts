import { randomUUID } from 'node:crypto';
import type { ActionGateway, ToolDefinition } from '../system/ActionGateway.ts';
import type { ToolOutputContract, ToolInputNodeContract } from '../system/ToolInputContract.ts';
import type { FutureSimulator } from './FutureSimulator.ts';
import type { WorldForgeAction, WorldForgeAdversarialFocus, WorldForgeCase, WorldForgeFailureMode } from './WorldForge.ts';

const MAX_SCENARIOS = 512;
const MAX_SESSIONS = 2048;
const ENTRY_TTL_MS = 30 * 60_000;
const ACTIONS: WorldForgeAction[] = ['observe','inspect','move','collect','wait','reroute','prioritize','verify'];

const boundedString = (maxLength: number): ToolInputNodeContract => ({ type: 'string', minLength: 1, maxLength });
const boundedStringArray = (maxItems: number, maxLength = 160): ToolInputNodeContract => ({
  type: 'array', maxItems, items: boundedString(maxLength),
});
const WORLD_FORGE_FAILURE_MODES: WorldForgeFailureMode[] = ['goal-gap','evidence-gap','resource-budget','risk-budget','step-budget','invalid-trace','disturbance-pressure'];
const AUTO_FOCUS_VALUES = ['auto','balanced','resource-shock','route-block','signal-noise','deadline-shift'] as const;

const worldForgeScenarioOutput: ToolInputNodeContract = {
  type: 'object',
  properties: {
    id: boundedString(160),
    split: { type: 'string', enum: ['train', 'validation'] },
    domain: { type: 'string', enum: ['resource-allocation', 'route-planning', 'investigation'] },
    difficulty01: { type: 'number', minimum: 0, maximum: 1 },
    task: boundedString(512),
    observations: boundedStringArray(8, 512),
    goalOptions: boundedStringArray(8, 120),
    availableActions: { type: 'array', maxItems: 8, items: { type: 'string', enum: ACTIONS } },
    constraints: {
      type: 'object',
      properties: {
        maxSteps: { type: 'integer', minimum: 1, maximum: 64 },
        resourceBudget: { type: 'integer', minimum: 0, maximum: 64 },
        riskTolerance01: { type: 'number', minimum: 0, maximum: 1 },
        requiredEvidence: { type: 'integer', minimum: 0, maximum: 16 },
      },
      required: ['maxSteps', 'resourceBudget', 'riskTolerance01', 'requiredEvidence'],
      additionalProperties: false,
      maxProperties: 4,
    },
    strategyFamilies: boundedStringArray(8, 80),
    syntheticOnly: { type: 'boolean', enum: [true] },
  },
  required: ['id', 'split', 'domain', 'difficulty01', 'task', 'observations', 'goalOptions',
    'availableActions', 'constraints', 'strategyFamilies', 'syntheticOnly'],
  additionalProperties: false,
  maxProperties: 11,
};
const worldForgeStateOutput: ToolInputNodeContract = {
  type: 'object',
  properties: {
    sessionId: boundedString(160),
    scenarioId: boundedString(160),
    tick: { type: 'integer', minimum: 0, maximum: 128 },
    resourcesRemaining: { type: 'integer', minimum: 0, maximum: 256 },
    remainingSteps: { type: 'integer', minimum: 0, maximum: 128 },
    position: boundedString(120),
    knownTargets: boundedStringArray(32, 120),
    knownSignals: boundedStringArray(32, 120),
    blockedTargets: boundedStringArray(32, 120),
    noise01: { type: 'number', minimum: 0, maximum: 1 },
    verifiedEvidence: boundedStringArray(32, 120),
    events: boundedStringArray(32, 160),
    status: { type: 'string', enum: ['active', 'exhausted'] },
    syntheticOnly: { type: 'boolean', enum: [true] },
  },
  required: ['sessionId', 'scenarioId', 'tick', 'resourcesRemaining', 'remainingSteps', 'position',
    'knownTargets', 'knownSignals', 'blockedTargets', 'noise01', 'verifiedEvidence',
    'events', 'status', 'syntheticOnly'],
  // priorityTarget is nullable in the in-memory state model. This contract
  // deliberately leaves that one field unconstrained; the rest are closed and bounded.
  additionalProperties: true,
  maxProperties: 15,
};
const worldForgeEvaluationOutput: ToolInputNodeContract = {
  type: 'object',
  properties: {
    scenarioId: boundedString(160),
    split: { type: 'string', enum: ['train', 'validation'] },
    score01: { type: 'number', minimum: 0, maximum: 1 },
    success: { type: 'boolean' },
    constraintViolations: { type: 'integer', minimum: 0, maximum: 256 },
    evidenceCoverage01: { type: 'number', minimum: 0, maximum: 1 },
    efficiency01: { type: 'number', minimum: 0, maximum: 1 },
    robustness01: { type: 'number', minimum: 0, maximum: 1 },
    strategyFamily: { type: 'string', maxLength: 120 },
    stepsUsed: { type: 'integer', minimum: 0, maximum: 128 },
    syntheticOnly: { type: 'boolean', enum: [true] },
    independentlyVerified: { type: 'boolean', enum: [false] },
    limitations: boundedStringArray(8, 512),
    failureModes: { type: 'array', maxItems: 7, items: { type: 'string', enum: ['goal-gap','evidence-gap','resource-budget','risk-budget','step-budget','invalid-trace','disturbance-pressure'] } },
  },
  required: ['scenarioId', 'split', 'score01', 'success', 'constraintViolations',
    'evidenceCoverage01', 'efficiency01', 'robustness01', 'strategyFamily', 'stepsUsed',
    'syntheticOnly', 'independentlyVerified', 'limitations', 'failureModes'],
  additionalProperties: false,
  maxProperties: 14,
};
function outputContract(properties: Record<string, ToolInputNodeContract>, required: string[]): ToolOutputContract {
  return {
    type: 'object',
    properties: {
      ok: { type: 'boolean', enum: [true] },
      syntheticOnly: { type: 'boolean', enum: [true] },
      independentlyVerified: { type: 'boolean', enum: [false] },
      ...properties,
    },
    required: ['ok', 'syntheticOnly', 'independentlyVerified', ...required],
    additionalProperties: false,
    maxProperties: 8,
    maxSerializedBytes: 65_536,
  };
}

type ScenarioEntry = { scenario: WorldForgeCase; createdAt: number };
type SessionEntry = { scenarioId: string; createdAt: number };

function boundedText(value: unknown, limit = 160): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, limit) : '';
}

function resultEnvelope(value: Record<string, unknown>): Record<string, unknown> {
  return { ok: true, syntheticOnly: true, independentlyVerified: false, ...value };
}

function publicScenario(s: WorldForgeCase): Record<string, unknown> {
  return {
    id: s.id,
    split: s.split,
    domain: s.domain,
    difficulty01: s.difficulty01,
    task: s.task,
    observations: [...s.observations],
    goalOptions: [...s.goalOptions],
    availableActions: [...s.availableActions],
    constraints: { ...s.constraints },
    strategyFamilies: [...s.strategyFamilies],
    syntheticOnly: true,
  };
}

export class WorldForgeToolAdapter {
  readonly #scenarios = new Map<string, ScenarioEntry>();
  readonly #sessions = new Map<string, SessionEntry>();
  readonly #trainingFeedback: Record<WorldForgeAdversarialFocus, number> = {
    balanced: 0, 'resource-shock': 0, 'route-block': 0, 'signal-noise': 0, 'deadline-shift': 0,
  };
  #trainingEvaluationCount = 0;
  readonly #simulator: Pick<FutureSimulator,
    'generateWorldForgeScenarios' | 'generateAdversarialWorldForgeScenarios' | 'startWorldForgeScenario' | 'stepWorldForgeScenario' |
    'evaluateWorldForgeSession' | 'releaseWorldForgeScenario'>;
  readonly #now: () => number;

  constructor(
    simulator: Pick<FutureSimulator,
      'generateWorldForgeScenarios' | 'generateAdversarialWorldForgeScenarios' | 'startWorldForgeScenario' | 'stepWorldForgeScenario' |
      'evaluateWorldForgeSession' | 'releaseWorldForgeScenario'>,
    now: () => number = () => Date.now(),
  ) {
    this.#simulator = simulator;
    this.#now = now;
  }

  private recordTrainingFeedback(evaluation: { split: string; failureModes: WorldForgeFailureMode[] }): void {
    // Validation and holdout are evaluation-only; they never tune the curriculum.
    if (evaluation.split !== 'train') return;
    this.#trainingEvaluationCount += 1;
    if (this.#trainingEvaluationCount % 32 === 0) {
      for (const focus of Object.keys(this.#trainingFeedback) as WorldForgeAdversarialFocus[]) {
        this.#trainingFeedback[focus] *= 0.85;
      }
    }
    const modes = new Set(evaluation.failureModes);
    if (modes.has('resource-budget')) this.#trainingFeedback['resource-shock'] += 2;
    if (modes.has('step-budget')) this.#trainingFeedback['deadline-shift'] += 2;
    if (modes.has('risk-budget') || modes.has('disturbance-pressure')) this.#trainingFeedback['route-block'] += 2;
    if (modes.has('evidence-gap') || modes.has('invalid-trace')) this.#trainingFeedback['signal-noise'] += 2;
    if (modes.has('goal-gap')) this.#trainingFeedback.balanced += 1;
  }

  private resolveAutomaticFocus(): WorldForgeAdversarialFocus {
    if (this.#trainingEvaluationCount === 0) return 'balanced';
    const order: WorldForgeAdversarialFocus[] = [
      'resource-shock', 'deadline-shift', 'route-block', 'signal-noise', 'balanced',
    ];
    return order.reduce((best, candidate) =>
      this.#trainingFeedback[candidate] > this.#trainingFeedback[best] ? candidate : best, order[0]);
  }

  private prune(): void {
    const now = this.#now();
    for (const [id, entry] of this.#scenarios) {
      if (now - entry.createdAt > ENTRY_TTL_MS) this.releaseScenario(id);
    }
    for (const [id, entry] of this.#sessions) {
      if (now - entry.createdAt > ENTRY_TTL_MS || !this.#scenarios.has(entry.scenarioId)) this.#sessions.delete(id);
    }
  }

  private rememberScenario(scenario: WorldForgeCase): void {
    this.#scenarios.set(scenario.id, { scenario, createdAt: this.#now() });
    while (this.#scenarios.size > MAX_SCENARIOS) {
      const oldest = this.#scenarios.keys().next().value as string | undefined;
      if (!oldest) break;
      this.releaseScenario(oldest);
    }
  }

  private releaseScenario(id: string): void {
    this.#simulator.releaseWorldForgeScenario(id);
    this.#scenarios.delete(id);
    for (const [sessionId, session] of this.#sessions) {
      if (session.scenarioId === id) this.#sessions.delete(sessionId);
    }
  }

  private requireScenario(id: unknown): WorldForgeCase {
    const key = boundedText(id);
    const entry = this.#scenarios.get(key);
    if (!entry) throw new Error('worldforge-scenario-unknown-or-expired');
    if (this.#now() - entry.createdAt > ENTRY_TTL_MS) {
      this.releaseScenario(key);
      throw new Error('worldforge-scenario-unknown-or-expired');
    }
    return entry.scenario;
  }

  private requireSession(sessionId: unknown, scenarioId: unknown, tick: unknown): { sessionId: string; scenarioId: string; tick: number } {
    const sessionKey = boundedText(sessionId, 200);
    const scenarioKey = boundedText(scenarioId, 160);
    const entry = this.#sessions.get(sessionKey);
    if (!entry || entry.scenarioId !== scenarioKey || this.#now() - entry.createdAt > ENTRY_TTL_MS) {
      this.#sessions.delete(sessionKey);
      throw new Error('worldforge-session-unknown-or-expired');
    }
    if (typeof tick !== 'number' || !Number.isSafeInteger(tick) || tick < 0) throw new Error('worldforge-session-tick-invalid');
    return { sessionId: sessionKey, scenarioId: scenarioKey, tick };
  }

  register(gateway: Pick<ActionGateway, 'registerTool'>): void {
    const register = (definition: ToolDefinition) => gateway.registerTool(definition);

    register({
      id: 'organism.worldforge.scenarios.generate',
      outputContract: outputContract({
        scenarios: { type: 'array', minItems: 1, maxItems: 64, items: worldForgeScenarioOutput },
        count: { type: 'integer', minimum: 1, maximum: 64 },
        note: boundedString(512),
      }, ['scenarios', 'count', 'note']),
      capability: 'planning.simulation.read',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: {
          split: { type: 'string', enum: ['train','validation'] },
          count: { type: 'integer', minimum: 1, maximum: 64 },
          difficulty01: { type: 'number', minimum: 0.05, maximum: 0.95 },
        },
        required: ['split','count','difficulty01'],
        additionalProperties: false,
        maxProperties: 3,
        maxSerializedBytes: 1024,
      },
      execute: async (input) => {
        this.prune();
        const split = input.split;
        if (split !== 'train' && split !== 'validation') throw new Error('worldforge-runtime-split-forbidden');
        const count = input.count as number;
        const difficulty01 = input.difficulty01 as number;
        const seed = Number.parseInt(randomUUID().replace(/-/g, '').slice(0, 8), 16);
        const scenarios = this.#simulator.generateWorldForgeScenarios({ split, seed, count, difficulty01 });
        for (const scenario of scenarios) this.rememberScenario(scenario);
        return resultEnvelope({
          scenarios: scenarios.map(publicScenario),
          count: scenarios.length,
          note: 'Perturbations are hidden. Their effects become observable only as the synthetic environment changes.',
        });
      },
    });

    register({
      id: 'organism.worldforge.scenarios.generate-adversarial',
      outputContract: outputContract({
        scenarios: { type: 'array', minItems: 1, maxItems: 16, items: worldForgeScenarioOutput },
        count: { type: 'integer', minimum: 1, maximum: 16 },
        candidateCount: { type: 'integer', minimum: 2, maximum: 64 },
        focus: { type: 'string', enum: ['balanced','resource-shock','route-block','signal-noise','deadline-shift'] },
        requestedFocus: { type: 'string', enum: AUTO_FOCUS_VALUES },
        note: boundedString(512),
      }, ['scenarios','count','candidateCount','focus','requestedFocus','note']),
      capability: 'planning.simulation.read',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: {
          count: { type: 'integer', minimum: 1, maximum: 16 },
          difficulty01: { type: 'number', minimum: 0.2, maximum: 0.95 },
          focus: { type: 'string', enum: AUTO_FOCUS_VALUES },
          candidateMultiplier: { type: 'integer', minimum: 2, maximum: 4 },
        },
        required: ['count','difficulty01','focus','candidateMultiplier'],
        additionalProperties: false,
        maxProperties: 4,
        maxSerializedBytes: 1024,
      },
      execute: async (input) => {
        this.prune();
        const count = input.count as number;
        const difficulty01 = input.difficulty01 as number;
        const requestedFocus = input.focus as typeof AUTO_FOCUS_VALUES[number];
        const focus: WorldForgeAdversarialFocus = requestedFocus === 'auto' ? this.resolveAutomaticFocus() : requestedFocus;
        const candidateMultiplier = input.candidateMultiplier as number;
        const seed = Number.parseInt(randomUUID().replace(/-/g, '').slice(0, 8), 16);
        const scenarios = this.#simulator.generateAdversarialWorldForgeScenarios({
          seed, count, difficulty01, focus, candidateMultiplier,
        });
        for (const scenario of scenarios) this.rememberScenario(scenario);
        return resultEnvelope({
          scenarios: scenarios.map(publicScenario),
          count: scenarios.length,
          candidateCount: count * candidateMultiplier,
          focus,
          requestedFocus,
          note: 'Adversarial candidates are ranked inside the evaluator; selection scores, seed and hidden perturbation schedules are never exposed.',
        });
      },
    });

    register({
      id: 'organism.worldforge.sessions.begin',
      outputContract: outputContract({ state: worldForgeStateOutput }, ['state']),
      capability: 'planning.simulation.state',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: { scenarioId: { type: 'string', minLength: 1, maxLength: 160 } },
        required: ['scenarioId'],
        additionalProperties: false,
        maxProperties: 1,
        maxSerializedBytes: 512,
      },
      execute: async (input) => {
        this.prune();
        const scenario = this.requireScenario(input.scenarioId);
        const state = this.#simulator.startWorldForgeScenario(scenario);
        if (!state) throw new Error('worldforge-session-start-rejected');
        this.#sessions.set(state.sessionId, { scenarioId: scenario.id, createdAt: this.#now() });
        while (this.#sessions.size > MAX_SESSIONS) {
          const oldest = this.#sessions.keys().next().value as string | undefined;
          if (!oldest) break;
          this.#sessions.delete(oldest);
        }
        return resultEnvelope({ state });
      },
    });

    register({
      id: 'organism.worldforge.sessions.step',
      outputContract: outputContract({
        transition: {
          type: 'object',
          properties: {
            accepted: { type: 'boolean' },
            state: worldForgeStateOutput,
            reward01: { type: 'number', minimum: -1, maximum: 1 },
            eventsApplied: { type: 'integer', minimum: 0, maximum: 16 },
            reason: { type: 'string', maxLength: 160 },
            syntheticOnly: { type: 'boolean', enum: [true] },
          },
          required: ['accepted', 'state', 'reward01', 'eventsApplied', 'syntheticOnly'],
          additionalProperties: false,
          maxProperties: 6,
        },
      }, ['transition']),
      capability: 'planning.simulation.state',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: {
          scenarioId: { type: 'string', minLength: 1, maxLength: 160 },
          sessionId: { type: 'string', minLength: 1, maxLength: 200 },
          tick: { type: 'integer', minimum: 0, maximum: 128 },
          action: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ACTIONS },
              target: { type: 'string', minLength: 1, maxLength: 120 },
              evidence: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['action'],
            additionalProperties: false,
            maxProperties: 3,
          },
        },
        required: ['scenarioId','sessionId','tick','action'],
        additionalProperties: false,
        maxProperties: 4,
        maxSerializedBytes: 2048,
      },
      execute: async (input) => {
        this.prune();
        const session = this.requireSession(input.sessionId, input.scenarioId, input.tick);
        this.requireScenario(session.scenarioId);
        const transition = this.#simulator.stepWorldForgeScenario(session, input.action);
        if (!transition.state) throw new Error(transition.reason ?? 'worldforge-step-rejected');
        return resultEnvelope({ transition });
      },
    });

    register({
      id: 'organism.worldforge.sessions.evaluate',
      outputContract: outputContract({ evaluation: worldForgeEvaluationOutput }, ['evaluation']),
      capability: 'planning.simulation.read',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: {
          scenarioId: { type: 'string', minLength: 1, maxLength: 160 },
          sessionId: { type: 'string', minLength: 1, maxLength: 200 },
          tick: { type: 'integer', minimum: 0, maximum: 128 },
        },
        required: ['scenarioId','sessionId','tick'],
        additionalProperties: false,
        maxProperties: 3,
        maxSerializedBytes: 1024,
      },
      execute: async (input) => {
        this.prune();
        const session = this.requireSession(input.sessionId, input.scenarioId, input.tick);
        const scenario = this.requireScenario(session.scenarioId);
        const evaluation = this.#simulator.evaluateWorldForgeSession(scenario, session);
        if (scenario.split === 'train' && evaluation.split === 'train') this.recordTrainingFeedback(evaluation);
        return resultEnvelope({ evaluation });
      },
    });

    register({
      id: 'organism.worldforge.scenarios.release',
      outputContract: outputContract({
        released: { type: 'boolean', enum: [true] },
        scenarioId: boundedString(160),
      }, ['released', 'scenarioId']),
      capability: 'planning.simulation.state',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: { scenarioId: { type: 'string', minLength: 1, maxLength: 160 } },
        required: ['scenarioId'],
        additionalProperties: false,
        maxProperties: 1,
        maxSerializedBytes: 512,
      },
      execute: async (input) => {
        const id = boundedText(input.scenarioId);
        this.releaseScenario(id);
        return resultEnvelope({ released: true, scenarioId: id });
      },
    });
  }
}

export function registerWorldForgeTools(
  gateway: Pick<ActionGateway, 'registerTool'>,
  simulator: Pick<FutureSimulator,
    'generateWorldForgeScenarios' | 'generateAdversarialWorldForgeScenarios' | 'startWorldForgeScenario' | 'stepWorldForgeScenario' |
    'evaluateWorldForgeSession' | 'releaseWorldForgeScenario'>,
): WorldForgeToolAdapter {
  const adapter = new WorldForgeToolAdapter(simulator);
  adapter.register(gateway);
  return adapter;
}
