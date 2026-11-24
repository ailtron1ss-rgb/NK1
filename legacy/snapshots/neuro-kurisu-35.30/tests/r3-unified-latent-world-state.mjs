import assert from 'node:assert/strict';
import { UnifiedLatentWorldState } from '../src/organism/world/UnifiedLatentWorldState.ts';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const context=(tick,uncertainty=.22)=>({tick,location:'lab',energy:.77,attention:.71,uncertainty,facts:['observed communication channel','lab contains instrument'],objects:[{id:'instrument-1',label:'instrument',location:'lab',value:.7,visible:true,collected:false,evidenceKind:'observed',sourceId:`sensor-${tick}`}],events:['external-observation']});

// 1) Independent unit-level contract: observation != latent != prediction ticket != counterfactual.
const canonical=new UnifiedLatentWorldState();
const latent=canonical.observe({tick:1,at:1000,context:context(1),grounding01:.91,p27Latent:new Array(64).fill(.2).map((v,i)=>Math.sin(i*.17))});
assert.ok(latent.id.startsWith('wlat-'));
assert.notEqual(latent.id,latent.observationId);
const prediction=canonical.registerPrediction({action:'verify',predicted01:.73,confidence01:.81,uncertainty01:.24,horizon:2,sourcePredictionId:'wm2-1'});
const counterfactual=canonical.registerCounterfactual({action:'explore',expected01:.69,confidence01:.77,horizon:3,source:'unit-test'});
assert.equal(prediction.latentId,latent.id);
assert.equal(counterfactual.latentId,latent.id);
const resolved=canonical.resolvePrediction(prediction.id,.88,context(2,.18),new Array(64).fill(.1));
assert.equal(resolved.resolved,true);
assert.equal(canonical.diagnostics().predictionResolutions,1);
assert.equal(canonical.snapshot().predictions.filter(x=>x.resolved).length,1);

// 2) Physical WorldSubsystem owner: prediction ticket is canonical and closes on outcome.
const world=new WorldSubsystemRuntime();
world.observeGroundedContext(context(2));
const pre=world.predictForDecision('verify',.62,.28,{version:1,tick:2,at:2000,needs:{energy:.77,cognitiveLoad:.22,uncertainty:.28,socialNeed:.1,novelty:.2,identityCoherence:.7,goalPressure:.4},predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:1});
assert.ok(pre.predictionId.startsWith('wprd-'));
assert.equal(world.unifiedLatentWorldState.diagnostics().openPredictions,1);
const after=context(3,.17);
const outcome=world.observeActionOutcome({action:'verify',before:context(2),after,reward:.84,surprise:.11,at:3000},undefined,pre.predictionId);
assert.equal(outcome.canonicalResolution.resolved,true);
assert.equal(world.unifiedLatentWorldState.diagnostics().openPredictions,0);

// 3) Full organism routing: P2524/P2525/P2522/P2523 consume canonical latent state.
const runtime=new OrganismRuntime({stateFile:'/tmp/nk-r3-state.json',worldStateFile:'/tmp/nk-r3-world.json',enableLanguage:false,autoRun:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),performanceProfile:'mobile'});
await runtime.init();
await runtime.autonomousStep({worldContext:context(10,.29),novelty:.43,uncertainty:.29,reward:.66,embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.85,thermalStrain01:.11,sensoryFreshness01:.92,awake:true,battery01:.84,cpuLoad01:.17,ramPressure01:.18}});
const canonicalSnapshot=runtime.core.unifiedLatentWorldSnapshot();
const canonicalVector=canonicalSnapshot.currentLatent.vector;
const preActionPrediction=canonicalSnapshot.predictions.find(x=>Array.isArray(x.sourceLatentVector));
assert.ok(preActionPrediction);
const preActionVector=preActionPrediction.sourceLatentVector.slice(0,32);
assert.equal(canonicalVector.length,32);
const system=runtime.core.systemSnapshot();
const p24=system.b2524NonparametricWorldExperienceMemory;
const p25=system.b2525LearnedLatentTransitionField;
const p22=system.b2522AdaptiveWorldModelMixtureRouter;
const p23=system.b2523MultiHorizonCounterfactualVerifier;
assert.ok(p24.queries>0 && p25.queries>0 && p22.cycles>0 && p23.cycles>0);
assert.deepEqual(p24.lastContext,preActionVector);
assert.deepEqual(p25.lastPreContext,preActionVector);
assert.ok(p22.lastCanonicalAnchor01>0 || p23.lastCanonicalAnchor01>0);
assert.ok(canonicalSnapshot.counterfactualRegistrations>=7);
assert.ok(canonicalSnapshot.predictionRegistrations>=7);
const candidateFrame=runtime.core.worldPredictionEvidenceSnapshot();
assert.ok(candidateFrame.unifiedLatentWorldState.predictionRegistrations>=7);
assert.equal(candidateFrame.unifiedLatentWorldState.version,1);
runtime.stop();

console.log('R3_UNIFIED_LATENT_WORLD_PASS',JSON.stringify({
  unit:{latentId:latent.id,predictionResolved:resolved.resolved},
  world:{predictionId:pre.predictionId,canonicalResolved:outcome.canonicalResolution.resolved},
  runtime:{observations:canonicalSnapshot.observations,predictions:canonicalSnapshot.predictionRegistrations,counterfactuals:canonicalSnapshot.counterfactualRegistrations,p2524Queries:p24.queries,p2525Queries:p25.queries,p2522Cycles:p22.cycles,p2523Cycles:p23.cycles}
},null,2));
