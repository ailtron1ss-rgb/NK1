import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as signSignature } from 'node:crypto';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { isAuthenticVerifiedSkillPromotionProposal, proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import {
  createSkillCompetenceProofVerifier,
  cloneFrozenSkillCompetenceProof,
  parseTrustedSkillCompetenceAttestorKeys,
  canonicalSkillCompetenceProofPayload,
  skillCompetenceRuntimeFingerprint,
  verifySkillCompetenceProofForTool,
} from '../src/organism/learning/SkillCompetenceProof.ts';
import { InMemorySkillStorePersistence, VersionedSkillCandidateStore } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import {
  signSkillShadowArtifactForFixture,
  skillShadowPayloadFingerprint,
  verifySignedSkillShadowObservation,
} from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const holdoutKeys = generateKeyPairSync('ed25519');
const shadowKeys = generateKeyPairSync('ed25519');
const attestorKeys = generateKeyPairSync('ed25519');
const pem = (key, type) => key.export({ type, format: 'pem' }).toString();
const holdoutPrivatePem = pem(holdoutKeys.privateKey, 'pkcs8');
const shadowPublicPem = pem(shadowKeys.publicKey, 'spki');
const shadowPrivatePem = pem(shadowKeys.privateKey, 'pkcs8');
const attestorPublicPem = pem(attestorKeys.publicKey, 'spki');
const attestorPrivatePem = pem(attestorKeys.privateKey, 'pkcs8');
const holdoutVerifierKeys = new Map([['holdout-verifier-v1', pem(holdoutKeys.publicKey, 'spki')]]);

function signSkillCompetenceProofForTest(payload, privateKeyPem) {
  return {
    payload,
    signature: signSignature(
      null,
      Buffer.from(canonicalSkillCompetenceProofPayload(payload), 'utf8'),
      privateKeyPem,
    ).toString('base64'),
  };
}
const shadowVerifierKeys = new Map([['shadow-verifier-v1', shadowPublicPem]]);
const trustedAttestorKeys = new Map([['skill-attestor-v1', attestorPublicPem]]);

assert.equal(parseTrustedSkillCompetenceAttestorKeys(JSON.stringify({
  'skill-attestor-v1': attestorPublicPem,
})).size, 1, 'trusted Ed25519 skill attestors load separately');
assert.throws(() => parseTrustedSkillCompetenceAttestorKeys('{bad-json'), /valid JSON/);

const malformedSparseProof = {
  payload: {
    contract: { allowedModes: ['assisted', ,] },
  },
  signature: 'A'.repeat(88),
};
assert.throws(() => cloneFrozenSkillCompetenceProof(malformedSparseProof), /invalid-skill-competence-proof-data/);
const accessorProof = { payload: {}, signature: 'A'.repeat(88) };
Object.defineProperty(accessorProof.payload, 'attestorId', {
  enumerable: true,
  get() { throw new Error('accessor must never execute'); },
});
assert.throws(() => cloneFrozenSkillCompetenceProof(accessorProof), /invalid-skill-competence-proof-data/);
const proxyProof = new Proxy({ payload: {}, signature: 'A'.repeat(88) }, {});
assert.throws(() => cloneFrozenSkillCompetenceProof(proxyProof), /invalid-skill-competence-proof-data/);
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
assert.throws(() => parseTrustedSkillCompetenceAttestorKeys(JSON.stringify({
  'not-ed25519': pem(rsa.publicKey, 'spki'),
})), /valid Ed25519 public keys/);

const manifest = Array.from({ length: 10 }, (_, index) => ({
  taskId: 'task-' + index,
  family: index < 5 ? 'memory' : 'tool-use',
  split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('unique proof prompt ' + index),
  verifierId: 'holdout-verifier-v1',
  version: 'v1',
}));
const ledger = new VerifiedOutcomeLedger(manifest);

function recordSigned(taskId, method, seed, passed) {
  const task = manifest.find(item => item.taskId === taskId);
  const payload = {
    schemaVersion: 1,
    artifactId: 'outcome-' + taskId + '-' + method + '-' + seed,
    runId: 'run-' + method + '-' + seed,
    manifestFingerprint: ledger.manifestFingerprint(),
    taskId,
    taskVersion: task.version,
    method,
    seed,
    attempt: 1,
    passed,
    verifierId: task.verifierId,
    observedAt: Date.now(),
  };
  return ingestSignedOutcomeArtifact(
    ledger, manifest, signOutcomePayloadForFixture(payload, holdoutPrivatePem), holdoutVerifierKeys,
  );
}
for (let seed = 1; seed <= 5; seed++) {
  for (let index = 0; index < manifest.length; index++) {
    for (const pair of [['baseline', index < 6], ['candidate', index < 8]]) {
      assert.equal(recordSigned('task-' + index, pair[0], seed, pair[1]).accepted, true);
    }
  }
}
const proposal = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8, minAbsoluteGain: .1, minCompleteSeeds: 3,
});
assert.equal(isAuthenticVerifiedSkillPromotionProposal(proposal), true);
assert.equal(proposal.gate.accepted, true);
assert.equal(proposal.uniquePairedTasks, 10);
assert.equal(proposal.completePairedSeeds, 5);
assert.equal(proposal.pairedTaskSeedN, 50);
assert.equal(proposal.seedClusteredEvaluation.pairedN, 5,
  'independent seed clusters are not task×seed pairs');

