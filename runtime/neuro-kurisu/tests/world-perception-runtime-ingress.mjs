import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'nk1-world-perception-ingress-'));
const runtime = new OrganismRuntime({
  stateFile: path.join(dir, 'organism.json'),
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: false,
  autoRun: false,
});

try {
  await runtime.init();
  const before = runtime.core.perceptionSnapshot();
  await runtime.step('world perception runtime ingress smoke test', { deliberate: false });
  const after = runtime.core.perceptionSnapshot();
  assert.equal(after.eventCount, before.eventCount + 1, 'one core observation must produce exactly one canonical perception event');
  assert.equal(after.lastEvent?.kind, 'text-input');
  assert.equal(after.lastEvent?.source, 'social');
  const evidence = runtime.evidenceBus.snapshot();
  const event = evidence.recent.find(item =>
    item.source === 'perception-engine'
    && item.kind === 'observation'
    && item.payload?.eventKind === 'text-input'
  );

  assert.ok(event, 'a real runtime step must publish the PerceptionEngine event to RuntimeEvidenceBus');
  assert.equal(typeof event.payload.eventId, 'string');
  assert.ok(event.payload.eventId.length > 0);
  assert.equal(event.payload.eventSource, 'social');
  assert.equal(event.payload.eventId, after.lastEvent?.id, 'runtime evidence must reference the exact canonical Core event');
  assert.equal(evidence.recent.filter(item => item.source === 'perception-engine' && item.payload?.eventId === after.lastEvent?.id).length, 1, 'the same observation must not be double-published');
  assert.ok(Number.isFinite(event.confidence01) && event.confidence01 >= 0 && event.confidence01 <= 1);
  assert.ok(Array.isArray(event.payload.evidence));

  console.log('WORLD_PERCEPTION_RUNTIME_INGRESS=PASS');
} finally {
  await runtime.stop?.();
  await rm(dir, { recursive: true, force: true });
}
