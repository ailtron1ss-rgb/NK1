import { createHash } from 'node:crypto';
import type { VerifiedSessionDataset, VerifiedSessionTrainingExample } from './VerifiedSessionDataset.ts';

export interface NeuroPlasticTrainingConsent {
  trainingOptIn: true;
  privacyReviewed: true;
  licenseApproved: true;
  piiScreening: 'passed';
  attestedBy: string;
  attestedAt: number;
  licenseId: string;
  provenanceDigest: string;
}

export interface NeuroPlasticResolvedEvidence {
  domain: string;
  prompt: string;
  completion: string;
  outcome: 'verified-success' | 'verified-correction';
  correctionVerifiedBy?: string;
  consent: NeuroPlasticTrainingConsent;
}

export interface NeuroPlasticTrainingExample {
  exampleId: string;
  domain: string;
  prompt: string;
  completion: string;
}

export interface NeuroPlasticTrainingCorpus {
  schemaVersion: 1;
  domain: string;
  sourceDatasetFingerprint: string;
  holdoutPlanFingerprint: string;
  corpusFingerprint: string;
  training: NeuroPlasticTrainingExample[];
  validation: NeuroPlasticTrainingExample[];
  evidenceCount: number;
}

export type NeuroPlasticEvidenceResolver = (
  row: VerifiedSessionTrainingExample,
) => NeuroPlasticResolvedEvidence | null;

const HASH = /^[a-f0-9]{64}$/i;
const DOMAIN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const SECRET = /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/-]{16,})\b/i;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

function safeText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max ||
      value.trim() !== value || value.normalize('NFKC') !== value || CONTROL.test(value)) {
    throw new Error('neuro-plastic-invalid-' + label);
  }
  return value;
}
function safeHash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error('neuro-plastic-invalid-' + label);
  return value.toLowerCase();
}
function containsSensitiveContent(value: string): boolean {
  return EMAIL.test(value) || SECRET.test(value);
}
function validateConsent(value: unknown): NeuroPlasticTrainingConsent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('neuro-plastic-training-consent-required');
  const consent = value as Record<string, unknown>;
  if (consent.trainingOptIn !== true || consent.privacyReviewed !== true ||
      consent.licenseApproved !== true || consent.piiScreening !== 'passed') {
    throw new Error('neuro-plastic-training-consent-or-governance-required');
  }
  const attestedBy = safeText(consent.attestedBy, 'consent-attestor', 160);
  const licenseId = safeText(consent.licenseId, 'license-id', 240);
  const provenanceDigest = safeHash(consent.provenanceDigest, 'provenance-digest');
  if (typeof consent.attestedAt !== 'number' || !Number.isSafeInteger(consent.attestedAt) || consent.attestedAt <= 0) {
    throw new Error('neuro-plastic-consent-attestation-time-invalid');
  }
  return {
    trainingOptIn: true,
    privacyReviewed: true,
    licenseApproved: true,
    piiScreening: 'passed',
    attestedBy,
    attestedAt: consent.attestedAt,
    licenseId,
    provenanceDigest,
  };
}

function canonicalExample(value: NeuroPlasticTrainingExample): Record<string, string> {
  // Stable alphabetic property order is shared with the Python trainer's corpus hash.
  return {
    completion: value.completion,
    domain: value.domain,
    exampleId: value.exampleId,
    prompt: value.prompt,
  };
}

function serializeRows(rows: NeuroPlasticTrainingExample[]): string {
  if (!rows.length) return '';
  return rows.map(row => JSON.stringify(canonicalExample(row))).join('\n') + '\n';
}

