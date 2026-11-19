import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverPath = new URL('../src/server/server.mjs', import.meta.url);
const runtimePath = new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url);
const server = readFileSync(serverPath, 'utf8');
const runtime = readFileSync(runtimePath, 'utf8');

assert.match(server, /req\.method === 'GET' && url\.pathname === '\/api\/organism\/evaluation\/evidence'/);
assert.match(server, /organism-runtime-not-ready/);
assert.match(server, /runtime\.independentEvaluationEvidenceSnapshot\(\)/);
assert.match(runtime, /buildIndependentEvaluationEvidenceBundle/);
assert.match(runtime, /independentEvaluationEvidenceSnapshot\(\)/);
assert.match(runtime, /this\.cognitiveEventFabric\.recent\(256\)/);
assert.match(runtime, /this\.core\.realityEvidenceLedgerSnapshot\(\)/);
assert.match(runtime, /this\.unifiedCycle\.snapshot\(\)/);
console.log('WORKPASS72_INSPECT_EVIDENCE_ROUTE=PASS read-only runtime projection is wired');
