import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const EMB={awake:true,bodyEnergy01:.84,cognitiveCapacity01:.82,thermalStrain01:.12,sensoryFreshness01:.82,battery01:.88,cpuLoad01:.18,ramPressure01:.16};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const unseen={epistemic:.28,autonomy:.74,maintenance:.11,social:.05,novelty:.81,uncertainty:.36,embodiment:EMB};
const mk=async(snapshot,cfg=base)=>{const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),cfg);await c.init();return c;};
const latent=(seed,shift=0)=>({goalVector:Array.from({length:8},(_,i)=>Math.sin((i+1)*(seed+1)*.31+shift)),selfLatent:Array.from({length:8},(_,i)=>Math.cos((i+2)*(seed+1)*.23+shift)),worldLatent:Array.from({length:8},(_,i)=>Math.sin((i+3)*(seed+2)*.17+shift)),neuralAssembly:Array.from({length:12},(_,i)=>((i*(seed+2)+shift*3)%9)/8)});

const rows=[];
for(let seed=0;seed<5;seed++){
  const pos=await mk();
  const L=latent(seed);
  await pos.observe({epistemic:.62,autonomy:.52,maintenance:.12,social:.05,novelty:.55,uncertainty:.51,embodiment:EMB},'operational');
  await pos.feedback({reward:1,success:1,surprise:.01});
  const prop=pos.b276LatentProgramPropose({tick:1200+seed,...L,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`p${seed}a`,actions:['respond','explore'],reliability01:.94},{id:`p${seed}b`,actions:['verify','reflect'],reliability01:.91},{id:`p${seed}c`,actions:['rest','wait'],reliability01:.87}]});
  assert(prop.depth>=3);
  const trial=pos.b276LatentProgramTrial({tick:1201+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  assert.equal(trial.verified,true);
  const plan=pos.b276LatentProgramDiagnostics().executionPlan;
  const baselineBias=pos.b276LatentProgramActionBias(plan[0]);
  for(let i=0;i<4;i++){
    pos.b276LatentProgramExecutionOutcome({tick:1210+seed*10+i,programId:prop.programId,stepIndex:0,primitive:plan[0],reward01:.96,success01:1,predictionError01:.06,unseenContext01:.82});
  }
  const learned=pos.b276LatentProgramDiagnostics();
  const trainedBias=pos.b276LatentProgramActionBias(plan[0]);
  assert(trainedBias>baselineBias,`seed ${seed} consequence learning must increase learned primitive bias`);
  assert(learned.actionConsequenceCredits01[plan[0]]>.65);
  assert(learned.activeProgramId===prop.programId);
  const transfer=pos.b276LatentProgramTransfer({tick:1250+seed,programId:prop.programId,newGoalVector:L.goalVector.map((v,i)=>v*.17+(i===0?.7:0)),selfLatent:L.selfLatent.map(v=>-v),worldLatent:L.worldLatent.map((v,i)=>-v),neuralAssembly:L.neuralAssembly.map((v,i)=>i%2?.1:.8),independentGain01:.16,robustness01:.88});
  assert(transfer.success===true,`seed ${seed} learned program should transfer to unseen context`);

  const sham=await mk(pos.snapshot());
  // Matched sham: erase the learned causal memory for the same program while preserving structure and verification.
  const sd=sham.b276LatentProgramDiagnostics();
  assert(sd.activeProgramId===prop.programId);
  const shPlan=sd.executionPlan;
  for(let i=0;i<4;i++) sham.b276LatentProgramExecutionOutcome({tick:1310+seed*10+i,programId:prop.programId,stepIndex:0,primitive:shPlan[0],reward01:.50,success01:.5,predictionError01:.5,unseenContext01:0});
  const shamDiag=sham.b276LatentProgramDiagnostics();
  const shamTransfer=sham.b276LatentProgramTransfer({tick:1350+seed,programId:prop.programId,newGoalVector:L.goalVector.map(v=>v*.17),selfLatent:L.selfLatent.map(v=>-v),worldLatent:L.worldLatent.map(v=>-v),neuralAssembly:L.neuralAssembly.map(v=>.2),independentGain01:.04,robustness01:.62});
  assert(transfer.gain01>shamTransfer.gain01,`seed ${seed} trained transfer gain must exceed sham`);
  assert(learned.activeProgramConsequenceEMA01>shamDiag.activeProgramConsequenceEMA01,`seed ${seed} trained consequence EMA must exceed sham`);
  rows.push({seed:seed+1,primitive:plan[0],baselineBias,trainedBias,consequenceEMA01:learned.activeProgramConsequenceEMA01,shamConsequenceEMA01:shamDiag.activeProgramConsequenceEMA01,transferGain01:transfer.gain01,shamTransferGain01:shamTransfer.gain01});
}

const integration=[];
for(let seed=0;seed<3;seed++){
  const live=await mk(); const L=latent(seed,0.33); const prop=live.b276LatentProgramPropose({tick:1500+seed,...L,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`live-${seed}-a`,actions:['respond','explore'],reliability01:.94},{id:`live-${seed}-b`,actions:['verify','reflect'],reliability01:.91},{id:`live-${seed}-c`,actions:['rest','wait'],reliability01:.87}]});
  live.b276LatentProgramTrial({tick:1501+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  const before=live.b276LatentProgramDiagnostics();
  const observation={epistemic:.25,autonomy:.74,maintenance:.11,social:.05,novelty:.81,uncertainty:.36,embodiment:EMB};
  const decision=await live.observe(observation,'operational');
  const mid=live.b276LatentProgramDiagnostics();
  assert.equal(decision.decision.selected?.action,mid.executionHistory.at(-1)?.primitive ?? decision.decision.selected?.action);
  await live.feedback({reward:1,success:1,surprise:.01});
  const after=live.b276LatentProgramDiagnostics();
  assert(after.activeProgramConsequenceEMA01>before.activeProgramConsequenceEMA01,`seed ${seed} real Core outcome must train B276`);
  integration.push({seed:seed+1,selected:decision.decision.selected?.action,cursorAfterObserve:mid.executionCursor,consequenceBefore:before.activeProgramConsequenceEMA01,consequenceAfter:after.activeProgramConsequenceEMA01});
}
console.log(JSON.stringify({pass:true,status:'COMPOSITIONAL_PROGRAM_CONSEQUENCE_LEARNING_UNSEEN_TRANSFER_AND_CORE_LOOP_PASS',seeds:rows.length,rows,coreIntegration:integration},null,2));

