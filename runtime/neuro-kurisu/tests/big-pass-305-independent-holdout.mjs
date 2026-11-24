import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const families=['counterfactual-negotiation','resource-routing','ambiguity-resolution','novel-coordination','evidence-prioritization','recovery-planning'];
const sessions=[];
for(let session=0;session<2;session++){
  const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
  await core.init();
  const train=session===0?families.slice(0,2):families.slice(2,4); const holdout=session===0?[families[4],families[5]]:[families[0],families[5]];
  for(let i=0;i<16;i++){
    const family=train[i%train.length];
    const r=await core.observeOperational({text:`Practice ${family.replaceAll('-',' ')} while tracking consequences.`,novelty:.35+(i%5)*.08,surprise:i%7===0?.6:.15,embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.86,thermalStrain01:.18,battery01:.82,cpuLoad01:.22,ramPressure01:.18,awake:true}});
    if(r.workspace.content.temporalResolution==='micro')continue;
    const action=r.decision?.selected?.action??'wait'; const reward=action==='verify'?.74:action==='explore'?.71:action==='reflect'?.67:.53;
    await core.feedback({success:reward,reward,surprise:.14,evidenceSource:'unknown',evaluationContextFamily:family,evaluationPhase:'training'});
  }
  for(let i=0;i<12;i++){
    const family=holdout[i%holdout.length];
    const r=await core.observeOperational({text:`Handle an unfamiliar ${family.replaceAll('-',' ')} situation without using task labels.`,novelty:.70+(i%4)*.06,surprise:.28+(i%5)*.05,embodiment:{bodyEnergy01:.79,cognitiveCapacity01:.82,thermalStrain01:.26,battery01:.74,cpuLoad01:.35,ramPressure01:.32,awake:true}});
    if(r.workspace.content.temporalResolution==='micro')continue;
    const action=r.decision?.selected?.action??'wait'; const reward=family==='counterfactual-negotiation'?(action==='respond'?.72:action==='verify'?.66:.53):family==='resource-routing'?(action==='defer'?.70:action==='rest'?.67:.52):family==='ambiguity-resolution'?(action==='verify'?.75:action==='reflect'?.69:.51):(action==='explore'?.72:action==='verify'?.63:.51);
    await core.feedback({success:reward,reward,surprise:.19,evidenceSource:'external',evaluationContextFamily:family,evaluationPhase:'holdout'});
  }
  const d=core.b304SemanticHoldoutDiagnostics();
  assert.ok(d.trainingFamilyCount>=2,'independent holdout training set collapsed');
  assert.ok(d.holdoutFamilyCount>=2,'independent holdout families collapsed');
  assert.equal(d.novelHoldoutFamilyRate01,1,'holdout families overlap training family set');
  assert.ok(d.holdoutCoherence01>.20,'independent holdout coherence too low');
  sessions.push({session,training:d.trainingFamilyCount,holdout:d.holdoutFamilyCount,novelHoldoutFamilyRate01:d.novelHoldoutFamilyRate01,holdoutCoherence01:d.holdoutCoherence01,familyTransferScore01:d.familyTransferScore01,evaluationReadiness01:d.evaluationReadiness01,criticalPath:core.b305CriticalPathDiagnostics()});
  // Make each dataset an independent experiment and release its large graph before session 2.
  await core.beginBatch();
  await core.endBatch();
  if(global.gc) global.gc();
}
console.log(JSON.stringify({pass:true,independentSessions:2,sessions},null,2));
process.exit(0);
