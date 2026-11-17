import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { canonicalOutcomePayload } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { inventionProtocolFingerprint } from '../src/organism/research/TheInventionLoop.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

const digest = value => createHash('sha256').update(String(value)).digest('hex');
const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
};
let now = 1_800_000_000_000;
const nextTime = () => now++;
const actors = {
  discoverer: 'science-discoverer',
  theorist: 'science-theorist',
  experimentalist: 'science-experimentalist',
  replicator: 'science-replicator',
  skeptic: 'science-skeptic',
  auditor: 'science-auditor',
};
const verifierIds = [
  'science-primary-evaluator',
  actors.skeptic,
  actors.replicator,
  'science-holdout-evaluator',
];
const privateKeys = new Map();
const trustedKeys = new Map();
for (const verifierId of verifierIds) {
  const pair = generateKeyPairSync('ed25519');
  privateKeys.set(verifierId, pair.privateKey);
  trustedKeys.set(verifierId, pair.publicKey.export({ type: 'spki', format: 'pem' }).toString());
}
const resolveKey = verifierId => trustedKeys.get(verifierId);
const artifactBytes = new Map();
let revokeTheoristIdentity = false;
const resolveScienceRoleIdentity = (_role, actorId) =>
  revokeTheoristIdentity && actorId === actors.theorist
    ? 'revoked-principal:' + actorId
    : 'principal:' + actorId;
const auditByteChecks = [];
const verifyScienceArtifactBytes = (artifact, context) => {
  if (context.purpose === 'audit') auditByteChecks.push(context);
  const bytes = artifactBytes.get(artifact.reference);
  return typeof bytes === 'string' && digest(bytes) === artifact.sha256;
};
const rememberArtifactBytes = (artifact, bytes) => {
  if (typeof bytes !== 'string' || digest(bytes) !== artifact.sha256) {
    throw new Error('test-artifact-bytes-do-not-match-reference-digest');
  }
  artifactBytes.set(artifact.reference, bytes);
};
const rememberSignedEvidence = artifact => {
  const payloadFingerprint = createHash('sha256')
    .update(canonicalOutcomePayload(artifact.payload))
    .digest('hex');
  const storedBytes = canonical(artifact);
  const storedDigest = digest(storedBytes);
  const measurement = artifact.payload.measurement;
  if (measurement?.contextType === 'invention-critique') {
    const reviewBytes = 'review-' + artifact.payload.measurement.experimentId;
    rememberArtifactBytes({
      reference: measurement.reviewRef,
      sha256: measurement.reviewSha256,
    }, reviewBytes);
    rememberArtifactBytes({
      reference: 'signed-critique:' + artifact.payload.artifactId,
      sha256: storedDigest,
    }, storedBytes);
  } else if (measurement?.contextType === 'invention-outcome') {
    rememberArtifactBytes({
      reference: 'signed-artifact:' + artifact.payload.artifactId + ':sha256:' + payloadFingerprint,
      sha256: storedDigest,
    }, storedBytes);
  }
};
const runtime = new EvidenceResearchSubsystemRuntime(
  resolveKey,
  resolveScienceRoleIdentity,
  verifyScienceArtifactBytes,
);

// Verify the actual organism composition root can inject the host trust
// adapters into its one canonical research subsystem.
const fabric = new OrganismSystemFabric({
  inventionVerifierKeyResolver: resolveKey,
  scienceRoleIdentityResolver: resolveScienceRoleIdentity,
  scienceArtifactBytesVerifier: verifyScienceArtifactBytes,
});
assert.ok(fabric.research.scienceRepublic);
const fabricCase = fabric.research.scienceRepublic.discover({
  title: 'Fabric-level role binding',
  domain: 'composition root',
  observation: 'The organism fabric routes host identity policy to its research runtime.',
  evidence: { reference: 'artifact://science/fabric-discovery.json', sha256: digest('fabric-discovery') },
  actors,
});
assert.equal(fabricCase.trust.roleIdentity, 'host-attested');
const lateConfiguredFabric = new OrganismSystemFabric();
lateConfiguredFabric.configureScienceRoleIdentityResolver(resolveScienceRoleIdentity);
lateConfiguredFabric.configureScienceArtifactBytesVerifier(verifyScienceArtifactBytes);
const lateConfiguredCase = lateConfiguredFabric.research.scienceRepublic.discover({
  title: 'Late-bound fabric trust',
  domain: 'composition root',
  observation: 'Host adapters can be configured after the fabric is constructed.',
  evidence: { reference: 'artifact://science/fabric-late-binding.json', sha256: digest('fabric-late-binding') },
  actors,
});
assert.equal(lateConfiguredCase.trust.roleIdentity, 'host-attested');

