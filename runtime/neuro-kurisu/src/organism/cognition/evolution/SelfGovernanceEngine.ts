import type { ActionKind, IntentCandidate, OrganismGoal } from '../../core/types.ts';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export interface GovernanceRecord {
  id: string;
  at: number;
  requestedAction: ActionKind | null;
  chosenAction: ActionKind;
  preferredInternalAction: ActionKind;
  autonomous: boolean;
  overrideStrength: number;
  internalPressure: number;
  commitmentPressure: number;
  regretPressure: number;
  reason: string;
}

export interface ConsequenceRecord {
  id: string;
  at: number;
  action: ActionKind;
  expectedReward: number;
  actualReward: number;
  predictionError: number;
  counterfactualBest: number;
  regret: number;
  ownership: number;
  lesson: string;
}

export interface SelfGovernanceState {
  version: 1;
  records: GovernanceRecord[];
  consequences: ConsequenceRecord[];
  governanceScore: number;
  externalOverrideDependency: number;
  consequenceOwnership: number;
  regretMean: number;
  lastAt: number;
  totalRecords: number;
  totalAutonomousDecisions: number;
  totalOverrides: number;
  totalConsequences: number;
  totalRegret: number;
  totalOwnership: number;
}

export const defaultSelfGovernance = (): SelfGovernanceState => ({
  version: 1,
  records: [],
  consequences: [],
  governanceScore: 0.18,
  externalOverrideDependency: 0,
  consequenceOwnership: 0.5,
  regretMean: 0,
  lastAt: 0,
  totalRecords: 0,
  totalAutonomousDecisions: 0,
  totalOverrides: 0,
  totalConsequences: 0,
  totalRegret: 0,
  totalOwnership: 0,
});

export class SelfGovernanceEngine {
  private state = defaultSelfGovernance();

  restore(value: SelfGovernanceState | undefined): void {
    const base = defaultSelfGovernance();
    this.state = {
      ...base,
      ...(value ?? {}),
      records: Array.isArray(value?.records) ? value!.records.slice(0, 160) : [],
      consequences: Array.isArray(value?.consequences) ? value!.consequences.slice(0, 192) : [],
      totalRecords: Math.max(Number(value?.totalRecords ?? value?.records?.length ?? 0), Array.isArray(value?.records) ? value!.records.length : 0),
      totalAutonomousDecisions: Math.max(Number(value?.totalAutonomousDecisions ?? (value?.records??[]).filter((record:GovernanceRecord)=>record.autonomous).length), 0),
      totalOverrides: Math.max(Number(value?.totalOverrides ?? (value?.records??[]).filter((record:GovernanceRecord)=>record.requestedAction && record.chosenAction !== record.requestedAction).length), 0),
      totalConsequences: Math.max(Number(value?.totalConsequences ?? value?.consequences?.length ?? 0), Array.isArray(value?.consequences) ? value!.consequences.length : 0),
      totalRegret: Math.max(Number(value?.totalRegret ?? (value?.consequences??[]).reduce((sum:number,row:ConsequenceRecord)=>sum+row.regret,0)), 0),
      totalOwnership: Math.max(Number(value?.totalOwnership ?? (value?.consequences??[]).reduce((sum:number,row:ConsequenceRecord)=>sum+row.ownership,0)), 0),
    };
  }

  snapshot(): SelfGovernanceState { return structuredClone(this.state); }

  consequencesSnapshot(limit = 256): ConsequenceRecord[] {
    const n = Math.max(1, Math.min(256, Math.floor(Number(limit) || 256)));
    return structuredClone(this.state.consequences.slice(0, n));
  }

  snapshotLight() {
    return {
      governanceScore: this.state.governanceScore,
      externalOverrideDependency: this.state.externalOverrideDependency,
      consequenceOwnership: this.state.consequenceOwnership,
      regretMean: this.state.regretMean,
      lastAt: this.state.lastAt,
      totalRecords: this.state.totalRecords,
      totalAutonomousDecisions: this.state.totalAutonomousDecisions,
      totalOverrides: this.state.totalOverrides,
      totalConsequences: this.state.totalConsequences,
    };
  }

