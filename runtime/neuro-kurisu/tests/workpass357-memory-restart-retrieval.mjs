import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryOS2, defaultMemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const TARGET_ID = 'nk1-memory-restart-357';
const MARKER = 'verified causal trace marker-357 action observe-42 outcome success-731 independent confirmation';
const memoryRow = () => ({
  id: TARGET_ID,
  content: 'The ' + MARKER + ' remains durable after a process restart.',
  kind: 'episodic',
  source: 'restart-integration-test',
  createdAt: 1_760_000_000_000,
  lastAccessAt: 1_760_000_000_010,
  salience: 0.8,
  emotionalWeight: 0.2,
  identityRelevance: 0.4,
  goalRelevance: 0.7,
  socialRelevance: 0.1,
  predictionError: 0.15,
  temperature01: 0.2,
  confidence: 0.93,
  epistemicStatus: 'fact',
  entities: ['observe-42', 'success-731'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: ['outcome:success-731'],
  contradictionLinks: [],
  revisionHistory: [],
  dormant: false,
  retrievalCount: 0,
  semanticVector: [0.12, 0.34, 0.56],
});

async function writeProcess(statePath) {
  const memory = new MemoryOS2();
  memory.restore({ ...defaultMemoryOS2(), items: [memoryRow()] });
  const store = new FileStateStore(statePath, { encoding: 'json' });
  await store.save(memory.snapshot());
  console.log('MEMORY_RESTART_WRITER=PASS');
}

async function readProcess(statePath) {
  const store = new FileStateStore(statePath, { encoding: 'json' });
  const snapshot = await store.load();
  assert.ok(snapshot, 'fresh process must reopen the durable state file');
  const memory = new MemoryOS2();
  memory.restore(snapshot);
  const recovered = memory.retrieve(
    'verified causal trace marker-357 action observe-42 outcome success-731 independent confirmation',
    8,
  );
  assert.ok(recovered.some(item => item.id === TARGET_ID),
    'restored retrieval must return the same causal/autobiographical memory ID');
  const row = recovered.find(item => item.id === TARGET_ID);
  assert.ok(row.content.includes('outcome success-731'));
  assert.ok(row.causalLinks.includes('outcome:success-731'));
  assert.equal(memory.doctor({ maxIssues: 20 }).pass, true,
    'restored and re-indexed memory must pass its read-only integrity doctor');
  console.log('MEMORY_RESTART_RETRIEVAL=PASS');
}

const mode = process.argv[2];
const statePath = process.argv[3];
if (mode === 'write') {
  await writeProcess(statePath);
} else if (mode === 'read') {
  await readProcess(statePath);
} else {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nk1-memory-restart-357-'));
  const durablePath = path.join(temp, 'memory-state.json');
  const entry = fileURLToPath(import.meta.url);
  const runChild = phase => {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', entry, phase, durablePath], {
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (child.error || child.status !== 0) {
      throw new Error(
        'memory-restart-child-failed:' + phase +
        ':status=' + String(child.status) +
        ':error=' + String(child.error?.message ?? '') +
        ':stdout=' + String(child.stdout).slice(-2000) +
        ':stderr=' + String(child.stderr).slice(-4000),
      );
    }
    return child.stdout;
  };
  try {
    const written = runChild('write');
    assert.match(written, /MEMORY_RESTART_WRITER=PASS/);
    const read = runChild('read');
    assert.match(read, /MEMORY_RESTART_RETRIEVAL=PASS/);
    console.log('WORKPASS357_FILE_BACKED_MEMORY_RESTART=PASS separate writer/reader processes');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
