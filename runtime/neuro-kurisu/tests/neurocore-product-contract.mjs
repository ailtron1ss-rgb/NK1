import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('NeuroCore is the application identity in browser metadata and the home screen', () => {
  const documentRoot = read('app/src/routes/__root.tsx');
  const home = read('app/src/routes/index.tsx');
  assert.match(documentRoot, /const APP_NAME = ["']NeuroCore["']/);
  assert.match(home, />NeuroCore<\/h1>/);
  assert.doesNotMatch(home, /canonical runtime · Neuro-Kurisu/);
});

test('frontend prefers NeuroCore API configuration and keeps a migration fallback', () => {
  const api = read('app/src/neuro-kurisu/api.ts');
  assert.match(api, /VITE_NEUROCORE_API_BASE/);
  assert.match(api, /VITE_NEURO_KURISU_API_BASE/);
});

test('runtime health endpoint identifies the product as NeuroCore', () => {
  const server = read('runtime/neuro-kurisu/src/server/server.mjs');
  assert.match(server, /service: 'neurocore'/);
  assert.match(server, /legacyService: 'neuro-kurisu'/);
});