  influence(
    candidates: IntentCandidate[],
    requestedAction: ActionKind | null,
    goals: OrganismGoal[],
    internalPressure: number,
    regretPressure: number,
  ): IntentCandidate[] {
    const commitmentPressure = goals
      .filter(goal => goal.status === 'active')
      .reduce((sum, goal) => sum + clamp(goal.importance * goal.urgency * (1 - goal.progress)), 0) / Math.max(1, Math.min(4, goals.length));
    const autonomousBias = clamp(internalPressure * 0.45 + commitmentPressure * 0.35 + regretPressure * 0.2);
    const requested = requestedAction ? candidates.find(candidate => candidate.action === requestedAction) : undefined;
    return candidates
      .map(candidate => {
        const preservesCommitment = goals.some(goal => goal.status === 'active' && goal.title.toLowerCase().includes(candidate.action));
        const internal = candidate.action === 'verify' || candidate.action === 'explore' || candidate.action === 'reflect' || candidate.action === 'rest';
        const externalPenalty = requestedAction && candidate.action !== requestedAction ? 0.015 * (1 - autonomousBias) : 0;
        const commitmentBonus = preservesCommitment ? commitmentPressure * 0.06 : 0;
        const autonomyBonus = internal ? autonomousBias * 0.055 : 0;
        const score = clamp(candidate.score + commitmentBonus + autonomyBonus - externalPenalty);
        return { ...candidate, score, predictedUtility: clamp(candidate.predictedUtility + commitmentBonus + autonomyBonus - externalPenalty) };
      })
      .sort((a, b) => b.score - a.score);
  }

  recordDecision(input: {
    requestedAction: ActionKind | null;
    chosenAction: ActionKind;
    autonomous: boolean;
    internalPressure: number;
    commitmentPressure: number;
    regretPressure: number;
    reason: string;
  }): GovernanceRecord {
    const requested = input.requestedAction;
    const overrideStrength = requested && requested !== input.chosenAction
      ? clamp(0.45 + input.internalPressure * 0.4 - (1 - input.commitmentPressure) * 0.08)
      : 0;
    const row: GovernanceRecord = {
      id: `gov-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: Date.now(),
      requestedAction: requested,
      chosenAction: input.chosenAction,
      preferredInternalAction: input.chosenAction,
      autonomous: input.autonomous,
      overrideStrength: Number(overrideStrength.toFixed(3)),
      internalPressure: clamp(input.internalPressure),
      commitmentPressure: clamp(input.commitmentPressure),
      regretPressure: clamp(input.regretPressure),
      reason: input.reason.slice(0, 280),
    };
    this.state.records = [row, ...this.state.records].slice(0, 160);
    this.state.totalRecords += 1;
    if (row.autonomous) this.state.totalAutonomousDecisions += 1;
    if (row.requestedAction && row.chosenAction !== row.requestedAction) this.state.totalOverrides += 1;
    const n = Math.max(1, this.state.totalRecords);
    this.state.externalOverrideDependency = clamp(1 - this.state.totalOverrides / n);
    this.state.governanceScore = clamp(this.state.governanceScore * 0.94 + (this.state.totalAutonomousDecisions / n) * 0.04 + overrideStrength * 0.08 + input.commitmentPressure * 0.03);
    this.state.lastAt = row.at;
    return structuredClone(row);
  }

  recordConsequence(input: {
    action: ActionKind;
    expectedReward: number;
    actualReward: number;
    counterfactualBest: number;
    source?: string;
  }): ConsequenceRecord {
    const expected = clamp(input.expectedReward);
    const actual = clamp(input.actualReward);
    const counterfactual = clamp(input.counterfactualBest);
    const predictionError = clamp(Math.abs(expected - actual));
    const regret = clamp(counterfactual - actual);
    const ownership = clamp(0.45 + (1 - predictionError) * 0.35 + (1 - regret) * 0.2);
    const lesson = regret > 0.3 ? `reconsider:${input.action}:alternative-outperformed` : predictionError > 0.3 ? `recalibrate:${input.action}` : `reinforce:${input.action}`;
    const row: ConsequenceRecord = {
      id: `consequence-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: Date.now(),
      action: input.action,
      expectedReward: expected,
      actualReward: actual,
      predictionError,
      counterfactualBest: counterfactual,
      regret,
      ownership,
      lesson: `${lesson}${input.source ? `:${input.source}` : ''}`,
    };
    this.state.consequences = [row, ...this.state.consequences].slice(0, 192);
    this.state.totalConsequences += 1;
    this.state.totalRegret += regret;
    this.state.totalOwnership += ownership;
    this.state.regretMean = clamp(this.state.totalRegret / Math.max(1, this.state.totalConsequences));
    this.state.consequenceOwnership = clamp(this.state.totalOwnership / Math.max(1, this.state.totalConsequences));
    this.state.governanceScore = clamp(this.state.governanceScore * 0.96 + ownership * 0.02 + (1 - regret) * 0.02);
    this.state.lastAt = row.at;
    return structuredClone(row);
  }
}
