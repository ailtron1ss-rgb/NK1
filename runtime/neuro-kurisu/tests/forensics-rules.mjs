import assert from 'node:assert/strict';
import { isLongLine, isDuplicateNameGroup, longLineMeasure, MAX_LINE } from '../scripts/lib/forensics-rules.mjs';

// --- long-line rule: code length, not raw length -------------------------------
const blob = 'x'.repeat(MAX_LINE * 2);

// A giant string/template/comment inside code is data, not logic: not flagged.
assert.equal(isLongLine('src/a.ts', `const p = '${blob}';`), false, 'long string literal must not count');
assert.equal(isLongLine('src/a.ts', `const p = \`${blob}\`;`), false, 'long template literal must not count');
assert.equal(isLongLine('src/a.ts', `// ${blob}`), false, 'long comment must not count');
assert.equal(isLongLine('config.json', `{"k":"${blob}"}`), false, 'long json string value must not count');

// Genuinely dense code is flagged.
assert.equal(isLongLine('src/a.ts', `const v=${'a+'.repeat(MAX_LINE / 2)}0;`), true, 'dense code must be flagged');
assert.equal(isLongLine('config.json', `{"k":${'[1,'.repeat(MAX_LINE / 3)}1]}`), true, 'dense json must be flagged');

// Prose is still measured raw.
assert.equal(isLongLine('docs/a.md', blob), true, 'long prose line must be flagged');
assert.equal(isLongLine('README.md', 'short line'), false, 'short prose must pass');

// measure ignores whitespace so indentation alone never trips the rule.
assert.equal(longLineMeasure('src/a.ts', `${' '.repeat(MAX_LINE + 50)}const a=1;`), 9, 'whitespace must not count');

// --- duplicate-name rule: provenance and role pairs are not duplication --------
const readFrom = map => p => {
  if (!(p in map)) throw new Error(`missing fixture ${p}`);
  return map[p];
};

assert.equal(isDuplicateNameGroup(['a/x.ts']), false, 'singleton group is not duplication');
assert.equal(
  isDuplicateNameGroup(['src/index.ts', 'app/index.ts']),
  false, 'index.ts groups are exempt'
);
assert.equal(
  isDuplicateNameGroup([
    'research/vendor/CleanRL/LICENSE',
    'research/vendor/OpenAIA/LICENSE',
  ]),
  false, 'vendored legal files are provenance'
);
assert.equal(
  isDuplicateNameGroup(['LICENSE', 'research/vendor/CleanRL/LICENSE']),
  false, 'root + vendored legal files share a name legitimately'
);
assert.equal(
  isDuplicateNameGroup(['scripts/harness.mjs', 'tests/harness.mjs'], readFrom({
    'scripts/harness.mjs': 'export const a = 1;',
    'tests/harness.mjs': 'assert.ok(true);',
  })),
  false, 'distinct harness/test pair is not duplication'
);
assert.equal(
  isDuplicateNameGroup(['src/harness.mjs', 'tests/harness.mjs'], readFrom({
    'src/harness.mjs': 'identical body',
    'tests/harness.mjs': 'identical body',
  })),
  true, 'byte-identical harness/test pair is real copy-paste'
);
assert.equal(
  isDuplicateNameGroup(['src/alpha.ts', 'src/beta/alpha.ts']),
  true, 'unrelated same-name modules are flagged'
);

console.log(JSON.stringify({ pass: true, suite: 'forensics-rules', maxLine: MAX_LINE }));
