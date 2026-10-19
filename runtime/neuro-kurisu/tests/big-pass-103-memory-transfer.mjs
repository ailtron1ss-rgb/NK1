import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';

const f=new ExperienceContinuumFabric({maxNodes:128,maxEdges:256,maxClusters:32});
const base={id:'m103',kind:'episodic',source:'runtime',content:'causal memory replay transfer test',createdAt:1,lastAccessAt:1,retrievalCount:0,salience:.84,identityRelevance:.72,goalRelevance:.82,predictionError:.78,emotionalWeight:.42,socialRelevance:.36,confidence:.82,semanticLinks:[],temporalLinks:[],causalLinks:[],epistemicStatus:'verified'};
f.observe(base,{tick:1,at:1,novelty01:.74,activeGoalIds:['goal-A'],evidenceSupport01:.82});
const candidates=f.replayCandidates(4,['goal-A']); assert.equal(candidates.length,1); assert.ok(candidates[0].replayPriority01>.5);
const r=f.reactivate('m103',1000); assert.ok(r); assert.equal(r.tier,'hot');
const before=f.snapshot().graphNodes[0].stability01;
const validation=f.recordReplayValidation({memoryId:'m103',retentionScore01:.92,transferPotential01:.71,interferenceRisk01:.04,independentVerified:true,evidenceKey:'holdout:m103:1',at:1100});
assert.equal(validation.independentVerified,true);
assert.ok(f.snapshot().replay.validated===1); assert.ok(f.snapshot().graphNodes[0].stability01>=before);
f.recordReplayExperimentTrial({experimentId:'exp103',taskId:'task-X',mode:'replay-on',preScore01:.5,postScore01:.8,independentVerified:true,randomized:true,contextKey:'x1',pairKey:'pair-1',at:1200});
f.recordReplayExperimentTrial({experimentId:'exp103',taskId:'task-X',mode:'replay-on',preScore01:.5,postScore01:.74,independentVerified:true,randomized:true,contextKey:'x2',pairKey:'pair-2',at:1300});
f.recordReplayExperimentTrial({experimentId:'exp103',taskId:'task-X',mode:'replay-off',preScore01:.5,postScore01:.56,independentVerified:true,randomized:true,contextKey:'x1',pairKey:'pair-1',at:1400});
f.recordReplayExperimentTrial({experimentId:'exp103',taskId:'task-X',mode:'replay-off',preScore01:.5,postScore01:.59,independentVerified:true,randomized:true,contextKey:'x2',pairKey:'pair-2',at:1500});
const exp=f.replayExperimentSummary('exp103','task-X');
assert.equal(exp.pairedComparable,true); assert.equal(exp.evidenceGrade,'randomized-matched-observational'); assert.ok((exp.estimatedConditionDifference01??0)>.1);

const cx=new CausalExperienceStream();
const replayRecord=cx.recordExternalLearningEvent({tick:8,taskId:'replay:m103',action:'reflect',reward01:.5,success01:.5,surprise01:.7,novelty01:.6,causalStrength01:.67,provenance:'experience-replay',stateGrounded:false,sourceMemoryId:'m103',evidenceKey:'replay:m103'});
const repairRecord=cx.recordExternalLearningEvent({tick:9,taskId:'repair:demo',action:'explore',reward01:.9,success01:1,surprise01:.4,novelty01:.5,causalStrength01:.75,provenance:'skill-repair',stateGrounded:false,evidenceKey:'repair:demo'});
assert.equal(replayRecord.provenance,'experience-replay'); assert.equal(replayRecord.stateGrounded,false); assert.equal(repairRecord.provenance,'skill-repair');

const ul=new UnifiedLearningSubstrate();
const replaySignal=ul.ingestExternalSignal({taskId:'replay:m103',action:'reflect',reward01:.5,success01:.5,surprise01:.7,novelty01:.6,causalStrength01:.67,transferPotential01:.65,provenance:'experience-replay'});
assert.ok(replaySignal.learningOpportunity01>.4);
const probe=ul.beginTransferProbe({sourceTaskId:'source-X',targetTaskId:'target-Y',baseline01:.48,contextKey:'holdout-1',at:1600});
ul.recordTransferProbe({...probe,postScore01:.66,independentVerified:true,holdout:true});
ul.recordTransferProbe({...probe,id:probe.id+'-2',postScore01:.64,independentVerified:true,holdout:true});
const td=ul.transferDiagnostics();
assert.equal(td.validatedSamples,2); assert.equal(td.positiveSamples,2); assert.equal(td.negativeSamples,0); assert.ok(td.crossTaskTransfer01>0);
const diag=ul.diagnostics(); assert.equal(diag.version,2); assert.equal(diag.provenanceCounts.experienceReplay,1);

console.log('BIG_PASS_103_MEMORY_TRANSFER=PASS',JSON.stringify({
  replayValidated:f.snapshot().replay.validated,
  experimentDifference:Number((exp.estimatedConditionDifference01??0).toFixed(3)),
  causalProvenance:replayRecord.provenance,
  transferValidated:td.validatedSamples,
  positiveTransfer:td.positiveSamples,
  interference:Number(td.interference01.toFixed(3)),
  unifiedVersion:diag.version
}));
