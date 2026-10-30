import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(root,path),'utf8');
const [core,runtime,types,registry,p78,bridge,selfModel,personality]=await Promise.all([
  read('src/organism/core/OrganismCore.ts'),
  read('src/organism/core/OrganismRuntime.ts'),
  read('src/organism/core/types.ts'),
  read('src/organism/core/CognitiveSubsystemRegistry.ts'),
  read('src/organism/developmental/P78AutobiographicalSelfContinuity.ts'),
  read('src/organism/cognition/PersonalitySelfModelBridge.ts'),
  read('src/organism/cognition/SelfModelV2.ts'),
  read('src/organism/cognition/P2702PersistentPersonalityDynamics.ts'),
]);

assert.match(types,/evidenceReceiptId\?:\s*string/,'learning provenance carries an outcome receipt ID');
assert.match(runtime,/evidenceReceiptId:\s*grounded\.source\s*===\s*'external'\s*\?\s*outcomeEvidence\.id\s*:\s*undefined/,'runtime forwards the exact published external outcome event ID');

assert.match(core,/const personalityDecisionFrame\s*=\s*this\.organismSystems\.preparePersonalityDecision/,'the canonical candidate-scoring pass prepares personality signals');
assert.match(core,/personalityDecisionFrame\.actionBias\[action\]/,'personality bias reaches the existing candidate scores');
assert.match(core,/const hasStrongExternalReceipt\s*=\s*learning\.source\s*===\s*'external'/,'autobiographical verification requires the external receipt path');
assert.ok(core.includes('evidenceReceiptId: hasStrongExternalReceipt ? learning.evidenceReceiptId : undefined,'),'the exact runtime outcome event ID is passed into the bridge');
const exactReceiptForwarding='evidenceReceiptId: hasStrongExternalReceipt ? learning.evidenceReceiptId : undefined,';
assert.equal(core.split(exactReceiptForwarding).length-1,2,'the same exact receipt ID is attached to P78 and passed to the bridge');
assert.ok(core.includes('learningScale01: learning.learningScale01,'),'personality adaptation uses the shared evidence-weighted learning scale');
assert.ok(core.includes('independent01: learning.independent01,'),'personality adaptation receives the independent evidence score');
assert.match(core,/learning\.verified01\s*>=\s*\.85/,'autobiographical verification requires high verification');
assert.match(core,/learning\.independent01\s*>=\s*\.80/,'autobiographical verification requires independent evidence');
assert.match(core,/this\.organismSystems\.recordPersonalityOutcome\(/,'real feedback is routed through the canonical personality bridge');
assert.match(core,/personalityOutcome\.p78/,'the resulting autobiographical state is projected into persistence');
assert.match(registry,/recordPersonalityOutcome\(/,'the bridge is available through the physical-system registry');
assert.match(p78,/event\.evidenceReceiptId/,'P78 authenticates the receipt carried inside the event itself');
assert.match(p78,/Number\(receipt\[1\]\)===event\.tick/,'P78 binds the receipt tick to the autobiographical event tick');
assert.match(bridge,/input\.event\.evidenceReceiptId===receiptId/,'the bridge rejects mismatched event and caller receipt IDs');
assert.match(selfModel,/receiptBound/,'SelfModel independently protects its high-level identity gate');
assert.match(selfModel,/evidenceReceiptId/,'SelfModel requires the immutable evidence receipt ID');
assert.match(personality,/strongIndependentOutcome/,'stable values and relationship trust require strong independent evidence');
assert.match(personality,/tensionTargets/,'named character tensions are updated in the decision loop');
assert.match(personality,/autobiographicalStrength01/,'longitudinal autobiographical strength is updated from verified outcomes');

console.log('PERSONALITY_SELFMODEL_RUNTIME_WIRING=PASS');
