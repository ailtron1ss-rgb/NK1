import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const config = {
  enableLanguage: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  cycleResultMode: 'operational',
  performanceProfile: 'mobile',
};

const base = new OrganismCore(new MemoryStateStore(), config);
await base.init();
const snapshot = structuredClone(base.snapshot());
snapshot.system.autonomousSocialInitiative = {
  version: 1, cycles: 1, planned: 1, executed: 0, deferred: 0,
  reciprocity01: 0.54, initiative01: 0.4, startedAt: 1,
  lastExternalInputAt: 0, lastInitiativeAt: 1,
  initiatives: [{
    id: 'restored-sensitive', kind: 'share-thought', status: 'ready', createdAt: 1,
    reason: 'old stored context', topic: 'A safe topic on evidence and memory',
    message: 'Use API key sk-abcdefghijklmnopqrstuvwxyz123456 and contact private.person@example.com',
  }],
};

const restored = new OrganismCore(new MemoryStateStore({ initial: snapshot }), config);
await restored.init();
let restoredQueue = restored.snapshot().system.autonomousSocialInitiative;
assert.doesNotMatch(JSON.stringify(restoredQueue), /sk-abcdefghijklmnopqrstuvwxyz123456|private\.person@example\.com/,
  'constructor must persist scrubbed restoration instead of leaving unsafe source bytes in the checkpoint');
assert.equal(restoredQueue.initiatives[0].status, 'deferred', 'a restored unsafe ready item must become deferred');
assert.equal(restored.pendingAutonomousSocialInitiativeMessage(), null, 'unsafe restored content must not become deliverable');

const stageSnapshot = structuredClone(base.snapshot());
stageSnapshot.system.autonomousSocialInitiative = {
  version: 1, cycles: 1, planned: 1, executed: 0, deferred: 0,
  reciprocity01: 0.54, initiative01: 0.4, startedAt: 1,
  lastExternalInputAt: 0, lastInitiativeAt: 1,
  initiatives: [{
    id: 'stage-sensitive', kind: 'share-thought', status: 'planned', createdAt: 1,
    reason: 'reflection', topic: 'A clean topic about causal learning', message: null,
  }],
};
const stagingCore = new OrganismCore(new MemoryStateStore({ initial: stageSnapshot }), config);
await stagingCore.init();
assert.equal(stagingCore.stageAutonomousSocialInitiativeMessage('stage-sensitive', 'API key sk-abcdefghijklmnopqrstuvwxyz123456', 2), false,
  'unsafe generated message must fail staging');
const stagedState = stagingCore.snapshot().system.autonomousSocialInitiative;
assert.doesNotMatch(JSON.stringify(stagedState), /sk-abcdefghijklmnopqrstuvwxyz123456/,
  'the rejected output must not remain in the canonical persisted snapshot');
assert.equal(stagedState.initiatives.find((item) => item.id === 'stage-sensitive')?.status, 'deferred',
  'rejected output state must be persisted even when stageMessage returns false');
console.log('WorkPass49 OrganismCore persistence privacy: PASS (restore scrubbing persisted; rejected outgoing message durably deferred)');
