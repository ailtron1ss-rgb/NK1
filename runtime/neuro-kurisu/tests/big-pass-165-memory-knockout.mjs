import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
async function file(){const d=await mkdtemp(join(tmpdir(),'nk165-ko-'));return join(d,'state.json');}
async function build(path){const c=new OrganismCore(new FileStateStore(path),opts);await c.init();return c;}
const a=await file(),b=await file();
const A=await build(a),B=await build(b);
const history=[
  ['Positive sensor experience: successful exploration confirmed the anomaly was harmless.',.92,.1,.18,.86],
  ['Repeated confirmation: verification succeeded and the sensor remained stable.',.88,.12,.26,.52],
  ['Neutral note: routine observation with little new information.',.55,.42,.44,.22],
];
for(const [text,success,surprise,uncertainty,novelty] of history){
  await A.observe({text,novelty,worldContext:{location:'lab',facts:['sensor-safe'],objects:['sensor'],events:['confirmation'],energy:.82,attention:.7,uncertainty}});
  await A.feedback({success,reward:success>.7?.5:-.2,surprise,evidenceSource:'user'});
  await B.observe({text,novelty,worldContext:{location:'lab',facts:['sensor-safe'],objects:['sensor'],events:['confirmation'],energy:.82,attention:.7,uncertainty}});
  await B.feedback({success,reward:success>.7?.5:-.2,surprise,evidenceSource:'user'});
}
const ids=(A.memorySubsystem.memoryOS.snapshot().items).filter(m=>m.content.includes('Positive sensor experience')).map(m=>m.id);
assert.ok(ids.length>=1);
// Content-addressed IDs are intentionally stable across independent organism instances.
// Knock out the same semantic memory in B by its canonical ID and verify A remains intact.
const bTarget=B.memorySubsystem.memoryOS.snapshot().items.find(m=>m.content.includes('Positive sensor experience'));
assert.ok(bTarget);
const removed=B.forgetMemoryById(bTarget.id);
assert.equal(removed,true);
assert.ok(A.memorySubsystem.memoryOS.snapshot().items.some(m=>m.id===bTarget.id),'knockout leaked across organism instances');
const common={text:'The previously seen sensor is available again; should we explore or verify?',novelty:.48,worldContext:{location:'lab',facts:['sensor-available'],objects:['sensor'],events:['available'],energy:.76,attention:.62,uncertainty:.48}};
const ra=await A.observe(common);const rb=await B.observe(common);
const cand=(r,action)=>Number(r.decision?.candidates?.find(c=>c.action===action)?.predictedUtility??0);
const divergence=Math.abs(cand(ra,'explore')-cand(rb,'explore'))+Math.abs(cand(ra,'verify')-cand(rb,'verify'));
assert.ok(divergence>0.0005,'memory knockout did not alter downstream policy');
await A.flush();await B.flush();A.stop?.();B.stop?.();
console.log(JSON.stringify({pass:165,status:'PASS',knockout:true,divergence,exploreWithMemory:cand(ra,'explore'),exploreWithoutMemory:cand(rb,'explore'),verifyWithMemory:cand(ra,'verify'),verifyWithoutMemory:cand(rb,'verify'),removedA:removed,removedB:true},null,2));
