import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await readFile(path.join(runtimeRoot, 'src/server/server.mjs'), 'utf8');
const provider = await readFile(path.join(runtimeRoot, 'src/organism/learning/P23CompoundRepairRevisionProvider.ts'), 'utf8');
const hostConfig = await readFile(path.join(runtimeRoot, 'src/server/compound-repair-revision-host-config.mjs'), 'utf8');

test('native provider and host-owned evaluation remain explicit opt-in paths', () => {
  assert.match(server, /NEURO_COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH/);
  assert.match(server, /NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE/);
  assert.ok(server.includes('if (externalProviderConfigured && nativeProviderConfigured)'));
  assert.match(server, /createNativeCompoundRepairRevisionProvider\\(/);
  assert.match(server, /datasetPath: COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH/);
  assert.match(server, /createIndependentEvaluationConfigFactory\\(/);
  assert.match(server, /createHostOwnedIndependentEvaluationConfigFactory/);
  assert.ok(server.includes('if ((nativeProviderConfigured || COMPOUND_REPAIR_BACKGROUND_REVISION?.enabled) && !independentEvaluationConfigForRepair)'));
  assert.ok(server.includes('generateSkillRevision: (request) => P23_SKILL_REVISION_GENERATOR(request)'));
  assert.match(server, /compoundRepairRevision: COMPOUND_REPAIR_REVISION/);
});

test('signed dataset verifier and independent evaluator wrapper fail closed', () => {
  assert.match(provider, /loadTrustedVerifierKeys/);
  assert.match(provider, /asymmetricKeyType !== 'ed25519'/);
  assert.match(provider, /ingestSignedOutcomeArtifact/);
  assert.match(provider, /native-p23-revision-dataset-must-not-be-group-or-world-writable/);
  assert.match(provider, /native-p23-revision-dataset-mutated-during-read/);
  assert.match(provider, /native-p23-revision-requires-independent-evaluation-wrapper/);
  assert.match(hostConfig, /production-compound-repair-revision-requires-independent-evaluation-config-module/);
  assert.match(hostConfig, /production-independent-evaluation-requires-host-owned-experiment-authority/);
  assert.match(hostConfig, /compound-repair-provider-and-independent-evaluator-modules-must-be-distinct/);
});

console.log('P23_NATIVE_PROVIDER_WIRING=PASS');