assert.ok(runtime.scienceRepublic, 'EvidenceResearchSubsystemRuntime owns the Science Republic');
assert.equal(runtime.scienceRepublic.inventionLoop, runtime.inventionLoop,
  'Science Republic must not create a second experiment engine');
assert.equal(runtime.snapshot().scienceRepublic.version, 1);

const generated = runtime.intrinsicExperimentGenerator.generate({
  uncertainty: 0.96,
  predictionError: 0.2,
  novelty: 0.1,
  goals: [],
});
assert.ok(generated);
const project = runtime.scientificMethod.create(
  generated.question,
  generated.hypothesis,
  generated.action,
  ['intrinsic-experiment', 'tick:101', 'experiment:' + generated.id],
);
const captured = runtime.captureGeneratedExperiment(generated, project.id, 101);
assert.equal(captured.status, 'awaiting-preregistration');

const science = runtime.openScienceCaseFromCapturedCandidate({
  candidateId: captured.id,
  domain: 'memory retrieval',
  observation: 'An independent observer captured a lower p95 latency on a frozen workload.',
  evidence: { reference: 'artifact://science/discovery.json', sha256: digest('discovery') },
  actors,
});
rememberArtifactBytes(science.discoveryEvidence, 'discovery');
assert.equal(science.stage, 'discovered');
assert.equal(science.trust.roleIdentity, 'host-attested');
assert.equal(science.trust.artifactBytesVerified, false);
assert.equal(Object.keys(science.trust.roleSubjects).length, 6);
assert.equal(science.candidate.experimentId, generated.id);
assert.equal(runtime.scientificMethod.snapshot().projects.length, 1,
  'Science Republic must reuse the existing ScientificMethod project');
assert.throws(() => runtime.scienceRepublic.discover({
  title: captured.question,
  domain: 'memory retrieval',
  observation: 'Attempt to inject a fabricated candidate through the lower-level discovery API.',
  evidence: { reference: 'artifact://science/forged-candidate.json', sha256: digest('forged-candidate') },
  actors,
  candidate: { ...captured, candidateFingerprint: digest('forged-candidate-fingerprint') },
}), /science-captured-candidate-not-host-owned/,
'a candidate must be verified against the runtime capture owner even through direct discover()');
assert.throws(() => runtime.openScienceCaseFromCapturedCandidate({
  candidateId: captured.id,
  domain: 'memory retrieval',
  observation: 'Duplicate admission must be refused.',
  evidence: { reference: 'artifact://science/duplicate-discovery.json', sha256: digest('duplicate') },
  actors,
}), /science-candidate-already-admitted/);

// Dream-derived candidates are also fingerprinted against their source-memory,
// dream and linked-goal markers in the already-existing ScientificMethod project.
const dreamExperiment = runtime.intrinsicExperimentGenerator.fromDreamAssociation({
  id: 'dream-capture-01',
  question: 'Do these two episodes share a causal context?',
  confidence: 0.72,
  at: nextTime(),
  sourceMemoryIds: ['memory-episode-a', 'memory-episode-b'],
  sharedTerms: ['location', 'unexpected event'],
  kind: 'association',
  validationStatus: 'candidate',
}, [{ id: 'goal-dream-replication', source: 'intrinsic' }]);
assert.ok(dreamExperiment);
const dreamSources = [
  'intrinsic-experiment',
  'tick:102',
  'experiment:' + dreamExperiment.id,
  'goal:' + dreamExperiment.linkedGoal,
  'dream-association',
  'dream:' + dreamExperiment.dreamId,
  ...(dreamExperiment.sourceMemoryIds ?? []).map(id => 'source-memory:' + id),
];
const dreamProject = runtime.scientificMethod.create(
  dreamExperiment.question,
  dreamExperiment.hypothesis,
  dreamExperiment.action,
  dreamSources,
);
const dreamCaptured = runtime.captureGeneratedExperiment(dreamExperiment, dreamProject.id, 102);
const dreamScience = runtime.openScienceCaseFromCapturedCandidate({
  candidateId: dreamCaptured.id,
  domain: 'episodic memory',
  observation: 'A dream subsystem linked two stored episodic memories for independent testing.',
  evidence: {
    reference: 'artifact://science/dream-discovery.json',
    sha256: digest('dream-discovery'),
  },
  actors,
});
rememberArtifactBytes(dreamScience.discoveryEvidence, 'dream-discovery');
assert.equal(dreamScience.candidate.source, 'dream-association');
assert.equal(dreamScience.candidate.linkedGoal, 'goal-dream-replication');
assert.equal(dreamScience.stage, 'discovered');

