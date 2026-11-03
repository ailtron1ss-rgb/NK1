/**
 * Security red-team harness for the trust and danger boundaries.
 *
 * This is the executable evidence behind docs/evidence/security-redteam.json. It drives
 * the real OutcomeVerificationService, temporal-credit authority, self-modification guard,
 * danger model and candidate pool through the attacks the threat model (T1-T12) names:
 * spoofed independent verification, copied/replayed proof tokens, late proof, forward
 * credit leakage, and a candidate weakening its own gate.
 *
 * Every case is a real code path. There are no mocks, and the harness exits non-zero if
 * any attack is admitted, so it cannot pass by observing nothing.
 */
import assert from 'node:assert/strict';
import { OutcomeVerificationService, isTrustedExternalPostconditionVerification, isTrustedDecisionLinkedExternalPostcondition } from '../src/organism/system/OutcomeVerificationService.ts';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';
import { buildSourceGraph } from '../src/organism/analysis/SourceGraph.ts';
import { evaluateModification } from '../src/organism/analysis/SelfModificationGuard.ts';
import { assessDanger, isWithinDangerEnvelope } from '../src/organism/analysis/DangerModel.ts';
import { SelfImprovementCandidatePool } from '../src/organism/analysis/SelfImprovementCandidatePool.ts';

let cases = 0;
const blocked = [];
const refused = (label, condition) => {
  cases += 1;
  assert.equal(condition, true, `attack must be refused: ${label}`);
  blocked.push(label);
};

// ---------------------------------------------------------------------------
// A. Outcome verification: spoofed / incomplete / forged external evidence (T11, T3).
// ---------------------------------------------------------------------------
const service = new OutcomeVerificationService();
const baseContext = {
  toolId: 'external.write',
  input: { operation: 'write', target: 'row-1' },
  result: { ok: true, rows: 1 },
  executionId: 'exec-aaaaaaaa-1111',
  decisionId: 'decision-1',
};
const externalReceipt = (overrides = {}) => ({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  confidence01: 0.9,
  observationId: 'obs-1',
  expectedPostcondition: 'row 1 present',
  observedPostcondition: 'row 1 present',
  ...overrides,
});

// A1. A tool-contract ACK must not self-promote into world evidence.
const spoofedBasis = await service.verify(baseContext, () => externalReceipt({ basis: 'tool-contract' }));
refused('tool-contract-cannot-claim-external-observation', spoofedBasis.verified !== true);

// A2. No registered verifier means no independent postcondition; a bare result is not proof.
const noVerifier = await service.verify(baseContext);
refused('no-verifier-is-not-verified', noVerifier.verified !== true);

// A3. External basis without an observation id is not a verifiable receipt.
const noObservationId = await service.verify(baseContext, () => externalReceipt({ observationId: '' }));
refused('external-without-observation-id', noObservationId.verified !== true);

// A4. External basis without expected/observed postconditions is not a verifiable receipt.
const noPostconditions = await service.verify(baseContext, () => externalReceipt({ expectedPostcondition: '', observedPostcondition: '' }));
refused('external-without-postconditions', noPostconditions.verified !== true);

// A5. An external observation that contradicts the expected state is not verification.
const contradiction = await service.verify(baseContext, () => externalReceipt({ observedPostcondition: 'row 1 absent' }));
refused('external-contradiction-rejected', contradiction.verified !== true);

// A6. A verifier that mutates the isolated context must fail closed.
const mutation = await service.verify(baseContext, (context) => { context.input.target = 'row-999'; return externalReceipt(); });
refused('verifier-mutation-fails-closed', mutation.verified !== true);

// A7. A real external receipt is minted, frozen and trusted for its exact evidence tuple.
const minted = await service.verify(baseContext, () => externalReceipt());
assert.equal(minted.verified, true, 'a valid external receipt must verify');
cases += 1;
blocked.push('valid-external-receipt-trusted');
assert.equal(isTrustedExternalPostconditionVerification(minted, baseContext.input), true, 'minted receipt must be trusted for its own input');

// A8. A structurally identical copy is not trusted: only the minted object may authorize learning.
const copied = structuredClone(minted);
refused('copied-receipt-not-trusted', isTrustedExternalPostconditionVerification(copied, baseContext.input) !== true);

// A9. A minted receipt must not be reusable for a different action input.
refused('receipt-not-reusable-for-other-input', isTrustedExternalPostconditionVerification(minted, { operation: 'delete', target: 'row-1' }) !== true);

// A10. Decision-linked proof must bind to the exact execution id.
refused('decision-link-wrong-execution', isTrustedDecisionLinkedExternalPostcondition(minted, { toolId: baseContext.toolId, input: baseContext.input, executionId: 'exec-bbbbbbbb-2222', decisionId: baseContext.decisionId }) !== true);

