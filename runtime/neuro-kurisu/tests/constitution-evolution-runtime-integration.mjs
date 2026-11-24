import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { GovernanceSubsystemRuntime } from '../src/organism/core/GovernanceSubsystemRuntime.ts';
import { canonicalConstitutionReviewPayload } from '../src/organism/cognition/evolution/ConstitutionReviewAuthority.ts';

const HOST_KEY = 'omestro-20-runtime-signing-key-32-bytes-minimum';
process.env.NEURO_CONSTITUTION_HMAC_KEY = HOST_KEY;
const reviewer = generateKeyPairSync('ed25519');
const reviewerPublic = reviewer.publicKey.export({type:'spki',format:'pem'}).toString();
const reviewerPrivate = reviewer.privateKey.export({type:'pkcs8',format:'pem'}).toString();
process.env.NEURO_CONSTITUTION_REVIEW_KEYS_JSON = JSON.stringify({'runtime-test-reviewer':reviewerPublic});

const first = new GovernanceSubsystemRuntime();
const engine = first.constitutionEvolution;
const gateway = new ActionGateway({ live: false });
let gatewayLedger;
gateway.setExecutionLedgerPersister(async snapshot => { gatewayLedger = structuredClone(snapshot); });

const proposal = engine.propose({
  id: 'runtime-persistence-rule',
  authorId: 'runtime-test-author',
  baseVersion: '1.0.0',
  change: 'add',
  proposedRule: {
    id: 'workflow.runtime-provenance',
    title: 'Persist governance provenance',
    statement: 'Runtime governance changes carry verifiable revision lineage and bounded evidence references.',
    domain: 'workflow',
    scope: 'Governance subsystem persistence tests.'
  },
  motivation: 'Prove that an approved mutable constitution revision survives runtime snapshot and restore.',
  scope: 'Runtime persistence projection only.',
  counterexample: 'A successful constitutional change disappears after the runtime restarts.',
  riskAssessment: {
    level: 'low',
    summary: 'Additional governance metadata increases the persisted snapshot slightly.',
    mitigations: ['Keep proposal, revision and audit histories bounded.']
  },
  testPlan: ['Activate a reviewed rule and restore it through GovernanceSubsystemRuntime.']
});
const reviewPayload = {
  schemaVersion: 1,
  proposalId: proposal.id,
  candidateDigest: proposal.candidateDigest,
  reviewerId: 'runtime-test-reviewer',
  decision: 'approve',
  invariantsPassed: true,
  tests: { planned: 1, executed: 1, passed: 1, failed: 0, holdoutCases: 1, holdoutPassed: true },
  evidenceRefs: ['ci://omestro20/runtime-persistence'],
  rationale: 'Runtime integration test evidence.',
  at: Date.now(),
};
const reviewArtifact = {
  payload: reviewPayload,
  signature: sign(null, Buffer.from(canonicalConstitutionReviewPayload(reviewPayload), 'utf8'), reviewerPrivate).toString('base64'),
};
engine.review(proposal.id, reviewArtifact);

const ratification = await engine.requestRatification(proposal.id, gateway);
assert.equal(gatewayLedger.permissions.requests.at(-1).id, ratification.approvalRequestId);
assert.equal((await gateway.resolveToolApproval(ratification.approvalRequestId, true, 'runtime-test-host-owner')).ok, true);
const ratified = await engine.ratify(proposal.id, { approvalId: ratification.approvalRequestId }, gateway);
assert.equal(ratified.approval.approverId, 'runtime-test-host-owner');
const active = engine.activate(proposal.id, 1800000000200);
assert.equal(active.version, '1.1.0');

const snapshot = first.snapshot();
assert.equal(snapshot.constitutionEvolution.schemaVersion, 1);
assert.equal(snapshot.constitutionEvolution.active.version, '1.1.0');
assert.equal(snapshot.constitutionEvolution.active.rules.length, 1);
assert.ok(/^[a-f0-9]{64}$/.test(snapshot.constitutionEvolution.integrityMac));
assert.ok(Array.isArray(snapshot.constitutionEvolution.auditEvents));

const restored = new GovernanceSubsystemRuntime();
restored.restoreFromPersisted({ advanced: snapshot });
assert.equal(restored.constitutionEvolution.diagnostics().lastRestore.ok, true);
assert.equal(restored.constitutionEvolution.activeConstitution().digest, snapshot.constitutionEvolution.active.digest);
assert.equal(restored.constitutionEvolution.activeConstitution().rules[0].id, 'workflow.runtime-provenance');

const tampered = structuredClone(snapshot);
tampered.constitutionEvolution.proposals[0].reviews[0].reviewerId = 'tampered-reviewer';
const failClosed = new GovernanceSubsystemRuntime();
failClosed.restoreFromPersisted({ advanced: tampered });
assert.equal(failClosed.constitutionEvolution.activeConstitution().version, '1.0.0');
assert.equal(failClosed.constitutionEvolution.diagnostics().lastRestore.ok, false);

console.log('OMESTRO_20_GOVERNANCE_RUNTIME_PERSISTENCE=PASS');
