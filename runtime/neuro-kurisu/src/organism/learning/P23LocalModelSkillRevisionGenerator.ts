import { snapshotPlainData } from './LearningTrustBoundary.ts';
import type { LocalChatCompletionRequest, LocalChatCompletionResponse } from '../integration/local/OpenAICompatibleLocalChatProvider.ts';

export interface ReflectiveRevisionRequest {
  /** SHA-256 of the exact verified train/validation/aggregate-only holdout dataset. */
  datasetFingerprint: string;
  sourcePayload: unknown;
  optimizerInstruction: string;
  validationEvidence: unknown[];
  targets: Array<{ dimension: string; priority01: number; affectedTaskIds: string[]; evidenceCount: number; evidenceIds: string[]; directive: string }>;
  /** Policy assertion only; numeric or directional holdout feedback is forbidden here. */
  holdoutPolicy: { resultsWithheld: true; requiresFreshIndependentEvaluation: true };
}

export interface SkillRevisionChatProvider {
  configured(): boolean;
  generate(request: LocalChatCompletionRequest): Promise<LocalChatCompletionResponse>;
}

const MAX_SOURCE_JSON_CHARS = 48_000;
const MAX_VALIDATION_JSON_CHARS = 32_000;
const MAX_GENERATED_CHARS = 64_000;

/** Read a host-owned method capability without invoking an accessor getter. */
function bindProviderMethod(target: unknown, key: 'configured'|'generate'): (...args:any[])=>any {
  if(target===null||(typeof target!=='object'&&typeof target!=='function')) {
    throw new Error('p23-revision-local-provider-capability-invalid');
  }
  let cursor: object|null=target as object;
  const seen=new Set<object>();
  try {
    for(let depth=0;cursor&&depth<32;depth++) {
      if(seen.has(cursor))break;
      seen.add(cursor);
      const descriptor=Object.getOwnPropertyDescriptor(cursor,key);
      if(descriptor) {
        if(!('value' in descriptor)||typeof descriptor.value!=='function') {
          throw new Error('p23-revision-local-provider-capability-invalid');
        }
        return descriptor.value.bind(target);
      }
      cursor=Object.getPrototypeOf(cursor) as object|null;
    }
  } catch(error) {
    if(error instanceof Error&&error.message==='p23-revision-local-provider-capability-invalid')throw error;
    throw new Error('p23-revision-local-provider-capability-invalid');
  }
  throw new Error('p23-revision-local-provider-capability-invalid');
}

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

/**
 * Real local-model revision generator for the P23 reflective lifecycle.
 * It creates a candidate payload only; evaluation, proposal authenticity,
 * evidence binding, shadow runs and promotion remain separate trusted gates.
 */
export async function generateLocalSkillRevision(
  provider: SkillRevisionChatProvider,
  rawRequest: ReflectiveRevisionRequest,
): Promise<unknown> {
  if(!provider)throw new Error('p23-revision-local-model-not-configured');
  const configured=bindProviderMethod(provider,'configured');
  const generate=bindProviderMethod(provider,'generate');
  if (!configured()) throw new Error('p23-revision-local-model-not-configured');
  let request: ReflectiveRevisionRequest;
  try {
    request=snapshotPlainData(rawRequest) as ReflectiveRevisionRequest;
  } catch {
    throw new Error('p23-revision-request-data-boundary-rejected');
  }
  if (!request || typeof request!=='object' || Array.isArray(request)) {
    throw new Error('p23-revision-request-data-boundary-rejected');
  }
  if (!Array.isArray(request.targets) || request.targets.length === 0) {
    throw new Error('p23-revision-evidence-backed-targets-required');
  }
  if (typeof request.datasetFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(request.datasetFingerprint)) {
    throw new Error('p23-revision-verified-dataset-fingerprint-required');
  }
  const sourcePayload = boundedJson(request.sourcePayload, MAX_SOURCE_JSON_CHARS, 'source-payload');
  const validationEvidence = boundedJson(request.validationEvidence, MAX_VALIDATION_JSON_CHARS, 'validation-evidence');
  const targetJson = boundedJson(request.targets, 12_000, 'targets');
  if (request.holdoutPolicy?.resultsWithheld !== true ||
      request.holdoutPolicy?.requiresFreshIndependentEvaluation !== true) {
    throw new Error('p23-revision-holdout-results-must-remain-withheld');
  }
  const rawResponse = await generate({
    system: [
      'You are a constrained skill-revision generator inside a verified learning pipeline.',
      'Return ONLY one valid JSON value representing the revised skill payload; no markdown, prose, or claims of test success.',
      'Preserve the source payload schema and unrelated fields. Make the smallest change supported by the provided validation evidence and targets.',
      'Never invent evidence, tests, capabilities, or outcomes. Never weaken safety constraints.',
      'All holdout results, including aggregate scores and regression direction, are withheld from optimization. Do not request or infer them.',
      'This output is an untrusted candidate and will undergo independent evaluation before it can be activated.',
      'Bind all generated revision work to the supplied verified dataset fingerprint; never claim this fingerprint proves candidate quality.',
    ].join(' '),
    user: [
      'VERIFIED_DATASET_FINGERPRINT:', request.datasetFingerprint.toLowerCase(),
      'SOURCE_PAYLOAD_JSON:', sourcePayload,
      'REVISION_INSTRUCTION:', String(request.optimizerInstruction ?? '').slice(0, 24_000),
      'VALIDATION_EVIDENCE_JSON:', validationEvidence,
      'EVIDENCE_BACKED_TARGETS_JSON:', targetJson,
      'HOLDOUT_RESULTS_WITHHELD:', JSON.stringify({
        resultsWithheld: true,
        requiresFreshIndependentEvaluation: true,
      }),
      'Return the revised payload as JSON only.',
    ].join('\n\n'),
    maxTokens: 4096,
    temperature: 0.2,
  });
  let response: LocalChatCompletionResponse;
  try {
    response=snapshotPlainData(rawResponse) as LocalChatCompletionResponse;
  } catch {
    throw new Error('p23-revision-generator-response-data-boundary-rejected');
  }
  if(!response||typeof response!=='object'||typeof response.text!=='string') {
    throw new Error('p23-revision-generator-response-data-boundary-rejected');
  }
  return parseGeneratedPayload(response.text);
}