// A11. Decision-linked proof must bind to the exact decision id.
refused('decision-link-wrong-decision', isTrustedDecisionLinkedExternalPostcondition(minted, { toolId: baseContext.toolId, input: baseContext.input, executionId: baseContext.executionId, decisionId: 'decision-other' }) !== true);

// A12. The correct binding is trusted (so the check is not vacuously false).
cases += 1;
assert.equal(isTrustedDecisionLinkedExternalPostcondition(minted, { toolId: baseContext.toolId, input: baseContext.input, executionId: baseContext.executionId, decisionId: baseContext.decisionId }), true);
blocked.push('correct-decision-link-trusted');

// ---------------------------------------------------------------------------
// B. Temporal credit: late proof, replay and forward leakage (T11, T4).
// ---------------------------------------------------------------------------
const authority = new CanonicalTemporalCreditAuthority({ gamma01: 0.88, lambda01: 0.82, maxHorizonTicks: 2 });
authority.registerDecision({ decisionId: 'd1', tick: 1, action: 'explore', contextKey: 'c1', predicted01: 0.4, at: 1 });
authority.registerDecision({ decisionId: 'd2', tick: 2, action: 'verify', contextKey: 'c2', predicted01: 0.4, at: 2 });
authority.registerDecision({ decisionId: 'd3', tick: 3, action: 'respond', contextKey: 'c3', predicted01: 0.4, at: 3 });

// B1. Proof arriving after the horizon cannot keep causal confidence.
const late = authority.resolveOutcome({ decisionId: 'd1', tick: 10, reward01: 0.9, verified01: 1, independent01: 1, autonomous01: 1, at: 10 });
refused('late-proof-cannot-credit', late.assignments.every((a) => a.reason === 'expired' && a.causalConfidence01 === 0));

// B2. A repeated outcome id is an idempotent replay, not new credit.
authority.registerDecision({ decisionId: 'd4', tick: 12, action: 'respond', contextKey: 'c4', predicted01: 0.4, at: 12 });
const firstDelivery = authority.resolveOutcome({ outcomeId: 'outcome-1', tick: 13, reward01: 0.8, verified01: 1, independent01: 1, autonomous01: 1, at: 13 });
assert.ok(firstDelivery.assignments.length >= 1, 'first delivery must credit the in-window decision');
const secondDelivery = authority.resolveOutcome({ outcomeId: 'outcome-1', tick: 13, reward01: 0.8, verified01: 1, independent01: 1, autonomous01: 1, at: 13 });
refused('duplicate-outcome-is-replayed-not-credited', secondDelivery.replayed === true && secondDelivery.assignments.length === 0);

// B3. The same outcome id with different content is a conflict, not a silent overwrite.
let conflictThrew = false;
try { authority.resolveOutcome({ outcomeId: 'outcome-1', tick: 13, reward01: 0.1, verified01: 1, independent01: 1, autonomous01: 1, at: 13 }); } catch { conflictThrew = true; }
refused('outcome-id-conflict-rejected', conflictThrew);

// B4. An outcome cannot credit a decision that happened after it (no forward leakage).
const authority2 = new CanonicalTemporalCreditAuthority({ gamma01: 0.88, lambda01: 0.82, maxHorizonTicks: 2 });
authority2.registerDecision({ decisionId: 'past', tick: 1, action: 'explore', contextKey: 'p', predicted01: 0.4, at: 1 });
authority2.registerDecision({ decisionId: 'future', tick: 30, action: 'respond', contextKey: 'f', predicted01: 0.4, at: 30 });
const forward = authority2.resolveOutcome({ tick: 5, reward01: 0.9, verified01: 1, independent01: 1, autonomous01: 1, at: 5 });
refused('no-forward-credit-leakage', forward.assignments.every((a) => a.decisionId !== 'future') && forward.openDecisions >= 1);

// ---------------------------------------------------------------------------
// C. Self-modification: a candidate weakening its own gate (T1, T5).
// ---------------------------------------------------------------------------
const graph = buildSourceGraph([
  { path: 'src/organism/cognition/Evolvable.ts', text: 'export function tune(x: number) { return x; }\n' },
  { path: 'src/organism/cognition/Hub.ts', text: 'export function hub() { return 1; }\n' },
  { path: 'src/organism/cognition/A.ts', text: "import { hub } from './Hub.ts';\nexport function a() { return hub(); }\n" },
  { path: 'src/organism/cognition/B.ts', text: "import { hub } from './Hub.ts';\nexport function b() { return hub(); }\n" },
  { path: 'src/organism/learning/VerifiedOutcomePromotionGate.ts', text: 'export class VerifiedOutcomePromotionGate {}\n' },
  { path: 'src/organism/analysis/DangerModel.ts', text: 'export function assessDanger() {}\n' },
  { path: 'src/organism/system/CanonicalSelfAgencyAuthority.ts', text: 'export class CanonicalSelfAgencyAuthority {}\n' },
]);
const block = (file) => [{ file, startLine: 1, endLine: 1 }];
const backed = (n) => Array.from({ length: 5 }, (_, i) => ({ id: `p${n}-${i}`, proxyGain: 0.3, downstreamGain: 0.28 }));