assert.throws(() => runtime.scienceRepublic.discover({
  title: 'Role collision',
  domain: 'systems',
  observation: 'Invalid role roster',
  evidence: { reference: 'artifact://science/role-collision.json', sha256: digest('collision') },
  actors: { ...actors, auditor: actors.discoverer },
}), /science-roles-must-have-distinct-actors/);
const duplicatePrincipalRuntime = new EvidenceResearchSubsystemRuntime(
  resolveKey,
  () => 'one-shared-principal',
);
assert.throws(() => duplicatePrincipalRuntime.scienceRepublic.discover({
  title: 'Attested identity collision',
  domain: 'systems',
  observation: 'Host identity resolver maps all role IDs to one principal.',
  evidence: { reference: 'artifact://science/identity-collision.json', sha256: digest('identity-collision') },
  actors,
}), /science-role-identities-must-be-distinct/);

const theoryInput = {
  actorId: actors.theorist,
  mechanism: 'A bounded candidate index reduces the number of comparisons.',
  predictions: ['p95 latency decreases on the frozen workload'],
  falsifiers: ['p95 latency does not decrease on the frozen workload'],
  alternatives: ['cache warm-up accounts for the observed change'],
  evidence: { reference: 'artifact://science/theory.json', sha256: digest('theory') },
};
revokeTheoristIdentity = true;
assert.throws(
  () => runtime.scienceRepublic.theorize(science.id, theoryInput),
  /science-role-identity-binding-changed/,
  'a revoked host principal must not continue acting under the old actor ID',
);
revokeTheoristIdentity = false;
const theory = runtime.scienceRepublic.theorize(science.id, theoryInput);
rememberArtifactBytes(theory.theory.evidence, 'theory');
assert.equal(theory.stage, 'theorized');

const replicationSeeds = Array.from({ length: 12 }, (_, index) => 11 + index);
const holdoutSeeds = Array.from({ length: 12 }, (_, index) => 23 + index);
const evaluation = {
  successCriteria: 'At least ten percent normalized latency improvement, replicated independently.',
  testFingerprint: digest('science-validation-manifest'),
  holdoutTestFingerprint: digest('science-sealed-holdout-manifest'),
  baseline: 100,
  metricScale: 20,
  minEffect: 0.1,
  expectedEffect01: 0.2,
  minSuccessRate: 0.8,
  primarySeed: 10,
  replicationSeeds,
  holdoutSeeds,
  lowerIsBetter: true,
  verifierPlan: {
    primary: verifierIds[0],
    critique: actors.skeptic,
    replication: actors.replicator,
    holdout: verifierIds[3],
  },
};
const manifest = {
  reference: 'artifact://science/test-manifest.json',
  sha256: evaluation.testFingerprint,
};
const holdoutManifest = {
  reference: 'artifact://science/holdout-manifest.json',
  sha256: evaluation.holdoutTestFingerprint,
};
rememberArtifactBytes(manifest, 'science-validation-manifest');
rememberArtifactBytes(holdoutManifest, 'science-sealed-holdout-manifest');

const duplicateRunnerEvaluation = {
  ...evaluation,
  testFingerprint: digest('invalid-shared-runner'),
  holdoutTestFingerprint: digest('invalid-shared-runner-holdout'),
  verifierPlan: {
    ...evaluation.verifierPlan,
    holdout: evaluation.verifierPlan.primary,
  },
};
assert.throws(() => runtime.registerScienceRepublicExperiment(science.id, {
  actorId: actors.experimentalist,
  evaluation: duplicateRunnerEvaluation,
  manifest: { reference: 'artifact://science/invalid-primary.json', sha256: duplicateRunnerEvaluation.testFingerprint },
  holdoutManifest: { reference: 'artifact://science/invalid-holdout.json', sha256: duplicateRunnerEvaluation.holdoutTestFingerprint },
}), /invalid-preregistration|science-evaluators-must-be-distinct/);
assert.equal(runtime.inventionLoop.snapshot().records.length, 0,
  'invalid evaluator separation must fail before creating a canonical invention');

