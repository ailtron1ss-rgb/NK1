import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { validateCognitiveStageReceipt } from '../src/organism/system/CognitiveStageReceipt.ts';

// W01: exercise the real owner-to-runtime-to-CEF path, not synthetic phase objects.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-stage-evidence-w01-'));
const stateFile = path.join(dir, 'organism.json');
const worldStateFile = path.join(dir, 'world.json');
const runtime = new OrganismRuntime({
  stateFile,
  worldStateFile,
  stateStore: new FileStateStore(stateFile),
  enableLanguage: false,
  intervalMs: 60_000,
});

try {
  await runtime.init();
  const step = await runtime.step('W01 evidence contract: verify exact memory retrieval and pre-decision attention.');
  const cycle = step.cycle;
  const evidence = cycle.stageEvidence;

  assert.ok(evidence, 'OrganismCycleResult must expose current-cycle owner evidence');
  assert.equal(evidence.tick, cycle.state.tick);
  assert.ok(Array.isArray(evidence.receipts), 'cycle evidence must include typed owner receipts');

  const attentionReceipt = evidence.receipts.find((receipt) => receipt.stage === 'attention');
  const memoryReceipt = evidence.receipts.find((receipt) => receipt.stage === 'memory');
  assert.ok(attentionReceipt, 'attention owner receipt must be present');
  assert.ok(memoryReceipt, 'memory owner receipt must be present');
  assert.equal(attentionReceipt.tick, cycle.state.tick);
  assert.equal(memoryReceipt.tick, cycle.state.tick);
  assert.equal(attentionReceipt.owner, 'OrganismCore.attend');
  assert.equal(memoryReceipt.owner, 'MemoryFabric.retrieveForCognition');

  const events = runtime.cognitiveEventFabricSnapshot().recent.filter((event) => event.tick === cycle.state.tick);
  const attentionEvent = events.find((event) => event.stage === 'attention');
  const memoryEvent = events.find((event) => event.stage === 'memory');
  assert.ok(attentionEvent, 'runtime must project attention owner evidence into CEF');
  assert.ok(memoryEvent, 'runtime must project memory owner evidence into CEF');

  assert.equal(attentionEvent.source, 'OrganismCore.attend');
  assert.equal(attentionEvent.payload.receiptId, attentionReceipt.id);
  assert.equal(attentionEvent.payload.timing, 'pre-decision');
  assert.equal(attentionEvent.payload.target, evidence.attention.target);
  assert.equal(attentionEvent.payload.reason, evidence.attention.reason);
  assert.equal(
    attentionEvent.payload.postDecisionWorkspace.broadcastId,
    cycle.workspace.broadcastId,
    'post-decision workspace broadcast must be separately labelled, never used as the attention allocation',
  );

  assert.equal(memoryEvent.source, 'MemoryFabric.retrieveForCognition');
  assert.equal(memoryEvent.payload.receiptId, memoryReceipt.id);
  assert.equal(memoryEvent.payload.status, evidence.memory.status);
  assert.deepEqual(memoryEvent.payload.retrievedMemoryIds, evidence.memory.retrievedMemoryIds);
  assert.equal(memoryEvent.payload.retrievedCount, evidence.memory.retrievedCount);
  assert.equal(
    memoryEvent.payload.storedMemoryCount,
    cycle.memories.length,
    'persistent stored memories must be reported separately from current retrieval results',
  );
  assert.ok(
    ['completed', 'completed_empty', 'skipped'].includes(evidence.memory.status),
    'memory stage must distinguish positive retrieval, valid empty result and policy skip',
  );
  assert.equal(
    evidence.memory.status === 'completed',
    evidence.memory.retrievedCount > 0,
    'completed means a non-empty current retrieval',
  );
  assert.equal(
    evidence.memory.status === 'completed_empty',
    evidence.memory.retrievedCount === 0 && evidence.memory.enabled === true,
    'completed_empty means retrieval was enabled and returned no rows',
  );
  assert.equal('query' in memoryEvent.payload, false, 'raw user query must not be copied into the cognitive event');

  console.log('COGNITIVE_STAGE_EVIDENCE_W01=PASS');
} finally {
  await runtime.stop().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}


