import { createHash } from 'node:crypto';
import {
  authenticatedOutcomeArtifactPayload,
  authenticatedOutcomeEvidenceFingerprint,
} from './VerifiedOutcomeArtifact.ts';
import {
  normalizePromotionGateConfig,
  type PromotionGateConfig,
} from './VerifiedOutcomePromotionGate.ts';
import { evaluateOutcomePromotionPortfolio, type PortfolioPromotionResult } from './ExperimentInference.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry, type VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { validateLearningExperimentPlan, type LearningExperimentPlan } from './LearningExperimentPlan.ts';

export type ExperimentCampaignPrimaryMetric = 'task-pass-rate';

export interface ExperimentCampaignCandidate { method: string; fingerprint: string; }
export interface ExperimentCampaignRegistration {
  schemaVersion: 1;
  campaignId: string;
  split: 'holdout';
  manifestFingerprint: string;
  holdoutManifestFingerprint: string;
  planFingerprint: string;
  baselineMethod: string;
  baselineFingerprint: string;
  candidates: ExperimentCampaignCandidate[];
  primaryMetric: ExperimentCampaignPrimaryMetric;
  promotionPolicy: PromotionGateConfig;
  registeredAt: number;
  registrationFingerprint: string;
}
export interface ExperimentCampaignRecord {
  registration: ExperimentCampaignRegistration;
  status: 'registered' | 'finalized';
  outcomeFingerprint?: string;
  result?: PortfolioPromotionResult;
}
export interface ExperimentCampaignRegistrySnapshot {
  schemaVersion: 1;
  campaigns: ExperimentCampaignRecord[];
  snapshotFingerprint: string;
}
export interface RegisterExperimentCampaignInput {
  campaignId: string;
  plan: LearningExperimentPlan;
  manifest: TaskManifestEntry[];
  baselineMethod: string;
  baselineFingerprint: string;
  candidateFingerprints: Record<string, string>;
  primaryMetric: string;
  promotionPolicy?: Partial<PromotionGateConfig>;
  registeredAt: number;
}

type PlainRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is PlainRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.normalize('NFKC').trim().length > 0;
const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as PlainRecord;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
};
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const clone = <T>(value: T): T => structuredClone(value);
const registrationFingerprint = (value: Omit<ExperimentCampaignRegistration, 'registrationFingerprint'>): string =>
  sha256(canonical(value));

function outcomeFingerprint(rows: Array<{ outcome: VerifiedTaskOutcome; runId: string; artifactFingerprint: string }>): string {
  return sha256(canonical(rows.map(row => ({
    runId: row.runId,
    taskId: row.outcome.taskId,
    taskVersion: row.outcome.taskVersion,
    method: row.outcome.method,
    seed: row.outcome.seed,
    attempt: row.outcome.attempt,
    passed: row.outcome.passed,
    verifierId: row.outcome.verifierId,
    evidenceRef: row.outcome.evidenceRef,
    artifactFingerprint: row.artifactFingerprint,
    observedAt: row.outcome.observedAt,
  })).sort((a, b) => a.runId.localeCompare(b.runId))));
}

/**
 * One-shot governance for confirmatory holdout campaigns.
 * The complete plan, candidate family, candidate fingerprints, primary metric
 * and promotion policy are locked before outcomes can be inspected. A given
 * holdout-only manifest fingerprint may be used by one confirmatory campaign.
 *
 * This is a fail-closed reservation mechanism, not a differential-privacy
 * reusable-holdout service. It deliberately prohibits adaptive reuse.
 */
export class ExperimentCampaignRegistry {
  private readonly campaigns = new Map<string, ExperimentCampaignRecord>();
  private readonly holdoutOwners = new Map<string, string>();

