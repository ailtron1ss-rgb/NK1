import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { maskNonCode } from '../scripts/lib/source-mask.mjs';

// Resolve from this file, not cwd, so the regression holds whether the suite is run
// from the runtime package or the repository root.
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pat = /(?:from\s*|import\()(['"])(\.\.?\/[^'"]+)\1/g;

const codeSpecifiers = source => {
  const masked = maskNonCode(source);
  const found = [];
  let m;
  while ((m = pat.exec(source))) {
    if (masked.slice(m.index, m.index + m[0].length).trim() === '') continue;
    found.push(m[2]);
  }
  return found;
};

// Comments, strings and regex literals must be masked; real code must not be.
assert.deepEqual(codeSpecifiers(`import x from './real.ts';\n`), ['./real.ts']);
assert.deepEqual(codeSpecifiers(`// import x from './commented.ts';\n`), []);
assert.deepEqual(codeSpecifiers(`/* import x from './blocked.ts'; */\n`), []);
assert.deepEqual(codeSpecifiers(`const s = "from './in-string.ts'";\n`), []);
assert.deepEqual(codeSpecifiers(`const s = 'import("./in-string.ts")';\n`), []);
assert.deepEqual(codeSpecifiers('const t = `import("./in-template.ts")`;\n'), []);
assert.deepEqual(codeSpecifiers(`const r = /from '\\.\\/in-regex\\.ts'/;\n`), []);
assert.deepEqual(codeSpecifiers(`const re = /['"]/g;\n`), []);

// Division is not a regex literal, so a following specifier-like string stays masked.
assert.deepEqual(codeSpecifiers(`const q = a / b;\nconst s = "from './after-div.ts'";\n`), []);
assert.deepEqual(codeSpecifiers(`const v = await import('./dynamic.ts');\n`), ['./dynamic.ts']);
// A quote inside a comment must not open a phantom string that swallows real code.
assert.deepEqual(codeSpecifiers(`// it's fine\nimport y from './after-comment.ts';\n`), ['./after-comment.ts']);

// Regression guard: the two files that previously tripped `audit:architecture` embed
// specifier text inside assertion strings. `world-perception-runtime-wiring.mjs` has no
// real relative imports at all, so masking must yield an empty set rather than the two
// false positives; the app test keeps its genuine imports while dropping the embedded one.
const previouslyFlagged = [
  [path.join(root, 'tests/world-perception-runtime-wiring.mjs'), []],
  [path.resolve(root, '../../app/scripts/avatar-motor-intent.test.mjs'), null],
];
const resolve = (base, spec) => {
  const clean = String(spec).split('?')[0];
  const p = path.resolve(path.dirname(base), clean);
  const candidates = [p, ...['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.jsx'].map(e => p + e), path.join(p, 'index.ts'), path.join(p, 'index.tsx')];
  return candidates.find(x => existsSync(x) && statSync(x).isFile());
};
for (const [file, expected] of previouslyFlagged) {
  assert.ok(existsSync(file), `fixture missing: ${file}`);
  const source = await readFile(file, 'utf8');
  const specs = codeSpecifiers(source);
  if (expected !== null) assert.deepEqual(specs, expected, `${path.relative(root, file)} specifier set changed`);
  else assert.ok(specs.length > 0, `${path.relative(root, file)} must still contribute real imports`);
  for (const spec of specs) {
    assert.ok(resolve(file, spec), `${path.relative(root, file)} has an unresolved code import: ${spec}`);
  }
}

console.log('ARCHITECTURE_AUDIT_MASKING=PASS');
