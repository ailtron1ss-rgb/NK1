import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const base = path.join(tmpdir(), `nk324-watchdog-${process.pid}-${Date.now()}`);
const make = () => new OrganismRuntime({
  stateFile: base + '.json', worldStateFile: base + '.world.json', autoRun:false,
  enableLanguage:false, intervalMs:5000, checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1,
});

const r1 = make();
await r1.init();
await r1.flush();
const w1 = r1.core.recoveryWatchdogSnapshot();
assert.equal(w1.recoveryCount, 0);
assert(w1.lastTick >= 0);
r1.stop();

const r2 = make();
await r2.init();
const w2 = r2.core.recoveryWatchdogSnapshot();
assert.equal(w2.status, 'healthy');
assert.equal(w2.recoveryCount, 1);
assert.equal(w2.lastTick, w1.lastTick);
assert.equal(w2.lastLearningCount, w1.lastLearningCount);
await r2.flush();
const w3 = r2.core.recoveryWatchdogSnapshot();
assert.equal(w3.status, 'healthy');
assert.equal(w3.recoveryCount, 1);
assert(w3.lastTick >= w2.lastTick);
r2.stop();

for (const suffix of ['.json','.world.json','.continuity.jsonl','.operational.jsonl','.json.bak','.world.json.bak','.world.json.tmp']) await rm(base+suffix,{force:true});
console.log(JSON.stringify({
  pass:true,
  before:{recoveryCount:w1.recoveryCount,tick:w1.lastTick,learning:w1.lastLearningCount},
  afterRestart:{status:w2.status,recoveryCount:w2.recoveryCount,tick:w2.lastTick,learning:w2.lastLearningCount},
  resumed:{status:w3.status,recoveryCount:w3.recoveryCount,tick:w3.lastTick,learning:w3.lastLearningCount}
},null,2));