const runtimeVersion = 'nk1-proof-runtime-build-2026-11-17';
const runtimeFingerprint = skillCompetenceRuntimeFingerprint(runtimeVersion);
const environmentFingerprint = 'e'.repeat(64);
const inputContract = {
  type: 'object',
  properties: { query: { type: 'string', minLength: 1, maxLength: 120 } },
  required: ['query'],
  additionalProperties: false,
  maxSerializedBytes: 4096,
};
const outputContract = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
  maxSerializedBytes: 4096,
};
const contract = {
  toolId: 'skill.proof.read',
  capability: 'skill-competence-proof-test',
  permissionClass: 'none',
  inputContractFingerprint: sha256Stable(inputContract),
  outputContractFingerprint: sha256Stable(outputContract),
  runtimeFingerprint,
  environmentFingerprint,
  preconditions: ['precondition.safe-read'],
  constraints: ['constraint.read-only'],
  allowedModes: ['assisted'],
};
const candidatePayload = {
  proofCarryingSkill: true,
  instruction: 'Read only the requested memory record.',
  competenceContract: contract,
};
const skillId = 'skill.proof.read';
const skillStorePersistence = new InMemorySkillStorePersistence();
const store = new VersionedSkillCandidateStore(
  skillStorePersistence,
  () => true,
  (observation, candidate) => verifySignedSkillShadowObservation(observation, candidate, shadowVerifierKeys),
  () => false,
  createSkillCompetenceProofVerifier(trustedAttestorKeys),
);
const candidate = store.stageCandidate(proposal, skillId, candidatePayload);
assert.equal(candidate.status, 'staged');

function signedShadowObservation(candidateRecord, index) {
  const observedAt = Date.now() + index;
  const payload = {
    schemaVersion: 1,
    artifactId: 'shadow-artifact-' + index,
    candidateId: candidateRecord.candidateId,
    skillId: candidateRecord.skillId,
    candidateVersion: candidateRecord.version,
    payloadFingerprint: candidateRecord.payloadFingerprint,
    proposalOutcomeFingerprint: candidateRecord.proposalOutcomeFingerprint,
    runId: 'shadow-run-' + index,
    taskId: 'shadow-task-' + index,
    manifestFingerprint: proposal.manifestFingerprint,
    seed: index,
    runtimeVersion,
    passed: true,
    observedAt,
    verifierId: 'shadow-verifier-v1',
  };
  const artifact = signSkillShadowArtifactForFixture(payload, shadowPrivatePem);
  return {
    runId: payload.runId,
    evidenceFingerprint: skillShadowPayloadFingerprint(payload),
    passed: true,
    observedAt,
    artifact,
  };
}
for (let index = 1; index <= 3; index++) {
  store.recordShadowObservation(candidate.candidateId, signedShadowObservation(candidate, index));
}
const initialIssuedAt = Date.now();
const firstPayload = store.createCompetenceProofPayload(
  candidate.candidateId, proposal, contract, 'skill-attestor-v1', initialIssuedAt, initialIssuedAt + 60 * 60_000,
);
const firstProof = signSkillCompetenceProofForTest(firstPayload, attestorPrivatePem);
const attached = store.attachCompetenceProof(candidate.candidateId, firstProof);
assert.equal(attached.competenceProof.payload.candidateId, candidate.candidateId);
assert.equal(attached.competenceProof.payload.holdout.completePairedSeeds, 5);
assert.equal(attached.competenceProof.payload.shadowRunCount, 3);

