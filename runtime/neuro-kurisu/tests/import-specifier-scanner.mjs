import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { scanRelativeImportSpecifiers } from '../scripts/lib/import-specifiers.mjs';

const specs = (src) => scanRelativeImportSpecifiers(src).map((r) => r.specifier);

test('reports a static relative import', () => {
  assert.deepEqual(specs("import x from './a.ts';"), ['./a.ts']);
});

test('reports a dynamic relative import with and without whitespace', () => {
  assert.deepEqual(specs("await import('./b.mjs');"), ['./b.mjs']);
  assert.deepEqual(specs("const p = import('./b2.mjs');"), ['./b2.mjs']);
  assert.deepEqual(specs("const p = import(\n  './b3.mjs'\n);"), ['./b3.mjs']);
});

test('reports a re-export from a relative module', () => {
  assert.deepEqual(specs("export { a } from './m.ts';"), ['./m.ts']);
});

test('ignores bare package specifiers', () => {
  assert.deepEqual(specs("import fs from 'node:fs';\nimport x from '@scope/pkg';"), []);
});

test('ignores type-only imports and exports, like the historical audit', () => {
  assert.deepEqual(specs("import type { T } from './c.ts';"), []);
  assert.deepEqual(specs("import type {\n  A,\n  B,\n} from './c2.ts';"), []);
  assert.deepEqual(specs("export type { T } from './n.ts';"), []);
});

test('still reports a value import that follows a type-only import', () => {
  assert.deepEqual(specs("import type { T } from './x.ts';\nimport y from './y.ts';"), ['./y.ts']);
});

// The regression that motivated this scanner: quoted import text inside a test
// fixture must not be treated as a real import.
test('ignores import text inside a double-quoted string literal', () => {
  assert.deepEqual(specs('const s = "import x from \'./d.ts\'";'), []);
});

test('ignores import text inside a single-quoted string literal', () => {
  assert.deepEqual(specs("const s = 'from \"./d.ts\"';"), []);
});

test('ignores import text inside a template literal', () => {
  assert.deepEqual(specs('const s = `from \'./e.ts\'`;'), []);
});

test('ignores import text inside line and block comments', () => {
  assert.deepEqual(specs("// import x from './f.ts'"), []);
  assert.deepEqual(specs("/* from './g.ts' */"), []);
});

test('a regex literal containing from-text does not create a false import', () => {
  assert.deepEqual(specs("const re = /from '.\\/h.ts'/; import y from './i.ts';"), ['./i.ts']);
});

test('a division operator is not mistaken for a regex literal', () => {
  assert.deepEqual(specs("const a = 4 / 2; import z from './j.ts';"), ['./j.ts']);
});

test('a real import after a template literal is still reported', () => {
  assert.deepEqual(specs("const s = `x`; import q from './k.ts';"), ['./k.ts']);
});

test('reports specifiers in source order with indices into the original text', () => {
  const src = "import a from './one.ts';\nimport b from './two.ts';";
  const out = scanRelativeImportSpecifiers(src);
  assert.deepEqual(out.map((r) => r.specifier), ['./one.ts', './two.ts']);
  assert.ok(out[0].index < out[1].index);
  assert.equal(src.slice(out[0].index + 1, out[0].index + 1 + './one.ts'.length), './one.ts');
});

// Real fixtures in the repository that previously produced false "missing
// import" failures must now yield no import specifiers.
test('world-perception runtime wiring test yields no import specifiers', async () => {
  const src = await readFile(new URL('./world-perception-runtime-wiring.mjs', import.meta.url), 'utf8');
  assert.deepEqual(specs(src), []);
});

test('avatar motor-intent test yields only its two real relative imports', async () => {
  const src = await readFile(new URL('../../../app/scripts/avatar-motor-intent.test.mjs', import.meta.url), 'utf8');
  assert.deepEqual(specs(src), [
    '../src/components/avatar/motorIntent.ts',
    '../../runtime/neuro-kurisu/public/live2d/embodiment-intent.mjs',
  ]);
});

console.log('IMPORT_SPECIFIER_SCANNER=PASS');
