import assert from 'node:assert/strict';
import { ConstitutionEvolutionEngine, PROTECTED_CONSTITUTIONAL_INVARIANTS } from '../src/organism/cognition/evolution/ConstitutionEvolutionEngine.ts';

const engine = new ConstitutionEvolutionEngine();
const tests = { planned:2, executed:2, passed:2, failed:0, holdoutCases:2, holdoutPassed:true };
const evidenceRefs = ['ci://constitution-evolution/unit/green','holdout://constitution-evolution/independent-set'];

assert.equal(engine.activeConstitution().version,'1.0.0');
assert.equal(engine.protectedInvariants().length,10);
assert.equal(Object.isFrozen(PROTECTED_CONSTITUTIONAL_INVARIANTS),true);
assert.equal(Object.isFrozen(PROTECTED_CONSTITUTIONAL_INVARIANTS[0]),true);
assert.throws(()=>{ PROTECTED_CONSTITUTIONAL_INVARIANTS[0].statement='mutable'; },TypeError);
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
assert.throws(()=>engine.review(proposal.id,{reviewerId:'engineer-1',candidateDigest:proposal.candidateDigest,decision:'approve',
  invariantsPassed:true,tests,evidenceRefs,rationale:'self review'}),/cannot review their own/);
const reviewed=engine.review(proposal.id,{reviewerId:'reviewer-1',candidateDigest:proposal.candidateDigest,decision:'approve',
  invariantsPassed:true,tests,evidenceRefs,rationale:'independent tests and holdout passed'});
assert.equal(reviewed.status,'awaiting-ratification');
assert.throws(()=>engine.ratify(proposal.id,{approverId:'reviewer-1',explicitHumanApproval:true,candidateDigest:proposal.candidateDigest,
  approvalRef:'approval://wrong',rationale:'reviewer cannot approve'}),/separate from author and reviewers/);
engine.ratify(proposal.id,{approverId:'system-owner',explicitHumanApproval:true,candidateDigest:proposal.candidateDigest,
  approvalRef:'approval://change-control/omestro20',rationale:'explicit out-of-band approval'});
const revision=engine.activate(proposal.id,1800000000200);
assert.equal(revision.version,'1.1.0');
assert.equal(engine.diagnostics().mutableRuleCount,1);

const restored=new ConstitutionEvolutionEngine();
assert.equal(restored.restore(engine.snapshot()),true);
assert.equal(restored.activeConstitution().digest,revision.digest);
const timestampTamper=engine.snapshot(); timestampTamper.active.createdAt+=1;
const timestampGuard=new ConstitutionEvolutionEngine();
assert.equal(timestampGuard.restore(timestampTamper),false,'revision timestamps are covered by the revision digest');
const tampered=engine.snapshot(); tampered.protectedInvariantDigest='0'.repeat(64);
const failClosed=new ConstitutionEvolutionEngine();
assert.equal(failClosed.restore(tampered),false);
assert.equal(failClosed.activeConstitution().version,'1.0.0');

const reason='Rollback after a reproduced operational regression.';
const rolledBack=engine.rollback({targetVersion:'1.0.0',reason,approverId:'system-owner',explicitHumanApproval:true,
  approvalRef:'approval://rollback/omestro20',approvalDigest:engine.rollbackApprovalDigest('1.0.0',reason),at:1800000000300});
assert.equal(rolledBack.version,'1.2.0');
assert.equal(rolledBack.rollbackOf,'1.0.0');
assert.equal(rolledBack.rules.length,0);
assert.ok(engine.snapshot().revisions.some(r=>r.version==='1.1.0'),'rollback retains superseded history');
assert.ok(engine.listAuditEvents().some(e=>e.type==='constitution.rollback'));

const highRisk=engine.propose({authorId:'engineer-2',baseVersion:'1.2.0',change:'add',
  proposedRule:{id:'quality.two-reviewers',title:'Two reviewers',statement:'High-risk quality changes require two independent reviewers.',
    domain:'quality',scope:'High-risk quality changes.'},
  motivation:'Increase assurance for high-risk changes.',scope:'Quality governance only.',counterexample:'One person approves a high-risk change.',
  riskAssessment:{level:'high',summary:'Review time may increase.',mitigations:['Use bounded escalation.','Do not silently waive the quorum.']},
  testPlan:['First reviewer leaves proposal pending.','Second reviewer satisfies quorum.']});
const reviewHigh=(reviewerId)=>engine.review(highRisk.id,{reviewerId,candidateDigest:highRisk.candidateDigest,decision:'approve',
  invariantsPassed:true,tests,evidenceRefs,rationale:'independent review passed'});
assert.equal(reviewHigh('reviewer-2').status,'pending-review');
assert.equal(reviewHigh('reviewer-3').status,'awaiting-ratification');
console.log(JSON.stringify({pass:true,protectedInvariantCount:10,activeVersionAfterRollback:engine.activeConstitution().version,
  auditEvents:engine.listAuditEvents().length,highRiskReviewerQuorum:2,
  checks:['protected-domain','protected-language','separation-of-duties','independent-review','human-ratification',
    'activation','restore','tamper-fail-closed','audited-rollback','high-risk-quorum']},null,2));
