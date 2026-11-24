import { randomUUID } from 'node:crypto';
import { sha256Stable } from '../../core/StableSerialization.ts';

export type SourceBranchState = 'canonical' | 'research' | 'legacy' | 'provenance-only';
export type ArtifactReviewStatus = 'pending' | 'approved' | 'rejected';
export type ArtifactReviewKind = 'generated-code' | 'research-promotion' | 'generated-tool' | 'generated-skill' | 'configuration';

export interface LettaSourceBranchRecord {
  id: string;
  name: string;
  state: SourceBranchState;
  role: string;
  allowCanonicalImport: boolean;
  provenancePath?: string;
  notes: string;
}

export interface TelemetryPolicyState {
  enabled: boolean;
  localOnly: boolean;
  redactSensitive: boolean;
  exportAllowed: boolean;
  retentionDays: number;
  updatedAt: number;
}

export interface ArtifactReviewRecord {
  id: string;
  kind: ArtifactReviewKind;
  source: string;
  generatedBy: string;
  disclosure: string;
  humanReviewed: boolean;
  status: ArtifactReviewStatus;
  digest: string;
  createdAt: number;
  decidedAt?: number;
  decisionReason?: string;
}

export interface LettaGovernanceAdaptationState {
  version: 1;
  source: { name: 'letta-main'; mode: 'reference-governance-adapter'; integratedAt: string };
  sourceBranches: LettaSourceBranchRecord[];
  telemetry: TelemetryPolicyState;
  artifactReviews: ArtifactReviewRecord[];
  metrics: {
    sourceBoundaryChecks: number;
    deniedCanonicalImports: number;
    reviewsCreated: number;
    reviewsApproved: number;
    reviewsRejected: number;
  };
}

const digest = (value: unknown) => sha256Stable(value, 'legacy');
const clampDays = (value: number) => Math.max(0, Math.min(3650, Math.floor(Number.isFinite(value) ? value : 30)));

export function defaultLettaGovernanceAdaptationState(): LettaGovernanceAdaptationState {
  return {
    version: 1,
    source: { name: 'letta-main', mode: 'reference-governance-adapter', integratedAt: '2026-10-08' },
    sourceBranches: [
      { id: 'canonical-neuro-kurisu', name: 'Neuro-Kurisu 35.40', state: 'canonical', role: 'single writable organism owner', allowCanonicalImport: true, notes: 'Only writable organism runtime owner.' },
      { id: 'research', name: 'NeuroCore/NOMEGA/DeepCode', state: 'research', role: 'governed research candidate', allowCanonicalImport: false, notes: 'Promotion requires evidence gates and explicit release decision.' },
      { id: 'legacy', name: 'Historical Neuro-Kurisu/Kurisu branches', state: 'legacy', role: 'historical or compatibility source', allowCanonicalImport: false, notes: 'Immutable reference; not a live owner.' },
      { id: 'provenance', name: 'User-provided source archives', state: 'provenance-only', role: 'immutable source provenance', allowCanonicalImport: false, notes: 'Stored for reproducibility; never executable by default.' },
      { id: 'letta-reference', name: 'letta-main 2026-10-08', state: 'provenance-only', role: 'governance reference', allowCanonicalImport: false, provenancePath: 'legacy/input-archives/raw-source-archives/letta-main.zip', notes: 'Landing-page/reference repository; no current runtime implementation is imported.' },
    ],
    telemetry: { enabled: true, localOnly: true, redactSensitive: true, exportAllowed: false, retentionDays: 30, updatedAt: Date.now() },
    artifactReviews: [],
    metrics: { sourceBoundaryChecks: 0, deniedCanonicalImports: 0, reviewsCreated: 0, reviewsApproved: 0, reviewsRejected: 0 },
  };
}

export class LettaGovernanceAdaptationFabric {
  private state = defaultLettaGovernanceAdaptationState();

  restore(raw?: Partial<LettaGovernanceAdaptationState> | null): void {
    const defaults = defaultLettaGovernanceAdaptationState();
    const value = raw ?? {};
    this.state = {
      ...defaults,
      ...value,
      source: { ...defaults.source, ...(value.source ?? {}) },
      sourceBranches: Array.isArray(value.sourceBranches) ? value.sourceBranches.slice(-64) : defaults.sourceBranches,
      telemetry: {
        ...defaults.telemetry,
        ...(value.telemetry ?? {}),
        retentionDays: clampDays(Number((value.telemetry as any)?.retentionDays ?? defaults.telemetry.retentionDays)),
      },
      artifactReviews: Array.isArray(value.artifactReviews) ? value.artifactReviews.slice(-512) : [],
      metrics: { ...defaults.metrics, ...(value.metrics ?? {}) },
    };
  }

