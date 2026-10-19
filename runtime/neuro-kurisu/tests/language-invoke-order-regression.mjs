import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../src/server/server.mjs', import.meta.url));
const source = await readFile(serverPath, 'utf8');
const start = source.indexOf('async function invokeLanguage(request)');
const end = source.indexOf('const runtime = new OrganismRuntime', start);
assert.ok(start >= 0 && end > start, 'server must retain the canonical invokeLanguage function');
const invoke = source.slice(start, end);
const responseAt = invoke.indexOf('const response = await generateLanguage(');
const finishedAt = invoke.indexOf('const finishedAt = Date.now();');
const observeAt = invoke.indexOf('LOCAL_LANGUAGE_BACKEND_POLICY.observe(');
assert.ok(responseAt >= 0 && finishedAt > responseAt, 'finish timestamp must be captured after language generation completes');
assert.ok(observeAt > finishedAt, 'policy observation must happen only after finishedAt is initialized');
assert.equal((invoke.match(/const finishedAt = Date\\.now\\(\\);/g) ?? []).length, 1, 'invokeLanguage must have exactly one completion timestamp declaration');
assert.match(invoke, /const backend = String\(response\.backend \?\? effectiveBackend \?\? 'unknown'\)/, 'reported backend must prefer the backend returned by the actual provider');
console.log('LANGUAGE_INVOKE_ORDER_REGRESSION=PASS', JSON.stringify({ responseBeforeTimestamp: true, timestampBeforeObservation: true, backendAttribution: 'actual-response-first' }));
