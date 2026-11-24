import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
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
  const productionProvider = withIndependentCandidateEvaluation(
    async () => ({
      proposal: { proposalId: 'production-proposal' },
      sourceCandidateId: 'production-source',
      baseline: { validation: [], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      generate: async () => ({ payload: { version: 1 } }),
      evaluateRevisedCandidate: async () => ({ validation: [], holdout: [] }),
    }),
    () => ({
      tasks: [],
      environmentFingerprint: 'f'.repeat(64),
      executor: { async execute() { return { runId: 'untrusted', observedStepIds: [] }; } },
      verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: [] }; } },
      safetyScanner: { async scan() { return { violationCount: 0 }; } },
      // Deliberately omit experimentAuthority: production must reject this
      // even though the executor/verifier/scanner-shaped interfaces exist.
    }),
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
