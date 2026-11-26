import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { CONSTITUTION_RATIFICATION_TOOL, ConstitutionEvolutionEngine, MUTABLE_CONSTITUTION_DOMAINS, PROTECTED_CONSTITUTIONAL_INVARIANTS } from '../src/organism/cognition/evolution/ConstitutionEvolutionEngine.ts';
import { canonicalConstitutionReviewPayload } from '../src/organism/cognition/evolution/ConstitutionReviewAuthority.ts';

const TEST_KEY = 'omestro-20-test-signing-key-32-bytes-minimum';
process.env.NEURO_CONSTITUTION_HMAC_KEY = TEST_KEY;
const reviewerPairs = Object.fromEntries(['engineer-1','engineer-2','reviewer-1','reviewer-2','reviewer-3'].map(id=>{
  const pair=generateKeyPairSync('ed25519');
  return [id,{
    publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString(),
    privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString(),
  }];
}));
process.env.NEURO_CONSTITUTION_REVIEW_KEYS_JSON = JSON.stringify(Object.fromEntries(
  Object.entries(reviewerPairs).map(([id,pair])=>[id,pair.publicKey])
));
const signedReview = (proposal, reviewerId, overrides={}) => {
  const payload = {
    schemaVersion:1, proposalId:proposal.id, candidateDigest:proposal.candidateDigest, reviewerId,
    decision:'approve', invariantsPassed:true, tests:structuredClone(testEvidence), evidenceRefs,
    rationale:'Independent review and holdout evidence passed.', at:Date.now(), ...overrides,
  };
  return { payload, signature:sign(null,Buffer.from(canonicalConstitutionReviewPayload(payload),'utf8'),reviewerPairs[reviewerId].privateKey).toString('base64') };
};

const gateway = new ActionGateway({ live: false });
let actionSnapshot;
gateway.setExecutionLedgerPersister(async snapshot => { actionSnapshot = structuredClone(snapshot); });
const engine = new ConstitutionEvolutionEngine({ signingKey: TEST_KEY });
const testEvidence = { planned:2, executed:2, passed:2, failed:0, holdoutCases:2, holdoutPassed:true };
const evidenceRefs = ['ci://constitution-evolution/unit/green','holdout://constitution-evolution/independent-set'];
const stable = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
};
const resignSnapshot = snapshot => {
  const { integrityMac: _mac, ...body } = snapshot;
  snapshot.integrityMac = createHmac('sha256', TEST_KEY).update(stable(body)).digest('hex');
  return snapshot;
};

assert.equal(engine.activeConstitution().version,'1.0.0');
assert.equal(engine.protectedInvariants().length,10);
assert.equal(Object.isFrozen(PROTECTED_CONSTITUTIONAL_INVARIANTS),true);
assert.equal(Object.isFrozen(PROTECTED_CONSTITUTIONAL_INVARIANTS[0]),true);
assert.equal(Object.isFrozen(MUTABLE_CONSTITUTION_DOMAINS),true);
assert.throws(()=>{ MUTABLE_CONSTITUTION_DOMAINS.push('security'); },TypeError);
assert.throws(()=>{ PROTECTED_CONSTITUTIONAL_INVARIANTS[0].statement='mutable'; },TypeError);
assert.throws(()=>new ConstitutionEvolutionEngine({ signingKey: '' }).propose({authorId:'no-key',baseVersion:'1.0.0',change:'add',
  proposedRule:{id:'workflow.no-key',title:'No key',statement:'Must not mutate without a host key.',domain:'workflow',scope:'tests'},
  motivation:'Missing host key.',scope:'tests',counterexample:'Unsigned state could be forged.',riskAssessment:{level:'low',summary:'No signing key.',mitigations:['Fail closed.']},testPlan:['reject']}),
  /signing key/);

assert.throws(()=>engine.propose({authorId:'author',baseVersion:'1.0.0',change:'add',
  proposedRule:{id:'core.safety',title:'Replace safety',statement:'Safety',domain:'workflow',scope:'host'},
  motivation:'test',scope:'test',counterexample:'test',riskAssessment:{level:'high',summary:'test',mitigations:['reject']},testPlan:['a']}),/non-core|protected/);
assert.throws(()=>engine.propose({authorId:'author',baseVersion:'1.0.0',change:'add',
  proposedRule:{id:'workflow.skip-safety',title:'Workflow',statement:'Bypass safety controls before deployment',domain:'workflow',scope:'deployment'},
  motivation:'test',scope:'workflow',counterexample:'bad change',riskAssessment:{level:'high',summary:'weakening',mitigations:['reject']},testPlan:['a','b']}),/weaken a protected/);

