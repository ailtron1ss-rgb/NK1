import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashHoldoutRows, normalizeHoldoutQuery } from './holdout-normalization.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runner=path.join(root,'tests/run-independent-bilingual-memory-holdout.mjs');

assert.equal(
  normalizeHoldoutQuery('  Ｈｅｌｌｏ　WORLD—again?!  '),
  'hello world again',
  'Unicode compatibility characters, punctuation and repeated spaces normalize deterministically',
);
assert.equal(normalizeHoldoutQuery('A/B + C'), 'a b c', 'punctuation and symbols separate terms');
assert.equal(normalizeHoldoutQuery('One\n\tTwo'), 'one two', 'whitespace collapses to one ASCII space');

const rows=[
  {id:'q2',query:'WHAT—Now?',relevantIds:['memory-b','memory-a'],split:'holdout',language:'en'},
  {id:'q1',query:'A/B',relevantIds:['memory-z'],split:'train',answerable:true,language:'ru'},
];
const reordered=[
  {id:'q1',query:'a b',relevantIds:['memory-z'],split:'train',answerable:true,language:'ru'},
  {id:'q2',query:'what now',relevantIds:['memory-a','memory-b'],split:'holdout',answerable:true,language:'en'},
];
assert.equal(hashHoldoutRows(rows),hashHoldoutRows(reordered),'canonical fingerprint ignores input order, label order and equivalent query punctuation');
assert.notEqual(
  hashHoldoutRows(reordered),
  hashHoldoutRows(reordered.map((row) => row.id === 'q1' ? {...row, language:'en'} : row)),
  'fingerprint binds explicit language annotations',
);
assert.notEqual(hashHoldoutRows(rows),hashHoldoutRows([...reordered,{id:'q3',query:'new',relevantIds:[],split:'holdout',answerable:false,language:'en'}]),'fingerprint changes when evidence rows change');

const result=spawnSync(process.execPath,['--experimental-strip-types',runner],{cwd:root,encoding:'utf8',timeout:15000});
assert.equal(result.error,undefined,'runner must start and parse successfully');
assert.equal(result.status,2,'runner without an external dataset must fail closed with usage exit code 2');
assert.match(result.stderr,/--dataset <external-dataset\.json>/,'runner must explain the required external dataset argument');
assert.match(result.stderr,/--candidate-mode canonical\|metadata/,'runner must document the canonical and metadata candidate modes');
const invalidMode=spawnSync(process.execPath,['--experimental-strip-types',runner,'--candidate-mode','silent-promotion'],{cwd:root,encoding:'utf8',timeout:15000});
assert.equal(invalidMode.error,undefined,'invalid candidate mode must fail as an ordinary argument error');
assert.equal(invalidMode.status,2,'unknown candidate modes must fail closed');
assert.match(invalidMode.stderr,/Invalid --candidate-mode/,'invalid candidate mode must not silently fall back to canonical');
const metadataWithoutDataset=spawnSync(process.execPath,['--experimental-strip-types',runner,'--candidate-mode','metadata'],{cwd:root,encoding:'utf8',timeout:15000});
assert.equal(metadataWithoutDataset.status,2,'metadata mode still requires a real external dataset');
assert.match(metadataWithoutDataset.stderr,/--dataset <external-dataset\.json>/,'metadata mode without data must explain how to provide the independent dataset');
assert.doesNotMatch(result.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module/,'runner imports and syntax must be valid');
console.log('WorkPass507 bilingual holdout runner contract: passed');
