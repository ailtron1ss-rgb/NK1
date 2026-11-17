import type { ActionGateway, ToolDefinition } from '../system/ActionGateway.ts';
import type { FutureSimulator } from './FutureSimulator.ts';
import type { ConsequenceEcologyRequest } from './ConsequenceEcology.ts';

export interface ConsequenceEcologyContextProviders {
  goalEcology?: () => unknown;
  /** Optional adapter: present on builds whose canonical RegretEngine owns Negative Space Memory. */
  negativeSpace?: () => unknown;
}

function safeRead(provider: (() => unknown) | undefined): unknown {
  if (!provider) return null;
  try { return provider(); } catch { return null; }
}

function resultEnvelope(value: Record<string, unknown>): Record<string, unknown> {
  return { ok: true, decisionAuthority: 'none', independentlyVerified: false, ...value };
}

const number01 = { type: 'number' as const, minimum: 0, maximum: 1 };
const boundedText = { type: 'string' as const, minLength: 1, maxLength: 320 };
const nodeContract = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, minLength: 1, maxLength: 96 },
    description: boundedText,
    effect: { type: 'string' as const, enum: ['harm', 'benefit', 'neutral'] },
    actor: { type: 'string' as const, minLength: 1, maxLength: 96 },
    system: { type: 'string' as const, minLength: 1, maxLength: 96 },
    probability01: number01,
    impact01: number01,
    confidence01: number01,
    delayDays: { type: 'number' as const, minimum: 0, maximum: 365 },
    reversible: { type: 'boolean' as const },
    basis: { type: 'string' as const, enum: ['measured', 'external-research', 'user-assumption', 'simulation', 'internal-model'] },
    evidenceRefs: { type: 'array' as const, items: { type: 'string' as const, minLength: 1, maxLength: 180 }, maxItems: 8 },
    assumptionRefs: { type: 'array' as const, items: { type: 'string' as const, minLength: 1, maxLength: 128 }, maxItems: 8 },
  },
  required: ['id', 'description', 'effect', 'actor', 'system', 'probability01', 'impact01', 'confidence01', 'delayDays', 'reversible', 'basis'],
  additionalProperties: false,
  maxProperties: 13,
};
const edgeContract = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, minLength: 1, maxLength: 96 },
    from: { type: 'string' as const, minLength: 1, maxLength: 96 },
    to: { type: 'string' as const, minLength: 1, maxLength: 96 },
    relation: { type: 'string' as const, enum: ['causes', 'amplifies', 'mitigates', 'depends-on', 'feedback'] },
    polarity: { type: 'string' as const, enum: ['increase', 'decrease'] },
    strength01: number01,
    confidence01: number01,
    delayDays: { type: 'number' as const, minimum: 0, maximum: 365 },
  },
  required: ['id', 'from', 'to', 'relation', 'polarity', 'strength01', 'confidence01', 'delayDays'],
  additionalProperties: false,
  maxProperties: 8,
};
const optionContract = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, minLength: 1, maxLength: 96 },
    title: { type: 'string' as const, minLength: 1, maxLength: 180 },
    action: { type: 'string' as const, minLength: 1, maxLength: 180 },
    nodes: { type: 'array' as const, items: nodeContract, minItems: 1, maxItems: 64 },
    edges: { type: 'array' as const, items: edgeContract, maxItems: 128 },
  },
  required: ['id', 'title', 'action', 'nodes', 'edges'],
  additionalProperties: false,
  maxProperties: 5,
};

export class ConsequenceEcologyToolAdapter {
  readonly #simulator: Pick<FutureSimulator, 'analyzeConsequences' | 'consequenceEcology'>;
  readonly #providers: ConsequenceEcologyContextProviders;

  constructor(
    simulator: Pick<FutureSimulator, 'analyzeConsequences' | 'consequenceEcology'>,
    providers: ConsequenceEcologyContextProviders = {},
  ) {
    this.#simulator = simulator;
    this.#providers = providers;
  }

  register(gateway: Pick<ActionGateway, 'registerTool'>): void {
    const register = (definition: ToolDefinition) => gateway.registerTool(definition);
    register({
      id: 'organism.consequences.analyze',
      capability: 'planning.future.read',
      destructive: false,
      projectAllowed: true,
      requiresIdempotencyKey: true,
      inputContract: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 96 },
          scenarioId: { type: 'string', minLength: 1, maxLength: 160 },
          horizonDays: { type: 'integer', minimum: 1, maximum: 365 },
          options: { type: 'array', items: optionContract, minItems: 1, maxItems: 8 },
          at: { type: 'number', minimum: 0 },
        },
        required: ['id', 'scenarioId', 'horizonDays', 'options'],
        additionalProperties: false,
        maxProperties: 5,
        maxSerializedBytes: 65_536,
      },
      execute: async input => {
        const request = input as unknown as ConsequenceEcologyRequest;
        const result = this.#simulator.analyzeConsequences(request, {
          goalEcology: safeRead(this.#providers.goalEcology),
          negativeSpace: safeRead(this.#providers.negativeSpace),
        });
        return resultEnvelope({
          replayed: result.replayed,
          analysis: result.analysis,
          note: 'A model ranking is advisory only; no decision was approved or executed.',
        });
      },
    });
    register({
      id: 'organism.consequences.list',
      capability: 'planning.future.read',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 32 } },
        required: [],
        additionalProperties: false,
        maxProperties: 1,
        maxSerializedBytes: 128,
      },
      execute: async input => resultEnvelope({
        analyses: this.#simulator.consequenceEcology.list(Number(input.limit ?? 16)),
      }),
    });
    register({
      id: 'organism.consequences.get',
      capability: 'planning.future.read',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: { id: { type: 'string', minLength: 1, maxLength: 96 } },
        required: ['id'],
        additionalProperties: false,
        maxProperties: 1,
        maxSerializedBytes: 256,
      },
      execute: async input => {
        const analysis = this.#simulator.consequenceEcology.get(String(input.id));
        return resultEnvelope({ found: Boolean(analysis), analysis });
      },
    });
    register({
      id: 'organism.consequences.diagnostics',
      capability: 'planning.future.read',
      destructive: false,
      projectAllowed: true,
      inputContract: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
        maxProperties: 0,
        maxSerializedBytes: 64,
      },
      execute: async () => resultEnvelope({
        diagnostics: this.#simulator.consequenceEcology.diagnostics(),
      }),
    });
  }
}

export function registerConsequenceEcologyTools(
  gateway: Pick<ActionGateway, 'registerTool'>,
  simulator: Pick<FutureSimulator, 'analyzeConsequences' | 'consequenceEcology'>,
  providers: ConsequenceEcologyContextProviders = {},
): ConsequenceEcologyToolAdapter {
  const adapter = new ConsequenceEcologyToolAdapter(simulator, providers);
  adapter.register(gateway);
  return adapter;
}
