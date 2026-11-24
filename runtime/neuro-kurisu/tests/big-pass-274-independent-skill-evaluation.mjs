import assert from 'node:assert/strict';
import { B274AutonomousSkillLaboratory } from '../src/organism/cognition/B274AutonomousSkillLaboratory.ts';

const lab=new B274AutonomousSkillLaboratory();
const traits={curiosity:.76,caution:.67,'truth-seeking':.76,'self-reflection':.70,'self-preservation':.72,care:.61,'social-attunement':.60,persistence:.75};
const self=Array.from({length:16},(_,i)=>Math.sin(i*.11));
const world=Array.from({length:24},(_,i)=>Math.cos(i*.09));
const asm=Array.from({length:16},(_,i)=>.10+(i%4)*.018);
let promoted=null;
for(let t=0;t<18;t++){
  const r=lab.step({tick:t,goalVector:[.72,.18,.06,.31,.44,.52,.12,.28],plan:['explore','verify','reflect'],selfLatent:self,worldLatent:world,neuralAssembly:asm,needs:{novelty01:.76,uncertainty01:.36,goalPressure01:.58,autonomy01:.70,coherence01:.74},traits,imaginedPlanScores:[{actions:['explore','verify','reflect'],predictedGain01:.66,uncertainty01:.22},{actions:['verify','reflect'],predictedGain01:.61,uncertainty01:.24}]});
  const e=lab.observeTrial({tick:t,candidateId:r.candidateId,reward01:.80,independentGain01:.12,predictionError01:.20,personalityAlignment01:.72,selfAlignment01:.75,worldNovelty01:.76,neuralReliability01:.84,transferTestGain01:.08,robustness01:.82});
  if(e.promoted) promoted=e.skillId;
}
assert.ok(promoted,'B274 did not promote any independently verified skill');
const hidden=lab.step({tick:40,goalVector:[-.34,.62,.18,-.15,.21,.71,-.08,.39],plan:['verify','reflect','explore'],selfLatent:self,worldLatent:world,neuralAssembly:asm,needs:{novelty01:.42,uncertainty01:.67,goalPressure01:.61,autonomy01:.68,coherence01:.70},traits,imaginedPlanScores:[{actions:['verify','reflect','explore'],predictedGain01:.63,uncertainty01:.28},{actions:['explore','verify'],predictedGain01:.59,uncertainty01:.30}]});
const transfer=lab.promoteTransferred({tick:40,sourceSkillId:promoted,newGoalVector:hidden.goalVector??[-.34,.62,.18,-.15,.21,.71,-.08,.39],selfLatent:self,neuralAssembly:asm,independentGain01:.10,robustness01:.84});
const d=lab.diagnostics();
assert.ok(d.promotions>=1,'no promoted skills');
assert.ok(d.imaginedExperiments>=2,'hidden skill experiment did not run');
assert.ok(d.discoveryRate01>0,'discovery rate stayed zero');
assert.ok(transfer.transferGain01>=0,'transfer metric invalid');
console.log(JSON.stringify({pass:true,diagnostics:d,promoted,transfer},null,2));