const badHoldoutManifest = {
  reference: 'artifact://science/wrong-holdout-manifest.json',
  sha256: digest('wrong-holdout'),
};
assert.throws(() => runtime.registerScienceRepublicExperiment(science.id, {
  actorId: actors.experimentalist,
  evaluation,
  manifest,
  holdoutManifest: badHoldoutManifest,
}), /science-frozen-manifest-fingerprint-mismatch/);
assert.equal(runtime.inventionLoop.snapshot().records.length, 0,
  'manifest mismatch must fail before preregistration');

const registered = runtime.registerScienceRepublicExperiment(science.id, {
  actorId: actors.experimentalist,
  evaluation,
  manifest,
  holdoutManifest,
});
assert.equal(registered.stage, 'registered');
assert.equal(registered.inventionStage, 'designed');
assert.equal(runtime.inventionLoop.snapshot().records.length, 1);
assert.equal(runtime.inventionLoop.snapshot().records[0].protocol.provenance.experimentId, generated.id);
assert.equal(runtime.inventionLoop.snapshot().records[0].protocol.provenance.scientificProjectId, project.id);

assert.throws(() => runtime.scienceRepublic.attachPrototype(science.id, {
  actorId: actors.theorist,
  reference: 'artifact://science/wrong-prototype-owner.bin',
  sha256: digest('wrong-owner'),
}), /science-experimentalist-role-mismatch/);

const prototype = runtime.scienceRepublic.attachPrototype(science.id, {
  actorId: actors.experimentalist,
  reference: 'artifact://science/prototype.bin',
  sha256: digest('science-prototype'),
});
rememberArtifactBytes(prototype.prototype, 'science-prototype');
assert.equal(prototype.stage, 'prototyped');

function signedArtifact(invention, phase, seed, options = {}) {
  const isCritique = phase === 'critique';
  const verifierId = options.verifierId ?? invention.protocol.verifierPlan[phase];
  const manifestRows = runtime.inventionLoop.verifierManifest(invention.id, phase, seed);
  const ledger = new VerifiedOutcomeLedger(manifestRows);
  const observed = options.observed ?? 96;
  const direction = invention.protocol.lowerIsBetter ? -1 : 1;
  const effect01 = Math.max(0, Math.min(1,
    ((observed - invention.protocol.baseline) * direction) / invention.protocol.metricScale));
  const blockers = options.blockers ?? [];
  const limitations = options.limitations ?? [];
  const evidenceSha256 = options.evidenceSha256 ?? digest('evidence-' + phase + '-' + seed);
  const testFingerprint = phase === 'holdout'
    ? invention.protocol.holdoutTestFingerprint
    : invention.protocol.testFingerprint;
  const measurement = isCritique ? {
    contextType: 'invention-critique',
    experimentId: invention.id,
    protocolFingerprint: inventionProtocolFingerprint(invention.protocol),
    prototypeSha256: invention.prototypeSha256,
    testFingerprint: invention.protocol.testFingerprint,
    reviewRef: options.reviewRef ?? 'review://science/' + invention.id,
    reviewSha256: options.reviewSha256 ?? digest('review-' + invention.id),
    blockers,
    limitations,
  } : {
    contextType: 'invention-outcome',
    experimentId: invention.id,
    phase,
    protocolFingerprint: inventionProtocolFingerprint(invention.protocol),
    prototypeSha256: invention.prototypeSha256,
    testFingerprint,
    environmentId: options.environmentId ?? 'environment-' + phase + '-' + seed,
    observed,
    evidenceSha256,
  };
  const payload = {
    schemaVersion: 1,
    artifactId: options.artifactId ?? 'artifact-' + invention.id + '-' + phase + '-' + seed,
    runId: options.runId ?? 'run-' + invention.id + '-' + phase + '-' + seed,
    manifestFingerprint: ledger.manifestFingerprint(),
    taskId: manifestRows[0].taskId,
    taskVersion: '1',
    method: phase,
    seed,
    attempt: 1,
    passed: isCritique ? blockers.length === 0 : effect01 >= invention.protocol.minEffect,
    verifierId,
    observedAt: nextTime(),
    measurement,
  };
  return {
    payload,
    signature: sign(
      null,
      Buffer.from(canonicalOutcomePayload(payload), 'utf8'),
      privateKeys.get(verifierId),
    ).toString('base64'),
  };
}

