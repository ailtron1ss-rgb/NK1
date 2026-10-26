import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const start = await readFile(path.join(root, 'tools', 'super-start.mjs'), 'utf8');
const dev = await readFile(path.join(root, 'tools', 'super-dev.mjs'), 'utf8');

test('production start launches runtime from the runtime workspace', () => {
  assert.match(start, /const launch = \(label, command, args, env = \{\}, cwd = ROOT\)/);
  assert.match(start, /launch\('neuro-kurisu',[\s\S]*?resolve\(ROOT, 'runtime\/neuro-kurisu'\)\);/);
  assert.match(start, /launch\('research-bridge',[\s\S]*?\['research\/research_bridge\.py'\]/);
  assert.match(start, /launch\('gateway',[\s\S]*?\['tools\/super-gateway\.mjs'\]/);
});

test('developer mode launches runtime from the runtime workspace', () => {
  assert.match(dev, /function launch\(label, command, args, env = \{\}, cwd = ROOT\)/);
  assert.match(dev, /launch\('neuro-kurisu',[\s\S]*?resolve\(ROOT, 'runtime\/neuro-kurisu'\)\);/);
  assert.match(dev, /launch\('research-bridge',[\s\S]*?\['research\/research_bridge\.py'\]/);
});

test('the launcher does not bind the runtime entrypoint to the monorepo root', () => {
  assert.doesNotMatch(start, /launch\('neuro-kurisu',[\s\S]*?\},\s*ROOT\);/);
  assert.doesNotMatch(dev, /launch\('neuro-kurisu',[\s\S]*?\},\s*ROOT\);/);
});

console.log('Super start workspace contract: PASS');