function materialize(
  rows: VerifiedSessionTrainingExample[],
  resolver: NeuroPlasticEvidenceResolver,
  domain: string,
  split: 'train' | 'validation',
): NeuroPlasticTrainingExample[] {
  const result: NeuroPlasticTrainingExample[] = [];
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row || row.split !== split) continue;
    const resolved = resolver(row);
    if (resolved === null) continue;
    if (!resolved || typeof resolved !== 'object') throw new Error('neuro-plastic-resolved-evidence-invalid');
    const rowDomain = safeText(resolved.domain, 'evidence-domain', 64).toLowerCase();
    if (!DOMAIN.test(rowDomain)) throw new Error('neuro-plastic-domain-invalid');
    if (rowDomain !== domain) continue;
    const consent = validateConsent(resolved.consent);
    if (consent.provenanceDigest !== safeHash(row.evidenceRefDigest, 'evidence-reference-digest')) {
      throw new Error('neuro-plastic-consent-provenance-evidence-mismatch');
    }
    const prompt = safeText(resolved.prompt, 'prompt', 12_000);
    const completion = safeText(resolved.completion, 'completion', 12_000);
    if (prompt.length + completion.length > 20_000) throw new Error('neuro-plastic-example-too-large');
    if (containsSensitiveContent(prompt) || containsSensitiveContent(completion)) {
      throw new Error('neuro-plastic-potential-pii-or-secret-rejected');
    }
    if (row.passed && resolved.outcome !== 'verified-success') {
      throw new Error('neuro-plastic-outcome-authority-mismatch');
    }
    if (!row.passed && (resolved.outcome !== 'verified-correction' ||
        row.authority !== 'human-review' ||
        !resolved.correctionVerifiedBy ||
        resolved.correctionVerifiedBy !== row.verifierId)) {
      throw new Error('neuro-plastic-unverified-correction-rejected');
    }
    // The resolver's consent is validated above. The corpus intentionally contains no
    // transcript, raw evidence reference, user identity or attestation payload.
    void consent;
    const exampleId = safeText(row.exampleId, 'example-id', 128);
    if (ids.has(exampleId)) throw new Error('neuro-plastic-duplicate-example-id');
    ids.add(exampleId);
    result.push({ exampleId, domain, prompt, completion });
  }
  return result.sort((a, b) => a.exampleId.localeCompare(b.exampleId));
}

export function buildVerifiedNeuroPlasticCorpus(
  rawDataset: VerifiedSessionDataset,
  resolver: NeuroPlasticEvidenceResolver,
  requestedDomain: string,
): NeuroPlasticTrainingCorpus {
  if (!rawDataset || rawDataset.schemaVersion !== 1 || typeof resolver !== 'function') {
    throw new Error('neuro-plastic-verified-dataset-required');
  }
  const domain = safeText(requestedDomain, 'requested-domain', 64).toLowerCase();
  if (!DOMAIN.test(domain)) throw new Error('neuro-plastic-domain-invalid');
  const sourceDatasetFingerprint = safeHash(rawDataset.datasetFingerprint, 'source-dataset-fingerprint');
  const holdoutPlanFingerprint = safeHash(rawDataset.manifestFingerprint, 'holdout-plan-fingerprint');
  if (!Array.isArray(rawDataset.training) || !Array.isArray(rawDataset.validation) ||
      !Array.isArray(rawDataset.holdoutAggregates)) {
    throw new Error('neuro-plastic-verified-split-data-required');
  }
  const training = materialize(rawDataset.training, resolver, domain, 'train');
  const validation = materialize(rawDataset.validation, resolver, domain, 'validation');
  const trainingExampleIds = new Set(training.map(row => row.exampleId));
  if (validation.some(row => trainingExampleIds.has(row.exampleId))) {
    throw new Error('neuro-plastic-train-validation-example-overlap');
  }
  if (training.length < 5 || validation.length < 2) {
    throw new Error('neuro-plastic-minimum-training-validation-examples-not-met');
  }
  const trainingTaskIds = new Set(rawDataset.training
    .filter(row => row && row.split === 'train')
    .map(row => row.taskId));
  if (rawDataset.validation.some(row => row && trainingTaskIds.has(row.taskId))) {
    throw new Error('neuro-plastic-train-validation-task-overlap');
  }
  const trainingPromptFingerprints = new Set(rawDataset.training
    .filter(row => row && row.split === 'train')
    .map(row => row.promptFingerprint));
  if (rawDataset.validation.some(row => row && trainingPromptFingerprints.has(row.promptFingerprint))) {
    throw new Error('neuro-plastic-train-validation-prompt-fingerprint-overlap');
  }
  if (new Set(rawDataset.training.filter(row => row?.split === 'train').map(row => row.seed)).size < 3 ||
      new Set(rawDataset.validation.filter(row => row?.split === 'validation').map(row => row.seed)).size < 2) {
    throw new Error('neuro-plastic-independent-train-validation-seeds-required');
  }
  const trainingJsonl = serializeRows(training);
  const validationJsonl = serializeRows(validation);
  const corpusFingerprint = createHash('sha256')
    .update(trainingJsonl + '\n--validation--\n' + validationJsonl)
    .digest('hex');
  return {
    schemaVersion: 1,
    domain,
    sourceDatasetFingerprint,
    holdoutPlanFingerprint,
    corpusFingerprint,
    training,
    validation,
    evidenceCount: training.length + validation.length,
  };
}

export function toNeuroPlasticJsonl(
  corpus: NeuroPlasticTrainingCorpus,
  split: 'train' | 'validation',
): string {
  const rows = split === 'train' ? corpus?.training : corpus?.validation;
  if (!corpus || corpus.schemaVersion !== 1 || !Array.isArray(rows)) {
    throw new Error('neuro-plastic-corpus-split-invalid');
  }
  return serializeRows(rows);
}
