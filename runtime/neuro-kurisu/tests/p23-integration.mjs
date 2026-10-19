import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p23-integration-'));
const stateFile = path.join(dir, 'organism.json');
try {
  const core = new OrganismCore(new FileStateStore(stateFile), { checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1 });
  await core.init();
  for (let i = 0; i < 8; i++) {
    await core.observe({
      text: `verify evidence ${i}`,
      novelty: 0.2,
      surprise: 0.15,
      embodiment: { bodyEnergy01:.8, cognitiveCapacity01:.86, thermalStrain01:.18, sensoryFreshness01:.9, awake:true, battery01:.82, cpuLoad01:.2, ramPressure01:.25 },
    });
    await core.feedback({ success:.82, reward:.82, surprise:.08 });
  }
  const before = core.p23LearningSnapshot();
  assert.equal(before.experiences, 8);
  assert.ok(before.shadowComparisons >= 8);
  assert.ok(before.ablationComparisons >= 8);
  assert.ok(before.alternativePredictionComparisons >= 8);
  assert.ok(before.replayUpdates === 0, 'feedback stores experiences; replay must be explicit/consolidation-driven');
  const replay = await core.runP23Replay();
  assert.equal(replay, 8);
  const after = core.p23LearningSnapshot();
  assert.equal(after.replayUpdates, 8);
  assert.equal(after.checksum.verificationFailures, 0);
  await core.flush();

  const reloaded = new OrganismCore(new FileStateStore(stateFile));
  await reloaded.init();
  const restored = reloaded.p23LearningSnapshot();
  assert.equal(restored.experiences, 8);
  assert.equal(restored.checksum.verificationFailures, 0);
  assert.equal(restored.replayUpdates, 8);
  assert.ok(restored.checksum.digest.length === 64);
  reloaded.markRuntimeAnomaly('test-only');
  assert.ok(reloaded.longitudinalSnapshot().anomalyCount >= 1);
  console.log(`P23_INTEGRATION=PASS experiences=${restored.experiences} replay=${restored.replayUpdates} checksumFailures=${restored.checksum.verificationFailures}`);
} finally {
  await rm(dir, { recursive:true, force:true });
}
