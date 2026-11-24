import assert from 'node:assert/strict';
import { B276LatentActionProgramSynthesizer } from '../src/organism/cognition/B276LatentActionProgramSynthesizer.ts';

const latent=(seed)=>({goalVector:Array.from({length:8},(_,i)=>Math.sin((i+1)*(seed+1)*.31)),selfLatent:Array.from({length:8},(_,i)=>Math.cos((i+2)*(seed+1)*.23)),worldLatent:Array.from({length:8},(_,i)=>Math.sin((i+3)*(seed+2)*.17)),neuralAssembly:Array.from({length:12},(_,i)=>((i*(seed+2))%9)/8)});
const rows=[];
for(let seed=0;seed<5;seed++){
  const b=new B276LatentActionProgramSynthesizer(); const L=latent(seed);
  const prop=b.propose({tick:5000+seed,...L,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`a${seed}`,actions:['respond','explore'],reliability01:.94},{id:`b${seed}`,actions:['verify','reflect'],reliability01:.91},{id:`c${seed}`,actions:['rest','wait'],reliability01:.87}]});
  b.observeTrial({tick:5010+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  const original=b.diagnostics().executionPlan.slice();
  for(let ep=0;ep<2;ep++){
    const plan=b.diagnostics().executionPlan.slice();
    const target=ep===0?plan[1]:plan[plan.length-1];
    const rewards=plan.map((a,i)=>a===target?.97:(i===0?.61:.32));
    for(let step=0;step<3;step++){
      const before=b.diagnostics(); const next=b.nextExecutablePrimitive();
      assert(next); assert.equal(next.primitive,before.executionPlan[before.executionCursor]);
      b.observeExecutionOutcome({tick:5020+seed*100+ep*10+step,programId:prop.programId,stepIndex:next.stepIndex,primitive:next.primitive,reward01:rewards[step],success01:rewards[step],predictionError01:1-rewards[step],unseenContext01:ep===0?.25:.82});
    }
  }
  const learned=b.diagnostics(); assert.equal(learned.activeProgramStructureRevisionCount,2);
  const learnedPlan=learned.executionPlan.slice();
  const snapshot=b.snapshot(); const restored=new B276LatentActionProgramSynthesizer(); restored.restore(snapshot); assert.deepEqual(restored.diagnostics().executionPlan,learnedPlan);
  restored.restore(snapshot);
  restored['state'].executionPlan=original.slice(); restored['state'].executionCursor=0; restored['state'].programStructureRevisions=0;
  const rp=restored['state'].programs.find(x=>x.id===prop.programId); assert(rp); rp.stepCredits01=original.map(()=>.5); rp.structureRevisionCount=0;
  const sham=new B276LatentActionProgramSynthesizer(); sham.restore(restored.snapshot());
  const trainedExec=new B276LatentActionProgramSynthesizer(); trainedExec.restore(snapshot);
  const trained=[]; const shamSeq=[];
  for(let i=0;i<3;i++){trained.push(trainedExec.nextExecutablePrimitive().primitive); shamSeq.push(sham.nextExecutablePrimitive().primitive);}
  assert.notDeepEqual(trained,shamSeq);
  assert.equal(trained.length,3); assert.equal(shamSeq.length,3);
  rows.push({seed:seed+1,original,revised1:'verified-by-revision',learnedPlan,trained,ablated:shamSeq,revisions:learned.activeProgramStructureRevisionCount});
}
console.log(JSON.stringify({pass:true,status:'EXECUTOR_TRAJECTORY_SECOND_REVISION_ABLATION_PASS',seeds:rows.length,rows},null,2));
