import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
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
const recoveryState = path.join(directory, 'recovery-organism.json');
const recovery = new OrganismRuntime({
  stateFile: recoveryState,
  worldStateFile: path.join(directory, 'recovery-world.json'),
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
  assert.equal(sourceWorldTick, transfer.payload.world.snapshot.tick);

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

  await recovery.importPortableSubstrateTransferPackage(transfer, profile.backendId);
  const blankBackup = {
    version: 1,
    organism: null,
    world: null,
    proceduralSkills: null,
    substrate: {
      version: 1,
      activeBackendId: null,
      activeProvenance: 'unknown',
      observedBackendId: null,
      pendingTransfer: null,
      lastEvaluation: null,
      history: [],
    },
  };
  await writeFile(recoveryState + '.substrate-import-backup.json', JSON.stringify(blankBackup));
  await writeFile(recoveryState + '.substrate-import-journal.json', JSON.stringify({
    version: 1,
    importId: 'simulated-interrupted-import',
    phase: 'prepared',
    transferDigest: transfer.integrity.digest,
    targetBackendId: profile.backendId,
    updatedAt: Date.now(),
  }));
  await recovery.init();
  const recovered = recovery.core.snapshot();
  assert.equal(recovered.facets.advanced.modelSwitch.currentBackend, 'local-fallback',
    'startup must restore the pre-import snapshot after an interrupted multi-store write');
  assert.equal(recovery.substrateDiagnostics().pendingTransfer, null);
  const recoveredJournal = JSON.parse(await readFile(recoveryState + '.substrate-import-journal.json', 'utf8'));
  assert.equal(recoveredJournal.phase, 'rolled-back');

  console.log('OMESTRO_22_RUNTIME_PORTABLE_TRANSFER=PASS', JSON.stringify({
    organismStateRestored: true,
    worldStateRestored: true,
    calibrationStillRequired: true,
    importJournal: journal.phase,
    interruptedImportRecovered: recoveredJournal.phase,
  }));
} finally {
  await recovery.stop().catch(() => {});
  await target.stop().catch(() => {});
  await source.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