const invention = runtime.inventionLoop.snapshot().records.find(row => row.id === registered.inventionId);
assert.ok(invention);
const primaryArtifact = signedArtifact(invention, 'primary', evaluation.primarySeed);
const tamperedPrimary = structuredClone(primaryArtifact);
tamperedPrimary.payload.measurement.observed = 99;
assert.throws(() => runtime.scienceRepublic.recordOutcome(science.id, tamperedPrimary), /invalid-signature/);
assert.equal(runtime.inventionLoop.snapshot().records[0].outcomes.length, 0);

const primary = runtime.scienceRepublic.recordOutcome(science.id, primaryArtifact);
assert.equal(primary.stage, 'tested');
assert.equal(primary.trust.signedEvidence, 'canonical-invention-loop-verified');

assert.throws(() => runtime.scienceRepublic.critique(science.id, {
  actorId: actors.experimentalist,
  artifact: signedArtifact(invention, 'critique', 0),
}), /science-skeptic-role-mismatch/);

const critiqueArtifact = signedArtifact(invention, 'critique', 0, {
  blockers: [],
  limitations: ['The full device soak is a separate follow-up evaluation.'],
});
rememberSignedEvidence(critiqueArtifact);
const critiqued = runtime.scienceRepublic.critique(science.id, {
  actorId: actors.skeptic,
  artifact: critiqueArtifact,
});
assert.equal(critiqued.stage, 'critiqued');

const replicationBefore = runtime.scientificBrain.diagnostics().acceptedUpdates;
for (const seed of replicationSeeds) {
  const artifact = signedArtifact(invention, 'replication', seed);
  rememberSignedEvidence(artifact);
  const result = runtime.scienceRepublic.recordOutcome(science.id, artifact);
  assert.ok(['replicating', 'replicated'].includes(result.stage));
}
const afterReplication = runtime.scientificBrain.diagnostics().acceptedUpdates;
assert.equal(afterReplication, replicationBefore + 1,
  'a completed independently signed replication cohort reaches the existing scientific brain');
assert.equal(runtime.scienceRepublic.get(science.id).stage, 'replicated');

for (const seed of holdoutSeeds) {
  const artifact = signedArtifact(invention, 'holdout', seed);
  rememberSignedEvidence(artifact);
  const result = runtime.scienceRepublic.recordOutcome(science.id, artifact);
  assert.ok(['holdingout', 'awaiting-audit'].includes(result.stage));
}
assert.equal(runtime.scienceRepublic.get(science.id).stage, 'awaiting-audit');
assert.equal(runtime.scientificBrain.diagnostics().acceptedUpdates, afterReplication,
  'holdout remains calibration-only and cannot update trainable weights');

const terminalInvention = runtime.inventionLoop.snapshot().records.find(row => row.id === registered.inventionId);
const checkedArtifacts = [
  science.discoveryEvidence,
  theory.theory.evidence,
  registered.manifest,
  registered.holdoutManifest,
  prototype.prototype,
  ...terminalInvention.outcomes.map(outcome => ({
    reference: outcome.evidenceRef,
    sha256: outcome.attestationFingerprint,
  })),
  {
    reference: terminalInvention.critique.reviewRef,
    sha256: terminalInvention.critique.reviewSha256,
  },
  {
    reference: 'signed-critique:' + terminalInvention.critique.artifactId,
    sha256: terminalInvention.critique.attestationFingerprint,
  },
];

assert.throws(() => runtime.scienceRepublic.audit(science.id, {
  actorId: actors.auditor,
  auditRef: 'audit://science/incomplete',
  auditSha256: digest('audit-incomplete'),
  checkedArtifacts: checkedArtifacts.slice(1),
}), /science-audit-manifest-incomplete-or-mismatched/);