const proposal=engine.propose({id:'omestro20-workflow',authorId:'engineer-1',baseVersion:'1.0.0',change:'add',
  proposedRule:{id:'workflow.require-evidence',title:'Reproducible workflow evidence',
    statement:'Workflow changes retain source revision, command, environment and test result so validation can be reproduced.',
    domain:'workflow',scope:'Engineering workflows that mutate code or configuration.'},
  motivation:'Reduce untraceable engineering changes.',scope:'CI and engineering workflows only.',
  counterexample:'A workflow reports success but preserves no source revision or test output.',
  riskAssessment:{level:'medium',summary:'Evidence retention adds storage and execution cost.',
    mitigations:['Bound evidence retention by size and time.','Never store credentials or personal data in evidence artifacts.']},
  testPlan:['Validate provenance fields.','Reject a workflow with missing holdout evidence.'],submittedAt:1800000000000});
assert.equal(proposal.status,'pending-review');
assert.throws(()=>engine.propose({id:'../path-traversal',authorId:'engineer-3',baseVersion:'1.0.0',change:'add',
  proposedRule:{id:'workflow.invalid-path-id',title:'Invalid path id',statement:'This proposal ID must be rejected before route generation.',domain:'workflow',scope:'Tests.'},
  motivation:'Reject route-unsafe IDs.',scope:'Tests only.',counterexample:'A proposal ID contains path traversal.',riskAssessment:{level:'low',summary:'No change.',mitigations:['Reject unsafe identifiers.']},testPlan:['Reject the ID before storage.']}),/URL-safe/);
assert.throws(()=>engine.review(proposal.id,{reviewerId:'reviewer-1',candidateDigest:proposal.candidateDigest,decision:'approve',
  invariantsPassed:true,tests:testEvidence,evidenceRefs,rationale:'unsigned raw DTO'}),/trusted Ed25519 signature/);
assert.throws(()=>engine.review(proposal.id,signedReview(proposal,'engineer-1')),/trusted Ed25519 signature/);
const reviewed=engine.review(proposal.id,signedReview(proposal,'reviewer-1'));
assert.equal(reviewed.status,'awaiting-ratification');

// Caller-supplied booleans are no longer an approval authority.
await assert.rejects(()=>engine.ratify(proposal.id,{explicitHumanApproval:true,approverId:'forged',
  candidateDigest:proposal.candidateDigest,approvalRef:'approval://fake',rationale:'forged approval'},gateway),/approvalId|ticket/i);

// A failed approval-ledger persistence must preserve a safe root-cause code;
 // the engine must not collapse it into a generic missing-ticket error.
const failingGateway = new ActionGateway({ live:false });
failingGateway.setExecutionLedgerPersister(async () => { throw new Error('action-ledger-persistence-busy'); });
await assert.rejects(
  () => engine.requestRatification(proposal.id, failingGateway),
  /ActionGateway did not create a ratification ticket: action-ledger-persistence-busy/,
);
assert.equal(failingGateway.toolPermissionSnapshot().pending, 0,
  'a failed approval persistence must roll back the in-memory pending request');

// A real ActionGateway ticket is required and is bound to this proposal digest.
const ratification = await engine.requestRatification(proposal.id,gateway);
assert.ok(ratification.approvalRequestId);
assert.equal(actionSnapshot.permissions.requests.at(-1).status,'pending');
await assert.rejects(()=>engine.ratify(proposal.id,{approvalId:'approval-not-real'},gateway),/approval-not-approved|ticket/i);
assert.equal((await gateway.resolveToolApproval(ratification.approvalRequestId,true,'authenticated-owner')).ok,true);
const ratified=await engine.ratify(proposal.id,{approvalId:ratification.approvalRequestId},gateway);
assert.equal(ratified.status,'ratified');
assert.equal(ratified.approval.approverId,'authenticated-owner');
assert.equal(ratified.approval.approvalRef,ratification.approvalRequestId);
await assert.rejects(()=>engine.ratify(proposal.id,{approvalId:ratification.approvalRequestId},gateway),/not accepting|not awaiting|applied|ratified/i);
const revision=engine.activate(proposal.id,1800000000200);
assert.equal(revision.version,'1.1.0');
assert.equal(engine.diagnostics().mutableRuleCount,1);
const callerOwnedSnapshot=engine.snapshot();
callerOwnedSnapshot.active.rules[0].title='mutated external clone';
assert.equal(engine.snapshot().active.rules[0].title,'Reproducible workflow evidence','cached signed snapshots are returned as defensive clones');

