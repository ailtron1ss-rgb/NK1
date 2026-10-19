import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';
import { CognitiveResourceEconomy } from '../src/organism/system/CognitiveResourceEconomy.ts';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';

const emo=new EmotionAppraisalEngine();
const curious=emo.appraise({tick:1,novelty01:.9,uncertainty01:.7,predictionError01:.45,selfRelevance01:.7,goalPressure01:.4,goalCongruence01:.55,controllability01:.55});
assert.equal(curious.label,'curiosity');
assert.ok(curious.actionTendency==='explore');
const stressed=emo.appraise({tick:2,novelty01:.2,uncertainty01:.9,predictionError01:.8,selfRelevance01:.8,goalPressure01:.9,goalCongruence01:.2,controllability01:.2,homeostaticPressure01:.8});
assert.ok(['anxiety','frustration','protective'].includes(stressed.label));
assert.ok(emo.actionBias('verify')>=0);

const economy=new CognitiveResourceEconomy();
const abundant=economy.allocate({tick:1,energy01:.95,cognitiveLoad01:.1,uncertainty01:.2,novelty01:.5,predictionDebt01:.1,thermalStrain01:.1,ramPressure01:.1});
const scarce=economy.allocate({tick:2,energy01:.12,cognitiveLoad01:.9,uncertainty01:.9,novelty01:.7,predictionDebt01:.9,thermalStrain01:.9,ramPressure01:.9});
assert.ok(abundant.maxCounterfactualBranches>=scarce.maxCounterfactualBranches);
assert.equal(scarce.permitExpensiveLanguage,false);

const retention=new MemoryRetentionEconomy();
const hi=retention.assess({tick:1,salience01:.95,identity01:.95,goal01:.9,predictionError01:.8,emotion01:stressed.arousal01,novelty01:.8,storageCost01:.1});
const lo=retention.assess({tick:2,salience01:.02,identity01:0,goal01:0,predictionError01:.01,emotion01:0,novelty01:0,redundancy01:.95,storageCost01:.9});
assert.equal(hi.action,'retain'); assert.equal(lo.action,'discard-candidate');

const reality=new RealityEvidenceLedger();
reality.record({tick:1,realityClass:'simulator',claim:'x',confidence01:.99,independenceKey:'sim'});
reality.record({tick:2,realityClass:'device-observation',claim:'x',confidence01:.72,independenceKey:'device'});
reality.record({tick:3,realityClass:'external-observation',claim:'x',confidence01:.81,independenceKey:'ext'});
assert.equal(reality.claimAssessment('x').promotionAllowed,true);

const dir=await mkdtemp(join(tmpdir(),'nk164-')); const file=join(dir,'state.json');
const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
await core.observe({text:'164-A необычный опыт: необходимо исследование.',worldContext:{location:'lab',facts:['anomaly'],objects:['sensor'],events:['alert'],energy:.69,attention:.6,uncertainty:.74},novelty:.86});
await core.feedback({success:.36,reward:.12,surprise:.64,evidenceSource:'user',notes:'feedback changed confidence'});
await core.observe({text:'164-B последующий опыт после предыдущей ошибки.',worldContext:{location:'lab',facts:['anomaly','feedback'],objects:['sensor'],events:['repeat'],energy:.64,attention:.58,uncertainty:.62},novelty:.58});
await core.flush();
const before={emotion:core.emotionAppraisalSnapshot(),ret:core.memoryRetentionEconomySnapshot(),influence:core.behavioralInfluenceLedgerSnapshot(),resource:core.cognitiveResourceEconomySnapshot(),reality:core.realityEvidenceLedgerSnapshot(),cycles:core.unifiedCognitiveCycleSnapshot(),fabric:core.cognitiveEventFabricSnapshot()};
assert.ok(before.emotion?.episodes>=2); assert.ok(before.ret?.evaluations>=2); assert.ok(before.influence?.observations>=1); assert.ok(before.cycles?.completeCycles>=1); assert.ok((before.fabric?.buffered??0)>=6);
const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
const after={emotion:resumed.emotionAppraisalSnapshot(),ret:resumed.memoryRetentionEconomySnapshot(),influence:resumed.behavioralInfluenceLedgerSnapshot(),resource:resumed.cognitiveResourceEconomySnapshot(),reality:resumed.realityEvidenceLedgerSnapshot(),cycles:resumed.unifiedCognitiveCycleSnapshot(),fabric:resumed.cognitiveEventFabricSnapshot()};
assert.ok(after.emotion?.episodes>=before.emotion.episodes); assert.ok(after.ret?.evaluations>=before.ret.evaluations); assert.ok(after.influence?.observations>=before.influence.observations); assert.ok(after.cycles?.completeCycles>=before.cycles.completeCycles); assert.ok((after.fabric?.buffered??0)>=before.fabric.buffered);
resumed.stop?.();
console.log(JSON.stringify({pass:164,status:'PASS',emotionEpisodes:after.emotion.episodes,emotionLabel:after.emotion.lastLabel,retentionEvaluations:after.ret.evaluations,influenceObservations:after.influence.observations,completeCycles:after.cycles.completeCycles,causalEvents:after.fabric.buffered,resourceMode:after.resource.lastMode,realityExternal:after.reality.externalCount,persistence:true},null,2));
