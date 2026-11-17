import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const directory = await mkdtemp(path.join(tmpdir(), 'nk1-substrate-transfer-'));
const profile = {
  backendId: 'kobold',
  routeId: 'kobold',
  providerId: 'kobold',
  modelId: 'kobold-api-model',
  modelRevision: 'test-revision',
  runtime: 'koboldcpp-text-generation',
  privacyClass: 'local-only',
  capabilities: ['text-generation', 'json-proposal', 'tool-routing'],
  embeddingSpaceId: 'nk1-memory-embedding-v1',
  contextWindowTokens: 4096,
};
const sourceState = path.join(directory, 'source-organism.json');
const targetState = path.join(directory, 'target-organism.json');
const source = new OrganismRuntime({
  stateFile: sourceState,
  worldStateFile: path.join(directory, 'source-world.json'),
  enableLanguage: false,
  autoRun: false,
});
const target = new OrganismRuntime({
  stateFile: targetState,
  worldStateFile: path.join(directory, 'target-world.json'),
  enableLanguage: false,
  autoRun: false,
  substrateBackendProfiles: [profile],
});

try {
  await source.init();
  await source.core.recordLanguageBackend('gemini:test');
  await source.core.recordLanguageBackend('kobold');
  const sourceWorldTick = source.environment.snapshot().tick;
  const transfer = await source.createPortableSubstrateTransferPackage();
  assert.equal(transfer.schemaVersion, 1);
  assert.equal(sourceWorldTick, transfer.payload.world.tick);

  const imported = await target.importPortableSubstrateTransferPackage(transfer, profile.backendId);
  assert.equal(imported.imported, true);
  assert.equal(imported.requiresCalibration, true,
    'state import must never imply that the target model itself has passed migration calibration');

  await target.init();
  const restored = target.core.snapshot();
  assert.equal(restored.facets.advanced.modelSwitch.currentBackend, 'kobold',
    'the canonical persisted organism state must survive transfer to a different runtime directory');
  assert.equal(restored.facets.advanced.modelSwitch.switches, 2);
  assert.equal(target.environment.snapshot().tick, sourceWorldTick);
  assert.equal(target.substrateDiagnostics().pendingTransfer.targetBackendId, profile.backendId,
    'the imported target must remain pending until independent calibration and explicit promotion');

  const journal = JSON.parse(await readFile(targetState + '.substrate-import-journal.json', 'utf8'));
  assert.equal(journal.phase, 'committed');
  console.log('OMESTRO_22_RUNTIME_PORTABLE_TRANSFER=PASS', JSON.stringify({
    organismStateRestored: true,
    worldStateRestored: true,
    calibrationStillRequired: true,
    importJournal: journal.phase,
  }));
} finally {
  await target.stop().catch(() => {});
  await source.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
