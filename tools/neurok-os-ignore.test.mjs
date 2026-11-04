import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitignore = await readFile(path.join(root, '.gitignore'), 'utf8');

test('local NeuroK coordinator and evidence state stays out of Git', () => {
  const patterns = gitignore.split(/\r?\n/).map(line => line.trim());
  assert.ok(patterns.includes('.neurok-os/'), '.neurok-os/ must be ignored because it stores machine-local claims and evidence receipts');
});
