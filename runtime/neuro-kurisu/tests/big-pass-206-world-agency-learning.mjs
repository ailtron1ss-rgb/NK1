import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { CognitiveQuorumEngine } from '../src/organism/system/CognitiveQuorum.ts';
import { WorldAgencyLearningCausalBridge } from '../src/organism/system/WorldAgencyLearningCausalBridge.ts';

const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const q=new CognitiveQuorumEngine();
const high=q.evaluate({action:'explore',constitutional01:.95,worldConfidence01:.92,memorySupport01:.72,epistemic01:.88,budget01:.8,identity01:.9,urgency01:.6});
const low=q.evaluate({action:'explore',constitutional01:.95,worldConfidence01:.12,memorySupport01:.72,epistemic01:.88,budget01:.8,identity01:.9,urgency01:.6});
assert.ok(high.score01>low.score01,'world confidence must causally move agency quorum score');

const bridge=new WorldAgencyLearningCausalBridge();
const verified=bridge.recordOutcome({tick:1,at:1,action:'explore',worldOn01:.92,worldOff01:.12,selectedUtility01:.74,alternativeAction:'verify',alternativeUtility01:.41,outcome01:.83,reward01:.87,learningDelta01:.08,counterfactualActionChanged:true,counterfactualLearningChanged:true,provenance:'controlled-ablation'});
assert.equal(verified.status,'verified');
assert.ok(verified.worldDelta01>=.8);
assert.ok(verified.learningDelta01>=.08);

const store=new MemoryStateStore();
const core=new OrganismCore(store,cfg); await core.init();
for(let i=0;i<4;i++){ await core.observe({text:`agency learning ${i}`,worldContext:{location:'lab',facts:[i%2?'hazard present':'safe clear path'],objects:[]},novelty:.7+i*.02}); await core.feedback({success:.64+i*.04,reward:.66+i*.04,evidenceSource:'big-pass-206-test'}); }
const snap=core.worldAgencyLearningCausalBridgeSnapshot();
assert.ok(snap.applications>=1,'live bridge must observe outcomes');
const restored=new OrganismCore(store,cfg); await restored.init();
assert.deepEqual(restored.worldAgencyLearningCausalBridgeSnapshot(),snap,'bridge survives restart');
console.log('BIG_PASS_206_WORLD_AGENCY_LEARNING=PASS',JSON.stringify({quorumHigh:high.score01,quorumLow:low.score01,controlledStatus:verified.status,liveApplications:snap.applications,verifiedLinks:snap.verifiedLinks,restore:'PASS'}));