// New evidence changes the evidence-set digest; the previous certificate is revoked.
store.recordShadowObservation(candidate.candidateId, signedShadowObservation(candidate, 4));
assert.equal(store.snapshot().candidates[0].competenceProof, undefined);
assert.throws(() => store.approveAndPromote(candidate.candidateId, {
  approvedBy: 'trusted-test-approver',
  approvedAt: Date.now(),
  expectedActiveVersion: null,
}, 3), /without a signed competence certificate/);

const refreshedIssuedAt = Date.now();
const refreshedPayload = store.createCompetenceProofPayload(
  candidate.candidateId, proposal, contract, 'skill-attestor-v1',
  refreshedIssuedAt, refreshedIssuedAt + 60 * 60_000,
);
const activeProof = signSkillCompetenceProofForTest(refreshedPayload, attestorPrivatePem);
store.attachCompetenceProof(candidate.candidateId, activeProof);
const activeVersion = store.approveAndPromote(candidate.candidateId, {
  approvedBy: 'trusted-test-approver',
  approvedAt: Date.now(),
  expectedActiveVersion: null,
}, 3);
assert.equal(activeVersion.version, candidate.version);
assert.deepEqual(store.resolveActiveSkillCompetenceSubject(skillId), {
  candidateId: candidate.candidateId,
  version: candidate.version,
  payloadFingerprint: candidate.payloadFingerprint,
  proofId: activeProof.payload.proofId,
});

// Restart reconstruction must re-authenticate the persisted proof and its candidate/evidence binding.
const restoredStore = new VersionedSkillCandidateStore(
  skillStorePersistence,
  () => true,
  (observation, restoredCandidate) => verifySignedSkillShadowObservation(observation, restoredCandidate, shadowVerifierKeys),
  () => false,
  createSkillCompetenceProofVerifier(trustedAttestorKeys),
);
assert.deepEqual(restoredStore.resolveActiveSkillCompetenceSubject(skillId), {
  candidateId: candidate.candidateId,
  version: candidate.version,
  payloadFingerprint: candidate.payloadFingerprint,
  proofId: activeProof.payload.proofId,
});
const tamperedSnapshot = skillStorePersistence.read();
tamperedSnapshot.revision = 1;
tamperedSnapshot.candidates[0].competenceProof.signature =
  tamperedSnapshot.candidates[0].competenceProof.signature.slice(0, -4) + 'AAAA';
const tamperedPersistence = new InMemorySkillStorePersistence();
assert.equal(tamperedPersistence.compareAndSwap(0, tamperedSnapshot), true);
assert.throws(() => new VersionedSkillCandidateStore(
  tamperedPersistence,
  () => true,
  (observation, restoredCandidate) => verifySignedSkillShadowObservation(observation, restoredCandidate, shadowVerifierKeys),
  () => false,
  createSkillCompetenceProofVerifier(trustedAttestorKeys),
), /competence proof failed signature\/context verification/);

const expiredOnRestoreVerifier = createSkillCompetenceProofVerifier(
  trustedAttestorKeys,
  () => Date.now() + 2 * 60 * 60_000,
);
const expiredRestoredStore = new VersionedSkillCandidateStore(
  skillStorePersistence,
  () => true,
  (observation, restoredCandidate) => verifySignedSkillShadowObservation(observation, restoredCandidate, shadowVerifierKeys),
  () => false,
  expiredOnRestoreVerifier,
);
assert.equal(expiredRestoredStore.resolveActiveSkillCompetenceSubject(skillId), null,
  'an expired but authentic proof may be restored as historical state, but it cannot authorize an active skill');