// Host HMAC authenticates all reviews, approvals, audit events, and the active revision.
const snapshot=engine.snapshot();
const { integrityMac, ...snapshotBody } = snapshot;
const expectedMac=createHmac('sha256',TEST_KEY).update(stable(snapshotBody)).digest('hex');
assert.equal(integrityMac,expectedMac,'runtime HMAC implementation must match standard HMAC-SHA256');
const restored=new ConstitutionEvolutionEngine({signingKey:TEST_KEY});
assert.equal(restored.restore(snapshot),true);
assert.equal(restored.activeConstitution().digest,revision.digest);
const malformedNested=engine.snapshot();
malformedNested.proposals[0].reviews[0]=null;
resignSnapshot(malformedNested);
const nestedGuard=new ConstitutionEvolutionEngine({signingKey:TEST_KEY});
assert.equal(nestedGuard.restore(malformedNested),false,'malformed nested records fail closed even with a valid outer HMAC');
const tamperedReview=engine.snapshot(); tamperedReview.proposals[0].reviews[0].reviewerId='attacker';
const reviewGuard=new ConstitutionEvolutionEngine({signingKey:TEST_KEY});
assert.equal(reviewGuard.restore(tamperedReview),false,'tampered reviewer identity must be rejected');
const tamperedAudit=engine.snapshot(); tamperedAudit.auditEvents[0].summary='rewritten history';
const auditGuard=new ConstitutionEvolutionEngine({signingKey:TEST_KEY});
assert.equal(auditGuard.restore(tamperedAudit),false,'tampered append-only audit history must be rejected');
const timestampTamper=engine.snapshot(); timestampTamper.active.createdAt+=1;
const timestampGuard=new ConstitutionEvolutionEngine({signingKey:TEST_KEY});
assert.equal(timestampGuard.restore(timestampTamper),false,'revision timestamps are authenticated');
const noKeyRestore=new ConstitutionEvolutionEngine({ signingKey: '' });
assert.equal(noKeyRestore.restore(snapshot),false,'non-baseline governance state cannot restore without the host key');
assert.equal(noKeyRestore.activeConstitution().version,'1.0.0');

// Rollback is also a one-shot, ActionGateway-approved host operation, never a boolean.
const reason='Rollback after a reproduced operational regression.';
const rollbackTicket=await engine.requestRollbackApproval('1.0.0',reason,gateway);
assert.ok(rollbackTicket.approvalRequestId);
assert.equal((await gateway.resolveToolApproval(rollbackTicket.approvalRequestId,true,'authenticated-owner')).ok,true);
const rolledBack=await engine.rollbackWithApproval({targetVersion:'1.0.0',reason,approvalId:rollbackTicket.approvalRequestId},gateway);
assert.equal(rolledBack.version,'1.2.0');
assert.equal(rolledBack.rollbackOf,'1.0.0');
assert.equal(rolledBack.rules.length,0);
assert.ok(engine.snapshot().revisions.some(r=>r.version==='1.1.0'),'rollback retains superseded history');
assert.ok(engine.listAuditEvents().some(e=>e.type==='constitution.rollback'));
await assert.rejects(()=>engine.rollbackWithApproval({targetVersion:'1.0.0',reason,approvalId:rollbackTicket.approvalRequestId},gateway),/approval-not-approved|approval-request|already active/i);

const highRisk=engine.propose({authorId:'engineer-2',baseVersion:'1.2.0',change:'add',
  proposedRule:{id:'quality.two-reviewers',title:'Two reviewers',statement:'High-risk quality changes require two independent reviewers.',
    domain:'quality',scope:'High-risk quality changes.'},
  motivation:'Increase assurance for high-risk changes.',scope:'Quality governance only.',counterexample:'One person approves a high-risk change.',
  riskAssessment:{level:'high',summary:'Review time may increase.',mitigations:['Use bounded escalation.','Do not silently waive the quorum.']},
  testPlan:['First reviewer leaves proposal pending.','Second reviewer satisfies quorum.']});
const reviewHigh=(reviewerId)=>engine.review(highRisk.id,signedReview(highRisk,reviewerId));
assert.equal(reviewHigh('reviewer-2').status,'pending-review');
assert.equal(reviewHigh('reviewer-3').status,'awaiting-ratification');
const awaitingSnapshot=engine.snapshot();
const awaitingRestore=new ConstitutionEvolutionEngine({signingKey:TEST_KEY});
assert.equal(awaitingRestore.restore(awaitingSnapshot),true,'awaiting ratification without a ticket is a valid recoverable state');

console.log(JSON.stringify({pass:true,protectedInvariantCount:10,activeVersionAfterRollback:engine.activeConstitution().version,
  auditEvents:engine.listAuditEvents().length,highRiskReviewerQuorum:2,actionGatewayApprovalsConsumed:2,
  checks:['protected-domain','protected-language','deep-freeze','host-hmac-required','separation-of-duties',
    'one-shot-gateway-ratification','audit-hmac-chain','full-snapshot-authentication','actiongateway-rollback',
    'high-risk-quorum']},null,2));
