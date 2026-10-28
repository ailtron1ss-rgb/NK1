import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createIndependentEvaluationConfigFactory,
  parseCompoundRepairBackgroundRevisionConfig,
} from '../src/server/compound-repair-revision-host-config.mjs';

const digest = 'a'.repeat(64);
const temporary = async run => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-p23-host-config-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};
const hostModule = ({ experimentAuthority = true, complete = true, methods = true } = {}) => `
export async function createIndependentEvaluationHostConfig(input) {
  globalThis.__nk1HostConfigReceivedStateDirectory = input.stateDirectory;
  return ${complete ? `{
    ${methods ? "baselineMethod: 'active-baseline-v1',\n    sourceCandidateMethod: 'source-candidate-v1',\n" : ''}commands: {
      executor: { executable: '/host/executor', args: ['{requestFile}'], cwd: '/host', runRoot: '/host/executor-runs', surviveDir: '/host/executor-survive' },
      verifier: { executable: '/host/verifier', args: ['{requestFile}'], cwd: '/host', runRoot: '/host/verifier-runs', surviveDir: '/host/verifier-survive' },
      safetyScanner: { executable: '/host/scanner', args: ['{requestFile}'], cwd: '/host', runRoot: '/host/scanner-runs', surviveDir: '/host/scanner-survive' }
    },
    tasksForRepair: () => [{ taskId: 'validation-a', trialId: 'v-1', seed: 1, split: 'validation', input: { prompt: 'inspect' }, requiredCapabilityIds: ['read'], expectedStepIds: ['inspect'] }, { taskId: 'holdout-b', trialId: 'h-1', seed: 2, split: 'holdout', input: { prompt: 'inspect' }, requiredCapabilityIds: ['read'], expectedStepIds: ['inspect'] }],
    environmentFingerprintForRepair: () => '${digest}'${experimentAuthority ? `, experimentAuthorityForRepair: () => ({ manifest: [], ledger: {}, validationPlan: {}, holdoutPlan: {}, method: 'revision-candidate-v1' })` : ''}
  }` : '{}'}
}
`;

test('production requires an explicit host-owned independent evaluation module', async () => {
  await assert.rejects(
    createIndependentEvaluationConfigFactory({
      moduleSetting: '',
      root: '/repo',
      stateDirectory: '/state',
      production: true,
      createHostOwnedFactory: async () => () => ({}),
    }),
    /production-compound-repair-revision-requires-independent-evaluation-config-module/,
  );
});

test('development keeps revision provider-only mode opt-in and backward compatible', async () => {
  const result = await createIndependentEvaluationConfigFactory({
    moduleSetting: '',
    root: '/repo',
    stateDirectory: '/state',
    production: false,
    createHostOwnedFactory: async () => () => ({}),
  });
  assert.equal(result, undefined);
});

test('loads host config from a distinct module and delegates authority construction to the host factory', async () => {
  await temporary(async root => {
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(root, 'evaluator.mjs');
    await writeFile(providerPath, 'export default async () => () => ({})\n');
    await writeFile(evaluatorPath, hostModule());
    let captured;
    const factory = await createIndependentEvaluationConfigFactory({
      moduleSetting: 'evaluator.mjs',
      root,
      providerModulePath: providerPath,
      stateDirectory: path.join(root, 'state'),
      production: true,
      createHostOwnedFactory: async options => {
        captured = options;
        const plan = { arms: [
          { method: 'active-baseline-v1' },
          { method: 'source-candidate-v1' },
          { method: 'revision-candidate-v1' },
        ] };
        return repair => ({
          repair,
          authorityCount: 3,
          experimentAuthority: {
            method: 'revision-candidate-v1',
            validationPlan: plan,
            holdoutPlan: plan,
          },
        });
      },
    });
    assert.equal(typeof factory, 'function');
    assert.equal(globalThis.__nk1HostConfigReceivedStateDirectory, path.join(root, 'state'));
    assert.equal(captured.commands.executor.executable, '/host/executor');
    assert.equal(typeof captured.tasksForRepair, 'function');
    assert.equal(typeof captured.experimentAuthorityForRepair, 'function');
    assert.equal(captured.baselineMethod, 'active-baseline-v1');
    assert.equal(captured.sourceCandidateMethod, 'source-candidate-v1');
    const built = factory({ skillId: 'skill-a' });
    assert.equal(built.baselineMethod, 'active-baseline-v1');
    assert.equal(built.sourceCandidateMethod, 'source-candidate-v1');
    assert.equal(built.experimentAuthority.method, 'revision-candidate-v1');
  });
});

