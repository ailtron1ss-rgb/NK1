import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(join(tmpdir(),'neuro-kurisu-p2873-'));
const core = new OrganismCore(new FileStateStore(join(dir,'state.json')), { cycleResultMode:'operational', performanceProfile:'mobile' });
await core.init();
let cloneCalls = 0;
const previous = globalThis.structuredClone;
globalThis.structuredClone = (value) => { cloneCalls += 1; return previous(value); };
try {
  const before = cloneCalls;
  const metadata = core.runtimeMetadataSnapshot();
  assert.ok(Number.isFinite(metadata.tick));
  assert.equal(typeof metadata.stage, 'string');
  assert.equal(typeof metadata.replaySignature, 'string');
  assert.equal(cloneCalls, before, 'runtime metadata must not deep-clone state');
  const lite = core.p2835MetricsLite();
  assert.ok(Number.isFinite(lite.tick));
  assert.ok(Number.isFinite(lite.learningScale01));
  console.log(`P2873_RUNTIME_METADATA=PASS cloneCalls=${cloneCalls} tick=${metadata.tick}`);
} finally {
  globalThis.structuredClone = previous;
  await core.flush();
  await rm(dir,{recursive:true,force:true});
}
