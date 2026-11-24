import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
async function make(prefix){const d=await mkdtemp(join(tmpdir(),prefix));return join(d,'state.json');}
async function life(file,pattern){
 const c=new OrganismCore(new FileStateStore(file),opts); await c.init();
 const choices=[];
 for(let i=0;i<36;i++){
   const negative=pattern(i);
   const novelty=i%5===0?.9:.4;
   const uncertainty=negative?.82:.28;
   const res=await c.observe({text:`longitudinal-${pattern.name||'trajectory'}-${i}: sensor decision`,worldContext:{location:i%2?'lab':'home',facts:[negative?'failure-history':'success-history'],objects:['sensor'],events:[negative?'failure':'success'],energy:negative?.58:.82,attention:.66,uncertainty},novelty});
   choices.push({action:res.decision?.selected?.action??'wait',utilities:Object.fromEntries((res.decision?.candidates??[]).filter(x=>['explore','verify'].includes(x.action)).map(x=>[x.action,Number(x.predictedUtility??0)]))});
   await c.feedback({success:negative?.12:.88,reward:negative?-.35:.5,surprise:negative?.8:.12,evidenceSource:i%6===0?'device':'user'});
 }
 const s=c.snapshot(); await c.flush(); c.stop?.();
 return {c,s,choices,summary:{tick:s.state.tick,memory:c.memorySubsystem.memoryOS.size(),ret:c.memoryRetentionEconomySnapshot(),emo:c.emotionAppraisalSnapshot(),influence:c.behavioralInfluenceLedgerSnapshot(),cycles:c.unifiedCognitiveCycleSnapshot(),fabric:c.cognitiveEventFabricSnapshot()}};
}
const fileA=await make('nk165A-'),fileB=await make('nk165B-');
const positive=()=>false; const negative=i=>i%3===0;
const A=await life(fileA,positive);
const B=await life(fileB,negative);
assert.ok(A.summary.tick>=36&&B.summary.tick>=36);
assert.ok(A.summary.memory<=1600&&B.summary.memory<=1600);
assert.ok(A.summary.ret.consolidations>0&&B.summary.ret.consolidations>0);
assert.ok(A.summary.cycles.completeCycles>0&&B.summary.cycles.completeCycles>0);
const lastA=A.choices.at(-1),lastB=B.choices.at(-1);
const divergence=Math.abs((lastA?.utilities.explore??0)-(lastB?.utilities.explore??0))+Math.abs((lastA?.utilities.verify??0)-(lastB?.utilities.verify??0))+Math.abs(A.summary.emo.meanStress01-B.summary.emo.meanStress01);
assert.ok(divergence>0.002,'different life histories did not change downstream trajectory');
const resumedA=new OrganismCore(new FileStateStore(fileA),opts),resumedB=new OrganismCore(new FileStateStore(fileB),opts); await resumedA.init(); await resumedB.init();
assert.ok(resumedA.memoryRetentionEconomySnapshot().evaluations>=A.summary.ret.evaluations);
assert.ok(resumedB.memoryRetentionEconomySnapshot().evaluations>=B.summary.ret.evaluations);
assert.ok(resumedA.emotionAppraisalSnapshot().episodes>=A.summary.emo.episodes);
assert.ok(resumedB.emotionAppraisalSnapshot().episodes>=B.summary.emo.episodes);
resumedA.stop?.();resumedB.stop?.();
console.log(JSON.stringify({pass:165,status:'PASS',A:A.summary,B:B.summary,terminalDivergence:divergence,restartPersistence:true},null,2));
