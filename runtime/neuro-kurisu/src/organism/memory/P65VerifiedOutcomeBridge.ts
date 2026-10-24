import {
  isTrustedDecisionLinkedExternalPostcondition,
  type ExpectedDecisionOutcomeBinding,
  type OutcomeVerification,
} from '../system/OutcomeVerificationService.ts';
import type { P65EpistemicLedger } from './P65EpistemicLedger.ts';

export interface P65VerifiedOutcomeBridgeInput {
  claimId: string;
  verification: OutcomeVerification;
  expected: ExpectedDecisionOutcomeBinding;
  at: number;
}

export interface P65VerifiedOutcomeBridgeResult {
  accepted: boolean;
  reason: string;
  confidence01: number | null;
  independentSource: boolean;
}

/**
 * Apply an externally verified action outcome to a belief only while the exact
 * verifier-minted receipt remains present in this process. Copied/restored JSON,
 * a self-reported success, or a merely well-formed evidenceEventId is insufficient.
 * The belief text must match the verified postcondition; caller-supplied strength,
 * source and independence are not trusted.
 */
export function applyTrustedOutcomeToP65(
  ledger: P65EpistemicLedger,
  input: P65VerifiedOutcomeBridgeInput,
): P65VerifiedOutcomeBridgeResult {
  const reject = (reason: string): P65VerifiedOutcomeBridgeResult =>
    ({ accepted: false, reason, confidence01: null, independentSource: false });
  if (!input || !ledger || !input.expected || !input.verification ||
      !Number.isFinite(input.at) || input.at < 0) return reject('bridge-input-invalid');
  const verification = input.verification;
  if (!isTrustedDecisionLinkedExternalPostcondition(verification, input.expected)) {
    return reject('untrusted-decision-linked-postcondition');
  }
  const evidenceId = verification.evidenceEventId;
  if (typeof evidenceId !== 'string' || !/^outcome:[a-f0-9]{40}$/.test(evidenceId)) {
    return reject('verified-evidence-identity-missing');
  }
  const claim = ledger.snapshot().claimsData.find(row => row.id === input.claimId && row.kind === 'belief');
  if (!claim) return reject('belief-not-found');
  const canonical = (value: string) => value.normalize('NFKC').trim().replace(/\\s+/g, ' ').toLocaleLowerCase();
  if (!verification.expectedPostcondition || canonical(claim.content) !== canonical(verification.expectedPostcondition)) {
    return reject('belief-postcondition-mismatch');
  }
  const source = input.expected.toolId;
  return ledger.reviseBeliefFromEvidence({
    claimId: input.claimId,
    evidenceId,
    source,
    independenceKey: `tool:${source.normalize('NFKC').trim().toLocaleLowerCase()}`,
    stance: 'supports',
    strength01: verification.confidence01,
    at: input.at,
  });
}
