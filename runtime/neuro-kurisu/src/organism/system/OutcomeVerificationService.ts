export type OutcomeVerificationBasis = 'none' | 'tool-contract' | 'external-postcondition';

import type { WorldContext } from '../core/types.ts';
import { normalizeWorldContext as normalizeCanonicalWorldContext } from '../core/WorldContextNormalizer.ts';
import { stableJson } from '../core/StableSerialization.ts';

export interface OutcomeVerification {
  verified: boolean;
  basis: OutcomeVerificationBasis;
  confidence01: number;
  externalObservation?: boolean;
  observationId?: string;
  expectedPostcondition?: string;
  observedPostcondition?: string;
  notes?: string;
  observedWorldContextAfter?: WorldContext;
}

export type ExternalPostconditionAssessment = 'not-external' | 'match' | 'contradiction' | 'unknown';

function canonicalPostcondition(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return normalized && normalized.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(normalized) ? normalized : undefined;
}

/**
 * Compare a trustworthy external observation to the intended postcondition.
 * A valid observation is not synonymous with a successful action: a contradiction
 * is evidence about the outcome, but must never be surfaced as verified success.
 */
export function assessExternalPostcondition(value: Partial<OutcomeVerification> | undefined): ExternalPostconditionAssessment {
  if (value?.basis !== 'external-postcondition' || value.externalObservation !== true) return 'not-external';
  const observationId = typeof value.observationId === 'string' ? value.observationId.trim() : '';
  if (!observationId || observationId.length > 180 || /[\u0000-\u001f\u007f]/.test(observationId)) return 'unknown';
  const expected = canonicalPostcondition(value.expectedPostcondition);
  const observed = canonicalPostcondition(value.observedPostcondition);
  if (!expected || !observed) return 'unknown';
  if (expected !== observed) return 'contradiction';
  return value.verified === true ? 'match' : 'unknown';
}

export interface OutcomeVerificationContext {
  toolId: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  /** Host-owned identifiers copied from the ActionGateway execution ticket. */
  executionId?: string;
  decisionId?: string;
}

export interface ExpectedDecisionOutcomeBinding {
  toolId: string;
  input: Record<string, unknown>;
  executionId: string;
  decisionId: string;
}

export type OutcomeVerifier = (context: OutcomeVerificationContext) => Promise<OutcomeVerification> | OutcomeVerification;

const VALID_BASES = new Set<OutcomeVerificationBasis>(['none', 'tool-contract', 'external-postcondition']);
const trustedExternalPostconditionResults = new WeakMap<object, OutcomeVerificationContext>();

