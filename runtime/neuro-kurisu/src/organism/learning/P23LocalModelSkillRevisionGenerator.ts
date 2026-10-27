import type { LocalChatCompletionRequest, LocalChatCompletionResponse } from '../integration/local/OpenAICompatibleLocalChatProvider.ts';

export interface ReflectiveRevisionRequest {
  /** SHA-256 of the exact verified train/validation/aggregate-only holdout dataset. */
  datasetFingerprint: string;
  sourcePayload: unknown;
  optimizerInstruction: string;
  validationEvidence: unknown[];
  targets: Array<{ dimension: string; priority01: number; affectedTaskIds: string[]; evidenceCount: number; evidenceIds: string[]; directive: string }>;
  holdoutGeneralization: { gap01: number; requiresFreshIndependentEvaluation: true };
}

export interface SkillRevisionChatProvider {
  configured(): boolean;
  generate(request: LocalChatCompletionRequest): Promise<LocalChatCompletionResponse>;
}

const MAX_SOURCE_JSON_CHARS = 48_000;
const MAX_VALIDATION_JSON_CHARS = 32_000;
const MAX_GENERATED_CHARS = 64_000;

function boundedJson(value: unknown, maxChars: number, label: string): string {
  let encoded: string;
  try { encoded = JSON.stringify(value); } catch { throw new Error(`p23-revision-${label}-not-serializable`); }
  if (typeof encoded !== 'string' || encoded.length > maxChars) throw new Error(`p23-revision-${label}-too-large`);
  return encoded;
}

function parseGeneratedPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_GENERATED_CHARS) throw new Error('p23-revision-generator-output-invalid-size');
  const unfenced = trimmed.replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(unfenced); } catch { throw new Error('p23-revision-generator-must-return-valid-json'); }
  if (parsed === null || (typeof parsed !== 'object' && typeof parsed !== 'string')) {
    throw new Error('p23-revision-generator-payload-must-be-object-or-string');
  }
  return parsed;
}

function assertSourceSchemaPreserved(source: unknown, candidate: unknown): unknown {
  const sourceIsArray = Array.isArray(source);
  const candidateIsArray = Array.isArray(candidate);
  if (source === null || candidate === null ||
      typeof source !== typeof candidate ||
      sourceIsArray !== candidateIsArray) {
    throw new Error('p23-revision-generator-schema-mismatch');
  }
  if (typeof source === 'object' && !sourceIsArray) {
    if (typeof candidate !== 'object' || candidateIsArray) {
      throw new Error('p23-revision-generator-schema-mismatch');
    }
    const sourceKeys = Object.keys(source as Record<string, unknown>);
    const candidateRecord = candidate as Record<string, unknown>;
    const missingKeys = sourceKeys.filter(key => !Object.hasOwn(candidateRecord, key));
    if (missingKeys.length > 0) {
      throw new Error('p23-revision-generator-dropped-source-field');
    }
  }
  return candidate;
}

/**
 * Real local-model revision generator for the P23 reflective lifecycle.
 * It creates a candidate payload only; evaluation, proposal authenticity,
 * evidence binding, shadow runs and promotion remain separate trusted gates.
 */
export async function generateLocalSkillRevision(
  provider: SkillRevisionChatProvider,
  request: ReflectiveRevisionRequest,
): Promise<unknown> {
  if (!provider || !provider.configured()) throw new Error('p23-revision-local-model-not-configured');
  if (!request || !Array.isArray(request.targets) || request.targets.length === 0) {
    throw new Error('p23-revision-evidence-backed-targets-required');
  }
  if (typeof request.datasetFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(request.datasetFingerprint)) {
    throw new Error('p23-revision-verified-dataset-fingerprint-required');
  }
  const sourcePayload = boundedJson(request.sourcePayload, MAX_SOURCE_JSON_CHARS, 'source-payload');
  const validationEvidence = boundedJson(request.validationEvidence, MAX_VALIDATION_JSON_CHARS, 'validation-evidence');
  const targetJson = boundedJson(request.targets, 12_000, 'targets');
  const gap = Number(request.holdoutGeneralization?.gap01);
  if (!Number.isFinite(gap) || gap < -1 || gap > 1) throw new Error('p23-revision-holdout-signal-invalid');
  const response = await provider.generate({
    system: [
      'You are a constrained skill-revision generator inside a verified learning pipeline.',
      'Return ONLY one valid JSON value representing the revised skill payload; no markdown, prose, or claims of test success.',
      'Preserve the source payload schema and unrelated fields. Make the smallest change supported by the provided validation evidence and targets.',
      'Never invent evidence, tests, capabilities, or outcomes. Never weaken safety constraints.',
      'Holdout examples, identifiers, and per-case outcomes are intentionally withheld. Do not request or infer them.',
      'This output is an untrusted candidate and will undergo independent evaluation before it can be activated.',
      'Bind all generated revision work to the supplied verified dataset fingerprint; never claim this fingerprint proves candidate quality.',
    ].join(' '),
    user: [
      'VERIFIED_DATASET_FINGERPRINT:', request.datasetFingerprint.toLowerCase(),
      'SOURCE_PAYLOAD_JSON:', sourcePayload,
      'REVISION_INSTRUCTION:', String(request.optimizerInstruction ?? '').slice(0, 24_000),
      'VALIDATION_EVIDENCE_JSON:', validationEvidence,
      'EVIDENCE_BACKED_TARGETS_JSON:', targetJson,
      'AGGREGATE_HOLDOUT_SIGNAL_JSON:', JSON.stringify({
        gap01: Number(gap.toFixed(6)),
        requiresFreshIndependentEvaluation: true,
      }),
      'Return the revised payload as JSON only.',
    ].join('\n\n'),
    maxTokens: 4096,
    temperature: 0.2,
  });
  return assertSourceSchemaPreserved(request.sourcePayload, parseGeneratedPayload(response.text));
}