test('rejects using one module as both repair provider and evaluator authority config', async () => {
  await temporary(async root => {
    const samePath = path.join(root, 'same.mjs');
    await writeFile(samePath, hostModule());
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: samePath,
        root,
        providerModulePath: samePath,
        stateDirectory: path.join(root, 'state'),
        production: true,
        createHostOwnedFactory: async () => () => ({}),
      }),
      /compound-repair-provider-and-independent-evaluator-modules-must-be-distinct/,
    );
  });
});

test('rejects a writable host evaluator module on POSIX', async () => {
  if (process.platform === 'win32') return;
  await temporary(async root => {
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(root, 'evaluator.mjs');
    await writeFile(providerPath, 'export default async () => () => ({})\\n');
    await writeFile(evaluatorPath, hostModule());
    await chmod(evaluatorPath, 0o666);
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: evaluatorPath,
        root,
        providerModulePath: providerPath,
        stateDirectory: path.join(root, 'state'),
        production: true,
        createHostOwnedFactory: async () => () => ({}),
      }),
      /compound-repair-independent-evaluator-module-must-not-be-group-or-world-writable/,
    );
  });
});

test('rejects an evaluator config stored inside mutable organism state', async () => {
  await temporary(async root => {
    const stateDirectory = path.join(root, 'state');
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(stateDirectory, 'evaluator.mjs');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(stateDirectory);
    await writeFile(providerPath, 'export default async () => () => ({})\\n');
    await writeFile(evaluatorPath, hostModule());
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: evaluatorPath,
        root,
        providerModulePath: providerPath,
        stateDirectory,
        production: true,
        createHostOwnedFactory: async () => () => ({}),
      }),
      /compound-repair-independent-evaluator-module-must-be-outside-state-directory/,
    );
  });
});

test('rejects an evaluator module without the declared host factory', async () => {
  await temporary(async root => {
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(root, 'evaluator.mjs');
    await writeFile(providerPath, 'export default async () => () => ({})\n');
    await writeFile(evaluatorPath, 'export const unrelated = true;\n');
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: evaluatorPath,
        root,
        providerModulePath: providerPath,
        stateDirectory: path.join(root, 'state'),
        production: true,
        createHostOwnedFactory: async () => () => ({}),
      }),
      /independent-evaluation-config-module-must-export-createIndependentEvaluationHostConfig/,
    );
  });
});

test('production host config must declare distinct baseline and source evaluation methods', async () => {
  await temporary(async root => {
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(root, 'evaluator.mjs');
    await writeFile(providerPath, 'export default async () => () => ({})\\n');
    await writeFile(evaluatorPath, hostModule({ methods: false }));
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: evaluatorPath,
        root,
        providerModulePath: providerPath,
        stateDirectory: path.join(root, 'state'),
        production: true,
        createHostOwnedFactory: async () => () => ({
          experimentAuthority: {
            method: 'revision-candidate-v1',
            validationPlan: { arms: [{ method: 'revision-candidate-v1' }] },
            holdoutPlan: { arms: [{ method: 'revision-candidate-v1' }] },
          },
        }),
      }),
      /production-independent-evaluation-baseline-and-source-methods-required/,
    );
  });
});

