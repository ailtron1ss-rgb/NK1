import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');

test('dev and production launchers target the canonical runtime entrypoint', () => {
  const runtimeEntry = 'runtime/neuro-kurisu/src/server/server.mjs';
  assert.equal(existsSync(path.join(root, runtimeEntry)), true, 'canonical runtime server must exist');
  const dev = read('tools/super-dev.mjs');
  const start = read('tools/super-start.mjs');
  const integration = read('tools/verify-integration.mjs');
  for (const [name, source] of [['dev', dev], ['start', start]]) {
    assert.ok(source.includes(runtimeEntry), name + ' must launch the runtime from its actual workspace path');
    assert.ok(source.includes("fileURLToPath(new URL('..', import.meta.url))"), name + ' must resolve paths from its own location');
    assert.ok(source.includes('ORGANISM_RUNTIME_URL'), name + ' must pass the runtime URL to the research bridge');
    assert.ok(source.includes('required runtime entrypoint missing'), name + ' must fail before spawning if the runtime entrypoint is missing');
    assert.ok(source.includes('shuttingDown'), name + ' must guard coordinated shutdown');
  }
  assert.ok(integration.includes(runtimeEntry), 'integration smoke is the canonical launch-path reference');
  assert.ok(!dev.includes("'src/server/server.mjs'"));
  assert.ok(!start.includes("'src/server/server.mjs'"));
});

test('production gateway UI port matches Vite preview and all sidecars resolve', () => {
  const start = read('tools/super-start.mjs');
  const gateway = read('tools/super-gateway.mjs');
  const vite = read('app/vite.config.ts');
  for (const relative of [
    'research/research_bridge.py',
    'tools/super-gateway.mjs',
    'runtime/neuro-kurisu/src/server/server.mjs',
    'app/package.json',
  ]) assert.ok(existsSync(path.join(root, relative)), 'missing launch dependency: ' + relative);
  assert.match(start, /SUPER_UI_PORT:\s*'8081'/);
  assert.match(start, /SUPER_GATEWAY_PORT:\s*'8080'/);
  assert.match(start, /SUPER_RUNTIME_PORT:\s*'3310'/);
  assert.match(start, /SUPER_RESEARCH_PORT:\s*'8765'/);
  assert.match(vite, /preview:\s*\{[\s\S]*?port:\s*8081/);
  assert.match(gateway, /SUPER_UI_PORT\s*\|\|\s*8081/);
  assert.match(gateway, /SUPER_RUNTIME_PORT\s*\|\|\s*3310/);
  assert.match(gateway, /SUPER_RESEARCH_PORT\s*\|\|\s*8765/);
});

test('startup failure of any required child initiates coordinated shutdown', () => {
  for (const relative of ['tools/super-dev.mjs', 'tools/super-start.mjs']) {
    const source = read(relative);
    assert.match(source, /child\.on\('error'/);
    assert.match(source, /child\.on\('exit'/);
    assert.ok(source.includes('void shutdown('), relative + ' must stop sibling services on child failure');
    assert.ok(source.includes("child.kill('SIGTERM')"), relative + ' must terminate child processes cleanly');
  }
});
