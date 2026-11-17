import { randomBytes } from 'node:crypto';
import type { ActionGateway, ToolDefinition } from '../system/ActionGateway.ts';
import type { FutureSimulator } from './FutureSimulator.ts';
import type { WorldForgeAction, WorldForgeCase } from './WorldForge.ts';

const MAX_SCENARIOS = 512;
const MAX_SESSIONS = 2048;
const ENTRY_TTL_MS = 30 * 60_000;
const ACTIONS: WorldForgeAction[] = ['observe','inspect','move','collect','wait','reroute','prioritize','verify'];

type ScenarioEntry = { scenario: WorldForgeCase; createdAt: number };
type SessionEntry = { scenarioId: string; createdAt: number };

function boundedText(value: unknown, limit = 160): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, limit) : '';
}

function resultEnvelope(value: Record<string, unknown>): Record<string, unknown> {
  return { ok: true, syntheticOnly: true, independentlyVerified: false, ...value };
}

export class WorldForgeToolAdapter {
  readonly #scenarios = new Map<string, ScenarioEntry>();
  readonly #sessions = new Map<string, SessionEntry>();
  readonly #simulator: Pick<FutureSimulator,
    'generateWorldForgeScenarios' | 'startWorldForgeScenario' | 'stepWorldForgeScenario' |
    'evaluateWorldForgeSession' | 'releaseWorldForgeScenario'>;
  readonly #now: () => number;

  constructor(
    simulator: Pick<FutureSimulator,
      'generateWorldForgeScenarios' | 'startWorldForgeScenario' | 'stepWorldForgeScenario' |
      'evaluateWorldForgeSession' | 'releaseWorldForgeScenario'>,
    now: () => number = () => Date.now(),
  ) {
    this.#simulator = simulator;
    this.#now = now;
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
        const seed = randomBytes(4).readUInt32BE(0);
        const scenarios = this.#simulator.generateWorldForgeScenarios({ split, seed, count, difficulty01 });
        for (const scenario of scenarios) this.rememberScenario(scenario);
        return resultEnvelope({
          scenarios: scenarios.map(s => ({
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
          })),
          count: scenarios.length,
          note: 'Perturbations are hidden. Their effects become observable only as the synthetic environment changes.',
        });
      },
    });

    register({
      id: 'organism.worldforge.sessions.start',
      capability: 'planning.simulation.write',
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
      capability: 'planning.simulation.write',
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
        return resultEnvelope({ evaluation });
      },
    });

    register({
      id: 'organism.worldforge.scenarios.release',
      capability: 'planning.simulation.write',
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
    'generateWorldForgeScenarios' | 'startWorldForgeScenario' | 'stepWorldForgeScenario' |
    'evaluateWorldForgeSession' | 'releaseWorldForgeScenario'>,
): WorldForgeToolAdapter {
  const adapter = new WorldForgeToolAdapter(simulator);
  adapter.register(gateway);
  return adapter;
}