  snapshot(): LettaGovernanceAdaptationState { return structuredClone(this.state); }

  diagnostics() {
    return {
      source: this.state.source,
      canonicalOwner: this.state.sourceBranches.find((x) => x.state === 'canonical')?.name ?? 'unknown',
      sourceBranches: this.state.sourceBranches.map((x) => ({ ...x })),
      telemetry: { ...this.state.telemetry },
      reviews: {
        pending: this.state.artifactReviews.filter((x) => x.status === 'pending').length,
        approved: this.state.metrics.reviewsApproved,
        rejected: this.state.metrics.reviewsRejected,
      },
      metrics: { ...this.state.metrics },
    };
  }

  sourceBoundary(name: string, requestedState: SourceBranchState = 'canonical') {
    this.state.metrics.sourceBoundaryChecks += 1;
    const record = this.state.sourceBranches.find((x) => x.name.toLowerCase() === String(name).toLowerCase() || x.id === name);
    if (!record) return { allowed: false, reason: 'unknown-source-branch', record: null };
    if (requestedState === 'canonical' && !record.allowCanonicalImport) {
      this.state.metrics.deniedCanonicalImports += 1;
      return { allowed: false, reason: `source-state-${record.state}-cannot-enter-canonical`, record };
    }
    return { allowed: true, reason: 'source-boundary-ok', record };
  }

  setTelemetryPolicy(input: Partial<Omit<TelemetryPolicyState, 'updatedAt'>>): TelemetryPolicyState {
    this.state.telemetry = {
      ...this.state.telemetry,
      ...input,
      retentionDays: clampDays(Number(input.retentionDays ?? this.state.telemetry.retentionDays)),
      updatedAt: Date.now(),
    };
    return structuredClone(this.state.telemetry);
  }

  recordArtifactReview(input: Omit<ArtifactReviewRecord, 'id' | 'digest' | 'createdAt' | 'status'> & Partial<Pick<ArtifactReviewRecord, 'status'>>): ArtifactReviewRecord {
    const rowBase = { ...input, status: input.status ?? 'pending' };
    const row: ArtifactReviewRecord = { ...rowBase, id: randomUUID(), digest: digest(rowBase), createdAt: Date.now() };
    this.state.artifactReviews.push(row);
    this.state.artifactReviews = this.state.artifactReviews.slice(-512);
    this.state.metrics.reviewsCreated += 1;
    return structuredClone(row);
  }

  decideArtifactReview(id: string, decision: Exclude<ArtifactReviewStatus, 'pending'>, reason = '') {
    const row = this.state.artifactReviews.find((x) => x.id === id);
    if (!row) return { ok: false, error: 'artifact-review-not-found' };
    if (row.status !== 'pending') return { ok: false, error: 'artifact-review-already-decided', row };
    row.status = decision;
    row.decidedAt = Date.now();
    row.decisionReason = String(reason).slice(0, 1000);
    if (decision === 'approved') this.state.metrics.reviewsApproved += 1;
    else this.state.metrics.reviewsRejected += 1;
    return { ok: true, row: structuredClone(row) };
  }

  canPromoteGeneratedArtifact(reviewId: string) {
    const row = this.state.artifactReviews.find((x) => x.id === reviewId);
    if (!row) return { allowed: false, reason: 'review-not-found' };
    if (row.status !== 'approved') return { allowed: false, reason: 'human-review-required', status: row.status };
    if (!row.humanReviewed) return { allowed: false, reason: 'human-review-flag-required' };
    return { allowed: true, reason: 'review-approved', review: structuredClone(row) };
  }

  auditProvenancePaths(paths: string[]) {
    const unsafe = paths.filter((value) => /(^|[/\\])(?:\.env(?:\.[^/\\]+)?|.*(?:credentials|secret|private[_-]?key|token).*\.(?:json|pem|key))$/i.test(String(value)));
    return { ok: unsafe.length === 0, unsafePaths: unsafe.slice(0, 32), checked: paths.length, rule: 'credential-bearing files excluded from provenance archives' };
  }
}
