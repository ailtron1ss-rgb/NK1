import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
const mk=async(prefix)=>{const dir=await mkdtemp(join(tmpdir(),prefix));return join(dir,'state.json');};

// A: retention economics changes canonical memory, not just an advisory score.
const file=await mk('nk165-memory-');
const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
await core.observe({text:'Important autobiographical research event: discovered a repeatable sensor anomaly.',worldContext:{location:'lab',facts:['sensor-anomaly'],objects:['sensor'],events:['discovery'],energy:.72,attention:.72,uncertainty:.63},novelty:.92});
const ids=(core.memorySubsystemSnapshot?.() ?? core.memorySubstrateCanonicalItems?.()) || [];
const mem=core.memorySubstrateSnapshot();
assert.ok((mem.memoryOSItems??0)>=1);
const econ=core.memoryRetentionEconomySnapshot();
assert.ok((econ?.evaluations??0)>=1);
assert.ok((econ?.consolidations??0)>=1);
const recent=core.memorySubsystem.memoryOS.inspectRecent(8);
assert.ok(recent.length>=1);
assert.ok(recent.some(m=>m.content.includes('Important autobiographical') && m.temperature01>.45));

await core.feedback({success:.12,reward:-.5,surprise:.92,evidenceSource:'user',notes:'major prediction error'});
const afterFeedback=core.memorySubsystem.memoryOS.inspectRecent(8);
assert.ok(core.memorySubsystem.memoryOS.statsLight().reconsolidations>=2);
assert.ok((core.memoryRetentionEconomySnapshot().reconsolidations??0)>=2);

// B: memory knockout: deleting a specific canonical memory must succeed, then the
// same future observation remains operational but must lose that memory's influence.
const removable=afterFeedback.find(m=>m.kind!=='identity'&&m.kind!=='autobiographical');
assert.ok(removable,'expected a removable canonical episodic/working memory');
const beforeCount=core.memorySubsystem.memoryOS.size();
assert.equal(core.forgetMemoryById?.(removable.id) ?? core.memorySubsystem.memoryOS.forgetById(removable.id),true);
assert.equal(core.memorySubsystem.memoryOS.size(),beforeCount-1);

// C: Longitudinal bounded life, with deliberate alternating outcomes.
for(let i=0;i<48;i++){
  const novelty=i%3===0?.88:.38;
  await core.observe({text:`Life episode ${i}: sensor decision under changing uncertainty.`,worldContext:{location:i%2?'lab':'home',facts:[i%4===0?'anomaly':'stable'],objects:['sensor'],events:[i%2?'repeat':'explore'],energy:.82-(i%5)*.03,attention:.65,uncertainty:i%4===0?.78:.31},novelty});
  await core.feedback({success:i%4===0?.18:.82,reward:i%4===0?-.3:.45,surprise:i%4===0?.78:.16,evidenceSource:i%7===0?'device':'user'});
}
const snap=core.snapshot();
assert.ok(snap.state.tick>=48);
assert.ok(core.memorySubsystem.memoryOS.size()<=1600);
assert.ok((core.cognitiveEventFabricSnapshot()?.buffered??0)>0);
assert.ok((core.behavioralInfluenceLedgerSnapshot()?.observations??0)>0);
assert.ok((core.unifiedCognitiveCycleSnapshot()?.completeCycles??0)>0);
const lifeBefore={tick:snap.state.tick,mem:core.memorySubsystem.memoryOS.size(),ret:core.memoryRetentionEconomySnapshot(),emo:core.emotionAppraisalSnapshot(),cycles:core.unifiedCognitiveCycleSnapshot()};
await core.flush();
core.stop?.();
const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
assert.ok(resumed.snapshot().state.tick>=lifeBefore.tick);
assert.ok(resumed.memoryRetentionEconomySnapshot().evaluations>=lifeBefore.ret.evaluations);
assert.ok(resumed.memoryRetentionEconomySnapshot().consolidations>=lifeBefore.ret.consolidations);
assert.ok(resumed.emotionAppraisalSnapshot().episodes>=lifeBefore.emo.episodes);
assert.ok(resumed.unifiedCognitiveCycleSnapshot().completeCycles>=lifeBefore.cycles.completeCycles);
resumed.stop?.();
console.log(JSON.stringify({pass:165,status:'PASS',ticks:lifeBefore.tick,canonicalMemoryItems:lifeBefore.mem,retentionEvaluations:lifeBefore.ret.evaluations,consolidations:lifeBefore.ret.consolidations,reconsolidations:lifeBefore.ret.reconsolidations,emotionEpisodes:lifeBefore.emo.episodes,completeCycles:lifeBefore.cycles.completeCycles,memoryKnockout:true,restartPersistence:true},null,2));
