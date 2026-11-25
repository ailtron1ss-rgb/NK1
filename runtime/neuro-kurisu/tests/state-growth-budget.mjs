import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

// Guards the durable-state budget: growth must stay bounded and must not accelerate.
// Calibrated on 2026-11-25: ~12 MB at 80 steps, ~25 MB at 600 steps (see plan, section 12.2).
const STEPS = Math.max(40, Number(process.env.NK_STATE_GROWTH_STEPS || 80));
const LIMIT_MB = Number(process.env.NK_STATE_GROWTH_LIMIT_MB || 13.5);
const SAMPLE_EVERY = 20;
const MB = 1048576;

const dir = await mkdtemp(path.join(tmpdir(), 'nk-state-growth-'));
const runtime = new OrganismRuntime({
  stateFile: path.join(dir, 'state.json'),
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: false,
  journal: new BoundedOperationalJournal(),
  checkpointMinIntervalMs: 0,
});

const samples = [];
try {
  await runtime.init();
  for (let step = 1; step <= STEPS; step++) {
    await runtime.step(step % 5 === 0 ? 'Проверим это осторожно и учтём результат.' : 'Продолжаем наблюдение.');
    if (step % SAMPLE_EVERY === 0) {
      const bytes = Buffer.byteLength(JSON.stringify(runtime.core.snapshot()));
      samples.push({ step, mb: +(bytes / MB).toFixed(2) });
    }
  }
} finally {
  await runtime.stop();
  await rm(dir, { recursive: true, force: true });
}

const finalMb = samples.at(-1).mb;
const firstDelta = samples[1].mb - samples[0].mb;
const lastDelta = samples.at(-1).mb - samples.at(-2).mb;
const trend = samples.map(sample => `${sample.step}:${sample.mb}MB`).join(' ');
console.log(`STATE_GROWTH ${trend} firstDelta=${firstDelta.toFixed(2)}MB lastDelta=${lastDelta.toFixed(2)}MB limit=${LIMIT_MB}MB`);

assert.ok(finalMb <= LIMIT_MB, `state grew to ${finalMb}MB at ${STEPS} steps, budget is ${LIMIT_MB}MB (${trend})`);
assert.ok(
  lastDelta <= firstDelta * 1.25 + 0.25,
  `state growth accelerated: first window +${firstDelta.toFixed(2)}MB, last window +${lastDelta.toFixed(2)}MB (${trend})`,
);

console.log('STATE_GROWTH_BUDGET=PASS');
