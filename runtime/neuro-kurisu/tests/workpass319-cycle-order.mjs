import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const index = (needle) => {
  const found = runtime.indexOf(needle);
  assert.notEqual(found, -1, `required runtime phase not found: ${needle}`);
  return found;
};

const feedback = index('await this.core.feedback({');
const groundedTransitionLearning = index('this.core.b365LearnGroundedTransition({');
const embodiedConsequenceLearning = index('this.core.b365LearnEmbodiedConsequence({');
const continuousMemory = index('const continuousFabric = this.continuousCognitiveFabric.step({');
const neuralTrace = index('const neuralTrace = this.neuralCausalTrace.record({');
const lifeCourseUpdate = index('this.core.closeB380TemporalLife({');
const embodimentPersist = runtime.indexOf('await this.core.setEmbodiment(this.embodiment.snapshot(), this.embodiment.eventLog());', lifeCourseUpdate);
assert.notEqual(embodimentPersist, -1, 'cycle embodiment persistence must occur after the life-course update');
const cycleLedger = index('const cycleStageIds = this.cognitiveEventFabric.recordOperationalCycle({');
const cycleEvaluation = index('const cycleVerification = this.unifiedCycle.evaluate({');
const completenessEvidence = index("claim:'cognitive-cycle-completeness'");
// Cycle completeness evidence must be written through the single canonical
// core reality-evidence contract, not a runtime-local duplicate ledger.
const canonicalEvidenceWrite = runtime.lastIndexOf('this.core.recordRealityEvidence({', completenessEvidence);
assert.notEqual(canonicalEvidenceWrite, -1, 'cycle completeness evidence must be written through the canonical core reality-evidence path');
assert.doesNotMatch(runtime, /private readonly realityEvidence = new RealityEvidenceLedger/, 'runtime must not own a duplicate reality-evidence ledger');

assert.ok(feedback < groundedTransitionLearning, 'feedback must execute before the cycle claims learning completed');
assert.ok(groundedTransitionLearning < embodiedConsequenceLearning, 'world and embodied consequence learning must precede cycle closure');
assert.ok(embodiedConsequenceLearning < continuousMemory, 'experience/identity integration must precede cycle closure');
assert.ok(continuousMemory < neuralTrace, 'neural outcome trace must be recorded before cycle closure');
assert.ok(neuralTrace < lifeCourseUpdate, 'temporal/life-course update must precede cycle closure');
assert.ok(lifeCourseUpdate < embodimentPersist, 'embodiment state must be committed before cycle closure');
assert.ok(embodimentPersist < cycleLedger, 'causal stages must not be declared complete before the canonical learning path finishes');
assert.ok(cycleLedger < cycleEvaluation, 'the unified cycle must evaluate the exact ledger events that were just written');
assert.ok(cycleEvaluation < completenessEvidence, 'completeness evidence must be derived from the post-update verification');
assert.ok(cycleEvaluation < canonicalEvidenceWrite, 'cycle completeness evidence must be recorded after it is derived');

const cycleBlock = runtime.slice(cycleLedger, completenessEvidence);
assert.match(cycleBlock, /learning:\s*\{?\s*source:'core\.feedback'/);
assert.match(cycleBlock, /selfUpdate:\s*\{?\s*source:'core\.lifecycle'/);
assert.match(cycleBlock, /this\.core\.setRuntimeUnifiedCognitiveCycle\(this\.unifiedCycle\.snapshot\(\)\)/, 'the verified cycle snapshot must be persisted through the runtime-owned Core contract');

console.log('WorkPass319 cognitive-cycle causal ordering: PASS');
