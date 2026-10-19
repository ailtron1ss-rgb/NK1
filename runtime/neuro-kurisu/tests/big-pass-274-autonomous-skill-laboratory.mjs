import assert from 'node:assert/strict';
import { B274AutonomousSkillLaboratory } from '../src/organism/cognition/B274AutonomousSkillLaboratory.ts';

const lab=new B274AutonomousSkillLaboratory();
const self=Array.from({length:16},(_,i)=>Math.sin(i*.17));
const world=Array.from({length:24},(_,i)=>Math.cos(i*.11));
const asm=Array.from({length:16},(_,i)=>.12+((i%4)*.03));
const traits={curiosity:.78,caution:.61,'truth-seeking':.74,'self-reflection':.68,'self-preservation':.71,care:.64,'social-attunement':.66,persistence:.77};
let promotedId=null,created=0;
for(let t=0;t<8;t++){
  const r=lab.step({tick:t,goalVector:[.7,.2,-.1,.3,.4,.5,-.2,.6],plan:['explore','verify','reflect'],selfLatent:self,worldLatent:world,neuralAssembly:asm,needs:{novelty01:.72,uncertainty01:.42,goalPressure01:.58,autonomy01:.71,coherence01:.76},traits,imaginedPlanScores:[
    {actions:['explore','verify','reflect'],predictedGain01:.66,uncertainty01:.24},
    {actions:['verify','explore'],predictedGain01:.61,uncertainty01:.21},
  ]});
  if(r.candidateCreated)created++;
  const e=lab.observeTrial({tick:t,candidateId:r.candidateId,reward01:.82,independentGain01:.13,predictionError01:.20,personalityAlignment01:.77,selfAlignment01:.75,worldNovelty01:.72,neuralReliability01:.86,transferTestGain01:.10,robustness01:.84});
  if(e.promoted) promotedId=e.skillId;
}
const d=lab.diagnostics();
assert.ok(created>=1,'B274 did not generate a novel skill candidate');
assert.ok(d.imaginedExperiments>=1,'B274 imagination loop did not run');
assert.ok(d.realTrials>=2,'B274 real trial loop did not run');
assert.ok(d.promotions>=1,'B274 failed to promote a repeatedly verified skill');
assert.ok(promotedId,'B274 promotion id missing');
const before=lab.diagnostics();
const bad=lab.step({tick:20,goalVector:[-.6,.2,.4,-.4,.2,-.3,.1,-.2],plan:['rest','wait'],selfLatent:self,worldLatent:world,neuralAssembly:asm,needs:{novelty01:.24,uncertainty01:.88,goalPressure01:.72,autonomy01:.58,coherence01:.53},traits,imaginedPlanScores:[{actions:['rest','wait'],predictedGain01:.61,uncertainty01:.72}]});
const badTrial=lab.observeTrial({tick:20,candidateId:bad.candidateId,reward01:.31,independentGain01:-.16,predictionError01:.82,personalityAlignment01:.44,selfAlignment01:.38,worldNovelty01:.21,neuralReliability01:.45,transferTestGain01:-.12,robustness01:.31});
assert.ok(!badTrial.promoted,'B274 promoted a failed skill');
assert.ok(d.rollbackSafety01>=.8,'B274 rollback safety degraded unexpectedly');
const snap=lab.snapshot(); const restored=new B274AutonomousSkillLaboratory(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap,'B274 persistence mismatch');
console.log(JSON.stringify({pass:true,diagnostics:restored.diagnostics(),promotedId,badTrial},null,2));
