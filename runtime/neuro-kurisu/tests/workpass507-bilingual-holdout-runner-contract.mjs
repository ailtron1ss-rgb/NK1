import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runner=path.join(root,'tests/run-independent-bilingual-memory-holdout.mjs');
const result=spawnSync(process.execPath,['--experimental-strip-types',runner],{cwd:root,encoding:'utf8',timeout:15000});
assert.equal(result.error,undefined,'runner must start and parse successfully');
assert.equal(result.status,2,'runner without an external dataset must fail closed with usage exit code 2');
assert.match(result.stderr,/--dataset <external-dataset\.json>/,'runner must explain the required external dataset argument');
assert.doesNotMatch(result.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module/,'runner imports and syntax must be valid');
console.log('WorkPass507 bilingual holdout runner contract: passed');
