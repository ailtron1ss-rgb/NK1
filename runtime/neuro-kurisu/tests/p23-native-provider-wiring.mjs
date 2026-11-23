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
  for (const token of [
    'NEURO_COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH',
    'NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE',
    'if (externalProviderConfigured && nativeProviderConfigured)',
    'createNativeCompoundRepairRevisionProvider(',
    'datasetPath: COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH',
    'createIndependentEvaluationConfigFactory(',
    'createHostOwnedIndependentEvaluationConfigFactory',
    'if ((nativeProviderConfigured || COMPOUND_REPAIR_BACKGROUND_REVISION?.enabled) && !independentEvaluationConfigForRepair)',
    'generateSkillRevision: (request) => P23_SKILL_REVISION_GENERATOR(request)',
    'compoundRepairRevision: COMPOUND_REPAIR_REVISION',
  ]) assert.ok(server.includes(token), 'server must contain integration token: ' + token);
});

test('signed dataset verification and evaluator authority fail closed', () => {
  for (const token of [
    'loadTrustedVerifierKeys',
    "keyType !== 'ed25519'",
    'ingestSignedOutcomeArtifact',
    'native-p23-revision-dataset-must-not-be-group-or-world-writable',
    'native-p23-revision-dataset-mutated-during-read',
    'native-p23-revision-requires-independent-evaluation-wrapper',
  ]) assert.ok(provider.includes(token), 'provider must contain security token: ' + token);
  for (const token of [
    'production-compound-repair-revision-requires-independent-evaluation-config-module',
    'production-independent-evaluation-requires-host-owned-experiment-authority',
    'compound-repair-provider-and-independent-evaluator-modules-must-be-distinct',
  ]) assert.ok(hostConfig.includes(token), 'host evaluator config must enforce: ' + token);
});

console.log('P23_NATIVE_PROVIDER_WIRING=PASS');
