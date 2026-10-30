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
  assert.ok(after.lastEvent && after.lastEvent.kind !== 'quiet', 'the real runtime sample must produce one non-quiet canonical perception event');
  const evidence = runtime.evidenceBus.snapshot();
  const event = evidence.recent.find(item =>
    item.source === 'perception-engine'
    && item.kind === 'observation'
    && item.payload?.eventId === after.lastEvent?.id
  );

  assert.ok(event, 'a real runtime step must publish the PerceptionEngine event to RuntimeEvidenceBus');
  assert.equal(typeof event.payload.eventId, 'string');
  assert.ok(event.payload.eventId.length > 0);
  assert.equal(event.payload.eventSource, after.lastEvent?.source);
  assert.equal(event.payload.eventKind, after.lastEvent?.kind);
  assert.equal(event.payload.owner, 'OrganismCore');
  assert.equal(event.payload.eventId, after.lastEvent?.id, 'runtime evidence must reference the exact canonical Core event');
  assert.equal(evidence.recent.filter(item => item.source === 'perception-engine' && item.payload?.eventId === after.lastEvent?.id).length, 1, 'the same observation must not be double-published');
  assert.ok(Number.isFinite(event.confidence01) && event.confidence01 >= 0 && event.confidence01 <= 1);
  assert.ok(Array.isArray(event.payload.evidence));

  console.log('WORLD_PERCEPTION_RUNTIME_INGRESS=PASS');
} finally {
  await runtime.stop?.();
  await rm(dir, { recursive: true, force: true });
}
