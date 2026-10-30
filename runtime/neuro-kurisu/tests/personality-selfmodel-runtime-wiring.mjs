import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(root,path),'utf8');
const [core,runtime,types,registry]=await Promise.all([
  read('src/organism/core/OrganismCore.ts'),
  read('src/organism/core/OrganismRuntime.ts'),
  read('src/organism/core/types.ts'),
  read('src/organism/core/CognitiveSubsystemRegistry.ts'),
]);

assert.match(types,/evidenceReceiptId\?:\s*string/,'learning provenance carries an outcome receipt ID');
assert.match(runtime,/evidenceReceiptId:\s*grounded\.source\s*===\s*'external'\s*\?\s*outcomeEvidence\.id\s*:\s*undefined/,'runtime forwards the exact published external outcome event ID');
assert.ok(core.includes('evidenceReceiptId: hasStrongExternalReceipt ? learning.evidenceReceiptId : undefined,'),'the exact runtime outcome event ID is passed into the bridge');
assert.match(core,/const personalityDecisionFrame\s*=\s*this\.organismSystems\.preparePersonalityDecision/,'the canonical candidate-scoring pass prepares personality signals');
assert.match(core,/personalityDecisionFrame\.actionBias\[action\]/,'personality bias reaches the existing candidate scores');
assert.match(core,/const hasStrongExternalReceipt\s*=\s*learning\.source\s*===\s*'external'/,'autobiographical verification requires the external receipt path');
assert.ok(core.includes('evidenceReceiptId: hasStrongExternalReceipt ? learning.evidenceReceiptId : undefined,'),'the exact runtime outcome event ID is passed into the bridge');
assert.ok(core.includes('evidenceReceiptId: hasStrongExternalReceipt ? learning.evidenceReceiptId : undefined,'),'P78 receives the exact receipt ID checked by the runtime');
assert.ok(core.includes('learningScale01: learning.learningScale01,'),'personality adaptation uses the shared evidence-weighted learning scale');
assert.ok(core.includes('independent01: learning.independent01,'),'personality adaptation receives the independent evidence score');
assert.match(core,/learning\.verified01\s*>=\s*\.85/,'autobiographical verification requires high verification');
assert.match(core,/learning\.independent01\s*>=\s*\.80/,'autobiographical verification requires independent evidence');
assert.match(core,/this\.organismSystems\.recordPersonalityOutcome\(/,'real feedback is routed through the canonical personality bridge');
assert.match(core,/personalityOutcome\.p78/,'the resulting autobiographical state is projected into persistence');
assert.match(registry,/recordPersonalityOutcome\(/,'the bridge is available through the physical-system registry');

console.log('PERSONALITY_SELFMODEL_RUNTIME_WIRING=PASS');
