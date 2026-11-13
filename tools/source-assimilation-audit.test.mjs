import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSourceRegistry, validateSourceRegistry, summarizeSourceRegistry, renderSourceReport } from './source-assimilation-audit.mjs';

const doc = await loadSourceRegistry();
const clone = () => structuredClone(doc);

test('registry records four containers, 22 archive artifacts and 21 unique projects', () => {
  const v = validateSourceRegistry(doc);
  assert.equal(v.ok,true,v.errors.join('; '));
  assert.deepEqual([v.metrics.containers,v.metrics.artifacts,v.metrics.sources],[4,22,21]);
});
test('duplicate Letta artifacts are preserved but deduplicated by source identity', () => {
  const letta = doc.sources.find(s=>s.id==='letta');
  assert.equal(letta.artifacts.length,2);
  assert.equal(letta.artifacts[0].sha256,letta.artifacts[1].sha256);
  assert.equal(summarizeSourceRegistry(doc).sources,21);
});
test('malformed digest and unknown archive container fail validation', () => {
  const a=clone(); a.sources[0].artifacts[0].container='missing.7z';
  assert.equal(validateSourceRegistry(a).ok,false);
  const b=clone(); b.sources[0].artifacts[0].sha256='bad';
  assert.equal(validateSourceRegistry(b).ok,false);
});
test('mixed-scope AutoGPT cannot copy code without approved legal clearance', () => {
  const a=clone(); a.sources.find(s=>s.id==='autogpt').implementation.codeCopied=true;
  assert.ok(validateSourceRegistry(a).errors.some(e=>e.includes('codeCopied requires approved legal clearance')));
});
test('runtime wiring, test pass and release evidence must follow the gate order', () => {
  const a=clone(); a.sources[0].implementation.runtimeWired=true;
  assert.ok(validateSourceRegistry(a).errors.some(e=>e.includes('runtime wiring requires adaptation')));
  const b=clone(); b.sources[0].implementation.testsPassed=true;
  assert.ok(validateSourceRegistry(b).errors.some(e=>e.includes('tests require runtime wiring')));
  const c=clone(); c.sources[0].implementation.releaseVerified=true;
  assert.ok(validateSourceRegistry(c).errors.some(e=>e.includes('release requires test pass')));
});
test('six existing adapter discoveries are not counted as adaptations or releases', () => {
  const s=summarizeSourceRegistry(doc);
  assert.equal(s.adapters,6); assert.equal(s.adapted,0);
  assert.equal(s.wired,0); assert.equal(s.tested,0); assert.equal(s.released,0);
  assert.match(renderSourceReport(doc),/not an overall readiness score/);
});
test('all source records have one target and a concrete next action', () => {
  assert.equal(doc.sources.length,21);
  for(const s of doc.sources){ assert.ok(s.nk1.targetPaths.length,s.id); assert.ok(s.nextAction.length>30,s.id); }
});
