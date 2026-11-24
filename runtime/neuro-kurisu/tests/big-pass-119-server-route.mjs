import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/server/server.mjs',import.meta.url),'utf8');
assert.match(source,/\/api\/organism\/developmental-synthesis/);
assert.match(source,/developmentalSynthesisDiagnostics/);
console.log('BIG_PASS_119_SERVER_ROUTE=PASS');
