import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/server/server.mjs',import.meta.url),'utf8');
assert.match(source,/\/api\/organism\/meta-developmental/);
assert.match(source,/metaDevelopmentalDiagnostics/);
console.log('BIG_PASS_121_SERVER_ROUTE=PASS');