const permissionScopeCheck = verifySkillCompetenceProofForTool(activeProof, {
  trustedAttestorKeys,
  toolId: skillId,
  capability: contract.capability,
  permissionClass: 'device',
  inputContractFingerprint: sha256Stable(inputContract),
  outputContractFingerprint: sha256Stable(outputContract),
  runtimeFingerprint,
  environmentFingerprint,
  autonomous: false,
  now: Date.now(),
  activeSubject: store.resolveActiveSkillCompetenceSubject(skillId),
  input: { query: 'memory' },
  evaluateCondition: () => true,
});
assert.deepEqual(permissionScopeCheck, {
  ok: false,
  reason: 'skill-competence-proof-tool-scope-mismatch',
});

// A valid signature for the same candidate is not enough if it is not the exact
// certificate attached during promotion. This blocks silent scope/mode expansion.
const substitutedPayload = structuredClone(activeProof.payload);
substitutedPayload.contract.allowedModes = ['assisted', 'autonomous'];
substitutedPayload.proofId = sha256Stable({
  candidateId: substitutedPayload.candidateId,
  candidateVersion: substitutedPayload.candidateVersion,
  payloadFingerprint: substitutedPayload.payloadFingerprint,
  proposalId: substitutedPayload.proposalId,
  contract: substitutedPayload.contract,
  holdout: substitutedPayload.holdout,
  shadowEvidenceFingerprint: substitutedPayload.shadowEvidenceFingerprint,
  attestorId: substitutedPayload.attestorId,
  issuedAt: substitutedPayload.issuedAt,
  expiresAt: substitutedPayload.expiresAt,
});
const substitutedProof = signSkillCompetenceProofForTest(substitutedPayload, attestorPrivatePem);

const expiredIssuedAt = Date.now() - 10_000;
const expiredPayload = store.createCompetenceProofPayload(
  candidate.candidateId, proposal, contract, 'skill-attestor-v1',
  expiredIssuedAt, Date.now() - 1,
);
const expiredProof = signSkillCompetenceProofForTest(expiredPayload, attestorPrivatePem);

function buildGateway(options = {}) {
  const gateway = new ActionGateway();
  gateway.configureSkillCompetenceProofVerifier({
    skillCompetenceVerifierKeys: options.trustedAttestorKeys ?? trustedAttestorKeys,
    currentSkillCompetenceRuntimeFingerprint: () => options.runtimeFingerprint === undefined ? runtimeFingerprint : options.runtimeFingerprint,
    currentSkillCompetenceEnvironmentFingerprint: () => options.environmentFingerprint === undefined ? environmentFingerprint : options.environmentFingerprint,
    resolveActiveSkillCompetenceSubject: () => options.activeSubject ?? store.resolveActiveSkillCompetenceSubject(skillId),
    evaluateSkillCompetenceCondition: (conditionId, _input, context) =>
      options.rejectCondition ? false :
        (context.kind === 'precondition' && conditionId === 'precondition.safe-read') ||
        (context.kind === 'constraint' && conditionId === 'constraint.read-only'),
  });
  let executorCalls = 0;
  gateway.registerTool({
    id: options.toolId ?? skillId,
    capability: options.capability ?? contract.capability,
    permissionClass: options.permissionClass,
    destructive: false,
    requiresSkillCompetenceProof: true,
    skillCompetenceProof: options.proof ?? activeProof,
    inputContract: options.inputContract ?? inputContract,
    outputContract: options.outputContract ?? outputContract,
    execute: async () => {
      executorCalls += 1;
      return { ok: true };
    },
  });
  return { gateway, executorCalls: () => executorCalls };
}

const valid = buildGateway();
const validResult = await valid.gateway.executeTool(skillId, { query: 'memory' }, 'proof-admission-valid');
assert.equal(validResult.outcomeClass, 'executed-unverified');
assert.equal(valid.executorCalls(), 1, 'only a correctly attested in-scope proof reaches the executor');