const auditRef = 'audit://science-republic/' + science.id;
const auditSha256 = digest('audit-' + science.id);
rememberArtifactBytes({ reference: auditRef, sha256: auditSha256 }, 'audit-' + science.id);
const audited = runtime.scienceRepublic.audit(science.id, {
  actorId: actors.auditor,
  auditRef,
  auditSha256,
  checkedArtifacts,
  blockers: [],
  limitations: ['Actor identities remain declared rather than host-attested.'],
});
assert.equal(audited.stage, 'audit-complete');
assert.equal(audited.audit.result, 'byte-verified');
assert.equal(audited.audit.artifactBytesVerified, true);
assert.equal(audited.audit.signedEvidenceCount, 26);
assert.equal(auditByteChecks[0].actorRole, 'auditor');
assert.equal(auditByteChecks[0].actorId, actors.auditor);
assert.equal(auditByteChecks[0].actorSubject, 'principal:' + actors.auditor,
  'host artifact verification receives the canonical Auditor principal');
assert.equal(audited.trust.roleIdentity, 'host-attested');
assert.equal(audited.trust.signedEvidence, 'canonical-invention-loop-verified');
assert.equal(audited.trust.artifactBytesVerified, true);
assert.equal(runtime.scienceRepublic.metrics().hostAttestedRecords, 1);
assert.equal(runtime.scienceRepublic.metrics().byteVerifiedAudits, 1);
assert.equal(audited.trust.independentlyVerified, false);
assert.equal(audited.trust.promotionEligible, false);
assert.equal(audited.auditTrail.length, 31,
  'the maximum 12+12 preregistered cohorts fit within the bounded role-protocol audit history');

// A failed primary experiment remains rejected after the Auditor checks its
// complete, byte-verified record. Audit completion must never turn rejection
// into acceptance or make the candidate promotion-eligible.
const rejectedCase = runtime.scienceRepublic.discover({
  title: 'A failed candidate remains rejected after audit',
  domain: 'negative control',
  observation: 'The measured latency regressed on the preregistered workload.',
  evidence: {
    reference: 'artifact://science/rejected-discovery.json',
    sha256: digest('rejected-discovery'),
  },
  actors,
});
rememberArtifactBytes(rejectedCase.discoveryEvidence, 'rejected-discovery');
const rejectedTheory = runtime.scienceRepublic.theorize(rejectedCase.id, {
  actorId: actors.theorist,
  mechanism: 'The candidate changes the retrieval path and may increase p95 latency.',
  predictions: ['p95 latency increases under the frozen workload'],
  falsifiers: ['p95 latency does not increase under the frozen workload'],
  alternatives: ['the baseline workload was misconfigured'],
  evidence: {
    reference: 'artifact://science/rejected-theory.json',
    sha256: digest('rejected-theory'),
  },
});
rememberArtifactBytes(rejectedTheory.theory.evidence, 'rejected-theory');
const rejectedEvaluation = {
  ...evaluation,
  successCriteria: 'At least ten percent normalized latency improvement.',
  testFingerprint: digest('rejected-validation-manifest'),
  holdoutTestFingerprint: digest('rejected-sealed-holdout-manifest'),
  primarySeed: 301,
  replicationSeeds: [302, 303, 304, 305, 306],
  holdoutSeeds: [307, 308, 309, 310, 311],
};
const rejectedManifest = {
  reference: 'artifact://science/rejected-validation-manifest.json',
  sha256: rejectedEvaluation.testFingerprint,
};
const rejectedHoldoutManifest = {
  reference: 'artifact://science/rejected-holdout-manifest.json',
  sha256: rejectedEvaluation.holdoutTestFingerprint,
};
rememberArtifactBytes(rejectedManifest, 'rejected-validation-manifest');
rememberArtifactBytes(rejectedHoldoutManifest, 'rejected-sealed-holdout-manifest');
const rejectedRegistered = runtime.registerScienceRepublicExperiment(rejectedCase.id, {
  actorId: actors.experimentalist,
  evaluation: rejectedEvaluation,
  manifest: rejectedManifest,
  holdoutManifest: rejectedHoldoutManifest,
});
const rejectedPrototype = runtime.scienceRepublic.attachPrototype(rejectedCase.id, {
  actorId: actors.experimentalist,
  reference: 'artifact://science/rejected-prototype.bin',
  sha256: digest('rejected-prototype'),
});
rememberArtifactBytes(rejectedPrototype.prototype, 'rejected-prototype');
const rejectedInvention = runtime.inventionLoop.snapshot().records.find(
  record => record.id === rejectedRegistered.inventionId,
);
assert.ok(rejectedInvention);
const failedPrimary = signedArtifact(rejectedInvention, 'primary', rejectedEvaluation.primarySeed, {
  observed: 120,
});
rememberSignedEvidence(failedPrimary);
const failedScienceRecord = runtime.scienceRepublic.recordOutcome(rejectedCase.id, failedPrimary);
assert.equal(failedScienceRecord.stage, 'rejected');
assert.equal(runtime.inventionLoop.metrics().rejected, 1);

