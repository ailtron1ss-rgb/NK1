import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { TheInventionLoop, buildInventionVerifierManifest, inventionProtocolFingerprint } from '../src/organism/research/TheInventionLoop.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { canonicalOutcomePayload } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';
import { ScientificMethodEngine } from '../src/organism/learning/ScientificMethodEngine.ts';
import { AutonomousScientificBrainSubstrate } from '../src/organism/learning/AutonomousScientificBrainSubstrate.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const protocolFingerprint = inventionProtocolFingerprint;
let now = 1_800_000_000_000;
let sequence = 0;
const nextTime = () => now++;
const verifierIds = ['verifier-primary', 'reviewer-independent', 'verifier-replication', 'verifier-holdout'];
const privateKeys = new Map();
const trustedKeys = new Map();
for (const verifierId of verifierIds) {
  const pair = generateKeyPairSync('ed25519');
  privateKeys.set(verifierId, pair.privateKey);
  trustedKeys.set(verifierId, pair.publicKey.export({ type: 'spki', format: 'pem' }).toString());
}
const resolveKey = verifierId => trustedKeys.get(verifierId);
const loop = new TheInventionLoop(nextTime, () => 'inv-' + (++sequence), resolveKey);
const protocol = {
  question: 'Does the candidate reduce retrieval latency?',
  hypothesis: 'The candidate reduces p95 latency without reducing recall.',
  successCriteria: 'At least 10% improvement against the preregistered baseline.',
  testFingerprint: digest('validation-evaluation-manifest-v1'),
  holdoutTestFingerprint: digest('sealed-holdout-evaluation-manifest-v1'),
  baseline: 100,
  metricScale: 20,
  minEffect: 0.1,
  minSuccessRate: 0.8,
  primarySeed: 17,
  replicationSeeds: [18, 19, 20, 21, 22],
  holdoutSeeds: [23, 24, 25, 26, 27],
  lowerIsBetter: true,
  verifierPlan: {
    primary: 'verifier-primary',
    critique: 'reviewer-independent',
    replication: 'verifier-replication',
    holdout: 'verifier-holdout',
  },
};
assert.throws(
  () => loop.validateProtocol({ ...protocol, holdoutTestFingerprint: protocol.testFingerprint }),
  /invalid-preregistration/,
);
assert.throws(
  () => loop.validateProtocol({ ...protocol, expectedEffect01: Number.NaN }),
  /invalid-preregistration/,
);