  register(input: RegisterExperimentCampaignInput): ExperimentCampaignRegistration {
    if (!input || typeof input !== 'object' ||
        typeof input.campaignId !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/.test(input.campaignId) ||
        !nonEmpty(input.baselineMethod) || !isSha256(input.baselineFingerprint) ||
        input.primaryMetric !== 'task-pass-rate' || !Number.isSafeInteger(input.registeredAt) ||
        input.registeredAt <= 0 || !input.plan || !Array.isArray(input.manifest) ||
        !isRecord(input.candidateFingerprints)) {
      throw new Error('invalid experiment campaign registration');
    }
    validateLearningExperimentPlan(input.plan, input.manifest);
    if (input.plan.split !== 'holdout') throw new Error('confirmatory campaign must use the holdout split');

    const ledger = new VerifiedOutcomeLedger(input.manifest);
    const manifestFingerprint = ledger.manifestFingerprint();
    const holdoutManifestFingerprint = ledger.splitManifestFingerprint('holdout');
    if (manifestFingerprint !== input.plan.manifestFingerprint) {
      throw new Error('campaign plan is bound to a different task manifest');
    }

    const plannedMethods = [...new Set(input.plan.arms.map(arm => arm.method))].sort();
    if (!plannedMethods.includes(input.baselineMethod)) throw new Error('baseline method is absent from the registered plan');
    const candidates = Object.entries(input.candidateFingerprints)
      .map(([method, fingerprint]) => ({
        method,
        fingerprint: typeof fingerprint === 'string' ? fingerprint.toLowerCase() : '',
      }))
      .sort((a, b) => a.method.localeCompare(b.method));
    const expectedCandidates = plannedMethods.filter(method => method !== input.baselineMethod);
    if (candidates.length !== expectedCandidates.length ||
        candidates.some(item => !nonEmpty(item.method) || !isSha256(item.fingerprint)) ||
        candidates.some(item => item.method === input.baselineMethod) ||
        candidates.map(item => item.method).join('\u0000') !== expectedCandidates.join('\u0000')) {
      throw new Error('candidate fingerprints must cover every non-baseline plan arm exactly once');
    }

    const promotionPolicy = normalizePromotionGateConfig({
      ...input.promotionPolicy,
      familyPairCountMode: input.promotionPolicy?.familyPairCountMode ?? 'seed-repeated',
    });
    const raw: Omit<ExperimentCampaignRegistration, 'registrationFingerprint'> = {
      schemaVersion: 1,
      campaignId: input.campaignId,
      split: 'holdout',
      manifestFingerprint,
      holdoutManifestFingerprint,
      planFingerprint: input.plan.planFingerprint,
      baselineMethod: input.baselineMethod,
      baselineFingerprint: input.baselineFingerprint.toLowerCase(),
      candidates,
      primaryMetric: input.primaryMetric,
      promotionPolicy,
      registeredAt: input.registeredAt,
    };
    const fingerprint = registrationFingerprint(raw);
    const registration: ExperimentCampaignRegistration = { ...raw, registrationFingerprint: fingerprint };

    const existing = this.campaigns.get(input.campaignId);
    if (existing) {
      if (existing.registration.registrationFingerprint !== fingerprint) {
        throw new Error('campaign ID is already bound to a different registration');
      }
      return clone(existing.registration);
    }
    const owner = this.holdoutOwners.get(holdoutManifestFingerprint);
    if (owner) throw new Error(`holdout manifest is already reserved by campaign ${owner}`);

    this.campaigns.set(input.campaignId, { registration, status: 'registered' });
    this.holdoutOwners.set(holdoutManifestFingerprint, input.campaignId);
    return clone(registration);
  }

  get(campaignId: string): ExperimentCampaignRecord | null {
    const record = this.campaigns.get(campaignId);
    return record ? clone(record) : null;
  }

  list(): ExperimentCampaignRecord[] {
    return [...this.campaigns.values()]
      .sort((a, b) => a.registration.campaignId.localeCompare(b.registration.campaignId))
      .map(clone);
  }