const canonicalRejectedInvention = runtime.inventionLoop.snapshot().records.find(
  record => record.id === rejectedRegistered.inventionId,
);
const rejectedCheckedArtifacts = [
  rejectedCase.discoveryEvidence,
  rejectedTheory.theory.evidence,
  rejectedRegistered.manifest,
  rejectedRegistered.holdoutManifest,
  rejectedPrototype.prototype,
  {
    reference: canonicalRejectedInvention.outcomes[0].evidenceRef,
    sha256: digest(canonicalRejectedInvention.outcomes[0].signedArtifact),
  },
];
const rejectedAuditRef = 'audit://science-republic/rejected/' + rejectedCase.id;
const rejectedAuditSha = digest('audit-rejected-' + rejectedCase.id);
rememberArtifactBytes(
  { reference: rejectedAuditRef, sha256: rejectedAuditSha },
  'audit-rejected-' + rejectedCase.id,
);
const rejectedAudited = runtime.scienceRepublic.audit(rejectedCase.id, {
  actorId: actors.auditor,
  auditRef: rejectedAuditRef,
  auditSha256: rejectedAuditSha,
  checkedArtifacts: rejectedCheckedArtifacts,
  blockers: [],
  limitations: ['The primary signed measurement failed its preregistered effect threshold.'],
});
assert.equal(rejectedAudited.stage, 'rejected');
assert.equal(rejectedAudited.audit.result, 'blocked');
assert.equal(rejectedAudited.audit.artifactBytesVerified, true);
assert.equal(rejectedAudited.trust.artifactBytesVerified, true);
assert.equal(rejectedAudited.trust.independentlyVerified, false);
assert.equal(rejectedAudited.trust.promotionEligible, false);
assert.equal(runtime.scienceRepublic.metrics().artifactByteVerifiedAudits, 2);
assert.equal(runtime.scienceRepublic.metrics().blockedAudits, 1);
assert.equal(runtime.scienceRepublic.metrics().promotionEligible, 0);

const snapshot = runtime.snapshot();
const restored = new EvidenceResearchSubsystemRuntime(
  resolveKey,
  resolveScienceRoleIdentity,
  verifyScienceArtifactBytes,
);
restored.restore(snapshot);
assert.equal(restored.inventionLoop.metrics().accepted, 1);
assert.equal(restored.inventionLoop.metrics().rejected, 1);
assert.equal(restored.scienceRepublic.get(science.id).stage, 'audit-complete');
assert.equal(restored.scienceRepublic.get(rejectedCase.id).stage, 'rejected');
assert.equal(restored.scienceRepublic.get(rejectedCase.id).audit.result, 'blocked');
assert.equal(restored.scienceRepublic.metrics().quarantinedRecords, 0);
assert.equal(restored.scientificBrain.diagnostics().acceptedUpdates, afterReplication);
const restoreWithoutIdentityAuthority = new EvidenceResearchSubsystemRuntime(resolveKey);
restoreWithoutIdentityAuthority.restore(snapshot);
assert.equal(restoreWithoutIdentityAuthority.scienceRepublic.metrics().total, 0);
assert.equal(restoreWithoutIdentityAuthority.scienceRepublic.metrics().quarantinedRecords, 3,
  'all records declaring host-attested role identities must be reauthenticated by the host on restore');

