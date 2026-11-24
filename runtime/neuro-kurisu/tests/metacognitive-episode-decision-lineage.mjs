import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { normalizeMetacognitiveEpisode } from '../src/organism/cognition/MetacognitiveEpisode.ts';

const stagePayload=(source,payload={})=>({source,confidence01:0.8,payload});
const verifierIds=(ids)=>({
  observation:ids.observation,
  prediction:ids.prediction,
  appraisal:ids.appraisal,
  attention:ids.attention,
  memory:ids.memory,
  goal:ids.goal,
  plan:ids.plan,
  action:ids.action,
  outcome:ids.outcome,
  learning:ids.learning,
  'self-update':ids.selfUpdate,
});
const cycleInput=(tick,decisionId,overrides={})=>({
  tick,
  ...(decisionId===undefined?{}:{decisionId}),
  observation:stagePayload('runtime',{inputId:`input:${tick}`}),
  prediction:stagePayload('reward-model',{predictionId:`prediction:${tick}`}),
  appraisal:stagePayload('homeostatic-appraisal',{energy01:0.7}),
  attention:stagePayload('global-workspace',{broadcastId:`workspace:${tick}`}),
  memory:stagePayload('MemoryFabric.retrieveForCognition',{retrievedCount:1}),
  goal:stagePayload('canonical-goal-selection',{goalId:`goal:${tick}`}),
  plan:stagePayload('plan-engine',{stepCount:1}),
  action:stagePayload('organism-action-gate',{action:'explore'}),
  outcome:stagePayload('grounded-world',{verified:true}),
  learning:stagePayload('core.feedback',{accepted:true}),
  selfUpdate:stagePayload('core.lifecycle',{continuity01:0.9}),
  ...overrides,
});

const fabric=new CognitiveEventFabric(256);
const decisionId='decision:12:canonical';
const stageIds=fabric.recordOperationalCycle(cycleInput(12,decisionId));
const names=['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','selfUpdate'];
const snapshot=fabric.snapshot();
const eventById=new Map(snapshot.recent.map(event=>[event.id,event]));
for(const name of names){
  const event=eventById.get(stageIds[name]);
  assert.ok(event,`CEF must retain the ${name} stage`);
  assert.equal(event.payload.decisionId,decisionId,`the ${name} event must carry the exact Core decision ID`);
}
const lineage=fabric.verifyOperationalCycle(verifierIds(stageIds));
assert.equal(lineage.decisionId,decisionId);
assert.equal(lineage.decisionLineageComplete,true);
assert.deepEqual(lineage.decisionLineageIssues,[]);
assert.equal(lineage.fullComplete,true,'the eleven-stage causal cycle must remain complete');

const tampered=structuredClone(snapshot);
const actionNode=tampered.recent.find(event=>event.id===stageIds.action);
actionNode.payload.decisionId='decision:other';
const restored=new CognitiveEventFabric(256);
restored.restore(tampered);
const broken=restored.verifyOperationalCycle(verifierIds(stageIds));
assert.equal(broken.decisionLineageComplete,false,'restore must not accept a cross-decision cycle');
assert.ok(broken.decisionLineageIssues.includes('action:decision-id-mismatch'));
assert.equal(broken.fullComplete,false,'decision identity is part of strict full-cycle completeness');

const conflictFabric=new CognitiveEventFabric(256);
assert.throws(
  ()=>conflictFabric.recordOperationalCycle(cycleInput(13,'decision:A',{
    action:stagePayload('organism-action-gate',{decisionId:'decision:B',action:'explore'}),
  })),
  /cognitive-cycle-decision-id-conflict/,
  'a caller cannot override the canonical decision ID inside one stage payload',
);
assert.equal(conflictFabric.snapshot().total,0,'invalid decision identity must fail before any partial cycle is appended');

