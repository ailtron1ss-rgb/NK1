import type { ActionKind } from '../core/types.ts';

export interface CanonicalPolicySource {
  name: string;
  bias: Partial<Record<ActionKind, number>>;
  confidence01: number;
  enabled?: boolean;
  causal01?: number;
}

export interface CanonicalPolicyInput {
  baseUtility: number;
  predictedUtility: number;
  sources: CanonicalPolicySource[];
  computeBudget01?: number;
  uncertainty01?: number;
  identityGate01?: number;
}

export interface CanonicalPolicyAction {
  action: ActionKind;
  contribution01: number;
  confidence01: number;
  sourceCount: number;
  disagreement01: number;
  sourceContributions01: Record<string, number>;
}

export interface CanonicalPolicyFrame {
  version: 1;
  actions: Record<ActionKind, CanonicalPolicyAction>;
  totalSignal01: number;
  meanConfidence01: number;
  disagreement01: number;
}

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const clampSigned = (x: number, a = -.16, b = .16) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : 0));

/**
 * Single policy arbitration surface.
 * Learning systems remain independently replaceable, but action authority is
 * consolidated here so new learners cannot silently become second policy engines.
 */
export class CanonicalActionPolicyArbiter {
  static readonly VERSION = 1 as const;

  contribution(input: { action: ActionKind; sources: CanonicalPolicySource[]; computeBudget01?: number; uncertainty01?: number; identityGate01?: number }): CanonicalPolicyAction {
    const frame = this.evaluate({baseUtility:.5, predictedUtility:.5, sources:input.sources, computeBudget01:input.computeBudget01, uncertainty01:input.uncertainty01, identityGate01:input.identityGate01});
    return frame.actions[input.action];
  }

  evaluate(input: CanonicalPolicyInput): CanonicalPolicyFrame {
    const actions = {} as Record<ActionKind, CanonicalPolicyAction>;
    const active = input.sources.filter(s => s.enabled !== false);
    const budget = clamp(input.computeBudget01 ?? 1);
    const uncertainty = clamp(input.uncertainty01 ?? .5);
    const identityGate = clamp(input.identityGate01 ?? 1);
    const sourceRows = ACTIONS.map(action => {
      const raw = active.map(source => {
        const bias = Number(source.bias[action] ?? 0);
        const confidence = clamp(source.confidence01);
        const causal = clamp(source.causal01 ?? confidence);
        // Uncertain or non-causal policy proposals are attenuated rather than
        // allowed to silently dominate the production decision surface.
        const trust = confidence * (.65 + .35 * causal) * (.72 + .28 * identityGate);
        return { bias: clampSigned(bias), weight: trust, name: source.name };
      });
      const weight = rowsWeight(raw);
      const weighted = weight > 0 ? raw.reduce((sum, row) => sum + row.bias * row.weight, 0) / weight : 0;
      const values = raw.map(row => row.bias);
      const disagreement = values.length > 1 ? clamp01Variance(values) : 0;
      const confidence = active.length ? clamp((weight / Math.max(1, active.length)) * (.72 + .28 * (1 - disagreement))) : 0;
      const scale = (.72 + .28 * budget) * (.78 + .22 * (1 - uncertainty));
      // Names are provenance keys, not guaranteed unique IDs. Aggregate duplicate
      // names instead of silently overwriting earlier contributions in diagnostics.
      const sourceContributions01: Record<string, number> = {};
      for (const row of raw) {
        const contribution = row.bias * row.weight / Math.max(.001, weight);
        sourceContributions01[row.name] = clampSigned(
          (sourceContributions01[row.name] ?? 0) + contribution, -.14, .14,
        );
      }
      actions[action] = {
        action,
        contribution01: clampSigned(weighted * scale, -.14, .14),
        confidence01: confidence,
        sourceCount: raw.length,
        disagreement01: disagreement,
        sourceContributions01,
      };
      return actions[action];
    });
    const total = sourceRows.reduce((sum, row) => sum + Math.abs(row.contribution01), 0);
    return {
      version: 1,
      actions,
      totalSignal01: clamp(total / (ACTIONS.length * .14)),
      meanConfidence01: sourceRows.reduce((sum, row) => sum + row.confidence01, 0) / ACTIONS.length,
      disagreement01: sourceRows.reduce((sum, row) => sum + row.disagreement01, 0) / ACTIONS.length,
    };
  }
}

function rowsWeight(rows: Array<{weight: number}>): number { return rows.reduce((sum, row) => sum + row.weight, 0); }
function clamp01Variance(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return clamp(Math.sqrt(variance) / .16);
}
