import assert from 'node:assert/strict';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';
import { PredictionDebtEngine } from '../src/organism/system/PredictionDebt.ts';
import { CognitiveQuorumEngine } from '../src/organism/system/CognitiveQuorum.ts';
import { ShadowOrganismEngine } from '../src/organism/system/ShadowOrganism.ts';
import { IdentityCausalityGraphEngine } from '../src/organism/system/IdentityCausalityGraph.ts';
import { LongHorizonPredictionBenchmark } from '../src/organism/system/LongHorizonPredictionBenchmark.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const ex=new AutonomousProjectExecutor();
const p=ex.ensure({id:'p1',origin:'unresolved'});
assert.equal(p.steps.length,3); assert.equal(ex.currentStep()?.action,'verify');
ex.observe({action:'verify',success01:.86,evidence01:.9,relevant:true,tick:1});
assert.ok(ex.snapshot().completedSteps>=1);

const debt=new PredictionDebtEngine();
debt.register('a','self',1,4,.8); debt.register('b','world',1,2,.9); debt.tick(2); assert.equal(debt.snapshot().agingCount,1);
debt.resolve('b',2); assert.equal(debt.snapshot().records.find(r=>r.predictionId==='b')?.status,'resolved');

const quorum=new CognitiveQuorumEngine();
const q=quorum.evaluate({action:'verify',constitutional01:.92,worldConfidence01:.72,memorySupport01:.55,epistemic01:.68,budget01:.8,identity01:.88,urgency01:.6});
assert.ok(q.score01>.6); assert.ok(q.votes.length===7);

const shadow=new ShadowOrganismEngine();
const state={version:84,tick:10,at:Date.now(),needs:{energy:.8,cognitiveLoad:.2,uncertainty:.5,socialNeed:.2,novelty:.5,identityCoherence:.9,goalPressure:.4},predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:1};
const candidates=['verify','explore','reflect'].map((action,i)=>({id:String(i),goalId:undefined,action,predictedUtility:[.7,.82,.6][i],predictedNeedRelief:.5,predictedCost:.2,confidence:.7,score:[.7,.82,.6][i],generatedAt:state.at}));
shadow.decide({state,candidates,actualAction:'verify'}); assert.equal(shadow.snapshot().recent.length,1); shadow.observeOutcome({tick:10,actualSuccess:.8,actualAction:'verify'});

const ic=new IdentityCausalityGraphEngine(); ic.observe({tick:1,identityLabel:'Kurisu',causeKind:'goal',causeLabel:'accuracy',strength01:.8,reason:'goal pursuit'}); assert.equal(ic.snapshot().edges.length,1);

const lhp=new LongHorizonPredictionBenchmark();
const seedState={...state,tick:1};
lhp.seed(seedState,1,.9); lhp.seed(seedState,4,.75); lhp.seed(seedState,12,.6);
const s2={...state,tick:2,needs:{...state.needs,energy:.81}}; lhp.tick(s2); assert.equal(lhp.snapshot().resolved>=1,true);

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableWorldModel:true,enableLanguage:false,enableSelfProjects:true,enableSelfPrediction:true,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
for(let i=0;i<20;i++){await core.observe({text:i===0?'проверь неизвестность':undefined,success:i%4===0?.82:undefined,embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.86,thermalStrain01:.2,sensoryFreshness01:.85,awake:true},worldContext:{location:'lab',uncertainty:i%3===0?.64:.25}});if(i%4===0) await core.feedback({success:.82,reward:.7,evidenceSource:'device'}); const pred=core.recordPrediction({tick:core.snapshot().state.tick,kind:'self',action:'verify',predicted01:.72,confidence01:.7}); if(i%2===0) core.resolvePrediction(pred,.65);}
const ss=core.systemSnapshot();
assert.ok((ss.predictionDebt?.records?.length??0)>0); assert.ok((ss.cognitiveQuorum?.decisions??0)>0); assert.ok((ss.shadowOrganism?.comparisons??0)>0); assert.ok((ss.identityCausality?.samples??0)>0); assert.ok((ss.longHorizonPrediction?.samples??0)>=1); assert.ok((ss.autonomousProjectExecutor?.cycles??0)>=0);
await core.flush(); const persisted=await store.load(); assert.equal(persisted.system.schemaVersion,RELEASE_CONTRACT.stateSchema); assert.ok(persisted.system.predictionDebt); assert.ok(persisted.system.shadowOrganism); assert.ok(persisted.system.identityCausality); assert.ok(persisted.system.longHorizonPrediction);
console.log('BIG_PASS_38_AUTONOMOUS_SPINE=PASS',JSON.stringify({tick:core.snapshot().state.tick,predictionDebt:ss.predictionDebt?.records?.length,quorum:ss.cognitiveQuorum?.decisions,shadow:ss.shadowOrganism?.comparisons,longHorizon:ss.longHorizonPrediction?.samples,projectCycles:ss.autonomousProjectExecutor?.cycles}));