const legacyFabric=new CognitiveEventFabric(256);
const legacyIds=legacyFabric.recordOperationalCycle(cycleInput(14,undefined));
const legacy=legacyFabric.verifyOperationalCycle(verifierIds(legacyIds));
assert.equal(legacy.decisionLineageComplete,true,'unannotated historical cycles remain readable');
assert.equal(legacy.decisionId,undefined);
assert.equal(legacy.fullComplete,true,'legacy cycle completeness remains backward compatible');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nk-decision-lineage-'));
const runtime=new OrganismRuntime({
  stateFile:path.join(directory,'organism.json'),
  worldStateFile:path.join(directory,'world.json'),
  enableLanguage:false,
  autoRun:false,
  intervalMs:100000,
});
let restoredRuntime;
let runtimeStopped=false;
try {
  await runtime.init();
  const result=await runtime.step('decision lineage integration check',{deliberate:true});
  const runtimeDecisionId=result.cycle.decision.id;
  assert.ok(typeof runtimeDecisionId==='string'&&runtimeDecisionId.length>0,'Core must expose the canonical decision trace ID');
  const runtimeSnapshot=runtime.cognitiveEventFabricSnapshot();
  const tick=result.cycle.state.tick;
  const cycleEvents=runtimeSnapshot.recent.filter(event=>event.tick===tick&&names.some(name=>(name==='selfUpdate'?'self-update':name)===event.stage));
  assert.equal(cycleEvents.length,11,'one runtime step must emit exactly eleven operational stages');
  assert.ok(cycleEvents.every(event=>event.payload.decisionId===runtimeDecisionId),
    'OrganismRuntime must bind every operational stage to the exact OrganismCore decision');
  const runtimeIds={
    observation:cycleEvents.find(e=>e.stage==='observation')?.id,
    prediction:cycleEvents.find(e=>e.stage==='prediction')?.id,
    appraisal:cycleEvents.find(e=>e.stage==='appraisal')?.id,
    attention:cycleEvents.find(e=>e.stage==='attention')?.id,
    memory:cycleEvents.find(e=>e.stage==='memory')?.id,
    goal:cycleEvents.find(e=>e.stage==='goal')?.id,
    plan:cycleEvents.find(e=>e.stage==='plan')?.id,
    action:cycleEvents.find(e=>e.stage==='action')?.id,
    outcome:cycleEvents.find(e=>e.stage==='outcome')?.id,
    learning:cycleEvents.find(e=>e.stage==='learning')?.id,
    'self-update':cycleEvents.find(e=>e.stage==='self-update')?.id,
  };
  const runtimeVerifier=new CognitiveEventFabric(512);
  runtimeVerifier.restore(runtimeSnapshot);
  const runtimeLineage=runtimeVerifier.verifyOperationalCycle(runtimeIds);
  assert.equal(runtimeLineage.decisionId,runtimeDecisionId);
  assert.equal(runtimeLineage.decisionLineageComplete,true);
  assert.equal(runtimeLineage.fullComplete,true);
  const episodeEvent=runtimeSnapshot.recent.find(event=>event.tick===tick&&event.stage==='metacognitive-episode');
  assert.ok(episodeEvent,'a completed runtime cycle must emit its metacognitive episode');
  assert.equal(episodeEvent.payload.decisionId,runtimeDecisionId,
    'metacognitive reflection must retain the exact decision identity');
  assert.equal(episodeEvent.parentIds.length,11,
    'the metacognitive episode must reference all eleven operational stages');
  assert.ok(episodeEvent.parentIds.every(id=>runtimeSnapshot.recent.find(event=>event.id===id)?.payload.decisionId===runtimeDecisionId),
    'metacognitive reflection parents must all belong to the same Core decision');

  const storedEpisodeEvent=runtime.core.snapshot().facets.memory.eventLog.find(event=>event.type==='metacognitive-episode'&&event.tick===tick);
  assert.ok(storedEpisodeEvent,'the metacognitive episode must be stored in the canonical memory event log');
  assert.equal(storedEpisodeEvent.payload.episode.decisionId,runtimeDecisionId,
    'the persisted episode object must retain the same Core decision identity');
  const canonicalProjection=runtime.core.memorySubstrateCanonicalItems(64).find(item=>item.id===`metacognitive-cycle-${tick}`);
  assert.ok(canonicalProjection,'the lightweight canonical-memory view must expose the same episode ID');
  const diagnostics=runtime.core.metacognitiveEpisodeDiagnostics(4);
  assert.equal(diagnostics.episodes[0]?.decisionId,runtimeDecisionId,
    'bounded metacognitive diagnostics must expose the episode decision identity');
  assert.equal(diagnostics.episodes[0]?.memoryDecisionId,runtimeDecisionId,
    'bounded diagnostics must read the same identity from the live canonical MemoryOS2 owner');
  const legacyEpisode={...storedEpisodeEvent.payload.episode};
  delete legacyEpisode.decisionId;
  assert.ok(normalizeMetacognitiveEpisode(legacyEpisode),
    'pre-decision-identity episodes must remain readable after schema extension');

  await runtime.flush();
  await runtime.stop();
  runtimeStopped=true;
  restoredRuntime=new OrganismRuntime({
    stateFile:path.join(directory,'organism.json'),
    worldStateFile:path.join(directory,'world.json'),
    enableLanguage:false,
    autoRun:false,
    intervalMs:100000,
  });
  await restoredRuntime.init();
  const restoredSnapshot=restoredRuntime.core.snapshot();
  const restoredEpisodeEvent=restoredSnapshot.facets.memory.eventLog.find(event=>event.type==='metacognitive-episode'&&event.tick===tick);
  assert.ok(restoredEpisodeEvent,'the persisted metacognitive episode must survive runtime restore');
  assert.equal(restoredEpisodeEvent.payload.episode.decisionId,runtimeDecisionId,
    'restored episode lineage must preserve the exact decision identity');
  const restoredMemory=restoredRuntime.core.memorySubstrateCanonicalItems(64).find(item=>item.id===`metacognitive-cycle-${tick}`);
  assert.ok(restoredMemory,'the canonical episode must remain retrievable after restore');
  const restoredDiagnostics=restoredRuntime.core.metacognitiveEpisodeDiagnostics(4);
  assert.equal(restoredDiagnostics.episodes[0]?.memoryDecisionId,runtimeDecisionId,
    'the restored canonical MemoryOS2 owner must retain the exact decision identity');
  console.log(JSON.stringify({
    decisionId:runtimeDecisionId,
    stages:cycleEvents.map(event=>event.stage),
    decisionLineageComplete:runtimeLineage.decisionLineageComplete,
    tamperRejected:!broken.decisionLineageComplete,
    legacyCompatible:legacy.decisionLineageComplete,
    persistedDecisionIdentity:storedEpisodeEvent.payload.episode.decisionId,
    restoredDecisionIdentity:restoredEpisodeEvent.payload.episode.decisionId,
  },null,2));
} finally {
  if(restoredRuntime) await restoredRuntime.stop();
  if(!runtimeStopped) await runtime.stop();
  fs.rmSync(directory,{recursive:true,force:true});
}