// Receipt shape and CEF admission are strict; a graph node alone is not owner evidence.
{
  const attentionReceipt = {
    id: 'nk1-cycle:9:attention', cycleId: 'nk1-cycle:9', tick: 9, stage: 'attention',
    owner: 'OrganismCore.attend', status: 'completed',
    inputRefs: [], outputRefs: ['attention-state:9'], consumedStageReceipts: [], outputHash: 'a'.repeat(64),
  };
  const memoryReceipt = {
    id: 'nk1-cycle:9:memory', cycleId: 'nk1-cycle:9', tick: 9, stage: 'memory',
    owner: 'MemoryFabric.retrieveForCognition', status: 'completed_empty',
    inputRefs: ['query-sha256:' + 'b'.repeat(64)], outputRefs: [], consumedStageReceipts: [], outputHash: 'c'.repeat(64),
  };
  assert.equal(validateCognitiveStageReceipt(attentionReceipt, { tick: 9, stage: 'attention' }).ok, true);
  assert.equal(validateCognitiveStageReceipt({ ...attentionReceipt, tick: 10 }, { tick: 9 }).ok, false);
  assert.equal(validateCognitiveStageReceipt({ ...attentionReceipt, owner: 'global-workspace' }).ok, false);
  assert.equal(validateCognitiveStageReceipt({ ...memoryReceipt, status: 'completed' }).ok, false);

  const fabric = new CognitiveEventFabric();
  assert.throws(
    () => fabric.recordOperationalCycle({
      tick: 9,
      attention: { source: 'OrganismCore.attend', receipt: { ...attentionReceipt, tick: 8 }, payload: {} },
    }),
    /invalid-stage-owner-receipt:attention:.*tick-mismatch/,
  );
  const ids = fabric.recordOperationalCycle({
    tick: 9,
    observation: { source: 'runtime' },
    appraisal: { source: 'homeostatic-appraisal' },
    attention: { source: 'OrganismCore.attend', receipt: attentionReceipt, payload: { timing: 'pre-decision' } },
    memory: { source: 'MemoryFabric.retrieveForCognition', receipt: memoryReceipt, payload: { status: 'completed_empty' } },
  });
  const check = fabric.verifyOperationalCycle(ids, [attentionReceipt, memoryReceipt]);
  assert.equal(check.ownerEvidenceComplete, true);
  assert.deepEqual(check.missingOwnerEvidenceStages, []);
  const missing = fabric.verifyOperationalCycle(ids, [attentionReceipt]);
  assert.equal(missing.ownerEvidenceComplete, false);
  assert.deepEqual(missing.missingOwnerEvidenceStages, ['memory']);

  const skippedFabric = new CognitiveEventFabric();
  const skippedMemoryReceipt = {
    ...memoryReceipt,
    id: 'nk1-cycle:10:memory',
    cycleId: 'nk1-cycle:10',
    tick: 10,
    status: 'skipped',
    inputRefs: ['query-sha256:' + 'd'.repeat(64)],
  };
  const skippedAttentionReceipt = {
    ...attentionReceipt,
    id: 'nk1-cycle:10:attention',
    cycleId: 'nk1-cycle:10',
    tick: 10,
    outputRefs: ['attention-state:10'],
  };
  const skippedIds = skippedFabric.recordOperationalCycle({
    tick: 10,
    observation: { source: 'runtime' },
    appraisal: { source: 'homeostatic-appraisal' },
    attention: { source: 'OrganismCore.attend', receipt: skippedAttentionReceipt, payload: { timing: 'pre-decision' } },
    memory: { source: 'MemoryFabric.retrieveForCognition', receipt: skippedMemoryReceipt, payload: { status: 'skipped' } },
  });
  const skipped = skippedFabric.verifyOperationalCycle(skippedIds, [skippedAttentionReceipt, skippedMemoryReceipt]);
  assert.equal(skipped.ownerEvidenceComplete, false, 'a policy skip is valid evidence but cannot count as a complete full cycle');
  assert.ok(skipped.invalidOwnerEvidence.includes('memory:status-not-full-complete'));
}
