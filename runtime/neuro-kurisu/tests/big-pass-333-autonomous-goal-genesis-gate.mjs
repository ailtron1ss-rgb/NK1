import assert from 'node:assert/strict';
import { B333AutonomousGoalGenesisGate } from '../src/organism/system/B333AutonomousGoalGenesisGate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const gate=new B333AutonomousGoalGenesisGate();
const base={tick:1,candidateId:'goal-x',externalInput:false,autonomousAllowed:true,goalPressure01:.72,homeostaticPressure01:.68,predictionError01:.61,novelty01:.57,uncertainty01:.63,socialNeed01:.25,identityContinuity01:.82,energy01:.42,actionBefore:'wait'};
assert.equal(gate.evaluate(base).allow,true);
assert.equal(gate.evaluate({...base,externalInput:true}).allow,false);
assert.equal(gate.evaluate({...base,goalPressure01:.02,homeostaticPressure01:.03,predictionError01:.04,novelty01:.05,uncertainty01:.04,identityContinuity01:.82}).allow,false);
gate.observeGoalPopulation({tick:2,goals:[{id:'goal-x',source:'intrinsic',status:'active'}],externalInput:false,autonomousAllowed:true,actionBefore:'wait'});
gate.recordCandidate({tick:2,candidateId:'goal-x',externalInput:false,autonomousAllowed:true,internalPressure01:.63,pressureDiversity01:.57,identityContinuity01:.82,goalPressure01:.72,homeostaticPressure01:.68,predictionError01:.61,novelty01:.57,created:true,actionBefore:'wait',actionAfter:'explore'});
gate.observeOutcome(.81);
const d=gate.diagnostics();
assert.equal(d.internallySourcedGoals,1);
assert.equal(d.candidateAccepted,1);
assert.equal(d.actionInfluenced,1);
assert.equal(d.successfulInfluence,1);
assert.equal(d.internalGoalShare01,1);
const snap=gate.snapshot(); const restored=new B333AutonomousGoalGenesisGate(); restored.restore(snap); assert.deepEqual(restored.diagnostics(),d);

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<24;i++){
  await core.observe({text:'',novelty:.52+(i%4)*.05,surprise:.38+(i%3)*.08,embodiment:{bodyEnergy01:.70,cognitiveCapacity01:.82,thermalStrain01:.18,sensoryFreshness01:.92,awake:true,battery01:.76,cpuLoad01:.22,ramPressure01:.22}},'operational');
  await core.feedback({success:i%6===0?.69:.61,reward:i%5===0?.72:.57,surprise:.25,evidenceSource:'internal'});
}
const cd=core.b333AutonomousGoalDiagnostics();
assert.ok(cd.decisions>=20,'B333 did not run in live Core');
assert.ok(cd.eligible>0,'B333 found no autonomous eligibility');
assert.ok(cd.blockedExternal===0,'empty observation was treated as external');
assert.ok(cd.internallySourcedGoals>0,'live Core did not expose internally sourced goals');
const snap2=core.snapshot(); const core2=new OrganismCore(new MemoryStateStore({initial:snap2}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core2.init();
assert.deepEqual(core2.b333AutonomousGoalDiagnostics(),cd,'B333 diagnostics failed restart persistence');
console.log(JSON.stringify({pass:true,unit:d,live:cd,restored:core2.b333AutonomousGoalDiagnostics()},null,2));
