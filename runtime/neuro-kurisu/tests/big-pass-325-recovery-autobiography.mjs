import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const base = path.join(tmpdir(), `nk325-recovery-autobio-${process.pid}-${Date.now()}`);
const make = () => new OrganismRuntime({
  stateFile: base + '.json', worldStateFile: base + '.world.json', autoRun:false,
  enableLanguage:false, intervalMs:5000, checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1,
});

const first = make();
await first.init();
await first.flush();
const pre = first.core.recoveryAutobiographicalSnapshot();
assert.equal(pre.watchdog.recoveryCount, 0);
assert.equal(pre.recentRecoveryEvents.length, 0);
first.stop();

const second = make();
await second.init();
const post = second.core.recoveryAutobiographicalSnapshot();
assert.equal(post.watchdog.recoveryCount, 1);
assert(post.recentRecoveryEvents.length >= 1);
const recoveryEvent = post.recentRecoveryEvents.at(-1);
assert.equal(recoveryEvent.type, 'recovery');
assert.equal(recoveryEvent.payload.previousBootId, pre.watchdog.bootId);
assert.equal(recoveryEvent.payload.currentBootId, post.watchdog.bootId);
assert.notEqual(recoveryEvent.payload.previousBootId, recoveryEvent.payload.currentBootId);
assert.equal(post.watchdog.previousBootId, pre.watchdog.bootId);
assert.equal(recoveryEvent.payload.recoveryCount, 1);
assert.equal(post.selfModel.recoveryCount, 1);
assert(post.selfModel.continuityShock01 > 0);
assert(post.selfModel.postRecoveryIntegration01 > 0);
assert(post.lifeNarrative.episodes >= 1);
assert(post.lifeNarrative.recent.some(e=>e.theme==='recovery-after-process-gap'));

await second.core.observeOperational({
  embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.80,thermalStrain01:.22,sensoryFreshness01:.82,battery01:.80,cpuLoad01:.28,ramPressure01:.25,awake:true},
  novelty:.45, surprise:.16, text:'Continue after recovery and integrate the interruption into the next decision.'
});
await second.flush();
const after = second.core.recoveryAutobiographicalSnapshot();
assert.equal(after.watchdog.status, 'healthy');
assert.equal(after.watchdog.recoveryCount, 1);
assert.equal(after.selfModel.recoveryCount, 1);
assert(after.selfModel.continuityShock01 < post.selfModel.continuityShock01);
assert(after.selfModel.postRecoveryIntegration01 > post.selfModel.postRecoveryIntegration01);
second.stop();

for (const suffix of ['.json','.world.json','.continuity.jsonl','.operational.jsonl','.json.bak','.world.json.bak','.world.json.tmp']) await rm(base+suffix,{force:true});
console.log(JSON.stringify({
  pass:true,
  beforeRestart:{recoveryCount:pre.watchdog.recoveryCount,bootId:pre.watchdog.bootId},
  afterRestart:{recoveryCount:post.watchdog.recoveryCount,bootId:post.watchdog.bootId,recoveryEvents:post.recentRecoveryEvents.length,autobiographicalMemories:post.autobiographicalMemories.length,lifeNarrativeEpisodes:post.lifeNarrative.episodes,previousBootId:post.watchdog.previousBootId},
  recoveryEvent:{previousBootId:recoveryEvent.payload.previousBootId,currentBootId:recoveryEvent.payload.currentBootId,recoveryCount:recoveryEvent.payload.recoveryCount},
  selfModel:{recoveryCount:post.selfModel.recoveryCount,continuityShock01:post.selfModel.continuityShock01,postRecoveryIntegration01:post.selfModel.postRecoveryIntegration01},
  healed:{status:after.watchdog.status,continuityShock01:after.selfModel.continuityShock01,postRecoveryIntegration01:after.selfModel.postRecoveryIntegration01}
}, null, 2));
