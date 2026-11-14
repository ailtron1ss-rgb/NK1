import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import * as startupApi from './lib/super-startup.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPortAvailable,
  assertToolchainVersions,
  waitForHttpReady,
  workspaceNeedsNodeModules,
} from './lib/super-startup.mjs';

test('accepts the pinned Node/npm/Python toolchain', () => {
  const result = assertToolchainVersions({
    nodeVersion: 'v24.1.2',
    npmVersion: '10.9.0',
    pythonVersion: 'Python 3.11.8',
    expectedNodeMajor: 24,
    expectedPythonVersion: '3.11',
  });
  assert.equal(result.node.major, 24);
  assert.equal(result.npm.minor, 9);
  assert.equal(result.python.minor, 11);
});

test('rejects a Node major that differs from .nvmrc', () => {
  assert.throws(() => assertToolchainVersions({
    nodeVersion: 'v22.16.0',
    npmVersion: '10.9.0',
    pythonVersion: 'Python 3.11.8',
    expectedNodeMajor: 24,
    expectedPythonVersion: '3.11',
  }), /Node\.js 24\.x is required/);
});

test('rejects an npm version below the repository engine floor', () => {
  assert.throws(() => assertToolchainVersions({
    nodeVersion: 'v24.1.2',
    npmVersion: '10.7.0',
    pythonVersion: 'Python 3.11.8',
    expectedNodeMajor: 24,
    expectedPythonVersion: '3.11',
  }), /npm >=10\.8\.0 is required/);
});

test('rejects a Python minor version different from .python-version', () => {
  assert.throws(() => assertToolchainVersions({
    nodeVersion: 'v24.1.2',
    npmVersion: '10.9.0',
    pythonVersion: 'Python 3.12.0',
    expectedNodeMajor: 24,
    expectedPythonVersion: '3.11',
  }), /Python 3\.11\.x is required/);
});

test('waits for a service to return a successful HTTP response', async () => {
  let calls = 0;
  const result = await waitForHttpReady({
    url: 'http://service.test/health',
    serviceName: 'test-service',
    timeoutMs: 100,
    pollIntervalMs: 1,
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 3);
});

test('waits for an organism runtime to report ready=true, not only HTTP 200', async () => {
  let polls = 0;
  const result = await waitForHttpReady({
    url: 'http://runtime.test/health',
    serviceName: 'organism-runtime',
    timeoutMs: 100,
    pollIntervalMs: 1,
    fetchImpl: async () => {
      polls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ready: polls >= 3 }),
      };
    },
    isReady: async (response) => (await response.json()).ready === true,
  });
  assert.equal(result.status, 200);
  assert.equal(polls, 3);
});

test('fails promptly when the service process exits before readiness', async () => {
  await assert.rejects(waitForHttpReady({
    url: 'http://service.test/health',
    serviceName: 'dead-service',
    timeoutMs: 100,
    isAlive: () => false,
    fetchImpl: async () => ({ ok: true, status: 200 }),
  }), /exited before becoming ready/);
});

test('reports the final HTTP status when readiness times out', async () => {
  await assert.rejects(waitForHttpReady({
    url: 'http://service.test/health',
    serviceName: 'unhealthy-service',
    timeoutMs: 5,
    pollIntervalMs: 1,
    fetchImpl: async () => ({ ok: false, status: 503 }),
  }), /did not become ready.*HTTP 503/);
});

test('does not require node_modules for a dependency-free workspace', () => {
  assert.equal(workspaceNeedsNodeModules({ name: 'zero-dependency-runtime' }), false);
  assert.equal(workspaceNeedsNodeModules({ name: 'zero-dependency-runtime', dependencies: {} }), false);
});

test('requires node_modules when a workspace declares external dependencies', () => {
  assert.equal(workspaceNeedsNodeModules({ dependencies: { zod: '^4.0.0' } }), true);
  assert.equal(workspaceNeedsNodeModules({ devDependencies: { typescript: '^5.0.0' } }), true);
  assert.equal(workspaceNeedsNodeModules({ peerDependencies: { react: '^19.0.0' } }), true);
});

test('accepts an unused port and rejects a port already bound by another process', async () => {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await assert.rejects(assertPortAvailable(address.port), /already in use/);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});


test('provides one canonical runtime launch spec for dev and prebuilt modes', () => {
  assert.equal(
    typeof startupApi.createRuntimeLaunchSpec,
    'function',
    'both launchers must share a tested runtime entrypoint and working directory',
  );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const stateDir = path.join(root, '.super-state', 'organism');
  const spec = startupApi.createRuntimeLaunchSpec(root, stateDir, {
    nodeExecutable: '/usr/bin/node',
    nodeEnv: 'development',
  });
  const runtimeRoot = path.join(root, 'runtime', 'neuro-kurisu');
  const runtimeEntry = path.join(runtimeRoot, 'src', 'server', 'server.mjs');

  assert.equal(spec.command, '/usr/bin/node');
  assert.deepEqual(spec.args, ['--experimental-strip-types', runtimeEntry]);
  assert.equal(spec.cwd, runtimeRoot);
  assert.deepEqual(spec.env, {
    PORT: '3310',
    HOST: '127.0.0.1',
    STATE_DIR: stateDir,
    NODE_ENV: 'development',
  });
  assert.ok(existsSync(spec.args[1]), 'the configured runtime entrypoint must exist in the repository');
});