  /**
   * Finalize the registered portfolio directly from signed artifact receipts.
   * Caller-provided pass-rate/p-value summaries are never accepted here.
   */
  evaluate(campaignId: string, plan: LearningExperimentPlan, ledger: VerifiedOutcomeLedger): PortfolioPromotionResult {
    const record = this.campaigns.get(campaignId);
    if (!record) throw new Error('unknown experiment campaign');
    const registration = record.registration;
    if (plan.planFingerprint !== registration.planFingerprint ||
        plan.manifestFingerprint !== registration.manifestFingerprint || plan.split !== 'holdout') {
      throw new Error('evaluation plan does not match the preregistered campaign');
    }
    validateLearningExperimentPlan(plan, ledger.snapshot().manifest as TaskManifestEntry[]);
    if (ledger.manifestFingerprint() !== registration.manifestFingerprint ||
        ledger.splitManifestFingerprint('holdout') !== registration.holdoutManifestFingerprint) {
      throw new Error('evaluation ledger does not match the reserved holdout manifest');
    }

    const methods = new Map<string, string>([
      [registration.baselineMethod, registration.baselineFingerprint],
      ...registration.candidates.map(item => [item.method, item.fingerprint] as [string, string]),
    ]);
    const plannedTasks = new Set(plan.runs.map(run => run.taskId));
    const plannedSeeds = new Set(plan.seedIds);
    const expectedByCell = new Map(plan.runs.map(run => [JSON.stringify([run.taskId, run.seed, run.method]), run]));
    const outcomes = (ledger.snapshot().outcomes as VerifiedTaskOutcome[]).filter(outcome =>
      plannedTasks.has(outcome.taskId) && methods.has(outcome.method),
    );
    const seen = new Set<string>();
    const verifiedRows: Array<{ outcome: VerifiedTaskOutcome; runId: string; artifactFingerprint: string }> = [];

    for (const outcome of outcomes) {
      if (!plannedSeeds.has(outcome.seed) || outcome.attempt !== 1) {
        throw new Error('holdout campaign contains an unplanned seed or retry attempt');
      }
      const cell = JSON.stringify([outcome.taskId, outcome.seed, outcome.method]);
      const run = expectedByCell.get(cell);
      if (!run || seen.has(cell)) throw new Error('holdout outcome is outside the registered run schedule');
      const payload = authenticatedOutcomeArtifactPayload(ledger, outcome.evidenceRef);
      const artifactHash = authenticatedOutcomeEvidenceFingerprint(ledger, outcome.evidenceRef);
      if (!payload || !artifactHash) {
        throw new Error('every confirmatory holdout outcome requires an authenticated signed artifact');
      }
      if (payload.schemaVersion !== 1 ||
          payload.runId !== run.runId ||
          payload.manifestFingerprint !== registration.manifestFingerprint ||
          payload.taskId !== run.taskId ||
          payload.taskVersion !== run.taskVersion ||
          payload.method !== run.method ||
          payload.methodFingerprint !== methods.get(run.method) ||
          payload.seed !== run.seed ||
          payload.attempt !== 1 ||
          payload.passed !== outcome.passed ||
          payload.verifierId !== run.verifierId ||
          payload.observedAt !== outcome.observedAt) {
        throw new Error('signed outcome artifact does not match the registered plan or candidate fingerprint');
      }
      seen.add(cell);
      verifiedRows.push({ outcome, runId: run.runId, artifactFingerprint: artifactHash });
    }
    if (seen.size !== plan.runs.length) {
      throw new Error(`holdout campaign has incomplete signed outcome coverage: ${seen.size}/${plan.runs.length}`);
    }

    const currentFingerprint = outcomeFingerprint(verifiedRows);
    if (record.status === 'finalized') {
      if (record.outcomeFingerprint !== currentFingerprint || !record.result) {
        throw new Error('finalized holdout campaign cannot be re-evaluated on changed outcomes');
      }
      return clone(record.result);
    }

    const comparisons = registration.candidates.map(candidate => ({
      method: candidate.method,
      aggregate: ledger.comparePairedBySeed(registration.baselineMethod, candidate.method, 'holdout'),
      families: ledger.comparePairedByFamilyAndSeed(registration.baselineMethod, candidate.method, 'holdout'),
    }));
    const result = evaluateOutcomePromotionPortfolio(comparisons, registration.promotionPolicy);
    record.status = 'finalized';
    record.outcomeFingerprint = currentFingerprint;
    record.result = clone(result);
    return clone(result);
  }