const deniedCases = [
  ['autonomous-mode', { autonomous: true }],
  ['wrong-capability', { capability: 'different-capability' }],
  ['wrong-output-contract', { outputContract: { ...outputContract, properties: { ok: { type: 'string' } } } }],
  ['untrusted-attestor', { trustedAttestorKeys: new Map() }],
  ['wrong-tool-id', { toolId: 'skill.proof.other' }],
  ['missing-runtime-identity', { runtimeFingerprint: null }],
  ['missing-environment-identity', { environmentFingerprint: null }],
  ['wrong-runtime', { runtimeFingerprint: skillCompetenceRuntimeFingerprint('different-runtime') }],
  ['wrong-environment', { environmentFingerprint: 'f'.repeat(64) }],
  ['wrong-active-version', { activeSubject: {
    candidateId: candidate.candidateId, version: candidate.version + 1,
    payloadFingerprint: candidate.payloadFingerprint,
  } }],
  ['wrong-active-candidate', { activeSubject: {
    candidateId: 'a'.repeat(64), version: candidate.version,
    payloadFingerprint: candidate.payloadFingerprint,
  } }],
  ['wrong-input-contract', { inputContract: {
    ...inputContract, properties: { query: { type: 'string', maxLength: 4 } },
  } }],
  ['tampered-signature', { proof: {
    ...activeProof, signature: activeProof.signature.slice(0, -4) + 'AAAA',
  } }],
  ['expired-proof', { proof: expiredProof }],
  ['substituted-proof-widened-mode', { proof: substitutedProof, autonomous: true }],
  ['failed-condition', { rejectCondition: true }],
];
for (const pair of deniedCases) {
  const name = pair[0], options = pair[1];
  const denied = buildGateway(options);
  const result = await denied.gateway.executeTool(
    skillId, { query: 'memory' }, 'proof-admission-' + name, { autonomous: options.autonomous === true },
  );
  assert.equal(result.outcomeClass, 'competence-insufficient', name + ' must fail closed');
  assert.equal(denied.executorCalls(), 0, name + ' must refuse before executor entry');
}

// Registration snapshots and freezes the proof so a caller cannot mutate the signed
// payload after the gateway has accepted the tool definition.
const mutableProof = structuredClone(activeProof);
const immutableGateway = new ActionGateway();
immutableGateway.configureSkillCompetenceProofVerifier({
  skillCompetenceVerifierKeys: trustedAttestorKeys,
  currentSkillCompetenceRuntimeFingerprint: () => runtimeFingerprint,
  currentSkillCompetenceEnvironmentFingerprint: () => environmentFingerprint,
  resolveActiveSkillCompetenceSubject: () => store.resolveActiveSkillCompetenceSubject(skillId),
  evaluateSkillCompetenceCondition: () => true,
});
immutableGateway.registerTool({
  id: skillId, capability: contract.capability, destructive: false,
  requiresSkillCompetenceProof: true, skillCompetenceProof: mutableProof,
  inputContract, outputContract,
  execute: async () => ({ ok: true }),
});
assert.throws(() => immutableGateway.configureSkillCompetenceProofVerifier({ skillCompetenceVerifierKeys: new Map() }), /already-configured/);
mutableProof.payload.contract.toolId = 'skill.proof.other';
const immutableResult = await immutableGateway.executeTool(skillId, { query: 'memory' }, 'proof-registration-snapshot');
assert.equal(immutableResult.outcomeClass, 'executed-unverified',
  'mutating a caller-owned proof after registration must not alter the gateway snapshot');

const noProof = new ActionGateway();
let noProofExecutorCalls = 0;
noProof.registerTool({
  id: 'skill.proof.read',
  capability: 'skill-competence-proof-test',
  destructive: false,
  requiresSkillCompetenceProof: true,
  execute: async () => {
    noProofExecutorCalls += 1;
    return { ok: true };
  },
});
const noProofResult = await noProof.executeTool('skill.proof.read', {}, 'proof-required-regression');
assert.equal(noProofResult.outcomeClass, 'competence-insufficient');
assert.equal(noProofExecutorCalls, 0);

console.log('P23_SKILL_COMPETENCE_PROOF=PASS real holdout proposal, signed shadow receipts, evidence revocation, explicit promotion and live ActionGateway admission');
