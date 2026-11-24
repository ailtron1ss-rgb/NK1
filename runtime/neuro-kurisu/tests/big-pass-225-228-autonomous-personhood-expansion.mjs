import assert from 'node:assert/strict';
import { SelfDirectedLifeOrchestrator } from '../src/organism/system/SelfDirectedLifeOrchestrator.ts';
import { AutonomousLearningMemoryGovernor } from '../src/organism/system/AutonomousLearningMemoryGovernor.ts';
import { AutonomousRelationshipManager } from '../src/organism/system/AutonomousRelationshipManager.ts';
import { IdentityContinuityGuard } from '../src/organism/system/IdentityContinuityGuard.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const life=new SelfDirectedLifeOrchestrator();
let frame=null;
for(let i=1;i<=18;i++){
  frame=life.cycle({tick:i,at:i*10000,externalInput:false,energy01:.82,thermal01:.18,uncertainty01:i%3===0?.72:.48,novelty01:i%4===0?.75:.55,goalPressure01:.58,homeostaticPressure01:.2,identity01:.81,activeGoalCount:1,activeProject:i%4!==0,projectProgress01:Math.min(.9,i/24),learningPressure01:.62,socialNeed01:.42,maintenanceDue01:.18,resourcePressure01:.22});
  if(frame.commitment) life.observe({commitmentId:frame.commitment.id,success01:i%5===0?.82:.68,at:i*10000});
}
assert.ok(life.summary().initiatives>=2);
assert.ok(life.summary().activeCommitments>=1 || life.summary().completed>=1);
assert.ok(life.summary().meanAgency01>.35);
const life2=new SelfDirectedLifeOrchestrator();life2.restore(life.snapshot());assert.equal(life2.summary().initiatives,life.summary().initiatives);

const mem=new AutonomousLearningMemoryGovernor();
for(let i=0;i<14;i++)mem.cycle({tick:i+1,at:(i+1)*1000,predictionError01:.6+(i%2)*.1,uncertainty01:.58,novelty01:.61,goalPressure01:.55,outcome01:.65,identity01:.82,memoryPressure01:.2});
assert.ok(mem.summary().stored>=10);assert.ok(mem.summary().consolidated>=10);
const recalled=mem.retrieve(.9);assert.ok(recalled);assert.ok(mem.summary().retrieved>=1);

const rel=new AutonomousRelationshipManager();
for(let i=0;i<6;i++) rel.cycle({at:i*1000,externalInput:false,socialNeed01:.72,identity01:.8,energy01:.8,activeGoalCount:1,knownContactId:null,outcome01:.7});
assert.ok(rel.summary().initiatives>=5);
const rel2=new AutonomousRelationshipManager();rel2.cycle({at:9000,externalInput:true,socialNeed01:.4,identity01:.8,energy01:.8,activeGoalCount:1,knownContactId:'external-partner',outcome01:.75});

const guard=new IdentityContinuityGuard();
const good=guard.evaluate({at:1,identity01:.84,valueStability01:.82,narrative01:.8,projectContinuity01:.72,externalPressure01:.1,proposedRevision01:.7,verifiedEvidence01:.9});
const bad=guard.evaluate({at:2,identity01:.31,valueStability01:.22,narrative01:.18,projectContinuity01:.12,externalPressure01:.92,proposedRevision01:.9,verifiedEvidence01:.1});
assert.equal(good.safe,true);assert.equal(bad.safe,false);assert.ok(guard.summary().rejected>=1);

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg);await core.init();
for(let i=0;i<8;i++) await core.autonomousHeartbeat(200000+i*12000);
await core.flush();
const s1=core.systemSnapshot();
assert.ok((s1.selfDirectedLife?.initiatives??0)>=1);
assert.ok((s1.autonomousLearningMemory?.stored??0)>=1);
assert.ok((s1.autonomousRelationships?.cycles??0)>=1);
assert.ok((s1.identityContinuityGuard?.checks??0)>=1);
const core2=new OrganismCore(store,cfg);await core2.init();const s2=core2.systemSnapshot();
assert.equal(s2.selfDirectedLife?.initiatives,s1.selfDirectedLife?.initiatives);
assert.equal(s2.autonomousLearningMemory?.stored,s1.autonomousLearningMemory?.stored);
assert.equal(s2.identityContinuityGuard?.checks,s1.identityContinuityGuard?.checks);
console.log(JSON.stringify({pass:'BIG_PASS_225_228_AUTONOMOUS_PERSONHOOD_EXPANSION',modules:{selfDirectedLife:life.summary(),learningMemory:mem.summary(),relationships:rel.summary(),identityGuard:guard.summary()},core:{selfDirectedLife:s1.selfDirectedLife,autonomousLearningMemory:s1.autonomousLearningMemory,autonomousRelationships:s1.autonomousRelationships,identityContinuityGuard:s1.identityContinuityGuard,restartPreserved:true},verified:true},null,2));
