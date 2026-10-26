import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSupervisedDevelopmentServiceSpecs, buildSupervisedServiceSpecs, missingServiceRequirements, PRODUCTION_UI_BUILD_ENTRYPOINT, resolveSupervisorStateDir } from './supervised-service-specs.mjs';

const root = '/opt/neuro-kurisu';
const stateDir = '/opt/neuro-kurisu/.super-state';
const nodeExecutable = '/usr/local/bin/node';

test('supervisor state directory defaults safely and supports an isolated explicit override', () => {
  assert.equal(resolveSupervisorStateDir(root), '/opt/neuro-kurisu/.super-state');
  assert.equal(resolveSupervisorStateDir(root, '/tmp/nk1-supervisor-smoke/state'), '/tmp/nk1-supervisor-smoke/state');
  assert.equal(resolveSupervisorStateDir(root, 'test-state'), '/opt/neuro-kurisu/test-state');
  assert.throws(() => resolveSupervisorStateDir(''), /root is required/);
});

test('runtime service resolves its relative entrypoint from the runtime workspace', () => {
  const specs = buildSupervisedServiceSpecs({ root, stateDir, nodeExecutable });
  const runtime = specs.find(spec => spec.label === 'neuro-kurisu');
  assert.ok(runtime);
  assert.equal(runtime.command, nodeExecutable);
  assert.equal(runtime.cwd, '/opt/neuro-kurisu/runtime/neuro-kurisu');
  assert.deepEqual(runtime.args, ['--experimental-strip-types', 'src/server/server.mjs']);
  assert.equal(runtime.env.STATE_DIR, '/opt/neuro-kurisu/.super-state/organism');
});

test('project-level bridge, preview and gateway run from repository root', () => {
  const specs = buildSupervisedServiceSpecs({ root, stateDir, nodeExecutable });
  assert.deepEqual(specs.map(spec => spec.label), [
    'neuro-kurisu', 'research-bridge', 'ui-preview', 'gateway',
  ]);
  for (const label of ['research-bridge', 'ui-preview', 'gateway']) {
    assert.equal(specs.find(spec => spec.label === label).cwd, root, label);
  }
  assert.deepEqual(specs.find(spec => spec.label === 'research-bridge').args, ['research/research_bridge.py']);
  assert.deepEqual(specs.find(spec => spec.label === 'ui-preview').args, ['--prefix', 'app', 'run', 'preview']);
  assert.deepEqual(specs.find(spec => spec.label === 'gateway').args, ['tools/super-gateway.mjs']);
});

test('all configured service entrypoints exist relative to their declared working directories', () => {
  const actualRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const specs = buildSupervisedServiceSpecs({
    root: actualRoot,
    stateDir: resolve(actualRoot, '.super-state'),
    nodeExecutable: process.execPath,
  });
  const entrypointByService = new Map([
    ['neuro-kurisu', 'src/server/server.mjs'],
    ['research-bridge', 'research/research_bridge.py'],
    ['ui-preview', 'app/package.json'],
    ['gateway', 'tools/super-gateway.mjs'],
  ]);
  for (const spec of specs) {
    assert.equal(
      existsSync(resolve(spec.cwd, entrypointByService.get(spec.label))),
      true,
      `${spec.label} entrypoint must exist from cwd ${spec.cwd}`,
    );
  }
});

test('service specs reject missing launch inputs instead of constructing unusable paths', () => {
  assert.throws(() => buildSupervisedServiceSpecs({ root: '', stateDir, nodeExecutable }), /root is required/);
  assert.throws(() => buildSupervisedServiceSpecs({ root, stateDir: '', nodeExecutable }), /state directory is required/);
  assert.throws(() => buildSupervisedServiceSpecs({ root, stateDir, nodeExecutable: '' }), /Node executable is required/);
});


test('development specs use the runtime workspace and repository-level bridge/UI paths', () => {
  const specs = buildSupervisedDevelopmentServiceSpecs({ root, stateDir, nodeExecutable });
  assert.deepEqual(specs.map(spec => spec.label), ['neuro-kurisu', 'research-bridge', 'ui']);
  const runtime = specs.find(spec => spec.label === 'neuro-kurisu');
  assert.equal(runtime.cwd, '/opt/neuro-kurisu/runtime/neuro-kurisu');
  assert.equal(runtime.env.NODE_ENV, 'development');
  assert.equal(runtime.command, nodeExecutable);
  assert.deepEqual(runtime.args, ['--experimental-strip-types', 'src/server/server.mjs']);
  assert.equal(specs.find(spec => spec.label === 'research-bridge').cwd, root);
  assert.equal(specs.find(spec => spec.label === 'ui').cwd, root);
  assert.deepEqual(specs.find(spec => spec.label === 'ui').args, ['--prefix', 'app', 'run', 'dev']);
  assert.deepEqual(missingServiceRequirements(specs, () => true), []);
});

test('development supervisor uses shared launch specs and fail-closed child policy', () => {
  const actualRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const devSource = readFileSync(resolve(actualRoot, 'tools/super-dev.mjs'), 'utf8');
  assert.match(devSource, /buildSupervisedDevelopmentServiceSpecs/);
  assert.match(devSource, /decideSupervisedChildExit/);
  assert.match(devSource, /decideSupervisedChildSpawnError/);
  assert.match(devSource, /inspectSupervisorToolchain/);
});

test('required service prerequisites are checked before local state is created', () => {
  const specs = buildSupervisedServiceSpecs({ root, stateDir, nodeExecutable });
  assert.deepEqual(missingServiceRequirements(specs, () => true), []);

  const uiBuildOutput = resolve(root, PRODUCTION_UI_BUILD_ENTRYPOINT);
  const missingUi = missingServiceRequirements(specs, candidate => candidate !== uiBuildOutput);
  assert.deepEqual(missingUi, [{ label: 'ui-preview', path: uiBuildOutput }],
    'an unbuilt UI preview must be reported before the supervisor launches any child');

  const actualRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const startup = readFileSync(resolve(actualRoot, 'tools/super-start.mjs'), 'utf8');
  const interpreterCheck = startup.indexOf("commandAvailable('python3')");
  const requirementsCheck = startup.indexOf('missingServiceRequirements(serviceSpecs, existsSync)');
  const stateCreation = startup.indexOf('mkdirSync(stateDir, { recursive: true })');
  assert.ok(interpreterCheck >= 0 && stateCreation > interpreterCheck,
    'missing mandatory Python runtime must fail before creating state');
  assert.ok(requirementsCheck >= 0 && stateCreation > requirementsCheck,
    'missing entrypoints/build output must fail before creating state');
  assert.ok(startup.includes('Build the UI before production-style start: npm run build'));
  assert.ok(startup.includes('app/.vercel/output/static/index.html'));
});