function manifestFor(record, phase, seed) {
  return buildInventionVerifierManifest(record.id, record.protocol, phase, seed);
}
function signedArtifact(record, phase, seed, options = {}) {
  const isCritique = phase === 'critique';
  const verifierId = options.verifierId ?? record.protocol.verifierPlan[phase];
  const manifest = manifestFor(record, phase, seed);
  const ledger = new VerifiedOutcomeLedger(manifest);
  const observed = options.observed ?? 96;
  const direction = record.protocol.lowerIsBetter ? -1 : 1;
  const effect01 = Math.max(0, Math.min(1,
    ((observed - record.protocol.baseline) * direction) / record.protocol.metricScale));
  const blockers = options.blockers ?? [];
  const limitations = options.limitations ?? [];
  const evidenceSha256 = options.evidenceSha256 ?? digest('evidence-' + seed);
  const phaseTestFingerprint = phase === 'holdout'
    ? record.protocol.holdoutTestFingerprint : record.protocol.testFingerprint;
  const measurement = isCritique ? {
    contextType: 'invention-critique',
    experimentId: record.id,
    protocolFingerprint: protocolFingerprint(record.protocol),
    prototypeSha256: record.prototypeSha256,
    testFingerprint: record.protocol.testFingerprint,
    reviewRef: options.reviewRef ?? 'review://independent/' + record.id,
    reviewSha256: options.reviewSha256 ?? digest('review-' + record.id),
    blockers,
    limitations,
  } : {
    contextType: 'invention-outcome',
    experimentId: record.id,
    phase,
    protocolFingerprint: protocolFingerprint(record.protocol),
    prototypeSha256: record.prototypeSha256,
    testFingerprint: options.testFingerprint ?? phaseTestFingerprint,
    environmentId: options.environmentId ?? 'environment-' + phase + '-' + seed,
    observed,
    evidenceSha256,
  };
  const payload = {
    schemaVersion: 1,
    artifactId: options.artifactId ?? 'artifact-' + record.id + '-' + phase + '-' + seed,
    runId: options.runId ?? 'run-' + record.id + '-' + phase + '-' + seed,
    manifestFingerprint: ledger.manifestFingerprint(),
    taskId: manifest[0].taskId,
    taskVersion: '1',
    method: phase,
    seed,
    attempt: options.attempt ?? 1,
    passed: isCritique ? blockers.length === 0 : effect01 >= record.protocol.minEffect,
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
function startInvention(instance, proto = protocol) {
  const proposed = instance.propose(proto);
  instance.design(proposed.id);
  return instance.prototype(proposed.id, {
    reference: 'candidate://isolated-prototype/' + proposed.id,
    sha256: digest('prototype-' + proposed.id),
  });
}

// No trusted verifier key means no accepted outcome, even when the payload looks valid.
const noTrust = new TheInventionLoop(nextTime, () => 'no-trust', () => undefined);
const noTrustRecord = startInvention(noTrust);
assert.throws(
  () => noTrust.recordOutcome(noTrustRecord.id, signedArtifact(noTrustRecord, 'primary', 17)),
  /untrusted-verifier-key/,
);
assert.equal(noTrust.snapshot().records[0].outcomes.length, 0);

// A signature covers the measured value, candidate digest and exact preregistration.
const p = startInvention(loop);
const forged = signedArtifact(p, 'primary', 17);
forged.payload.measurement.observed = 99;
assert.throws(() => loop.recordOutcome(p.id, forged), /invalid-signature/);
assert.equal(loop.snapshot().records[0].outcomes.length, 0);
const validPrimary = signedArtifact(p, 'primary', 17, { observed: 96 });
const primary = loop.recordOutcome(p.id, validPrimary);
assert.equal(primary.stage, 'tested');
assert.equal(primary.outcomes[0].effect01, 0.2);
assert.equal(primary.outcomes[0].passed, true);
assert.equal(primary.outcomes[0].signedArtifact.signature, validPrimary.signature);
assert.match(primary.outcomes[0].attestationFingerprint, /^[a-f0-9]{64}$/);
assert.throws(
  () => loop.recordOutcome(p.id, signedArtifact(p, 'primary', 17, { attempt: 2 })),
  /attempt-must-be-one/,
);
assert.throws(
  () => loop.recordOutcome(p.id, signedArtifact(p, 'replication', 18, { verifierId: 'verifier-primary' })),
  /verifier-plan-mismatch/,
);
assert.throws(
  () => loop.critique(p.id, signedArtifact(p, 'critique', 0, { verifierId: 'verifier-primary' })),
  /reviewer-plan-mismatch/,
);

// Critique is signed and bound to reviewer, prototype, protocol and exact review findings.
assert.throws(() => loop.critique(p.id, {
  reviewerId: 'reviewer-independent',
  reviewRef: 'review://unsigned',
  reviewSha256: digest('unsigned-review'),
}), /invalid-critique-payload/);
const critique = signedArtifact(p, 'critique', 0, {
  blockers: [],
  limitations: ['Small preregistered sample; replication is required'],
});
const critiqued = loop.critique(p.id, critique);
assert.equal(critiqued.stage, 'critiqued');
assert.equal(critiqued.critique.reviewerId, 'reviewer-independent');
assert.equal(critiqued.critique.signedArtifact.signature, critique.signature);

// Replayed run IDs are rejected after signature verification.
assert.throws(
  () => loop.recordOutcome(p.id, signedArtifact(p, 'replication', 18, {
    runId: validPrimary.payload.runId,
  })),
  /duplicate-run/,
);

// Five independent, signed replication seeds are required.
for (const [seed, observed] of [[18, 97], [19, 97], [20, 101], [21, 97], [22, 96]]) {
  const result = loop.recordOutcome(p.id, signedArtifact(p, 'replication', seed, { observed }));
  assert.equal(result.stage, seed === 22 ? 'replicated' : 'replicating');
}
assert.throws(
  () => loop.recordOutcome(p.id, signedArtifact(p, 'replication', 18, {
    artifactId: 'artifact-new-duplicate-seed',
    runId: 'run-new-duplicate-seed',
    environmentId: 'environment-new-duplicate-seed',
  })),
  /duplicate-seed/,
);
assert.throws(
  () => loop.recordOutcome(p.id, signedArtifact(p, 'holdout', 23, {
    testFingerprint: p.protocol.testFingerprint,
  })),
  /attestation-context-mismatch/,
);

// Holdout has a different verifier and isolated environments and seed cohort.
assert.throws(
  () => loop.recordOutcome(p.id, signedArtifact(p, 'holdout', 23, {
    environmentId: 'environment-replication-18',
  })),
  /holdout-must-be-independent/,
);
for (const [seed, observed] of [[23, 96], [24, 97], [25, 105], [26, 96], [27, 96]]) {
  const result = loop.recordOutcome(p.id, signedArtifact(p, 'holdout', seed, { observed }));
  assert.equal(result.stage, seed === 27 ? 'accepted' : 'holdingout');
}
assert.equal(loop.metrics().accepted, 1);
assert.equal(loop.metrics().auditVerifiedRecords, 1);
assert.equal(loop.snapshot().records[0].phaseSummaries.replication.successRate01, 0.8);
assert.equal(loop.snapshot().records[0].phaseSummaries.holdout.successRate01, 0.8);
assert.throws(() => loop.reject(p.id, 'late-reject'), /invention-closed/);

// A valid verifier signature cannot turn a worse measured result into an improvement.
const worse = startInvention(loop, {
  ...protocol, testFingerprint: digest('worse-manifest'), primarySeed: 31,
});
const rejected = loop.recordOutcome(worse.id, signedArtifact(worse, 'primary', 31, { observed: 105 }));
assert.equal(rejected.stage, 'rejected');
assert.equal(rejected.outcomes[0].effect01, 0);
assert.equal(rejected.outcomes[0].passed, false);

// The signed receipt is bound to the exact invention and prototype; it cannot be replayed.
const reuse = startInvention(loop, protocol);
assert.throws(() => loop.recordOutcome(reuse.id, validPrimary), /attestation-context-mismatch/);
assert.equal(loop.snapshot().records.find(record => record.id === reuse.id).outcomes.length, 0);

// Signed critique contents cannot be changed after signing.
const blocked = startInvention(loop, {
  ...protocol, testFingerprint: digest('blocked-manifest'), primarySeed: 37,
});
loop.recordOutcome(blocked.id, signedArtifact(blocked, 'primary', 37));
const blockerArtifact = signedArtifact(blocked, 'critique', 0, { blockers: ['unsafe side effect'] });
blockerArtifact.payload.measurement.blockers.push('injected after signature');
assert.throws(() => loop.critique(blocked.id, blockerArtifact), /invalid-signature/);
const validBlocker = signedArtifact(blocked, 'critique', 0, { blockers: ['unsafe side effect'] });
assert.equal(loop.critique(blocked.id, validBlocker).stage, 'rejected');

// A complete cohort still fails if the preregistered success-rate gate is not met.
const weakProtocol = {
  ...protocol,
  testFingerprint: digest('weak-manifest'),
  primarySeed: 47,
  replicationSeeds: [48, 49, 50, 51, 52],
  holdoutSeeds: [53, 54, 55, 56, 57],
};
const weak = startInvention(loop, weakProtocol);
loop.recordOutcome(weak.id, signedArtifact(weak, 'primary', 47));
loop.critique(weak.id, signedArtifact(weak, 'critique', 0));
let weakResult;
for (const [seed, observed] of [[48, 96], [49, 96], [50, 96], [51, 103], [52, 103]]) {
  weakResult = loop.recordOutcome(weak.id, signedArtifact(weak, 'replication', seed, { observed }));
}
assert.equal(weakResult.stage, 'rejected');
assert.equal(weakResult.phaseSummaries.replication.successRate01, 0.6);
assert.equal(weakResult.phaseSummaries.replication.passed, false);

// Restore rechecks both audit-chain integrity and the trusted signatures. Keys remain
// an ephemeral host dependency and never enter the persisted subsystem state.
const snapshot = loop.snapshot();
const untrustedRestore = new TheInventionLoop(nextTime, () => 'untrusted-restore');
untrustedRestore.restore(snapshot);
assert.ok(untrustedRestore.metrics().quarantinedRecords >= 1);
const tampered = structuredClone(snapshot);
const acceptedRecord = tampered.records.find(record => record.stage === 'accepted');
acceptedRecord.protocol.baseline = 50;
tampered.accepted = 999;
const restored = new TheInventionLoop(nextTime, () => 'trusted-restore', resolveKey);
restored.restore(tampered);
assert.equal(restored.metrics().accepted, 0);
assert.ok(restored.metrics().quarantinedRecords >= 1);
assert.ok(restored.metrics().auditVerifiedRecords >= 1);

// The research runtime receives verifier key authority from its host constructor.
const runtime = new EvidenceResearchSubsystemRuntime(resolveKey);
const runtimeRecord = startInvention(runtime.inventionLoop, {
  ...protocol, testFingerprint: digest('runtime-manifest'), primarySeed: 60,
});
assert.equal(
  runtime.inventionLoop.recordOutcome(
    runtimeRecord.id,
    signedArtifact(runtimeRecord, 'primary', 60),
  ).stage,
  'tested',
);

// Intrinsic idea generation is connected to a scientific project and the signed
// invention lifecycle. Only a complete, signed replication cohort may train the
// scientific substrate; the holdout cohort is calibration-only.
const generated = runtime.proposeIntrinsicInvention({
  uncertainty: 0.95,
  predictionError: 0.35,
  novelty: 0.25,
  goals: [],
  successCriteria: 'At least 10% normalized improvement, reproduced on independent seeds.',
  testFingerprint: digest('intrinsic-generator-validation-manifest'),
  holdoutTestFingerprint: digest('intrinsic-generator-holdout-manifest'),
  baseline: 100,
  metricScale: 20,
  minEffect: 0.1,
  expectedEffect01: 0.2,
  minSuccessRate: 0.8,
  primarySeed: 63,
  replicationSeeds: [64, 65, 66, 67, 68],
  holdoutSeeds: [69, 70, 71, 72, 73],
  lowerIsBetter: true,
  verifierPlan: protocol.verifierPlan,
});
assert.ok(generated);
assert.equal(generated.protocol.provenance.source, 'intrinsic');
assert.ok(generated.protocol.provenance.experimentId);
const scientificProjectId = generated.protocol.provenance.scientificProjectId;
assert.ok(runtime.scientificMethod.snapshot().projects.some(project => project.id === scientificProjectId));
runtime.inventionLoop.design(generated.id);
const generatedPrototype = runtime.inventionLoop.prototype(generated.id, {
  reference: 'candidate://generated/' + generated.id,
  sha256: digest('generated-prototype'),
});
assert.equal(runtime.recordInventionOutcome(
  generated.id,
  signedArtifact(generatedPrototype, 'primary', 63),
).stage, 'tested');
assert.equal(runtime.recordInventionCritique(
  generated.id,
  signedArtifact(generatedPrototype, 'critique', 0),
).stage, 'critiqued');
for (const [seed, observed] of [[64, 97], [65, 97], [66, 101], [67, 97], [68, 96]]) {
  runtime.recordInventionOutcome(
    generated.id,
    signedArtifact(generatedPrototype, 'replication', seed, { observed }),
  );
}
assert.equal(runtime.inventionLoop.snapshot().records.find(record => record.id === generated.id).stage, 'replicated');
const trainedAfterReplication = runtime.scientificBrain.diagnostics().acceptedUpdates;
assert.equal(trainedAfterReplication, 1);
let generatedFinal;
for (const [seed, observed] of [[69, 96], [70, 97], [71, 105], [72, 96], [73, 96]]) {
  generatedFinal = runtime.recordInventionOutcome(
    generated.id,
    signedArtifact(generatedPrototype, 'holdout', seed, { observed }),
  );
}
assert.equal(generatedFinal.stage, 'accepted');
assert.equal(runtime.scientificBrain.diagnostics().acceptedUpdates, trainedAfterReplication,
  'holdout evidence must never update the trainable weights');
const scientificProject = runtime.scientificMethod.snapshot().projects.find(project => project.id === scientificProjectId);
assert.ok(scientificProject);
assert.ok(scientificProject.evidence.some(evidence => evidence.includes('invention-holdout:')));
assert.ok(scientificProject.experiments.includes(generated.id));

// Restore preserves verified scientific state while rechecking every signed artifact.
const runtimeSnapshot = runtime.snapshot();
const restoredRuntime = new EvidenceResearchSubsystemRuntime(resolveKey);
restoredRuntime.restore(runtimeSnapshot);
assert.equal(restoredRuntime.inventionLoop.metrics().accepted, 1);
assert.equal(restoredRuntime.scientificBrain.diagnostics().acceptedUpdates, trainedAfterReplication);
assert.ok(restoredRuntime.scientificMethod.snapshot().projects.some(project => project.id === scientificProjectId));

// Dream associations become explicit verification hypotheses, not promoted memories.
const dreamGenerated = runtime.proposeDreamInvention({
  association: {
    id: 'dream-link-01',
    question: 'Do these two episodes share a causal context?',
    confidence: 0.72,
    at: now++,
    sourceMemoryIds: ['memory-episode-a', 'memory-episode-b'],
    sharedTerms: ['location', 'unexpected event'],
    kind: 'association',
    validationStatus: 'candidate',
  },
  goals: [],
  successCriteria: 'Independent observations must corroborate the proposed association.',
  testFingerprint: digest('dream-association-validation-manifest'),
  holdoutTestFingerprint: digest('dream-association-holdout-manifest'),
  baseline: 0,
  metricScale: 1,
  minEffect: 0.1,
  expectedEffect01: 0.25,
  minSuccessRate: 0.8,
  primarySeed: 74,
  replicationSeeds: [75, 76, 77, 78, 79],
  holdoutSeeds: [80, 81, 82, 83, 84],
  verifierPlan: protocol.verifierPlan,
});
assert.ok(dreamGenerated);
assert.equal(dreamGenerated.protocol.provenance.source, 'dream-association');
assert.equal(dreamGenerated.stage, 'proposed');

// Exercise the exact OrganismCore integration seam: a hypothesis and its
// already-created ScientificMethod project are captured without creating a
// duplicate project; evaluation policy is injected later by the trusted host.
const sharedScientificMethod = new ScientificMethodEngine();
const sharedScientificBrain = new AutonomousScientificBrainSubstrate();
const captureRuntime = new EvidenceResearchSubsystemRuntime(resolveKey);
captureRuntime.bindCognitiveSubsystems({
  scientificMethod: sharedScientificMethod,
  scientificBrain: sharedScientificBrain,
});
assert.equal(captureRuntime.scientificMethod, sharedScientificMethod);
assert.equal(captureRuntime.scientificBrain, sharedScientificBrain);
const nativeExperiment = captureRuntime.intrinsicExperimentGenerator.generate({
  uncertainty: 0.96,
  predictionError: 0.2,
  novelty: 0.1,
  goals: [],
});
assert.ok(nativeExperiment);
const preexistingProject = sharedScientificMethod.create(
  nativeExperiment.question,
  nativeExperiment.hypothesis,
  nativeExperiment.action,
  ['experiment:' + nativeExperiment.id],
);
const captured = captureRuntime.captureGeneratedExperiment(nativeExperiment, preexistingProject.id, 101);
assert.equal(captured.status, 'awaiting-preregistration');
assert.equal(sharedScientificMethod.snapshot().projects.length, 1);
assert.equal(captureRuntime.capturedInventionsSnapshot().length, 1);
const coreEvaluationPlan = {
  testFingerprint: digest('core-validation-manifest'),
  holdoutTestFingerprint: digest('core-holdout-manifest'),
  baseline: 100,
  metricScale: 20,
  minEffect: 0.1,
  expectedEffect01: 0.2,
  minSuccessRate: 0.8,
  primarySeed: 102,
  replicationSeeds: [103, 104, 105, 106, 107],
  holdoutSeeds: [108, 109, 110, 111, 112],
  lowerIsBetter: true,
  verifierPlan: protocol.verifierPlan,
};
const coreRegistered = captureRuntime.preregisterCapturedExperiment(captured.id, coreEvaluationPlan);
assert.equal(coreRegistered.protocol.provenance.experimentId, nativeExperiment.id);
assert.equal(coreRegistered.protocol.provenance.scientificProjectId, preexistingProject.id);
assert.equal(sharedScientificMethod.snapshot().projects.length, 1,
  'captured hypotheses must reuse the existing project, not fork a second scientific project');
assert.equal(captureRuntime.capturedInventionsSnapshot()[0].inventionId, coreRegistered.id);

// A malformed or missing host evaluation policy never invents seed/verifier identity.
const pendingAgain = captureRuntime.captureGeneratedExperiment({
  ...nativeExperiment,
  id: nativeExperiment.id + '-pending',
}, preexistingProject.id, 102);
assert.equal(pendingAgain.status, 'awaiting-preregistration');
captureRuntime.markCapturePreregistrationFailure(pendingAgain.id, new Error('missing-evaluator-policy'));
assert.equal(
  captureRuntime.capturedInventionsSnapshot().find(item => item.id === pendingAgain.id).preregistrationError,
  'missing-evaluator-policy',
);

// Late host key configuration matches OrganismCore's constructor ordering.
const lateConfiguredFabric = new OrganismSystemFabric();
lateConfiguredFabric.configureInventionVerifierKeyResolver(resolveKey);
const lateRecord = startInvention(lateConfiguredFabric.research.inventionLoop, {
  ...protocol, testFingerprint: digest('late-fabric-manifest'), primarySeed: 113,
});
assert.equal(
  lateConfiguredFabric.research.inventionLoop.recordOutcome(
    lateRecord.id,
    signedArtifact(lateRecord, 'primary', 113),
  ).stage,
  'tested',
);

// The canonical seven-system composition root forwards host key authority to research.
const fabric = new OrganismSystemFabric({ inventionVerifierKeyResolver: resolveKey });
const fabricRecord = startInvention(fabric.research.inventionLoop, {
  ...protocol, testFingerprint: digest('fabric-manifest'), primarySeed: 62,
});
assert.equal(
  fabric.research.inventionLoop.recordOutcome(
    fabricRecord.id,
    signedArtifact(fabricRecord, 'primary', 62),
  ).stage,
  'tested',
);
const unconfiguredRuntime = new EvidenceResearchSubsystemRuntime();
const unconfiguredRecord = startInvention(unconfiguredRuntime.inventionLoop, {
  ...protocol, testFingerprint: digest('unconfigured-manifest'), primarySeed: 61,
});
assert.throws(
  () => unconfiguredRuntime.inventionLoop.recordOutcome(
    unconfiguredRecord.id,
    signedArtifact(unconfiguredRecord, 'primary', 61),
  ),
  /untrusted-verifier-key/,
);

console.log('THE_INVENTION_LOOP_SIGNED_ATTESTATION=PASS');
