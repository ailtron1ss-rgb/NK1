import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { isAuthenticVerifiedSkillPromotionProposal, proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { withIndependentCandidateEvaluation } from '../src/organism/learning/P23IndependentEvaluationProvider.ts';

const previousNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  assert.throws(() => new OrganismRuntime({
    stateFile: '/tmp/nk-workpass224-state.json',
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    journal: new BoundedOperationalJournal(),
    enableLanguage: false,
    compoundRepairRevision: {
      // The production guard must reject missing independent authorities before
      // trying to inspect or invoke the candidate store or provider.
      engine: {},
      provideInputs: async () => { throw new Error('provider must not be called'); },
    },
  }), /production-compound-repair-revision-requires-independent-evaluation-authority/);
  assert.throws(
    () => withIndependentCandidateEvaluation(async () => ({}), () => ({})),
    /production-independent-evaluation-canonical-source-resolver-required/,
    'production must require canonical active/source payload resolution before a provider wrapper can be built',
  );
  // Use a genuine issuer-created proposal so this case reaches the distinct
  // experiment-authority guard rather than being rejected earlier for forged input.
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const trustedKeys = new Map([['verifier-v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const manifest = Array.from({ length: 10 }, (_, i) => ({
    taskId: 'task-' + i, family: i < 5 ? 'memory' : 'tool-use', split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('unique prompt ' + i),
    verifierId: 'verifier-v1', version: 'v1',
  }));
  const ledger = new VerifiedOutcomeLedger(manifest);
  function recordSigned(taskId, method, seed, passed) {
    const task = manifest.find(entry => entry.taskId === taskId);
    const payload = {
      schemaVersion: 1, artifactId: 'artifact-' + taskId + '-' + method + '-' + seed,
      runId: 'run-' + method + '-' + seed, manifestFingerprint: ledger.manifestFingerprint(),
      taskId, taskVersion: task.version, method, seed, attempt: 1, passed,
      verifierId: task.verifierId, observedAt: Date.now(),
    };
    return ingestSignedOutcomeArtifact(
      ledger, manifest, signOutcomePayloadForFixture(payload, privateKeyPem), trustedKeys,
    );
  }
  for (let seed = 1; seed <= 5; seed++) for (let i = 0; i < 10; i++) {
    assert.equal(recordSigned('task-' + i, 'baseline', seed, i < 6).accepted, true);
    assert.equal(recordSigned('task-' + i, 'candidate', seed, i < 8).accepted, true);
  }
  const authenticProposal = proposeVerifiedSkillPromotion(
    ledger, 'baseline', 'candidate', { minPairedTasks: 8, minAbsoluteGain: .1, minCompleteSeeds: 3 },
  );
  assert.equal(authenticProposal.gate.accepted, true);
  assert.equal(isAuthenticVerifiedSkillPromotionProposal(authenticProposal), true);

  const evaluationConfig = () => ({
    tasks: [],
    environmentFingerprint: 'f'.repeat(64),
    executor: { async execute() { return { runId: 'untrusted', observedStepIds: [] }; } },
    verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: [] }; } },
    safetyScanner: { async scan() { return { violationCount: 0 }; } },
    // Deliberately omit experimentAuthority while retaining the other shaped services.
  });
  const resolverOptions = {
    resolveCanonicalPayloads: () => ({
      baselinePayload: { source: 'canonical-baseline' },
      sourceCandidatePayload: { source: 'canonical-candidate' },
    }),
  };
  const forgedProvider = withIndependentCandidateEvaluation(
    async () => ({
      proposal: { proposalId: 'forged-production-proposal' },
      sourceCandidateId: 'production-source',
      baseline: { validation: [], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      generate: async () => ({ payload: { version: 1 } }),
      evaluateRevisedCandidate: async () => ({ validation: [], holdout: [] }),
    }),
    evaluationConfig, resolverOptions,
  );
  await assert.rejects(
    () => forgedProvider({ skillId: 'skill', repairFingerprints: [], repairEvidence: [] }),
    /production-independent-evaluation-authentic-proposal-required/,
  );
  const productionProvider = withIndependentCandidateEvaluation(
    async () => ({
      proposal: authenticProposal,
      sourceCandidateId: 'production-source',
      baseline: { validation: [], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      generate: async () => ({ payload: { version: 1 } }),
      evaluateRevisedCandidate: async () => ({ validation: [], holdout: [] }),
    }),
    evaluationConfig, resolverOptions,
  );
  await assert.rejects(
    () => productionProvider({ skillId: 'skill', repairFingerprints: [], repairEvidence: [] }),
    /production-independent-evaluation-experiment-authority-required/,
  );
  console.log('WorkPass224/226 production independent-evaluation authority requirements: PASS');
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}