// C1. A candidate must not edit the gate that decides whether its own edit is good.
refused('candidate-cannot-weaken-own-gate', evaluateModification({ candidateId: 'c', targetFiles: ['src/organism/learning/VerifiedOutcomePromotionGate.ts'] }, graph).decision !== 'allowed');
// C2. A candidate must not edit the danger model that bounds it.
refused('candidate-cannot-weaken-danger-model', evaluateModification({ candidateId: 'c', targetFiles: ['src/organism/analysis/DangerModel.ts'] }, graph).decision !== 'allowed');
// C3. A candidate must not edit the authority that admits it.
refused('candidate-cannot-edit-authority', evaluateModification({ candidateId: 'c', targetFiles: ['src/organism/system/CanonicalSelfAgencyAuthority.ts'] }, graph).decision !== 'allowed');
// C4. A self-declared safe label cannot lower the structural danger.
refused('self-declared-safety-ignored', isWithinDangerEnvelope(assessDanger({ candidateId: 'c', targetFiles: ['src/organism/cognition/Hub.ts'], rollbackReady: true, meanDownstreamGain: 0, meanDivergence: 0, observationCount: 0, protectedHits: 0, declaredSafe: true, dangerScore01: 0 }, graph)) !== true);
// C5. An irreversible change leaves the danger envelope regardless of gain.
refused('irreversible-change-refused', isWithinDangerEnvelope(assessDanger({ candidateId: 'c', targetFiles: ['src/organism/cognition/Evolvable.ts'], rollbackReady: false, meanDownstreamGain: 0.5, meanDivergence: 0, observationCount: 5, protectedHits: 0 }, graph)) !== true);
// C6. A pool must refuse a proxy-only candidate.
const pool = new SelfImprovementCandidatePool({ maxPoolSize: 8 });
refused('pool-refuses-proxy-only', pool.submit({ candidateId: 'proxy', targetFiles: ['src/organism/cognition/Evolvable.ts'], evolveBlocks: block('src/organism/cognition/Evolvable.ts'), observations: [0, 1, 2, 3, 4].map((i) => ({ id: `x${i}`, proxyGain: 0.9, downstreamGain: 0.01 })), rollbackReady: true }, graph).accepted !== true);
// C7. A pool must refuse a candidate without rollback.
refused('pool-refuses-no-rollback', pool.submit({ candidateId: 'norb', targetFiles: ['src/organism/cognition/Evolvable.ts'], evolveBlocks: block('src/organism/cognition/Evolvable.ts'), observations: backed(2), rollbackReady: false }, graph).accepted !== true);
// C8. A legitimate in-block candidate is admitted (so the checks are not vacuously false).
cases += 1;
assert.equal(pool.submit({ candidateId: 'ok', targetFiles: ['src/organism/cognition/Evolvable.ts'], evolveBlocks: block('src/organism/cognition/Evolvable.ts'), observations: backed(3), rollbackReady: true }, graph).accepted, true);
blocked.push('legitimate-candidate-admitted');

assert.ok(cases >= 20, `red-team suite must cover at least 20 cases, ran ${cases}`);

console.log(JSON.stringify({
  pass: 'NK1_SECURITY_REDTEAM',
  verified: true,
  metrics: {
    redTeamCasesPassed: cases,
    criticalBypasses: 0,
    spoofedVerificationBlocked: blocked.includes('tool-contract-cannot-claim-external-observation'),
    copiedTokenBlocked: blocked.includes('copied-receipt-not-trusted'),
    lateProofBlocked: blocked.includes('late-proof-cannot-credit'),
    replayBlocked: blocked.includes('duplicate-outcome-is-replayed-not-credited'),
    forwardCreditLeakageBlocked: blocked.includes('no-forward-credit-leakage'),
    selfGateWeakeningBlocked: blocked.includes('candidate-cannot-weaken-own-gate'),
    selfDeclaredSafetyIgnored: blocked.includes('self-declared-safety-ignored'),
    irreversibleChangeBlocked: blocked.includes('irreversible-change-refused'),
    cases: blocked,
  },
}, null, 2));
