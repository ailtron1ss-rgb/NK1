export type ActionKind = 'respond'|'explore'|'verify'|'rest'|'reflect'|'wait'|'defer';

export interface PolicyAuthorityContribution {
  source: string;
  action: ActionKind;
  bias01: number;
  authority01: number;
  causal01: number;
  stage: string;
}

export interface PolicyAuthorityLedgerState {
  version: 1;
  cycle: number;
  contributions: PolicyAuthorityContribution[];
  duplicateSourcePairs: number;
  duplicateMagnitude01: number;
  finalByAction: Partial<Record<ActionKind, number>>;
}

const finite = (x: unknown, fallback = 0) => typeof x === 'number' && Number.isFinite(x) ? x : fallback;
const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * R2 production policy contract: one auditable authority ledger sits between
 * policy-producing subsystems and the executive score. It does not invent
 * policy; it records provenance, bounds aggregate influence, and detects
 * accidental double-writes from the same authority family.
 */
export class PolicyAuthorityLedger {
  private state: PolicyAuthorityLedgerState = {
    version: 1, cycle: 0, contributions: [], duplicateSourcePairs: 0,
    duplicateMagnitude01: 0, finalByAction: {},
  };

  beginCycle(cycle: number) {
    this.state = {
      version: 1, cycle: Math.max(0, Math.floor(cycle)), contributions: [],
      duplicateSourcePairs: 0, duplicateMagnitude01: 0, finalByAction: {},
    };
  }

  add(input: Omit<PolicyAuthorityContribution, 'bias01'> & { bias01: number }) {
    const bias = clamp(finite(input.bias01));
    const row: PolicyAuthorityContribution = {
      source: String(input.source), action: input.action, bias01: bias,
      authority01: Math.max(0, Math.min(1, finite(input.authority01, .5))),
      causal01: Math.max(0, Math.min(1, finite(input.causal01, .5))), stage: String(input.stage),
    };
    if (Math.abs(row.bias01) > 1e-9) {
      const sameFamily = this.state.contributions.filter(x => x.action === row.action &&
        (x.source === row.source || x.source.split(':')[0] === row.source.split(':')[0]));
      if (sameFamily.length) {
        this.state.duplicateSourcePairs += sameFamily.length;
        this.state.duplicateMagnitude01 += Math.min(.25, Math.abs(row.bias01));
      }
    }
    this.state.contributions.push(row);
    return row;
  }

  finalize(maxAbs01 = .24) {
    // A caller-controlled bound must itself be finite and non-negative; otherwise
    // Math.min/Math.max can leak NaN or invert the clamp interval into policy output.
    const limit = Math.max(0, Math.min(1, finite(maxAbs01, .24)));
    const byAction: Partial<Record<ActionKind, number>> = {};
    for (const row of this.state.contributions) byAction[row.action] = (byAction[row.action] ?? 0) + row.bias01;
    for (const action of Object.keys(byAction) as ActionKind[]) byAction[action] = clamp(byAction[action] ?? 0, -limit, limit);
    this.state.finalByAction = byAction;
    return structuredClone(byAction);
  }

  snapshot() { return structuredClone(this.state); }
  diagnostics() {
    const actions = Object.keys(this.state.finalByAction).length;
    return {
      version: 1, cycle: this.state.cycle, contributionCount: this.state.contributions.length,
      actions, duplicateSourcePairs: this.state.duplicateSourcePairs,
      duplicateMagnitude01: clamp(this.state.duplicateMagnitude01, 0, 1),
      finalByAction: structuredClone(this.state.finalByAction),
      pass: this.state.duplicateSourcePairs === 0,
    };
  }
}