  snapshot(): ExperimentCampaignRegistrySnapshot {
    const campaigns = this.list();
    const payload = { schemaVersion: 1 as const, campaigns };
    return { ...payload, snapshotFingerprint: sha256(canonical(payload)) };
  }

  static restoreSnapshot(value: unknown): ExperimentCampaignRegistry {
    if (!isRecord(value) || value.schemaVersion !== 1 ||
        !Array.isArray(value.campaigns) || !isSha256(value.snapshotFingerprint)) {
      throw new Error('invalid experiment campaign registry snapshot');
    }
    const payload = { schemaVersion: 1, campaigns: value.campaigns };
    if (sha256(canonical(payload)) !== value.snapshotFingerprint) {
      throw new Error('experiment campaign registry snapshot fingerprint mismatch');
    }

    const registry = new ExperimentCampaignRegistry();
    for (const raw of value.campaigns) {
      if (!isRecord(raw) || !isRecord(raw.registration) ||
          !['registered', 'finalized'].includes(String(raw.status))) {
        throw new Error('malformed experiment campaign record');
      }
      const registration = raw.registration as unknown as ExperimentCampaignRegistration;
      const { registrationFingerprint: expected, ...withoutFingerprint } = registration;
      let normalizedPolicy: PromotionGateConfig | null = null;
      try {
        normalizedPolicy = normalizePromotionGateConfig(registration.promotionPolicy);
      } catch {
        normalizedPolicy = null;
      }
      const candidateMethods = Array.isArray(registration.candidates)
        ? registration.candidates.map(item => item?.method)
        : [];
      const expectedCandidates = [...candidateMethods].sort((a, b) =>
        typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : 0);
      if (registration.schemaVersion !== 1 || registration.split !== 'holdout' ||
          !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/.test(registration.campaignId) ||
          !nonEmpty(registration.baselineMethod) ||
          registration.primaryMetric !== 'task-pass-rate' ||
          !Number.isSafeInteger(registration.registeredAt) || registration.registeredAt <= 0 ||
          expected !== registrationFingerprint(withoutFingerprint) ||
          !isSha256(registration.manifestFingerprint) ||
          !isSha256(registration.holdoutManifestFingerprint) ||
          !isSha256(registration.planFingerprint) ||
          !isSha256(registration.baselineFingerprint) ||
          !Array.isArray(registration.candidates) || !registration.candidates.length ||
          registration.candidates.some(item => !item || !nonEmpty(item.method) ||
            item.method === registration.baselineMethod || !isSha256(item.fingerprint)) ||
          new Set(candidateMethods).size !== candidateMethods.length ||
          canonical(candidateMethods) !== canonical(expectedCandidates) ||
          !normalizedPolicy || canonical(normalizedPolicy) !== canonical(registration.promotionPolicy)) {
        throw new Error('campaign registration fingerprint or fields are invalid');
      }
      if (registry.campaigns.has(registration.campaignId) ||
          registry.holdoutOwners.has(registration.holdoutManifestFingerprint)) {
        throw new Error('duplicate campaign ID or reused holdout manifest in snapshot');
      }
      if (raw.status === 'finalized') {
        if (!isSha256(raw.outcomeFingerprint) || !isRecord(raw.result) || !Array.isArray(raw.result.results)) {
          throw new Error('finalized campaign is missing immutable result evidence');
        }
      } else if (raw.outcomeFingerprint !== undefined || raw.result !== undefined) {
        throw new Error('unfinalized campaign cannot contain result evidence');
      }
      registry.campaigns.set(registration.campaignId, clone(raw as unknown as ExperimentCampaignRecord));
      registry.holdoutOwners.set(registration.holdoutManifestFingerprint, registration.campaignId);
    }
    return registry;
  }
}