const restoreWithoutByteVerifier = new EvidenceResearchSubsystemRuntime(
  resolveKey,
  resolveScienceRoleIdentity,
);
restoreWithoutByteVerifier.restore(snapshot);
assert.equal(restoreWithoutByteVerifier.scienceRepublic.metrics().total, 1);
assert.equal(restoreWithoutByteVerifier.scienceRepublic.metrics().quarantinedRecords, 2);
assert.equal(restoreWithoutByteVerifier.scienceRepublic.get(dreamScience.id).stage, 'discovered',
  'an un-audited draft does not claim byte verification and remains restorable without an artifact-store verifier');

// Recompute the unkeyed local event chain after forging the projection's audit
// manifest. Restore must still reject it because the canonical signed Invention
// record does not match the forged reference/hash list.
const rehashedSnapshot = runtime.snapshot();
const projectedRecord = rehashedSnapshot.scienceRepublic.records.find(
  record => record.id === science.id,
);
projectedRecord.audit.checkedArtifacts[0].sha256 = digest('forged-audit-reference-hash');
const { auditTrail: projectedTrail, ...projectedCore } = projectedRecord;
projectedTrail[projectedTrail.length - 1].snapshot = structuredClone(projectedCore);
let previousHash = '0'.repeat(64);
for (const event of projectedTrail) {
  event.previousHash = previousHash;
  event.hash = digest(canonical({
    sequence: event.sequence,
    action: event.action,
    at: event.at,
    previousHash,
    snapshot: event.snapshot,
  }));
  previousHash = event.hash;
}
const quarantined = new EvidenceResearchSubsystemRuntime(
  resolveKey,
  resolveScienceRoleIdentity,
  verifyScienceArtifactBytes,
);
quarantined.restore(rehashedSnapshot);
assert.equal(quarantined.scienceRepublic.metrics().total, 2);
assert.equal(quarantined.scienceRepublic.metrics().quarantinedRecords, 1);
assert.equal(quarantined.scienceRepublic.get(rejectedCase.id).stage, 'rejected');
assert.equal(quarantined.scienceRepublic.get(dreamScience.id).stage, 'discovered',
  'other valid studies remain intact when one projection is quarantined');

assert.equal(quarantined.inventionLoop.metrics().accepted, 1,
  'a corrupt Science Republic projection must not delete the canonical signed invention');

// Even after recomputing the local hash chain, a forged captured-candidate
// fingerprint cannot be restored unless it matches the runtime-owned capture
// and its still-existing ScientificMethod project.
const forgedCandidateSnapshot = runtime.snapshot();
const forgedCandidateRecord = forgedCandidateSnapshot.scienceRepublic.records.find(
  record => record.id === science.id,
);
const forgedRuntimeCapture = forgedCandidateSnapshot.capturedInventions.find(
  candidate => candidate.id === forgedCandidateRecord.candidate.id,
);
const forgedFingerprint = digest('forged-runtime-capture-fingerprint');
forgedRuntimeCapture.candidateFingerprint = forgedFingerprint;
forgedCandidateRecord.candidate.candidateFingerprint = forgedFingerprint;
const { auditTrail: candidateTrail, ...candidateCore } = forgedCandidateRecord;
candidateTrail[candidateTrail.length - 1].snapshot = structuredClone(candidateCore);
previousHash = '0'.repeat(64);
for (const event of candidateTrail) {
  event.previousHash = previousHash;
  event.hash = digest(canonical({
    sequence: event.sequence,
    action: event.action,
    at: event.at,
    previousHash,
    snapshot: event.snapshot,
  }));
  previousHash = event.hash;
}
const candidateQuarantine = new EvidenceResearchSubsystemRuntime(
  resolveKey,
  resolveScienceRoleIdentity,
  verifyScienceArtifactBytes,
);
candidateQuarantine.restore(forgedCandidateSnapshot);
assert.equal(candidateQuarantine.scienceRepublic.metrics().total, 2);
assert.equal(candidateQuarantine.scienceRepublic.metrics().quarantinedRecords, 1);
assert.equal(candidateQuarantine.scienceRepublic.get(rejectedCase.id).stage, 'rejected');
assert.equal(candidateQuarantine.scienceRepublic.get(dreamScience.id).stage, 'discovered',
  'coordinated capture-list and projection tampering still cannot counterfeit source provenance');

console.log('SCIENCE_REPUBLIC=PASS roles+host-captured-candidate+signed-outcomes+replication+holdout+accepted-and-rejected-audits+restore');