/** Only an exact, frozen verifier result bound to the same evidence tuple can authorize learning. */
export function isTrustedExternalPostconditionVerification(value: unknown, expectedInput?: Record<string, unknown>): value is OutcomeVerification {
  if (!value || typeof value !== 'object') return false;
  const context = trustedExternalPostconditionResults.get(value as object);
  if (!context || assessExternalPostcondition(value as OutcomeVerification) !== 'match') return false;
  if (expectedInput) {
    // Bind to the complete action input, not a caller-selected subset. A partial
    // match could otherwise reuse valid evidence for a different operation.
    try {
      if (stableJson(context.input) !== stableJson(expectedInput)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Require an external postcondition receipt to belong to the exact gateway
 * execution and decision. A caller-supplied {executionId, decisionId} or a
 * persisted copy is insufficient: value must still be the exact object minted
 * by this OutcomeVerificationService in the current process.
 */
export function isTrustedDecisionLinkedExternalPostcondition(
  value: unknown,
  expected: ExpectedDecisionOutcomeBinding,
): value is OutcomeVerification {
  if (!value || typeof value !== 'object' || !expected ||
      typeof expected.toolId !== 'string' || !expected.toolId.trim() ||
      typeof expected.executionId !== 'string' || !/^exec-[a-z0-9-]{8,80}$/i.test(expected.executionId) ||
      typeof expected.decisionId !== 'string' || !expected.decisionId.trim() ||
      expected.decisionId.length > 180) return false;
  const context = trustedExternalPostconditionResults.get(value as object);
  if (!context || assessExternalPostcondition(value as OutcomeVerification) !== 'match') return false;
  if (context.toolId !== expected.toolId ||
      context.executionId !== expected.executionId ||
      context.decisionId !== expected.decisionId) return false;
  try {
    return stableJson(context.input) === stableJson(expected.input);
  } catch {
    return false;
  }
}
const clamp = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
const boundedText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, max) : undefined;
};

/** Correlation IDs are rejected when malformed; truncation would let distinct tickets alias. */
const boundedCorrelationId = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFKC');
  // Validate before trim: trim() would erase leading/trailing TAB, CR and LF,
  // allowing malformed external correlation IDs to alias valid identifiers.
  if (/[\\u0000-\\u001f\\u007f-\\u009f]/.test(normalized)) return undefined;
  const trimmed = normalized.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
};

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const object = value as unknown as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    let child: unknown;
    try { child = (object as Record<PropertyKey, unknown>)[key]; } catch { continue; }
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function isolatedContext(context: OutcomeVerificationContext): OutcomeVerificationContext {
  const executionId = boundedCorrelationId(context?.executionId, 100);
  const decisionId = boundedCorrelationId(context?.decisionId, 180);
  const cloned = structuredClone({
    toolId: boundedText(context?.toolId, 180) ?? 'unknown-tool',
    input: context?.input ?? {},
    result: context?.result ?? {},
    ...(executionId ? { executionId } : {}),
    ...(decisionId ? { decisionId } : {}),
  });
  if (!cloned || typeof cloned !== 'object' || !cloned.input || typeof cloned.input !== 'object' ||
      !cloned.result || typeof cloned.result !== 'object') {
    throw new TypeError('verification context is not a serializable record');
  }
  return deepFreeze(cloned) as OutcomeVerificationContext;
}

function failed(notes: string): OutcomeVerification {
  return { verified: false, basis: 'none', confidence01: 0, externalObservation: false, notes };
}

function normalizeWorldContext(value: unknown): WorldContext | undefined {
  if (value === undefined) return undefined;
  try {
    const clone = structuredClone(value);
    if (clone && typeof clone === 'object' && !Array.isArray(clone)) {
      return normalizeCanonicalWorldContext(clone as Partial<WorldContext>);
    }
  } catch {
    // Supplementary context must never turn valid independent evidence into success.
  }
  return undefined;
}

export class OutcomeVerificationService {
  async verify(
    context: OutcomeVerificationContext,
    verifier?: OutcomeVerifier,
  ): Promise<OutcomeVerification> {
    if (verifier) {
      let isolated: OutcomeVerificationContext;
      try {
        isolated = isolatedContext(context);
      } catch {
        return failed('verification context could not be isolated safely');
      }

      let checked: OutcomeVerification;
      try {
        checked = await verifier(isolated);
      } catch {
        return failed('registered verifier failed before returning evidence');
      }
      if (!checked || typeof checked !== 'object') {
        return failed('registered verifier returned no structured evidence');
      }

      const basis: OutcomeVerificationBasis = VALID_BASES.has(checked.basis) ? checked.basis : 'none';
      // Only the explicit external-postcondition basis may cross the external-evidence
      // boundary. A tool must not self-promote its own contract/ACK into world evidence
      // by setting `externalObservation: true` alongside `basis: 'tool-contract'`.
      if (checked.externalObservation === true && basis !== 'external-postcondition') {
        return failed('external observation requires external-postcondition basis');
      }
      const external = basis === 'external-postcondition';
      const observationIdRaw = boundedText(checked.observationId, 180);
      const observationId = observationIdRaw && !/[\u0000-\u001f\u007f]/.test(observationIdRaw) ? observationIdRaw : undefined;
      let verified = checked.verified === true && basis !== 'none';
      let notes = boundedText(checked.notes, 320);
      if (verified && external && !observationId) {
        verified = false;
        notes = 'external verification requires a valid observationId';
      }
      if (checked.verified === true && basis === 'none') {
        notes = 'verification basis is missing or unsupported';
      }
      const expectedPostcondition = boundedText(checked.expectedPostcondition, 1024);
      const observedPostcondition = boundedText(checked.observedPostcondition, 1024);
      const externalEvidenceShapeValid = external && Boolean(observationId) &&
        Boolean(expectedPostcondition) && Boolean(observedPostcondition) &&
        !/[\u0000-\u001f\u007f]/.test(expectedPostcondition ?? '') &&
        !/[\u0000-\u001f\u007f]/.test(observedPostcondition ?? '');
      if (verified && external && !externalEvidenceShapeValid) {
        verified = false;
        notes = 'external verification requires a bounded observationId and explicit expected/observed postconditions';
      }
      const normalizedExpected = canonicalPostcondition(expectedPostcondition);
      const normalizedObserved = canonicalPostcondition(observedPostcondition);
      const externallyContradicted = verified && externalEvidenceShapeValid && Boolean(normalizedExpected && normalizedObserved && normalizedExpected !== normalizedObserved);
      if (externallyContradicted) {
        verified = false;
        notes = 'external postcondition contradicts expected state';
      }
      const preserveExternalEvidence = external && externalEvidenceShapeValid && checked.verified === true;
      const normalized: OutcomeVerification = {
        verified,
        // Preserve valid contradictory external evidence for diagnostics, but it cannot authorize success.
        basis: verified || preserveExternalEvidence ? basis : 'none',
        confidence01: verified || preserveExternalEvidence ? clamp(checked.confidence01) : 0,
        externalObservation: (verified || preserveExternalEvidence) && external,
        ...((verified || preserveExternalEvidence) && observationId ? { observationId } : {}),
        ...((verified || preserveExternalEvidence) && expectedPostcondition ? { expectedPostcondition } : {}),
        ...((verified || preserveExternalEvidence) && observedPostcondition ? { observedPostcondition } : {}),
        ...(notes ? { notes } : {}),
        ...(verified ? { observedWorldContextAfter: normalizeWorldContext(checked.observedWorldContextAfter) } : {}),
      };
      if (verified && external && assessExternalPostcondition(normalized) === 'match') {
        Object.freeze(normalized);
        trustedExternalPostconditionResults.set(normalized, isolated);
      }
      return normalized;
    }

    if (context?.result?.verified === true) {
      return {
        verified: true,
        basis: 'tool-contract',
        confidence01: 0.6,
        externalObservation: false,
        notes: 'tool explicitly declared its own contract-level verification',
      };
    }

    return {
      verified: false,
      basis: 'none',
      confidence01: 0,
      externalObservation: false,
      notes: 'no independent postcondition verifier was registered',
    };
  }
}
