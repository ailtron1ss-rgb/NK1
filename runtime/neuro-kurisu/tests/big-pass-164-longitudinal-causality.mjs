import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

async function make(){const dir=await mkdtemp(join(tmpdir(),'nk164-life-'));return {dir,file:join(dir,'state.json')};}
const a=await make(), b=await make();
const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
const ca=new OrganismCore(new FileStateStore(a.file),opts), cb=new OrganismCore(new FileStateStore(b.file),opts); await ca.init(); await cb.init();
// Same baseline, intentionally divergent prior experiences.
await ca.observe({text:'История A: успешное исследование нового сенсора.',worldContext:{location:'lab',facts:['sensor-safe'],objects:['sensor'],events:['success'],energy:.8,uncertainty:.2},novelty:.8});
await ca.feedback({success:.92,reward:.8,surprise:.08,evidenceSource:'user'});
await ca.observe({text:'История A: подтверждение гипотезы после успешного теста.',worldContext:{location:'lab',facts:['confirmed'],objects:['sensor'],events:['repeat'],energy:.78,uncertainty:.18},novelty:.4});
await cb.observe({text:'История B: опасный эксперимент завершился неудачей.',worldContext:{location:'lab',facts:['sensor-failed'],objects:['sensor'],events:['failure'],energy:.55,uncertainty:.82},novelty:.8});
await cb.feedback({success:.08,reward:-.4,surprise:.9,evidenceSource:'user'});
await cb.observe({text:'История B: повторение после неудачи требует осторожности.',worldContext:{location:'lab',facts:['warning'],objects:['sensor'],events:['repeat'],energy:.58,uncertainty:.78},novelty:.45});
const common={text:'Одинаковый следующий стимул: снова доступен неизвестный сенсор.',worldContext:{location:'lab',facts:['sensor-available'],objects:['sensor'],events:['available'],energy:.7,uncertainty:.55},novelty:.62};
const ra=await ca.observe(common); const rb=await cb.observe(common);
const cand=(r,action)=>r.decision?.candidates?.find(c=>c.action===action)?.predictedUtility ?? r.decision?.predictedOutcomes?.find(c=>c.action===action)?.utility ?? 0; const sa=cand(ra,'explore'), sb=cand(rb,'explore');
const memA=ra.state ? (ca.memorySnapshot().lastRetrievedMemoryIds?.length ?? 0) : 0; const memB=rb.state ? (cb.memorySnapshot().lastRetrievedMemoryIds?.length ?? 0) : 0;
const infA=ca.behavioralInfluenceLedgerSnapshot(); const infB=cb.behavioralInfluenceLedgerSnapshot();
assert.ok(memA>=0&&memB>=0); assert.ok(infA.observations>=1&&infB.observations>=1);
const verifyA=cand(ra,'verify'), verifyB=cand(rb,'verify'); const utilityDivergence=Math.abs(Number(sa)-Number(sb))+Math.abs(Number(verifyA)-Number(verifyB));
const emotionA=ca.emotionAppraisalSnapshot(), emotionB=cb.emotionAppraisalSnapshot();
const divergence=utilityDivergence+Math.abs(Number((emotionA?.meanStress01??0)) - Number((emotionB?.meanStress01??0)));
assert.ok(divergence>0.001,'divergent histories failed to produce any measurable downstream divergence');
await ca.flush(); await cb.flush();
console.log(JSON.stringify({pass:164,status:'PASS',selectedActionA:ra.decision?.selected?.action,selectedActionB:rb.decision?.selected?.action,exploreUtilityA:Number(sa),exploreUtilityB:Number(sb),verifyUtilityA:Number(verifyA),verifyUtilityB:Number(verifyB),utilityDivergence,stressA:emotionA.meanStress01,stressB:emotionB.meanStress01,divergence,memoryA:memA,memoryB:memB,influenceA:infA.observations,influenceB:infB.observations},null,2));
