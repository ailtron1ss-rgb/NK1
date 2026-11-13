import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const root = process.cwd();
const runtimeSource = readFileSync(resolve(root, 'src/organism/core/OrganismRuntime.ts'), 'utf8');
const providerSource = readFileSync(resolve(root, 'src/organism/learning/P23IndependentEvaluationProvider.ts'), 'utf8');
const coordinatorSource = readFileSync(resolve(root, 'src/organism/learning/P23CompoundRepairRevisionCoordinator.ts'), 'utf8');

assert.match(runtimeSource, /validationOnlyEvaluationConfigForRepair\?:/);
assert.match(runtimeSource, /populationSearchBudget\?:/);
assert.match(runtimeSource, /withIndependentCandidateEvaluation\([\s\S]*?validationOnlyEvaluationConfigForRepair[\s\S]*?populationSearchBudget/);
assert.match(runtimeSource, /validation-only-population-search-requires-independent-final-evaluation-authority/);
assert.match(providerSource, /createValidationOnlySkillCandidateEvaluator\(validationOnlyConfig\)/);
assert.match(providerSource, /evaluateValidationCandidate:\s*createValidationOnlySkillCandidateEvaluator/);
assert.match(coordinatorSource, /evaluateValidationCandidate\?:/);
assert.match(coordinatorSource, /populationSearchBudget\?:/);
assert.match(coordinatorSource, /snapshotPlainDataEnvelope\(rawPrepared, \['generate', 'evaluateRevisedCandidate', 'evaluateValidationCandidate'\]\)/);

const digest = value => createHash('sha256').update(value).digest('hex');
const repairEvidence = [{
  skillId: 'skill-demo',
  skillName: 'Demo skill',
  failureFingerprint: 'a'.repeat(64),
  stepId: 'step-1',
  failedTool: 'tool-old',
  diagnosis: 'The selected tool failed its postcondition.',
  contextSignature: 'context-v1',
  candidateTools: ['tool-old', 'tool-new'],
  selectedTool: 'tool-new',
  verified: true,
  confidence01: .9,
  observedAt: 100,
  revisionEligible: true,
}];

const journalEvents = [];
const runtime = Object.create(OrganismRuntime.prototype);
runtime.compoundSkillRepairEvidence = skillId => {
  assert.equal(skillId, 'skill-demo');
  return structuredClone(repairEvidence);
};
runtime.journal = { write: async (...args) => { journalEvents.push(args); } };

let populationCalls = 0;
let legacyCalls = 0;
let receivedGeneration = null;
let receivedValidationEvaluator = null;
const engine = {
  generateAndStageReflectiveSkillRevision: async () => {
    legacyCalls++;
    return { candidate: { candidateId: 'legacy-candidate' } };
  },
  async generateAndStageReflectiveSkillRevisionWithPopulationGenerator(
    validationEvaluator,
    proposal,
    skillId,
    sourceCandidateId,
    baseline,
    candidateEvaluation,
    generateCandidate,
    evaluateRevisedCandidate,
    options,
    sourceEvidenceFingerprint,
    populationSearchBudget,
  ) {
    populationCalls++;
    receivedValidationEvaluator = validationEvaluator;
    assert.equal(proposal.proposalId, 'proposal');
    assert.equal(skillId, 'skill-demo');
    assert.equal(sourceCandidateId, 'source-candidate');
    assert.equal(typeof evaluateRevisedCandidate, 'function');
    assert.equal(sourceEvidenceFingerprint, digest(JSON.stringify(repairEvidence)));
    assert.deepEqual(populationSearchBudget, { maxCandidates: 2 });
    receivedGeneration = await generateCandidate({
      sourcePayload: { name: 'source' },
      datasetFingerprint: digest('dataset'),
      optimizerInstruction: 'Improve the repair target.',
      validationEvidence: [{ taskId: 'validation-1', pass: false }],
      targets: [{ dimension: 'trajectory', priority01: .7, affectedTaskIds: ['validation-1'], evidenceCount: 1, evidenceIds: ['trial-1'], directive: 'Fix order.' }],
      holdoutPolicy: { resultsWithheld: true, requiresFreshIndependentEvaluation: true },
      variation: { id: 'edge-case-reinforcement', instruction: 'Fix the edge.', index: 2, seed: 19 },
      signal: new AbortController().signal,
    });
    return {
      candidate: { candidateId: 'population-staged', status: 'staged' },
      populationSearch: { status: 'selected', diagnostics: { generationCalls: 2, evaluationCalls: 2, validationOnly: true }, archive: [{ candidateFingerprint: 'b'.repeat(64), split: 'validation', perTask: [] }] },
    };
  },
};
const generated = [];
const evaluator = async input => ({ payloadFingerprint: input.payloadFingerprint });
const result = await OrganismRuntime.prototype.generateCompoundSkillRevision.call(runtime, {
  engine,
  proposal: { proposalId: 'proposal' },
  skillId: 'skill-demo',
  sourceCandidateId: 'source-candidate',
  baseline: { validation: [], holdout: [] },
  candidateEvaluation: { validation: [], holdout: [] },
  generate: async request => {
    generated.push(request);
    return { name: 'candidate' };
  },
  evaluateRevisedCandidate: async () => ({}),
  evaluateValidationCandidate: evaluator,
  populationSearchBudget: { maxCandidates: 2 },
  sourceEvidenceFingerprint: digest(JSON.stringify(repairEvidence)),
});

assert.equal(populationCalls, 1, 'configured validation-only capability selects the population engine');
assert.equal(legacyCalls, 0, 'population mode must not also execute the legacy single-candidate route');
assert.equal(receivedValidationEvaluator.evaluate, evaluator);
assert.equal(generated.length, 1);
assert.equal(generated[0].variation.id, 'edge-case-reinforcement');
assert.equal(generated[0].signal instanceof AbortSignal, true);
assert.deepEqual(generated[0].repairEvidence, repairEvidence);
assert.equal(result.candidate.candidateId, 'population-staged');
assert.equal(result.populationSearch.diagnostics.validationOnly, true);
assert.equal(result.repairEvidenceCount, 1);
assert.deepEqual(journalEvents[0][2].populationSearch, {
  generationCalls: 2, evaluationCalls: 2, validationOnly: true,
});

// Without the explicit host-owned validation-only capability, the old route is retained.
populationCalls = 0;
legacyCalls = 0;
const fallback = await OrganismRuntime.prototype.generateCompoundSkillRevision.call(runtime, {
  engine,
  proposal: { proposalId: 'proposal' },
  skillId: 'skill-demo',
  sourceCandidateId: 'source-candidate',
  baseline: { validation: [], holdout: [] },
  candidateEvaluation: { validation: [], holdout: [] },
  generate: async request => ({ name: 'legacy', repairEvidence: request.repairEvidence }),
  evaluateRevisedCandidate: async () => ({}),
  sourceEvidenceFingerprint: digest(JSON.stringify(repairEvidence)),
});
assert.equal(legacyCalls, 1);
assert.equal(populationCalls, 0);
assert.equal(fallback.candidate.candidateId, 'legacy-candidate');


const failedArchive = [{
  candidateFingerprint: 'c'.repeat(64),
  sourceFingerprint: 'd'.repeat(64),
  split: 'validation',
  perTask: [],
}];
const failingEngine = {
  generateAndStageReflectiveSkillRevision: async () => {
    throw new Error('legacy-path-must-not-run');
  },
  generateAndStageReflectiveSkillRevisionWithPopulationGenerator: async () => {
    const error = new Error('p23-population-timeout');
    Object.assign(error, {
      populationSearchDiagnostics: { generationCalls: 1, evaluationCalls: 1, timedOut: true, validationOnly: true },
      populationSearchArchive: failedArchive,
    });
    throw error;
  },
};
await assert.rejects(
  OrganismRuntime.prototype.generateCompoundSkillRevision.call(runtime, {
    engine: failingEngine,
    proposal: { proposalId: 'proposal' },
    skillId: 'skill-demo',
    sourceCandidateId: 'source-candidate',
    baseline: { validation: [], holdout: [] },
    candidateEvaluation: { validation: [], holdout: [] },
    generate: async () => ({ name: 'unused' }),
    evaluateRevisedCandidate: async () => ({}),
    evaluateValidationCandidate: evaluator,
    sourceEvidenceFingerprint: digest(JSON.stringify(repairEvidence)),
  }),
  /p23-population-timeout/,
);
const failureEvent = journalEvents.find(row => row[1] === 'runtime.p23.compound-repair-revision.population-search-failed');
assert.ok(failureEvent, 'failed/no-gain population search must leave a durable operational journal event');
assert.equal(failureEvent[0], 'warn');
assert.equal(failureEvent[2].populationSearch.timedOut, true);
assert.equal(failureEvent[2].populationSearchArchive[0].split, 'validation');
\nconsole.log('P23_POPULATION_RUNTIME_WIRING=PASS');