test('production host config must own an experiment authority callback', async () => {
  await temporary(async root => {
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(root, 'evaluator.mjs');
    await writeFile(providerPath, 'export default async () => () => ({})\n');
    await writeFile(evaluatorPath, hostModule({ experimentAuthority: false }));
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: evaluatorPath,
        root,
        providerModulePath: providerPath,
        stateDirectory: path.join(root, 'state'),
        production: true,
        createHostOwnedFactory: async () => () => ({}),
      }),
      /production-independent-evaluation-requires-host-owned-experiment-authority/,
    );
  });
});

test('host config cannot omit one of the three independent service commands', async () => {
  await temporary(async root => {
    const providerPath = path.join(root, 'provider.mjs');
    const evaluatorPath = path.join(root, 'evaluator.mjs');
    await writeFile(providerPath, 'export default async () => () => ({})\n');
    await writeFile(evaluatorPath, hostModule({ complete: false }));
    await assert.rejects(
      createIndependentEvaluationConfigFactory({
        moduleSetting: evaluatorPath,
        root,
        providerModulePath: providerPath,
        stateDirectory: path.join(root, 'state'),
        production: false,
        createHostOwnedFactory: async () => () => ({}),
      }),
      /independent-evaluation-host-config-incomplete/,
    );
  });
});

test('background revision remains disabled when absent and validates explicit schedule', () => {
  assert.equal(parseCompoundRepairBackgroundRevisionConfig(undefined), undefined);
  assert.deepEqual(
    parseCompoundRepairBackgroundRevisionConfig('{"enabled":true,"initialDelayMs":1000,"intervalMs":60000}'),
    { enabled: true, initialDelayMs: 1000, intervalMs: 60000 },
  );
  assert.throws(() => parseCompoundRepairBackgroundRevisionConfig('{oops'), /compound-repair-background-revision-json-invalid/);
  assert.throws(() => parseCompoundRepairBackgroundRevisionConfig('{"enabled":"yes"}'), /compound-repair-background-revision-config-invalid/);
  assert.throws(() => parseCompoundRepairBackgroundRevisionConfig('{"enabled":true,"intervalMs":5000}'), /compound-repair-background-revision-interval-invalid/);
  assert.throws(() => parseCompoundRepairBackgroundRevisionConfig('{"enabled":true,"unknown":1}'), /compound-repair-background-revision-config-invalid/);
});

test('server resolves baseline/source payloads from the canonical P23 store and guards stale identity', async () => {
  const server = await readFile(new URL('../src/server/server.mjs', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
  assert.match(server, /resolveCanonicalPayloadsForRepair/);
  assert.match(server, /baselinePayload: structuredClone\(baseline\.payload\)/);
  assert.match(server, /sourceCandidatePayload: structuredClone\(source\.payload\)/);
  assert.match(server, /canonical-p23-revision-source-changed-during-independent-evaluation/);
  assert.match(runtime, /production-compound-repair-revision-requires-canonical-baseline-and-source-resolver/);
  assert.match(runtime, /resolveCanonicalPayloads: config\.compoundRepairRevision\.resolveCanonicalPayloadsForRepair/);
});

test('server attaches the separate host evaluator and explicit schedule to the runtime config', async () => {
  const server = await readFile(new URL('../src/server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE/);
  assert.match(server, /NEURO_COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH/);
  assert.match(server, /createNativeCompoundRepairRevisionProvider/);
  assert.match(server, /compound-repair-external-and-native-provider-configurations-are-mutually-exclusive/);
  assert.match(server, /createIndependentEvaluationConfigFactory\(\{/);
  assert.match(server, /independentEvaluationConfigForRepair/);
  assert.match(server, /baseline = source\.previousActive/);
  assert.match(server, /source\.baseVersion !== active\.version/);
  assert.match(server, /backgroundRevision: COMPOUND_REPAIR_BACKGROUND_REVISION/);
  assert.match(server, /compoundRepairRevision: COMPOUND_REPAIR_REVISION/);
  assert.doesNotMatch(server, /providerContext:\s*\{\s*engine,\s*candidateStore/);
});

console.log('WorkPass330 production revision wiring contracts passed');
