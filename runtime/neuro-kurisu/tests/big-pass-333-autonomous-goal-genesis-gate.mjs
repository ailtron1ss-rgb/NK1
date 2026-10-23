import assert from 'node:assert/strict';
import { B333AutonomousGoalGenesisGate } from '../src/organism/system/B333AutonomousGoalGenesisGate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { P67AutonomousGoalGenesis } from '../src/organism/developmental/P67AutonomousGoalGenesis.ts';

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

// Hexis-inspired goal lifecycle: safely restore persistent intent and make
// promotion/rejection receipts idempotent instead of re-counting retries.
const p67=new P67AutonomousGoalGenesis();
const p67Input={
  tick:32,at:10000,energy01:.7,uncertainty01:.4,predictionError01:.5,novelty01:.8,
  socialNeed01:.3,goalPressure01:.7,homeostaticPressure01:.4,epistemicUnresolved:4,
  identity01:.9,activeGoalCount:0,lastMode:'idle',identityDecision:'allow',
  motiveOverall01:.8,motiveConflict01:.1,attractorOverall01:.8,attractorConflict01:.1,
  valueWeights:{responsibility:.7,care:.7,autonomy:.6,evidence:.8,truth:.8,curiosity:.8,social:.5},
  curriculumPressure01:.7,historyUnresolved01:.5,socialLearning01:.3,
  worldTransitionConfidence01:.8,worldTransitionError01:.3,worldTransitionNovelty01:.6,neuralConfidence01:.8,
};
const p67Candidate=p67.propose(p67Input);
assert.ok(p67Candidate,'valid intrinsic signals should produce a bounded candidate goal');
assert.equal(p67.markPromoted(p67Candidate.id),true);
assert.equal(p67.markPromoted(p67Candidate.id),false,'duplicate promotion receipt must not inflate counters');
assert.equal(p67.markRejected(p67Candidate.id),false,'a promoted goal cannot also be counted as rejected');
assert.equal(p67.summary().promoted,1);
const p67BeforeHostile=p67.snapshot();
let p67GetterReads=0;
const hostileGoalInput={...p67Input};
Object.defineProperty(hostileGoalInput,'energy01',{enumerable:true,configurable:true,get(){p67GetterReads++;return .99;}});
assert.throws(()=>p67.propose(hostileGoalInput),/p67-goal-input-invalid/);
assert.equal(p67GetterReads,0,'goal proposal must reject accessors before reading internal pressures');
assert.deepEqual(p67.snapshot(),p67BeforeHostile,'invalid proposal must not advance cycles or proposal counters');
assert.throws(()=>p67.propose({...p67Input,unknownOverride:true}),/p67-goal-input-invalid/);
const hostileGoalRestore={...p67.snapshot()};
let p67RestoreGetterReads=0;
Object.defineProperty(hostileGoalRestore,'cycles',{enumerable:true,configurable:true,get(){p67RestoreGetterReads++;return 900;}});
const p67RestoredHostile=new P67AutonomousGoalGenesis();
p67RestoredHostile.restore(hostileGoalRestore);
assert.equal(p67RestoreGetterReads,0,'goal restore must not invoke persisted accessors');
assert.equal(p67RestoredHostile.snapshot().cycles,0,'ambiguous persisted goal state should fail closed');
const p67Restored=new P67AutonomousGoalGenesis();
p67Restored.restore(p67.snapshot());
assert.deepEqual(p67Restored.snapshot(),p67.snapshot(),'goal decision receipts must round-trip with persistent intent');
const p67Corrupt=new P67AutonomousGoalGenesis();
p67Corrupt.restore({...p67.snapshot(),cycles:Number.POSITIVE_INFINITY,history:[{id:'forged',tick:-1,at:0,title:'fake',reason:'fake',source:'intrinsic',importance:2,urgency:2,confidence:2}]});
assert.equal(p67Corrupt.snapshot().cycles,0);
assert.equal(p67Corrupt.snapshot().history.length,0,'malformed persisted goals must be discarded');

console.log(JSON.stringify({pass:true,unit:d,live:cd,restored:core2.b333AutonomousGoalDiagnostics()},null,2));
