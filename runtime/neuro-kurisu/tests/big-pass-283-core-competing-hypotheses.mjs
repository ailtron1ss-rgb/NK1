import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<14;i++){
  const g=Array.from({length:16},(_,j)=>Math.tanh(Math.sin((i+j)*.19))); const s=Array.from({length:16},(_,j)=>.22*Math.cos(i*.07+j*.11)); const w=Array.from({length:16},(_,j)=>.3*Math.sin(j*.17+i*.09)); const goal=Array.from({length:16},(_,j)=>.4*Math.cos(j*.13+i*.05)); const mem=Array.from({length:16},(_,j)=>.2*Math.sin(j*.09+i*.12));
  core.b283CompetingHypothesisStep({tick:i,globalLatent:g,selfLatent:s,worldLatent:w,goalVector:goal,memoryLatent:mem,reward01:.58,predictionError01:.2,uncertainty01:.24,autonomy01:.68,personalityVector:Array(16).fill(.06),learningEnabled:true});
  core.b283CompetingHypothesisLearn({tick:i,reward01:i%5===0?.7:.6,predictionError01:.16,action:i%2?'explore':'verify',independentEvidence01:.82});
}
const d=core.b283CompetingHypothesisDiagnostics(); assert(d.steps>=14); assert(d.learningUpdates>0); assert(d.hypotheses.length===4); assert(d.hypothesisSwitches>=0); const c=core.b283CompetingHypothesisCommit(); assert(c.committed===true || c.reason==='insufficient-evidence');
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init(); assert.deepEqual(restored.b283CompetingHypothesisDiagnostics(),core.b283CompetingHypothesisDiagnostics());
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,hypothesisSwitches:d.hypothesisSwitches,committedHypothesisId:d.committedHypothesisId,posteriorEntropy01:d.posteriorEntropy01,diversity01:d.diversity01,selfAlignment01:d.selfAlignment01,personalityFit01:d.personalityFit01,restart:true}));
