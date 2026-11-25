import assert from 'node:assert/strict';
import { EmotionAppraisalEngine, projectEmotionAffectFrame } from '../src/organism/system/EmotionAppraisalEngine.ts';
const now=Date.now()-120_000, engine=new EmotionAppraisalEngine();
const episode=engine.appraise({tick:41,at:now,goalPressure01:.9,goalCongruence01:.1,controllability01:.1,novelty01:.8,selfRelevance01:.9,socialMeaning01:.6,uncertainty01:.9,predictionError01:.9,homeostaticPressure01:.85,energy01:.25,success01:.1,external:true});
assert.equal(episode.label,'anxiety');
const acute=projectEmotionAffectFrame({stateVersion:41,stateAt:now,now:now+500,appraisal:engine.snapshot()});
assert.equal(acute.schemaVersion,1);assert.equal(acute.source,'emotion-appraisal');assert.ok(acute.mood.stress01>.18);assert.equal(acute.episodeId,episode.id);
const freshBoot=new EmotionAppraisalEngine().moodSnapshot(now);assert.equal(freshBoot.ageMs,0);assert.equal(freshBoot.resilienceConfidence01,0);
engine.observeInteroception({energy01:.68,thermal01:.2,capacity01:.72,load01:.38,homeostaticPressure01:.02,at:now+60_000});
const recovered=engine.moodSnapshot(now+60_000);
assert.ok(recovered.resilienceConfidence01>0,'recovery must have measured a reduction in mood deviation');
const restored=new EmotionAppraisalEngine();restored.restore(engine.snapshot());
assert.equal(restored.moodSnapshot(now+60_000).events,engine.moodSnapshot(now+60_000).events);
const stale=projectEmotionAffectFrame({stateVersion:40,stateAt:now,now:now+120_000,appraisal:engine.snapshot()});
assert.equal(stale.label,'calm','future tick must never become canonical');
assert.ok(engine.actionBias('explore',now+60_000)>=-.045&&engine.actionBias('explore',now+60_000)<=.045);
console.log('AFFECT_MOOD_DYNAMICS=PASS',JSON.stringify({episode:episode.label,stress:acute.mood.stress01,recoveryConfidence:recovered.resilienceConfidence01}));

// Persistent mood must survive decay of the acute episode that first revealed it.
// Paired scenarios hold the episode, interoception and outcome calibration constant;
// only the slow mood projection differs. This isolates mood's causal action prior.
const seedResults=[];
for(let seed=1;seed<=5;seed++){
  const eventAt=Date.now()-2_000;
  const source=new EmotionAppraisalEngine();
  source.appraise({
    tick:100+seed,at:eventAt,
    goalPressure01:.24+seed*.015,goalCongruence01:.64,
    controllability01:.68,novelty01:.72+seed*.02,
    selfRelevance01:.5,socialMeaning01:.2,
    uncertainty01:.38+seed*.015,predictionError01:.18+seed*.02,
    homeostaticPressure01:.1,success01:.65,
  });
  const base=source.snapshot();
  const makeMood=(overrides)=>({
    version:1,valence01:.5,arousal01:.22,stress01:.18,socialSafety01:.55,
    lastAt:eventAt,lastEpisodeId:base.history[0].id,events:8,interoceptiveSamples:8,
    recoveryActive:false,recoveryStartedAt:0,recoveryStartDistance01:0,recoveryLastDistance01:0,
    recoverySamples:0,meanRecoveryRate01:0,resilience01:.5,resilienceConfidence01:0,
    ...overrides,
  });
  const neutral=new EmotionAppraisalEngine();
  const stressed=new EmotionAppraisalEngine();
  neutral.restore({...base,mood:makeMood({})});
  stressed.restore({...base,mood:makeMood({
    valence01:.22-seed*.01,arousal01:.62+seed*.025,
    stress01:.74+seed*.02,socialSafety01:.38-seed*.025,
  })});

  const after15m=eventAt+15*60_000;
  const neutralRest=neutral.actionBias('rest',after15m);
  const stressedRest=stressed.actionBias('rest',after15m);
  const neutralExplore=neutral.actionBias('explore',after15m);
  const stressedExplore=stressed.actionBias('explore',after15m);
  const restMoodDelta=stressedRest-neutralRest;
  const exploreMoodDelta=stressedExplore-neutralExplore;
  assert.ok(restMoodDelta>.001,
    `seed ${seed}: persistent stress mood should retain a bounded rest prior after acute affect expiry (${restMoodDelta})`);
  assert.ok(exploreMoodDelta<-.001,
    `seed ${seed}: persistent stress mood should reduce exploration after acute affect expiry (${exploreMoodDelta})`);
  for(const value of [neutralRest,stressedRest,neutralExplore,stressedExplore]){
    assert.ok(value>=-.045&&value<=.045,'all direct affect priors remain inside the signed utility cap');
  }

  const after24h=eventAt+24*60*60_000;
  const restAt24h=stressed.actionBias('rest',after24h)-neutral.actionBias('rest',after24h);
  assert.ok(restAt24h>0&&restAt24h<restMoodDelta,
    `seed ${seed}: mood contribution must decay on its own slower horizon (${restAt24h} vs ${restMoodDelta})`);

  const noEvidence=new EmotionAppraisalEngine();
  const none=makeMood({events:0,interoceptiveSamples:0});
  const unsupported=new EmotionAppraisalEngine();
  noEvidence.restore({...base,mood:makeMood({})});
  unsupported.restore({...base,mood:none});
  assert.ok(Math.abs(noEvidence.actionBias('rest',after15m)-unsupported.actionBias('rest',after15m))<1e-12,
    `seed ${seed}: mood without event/interoceptive evidence must not bias actions`);

  seedResults.push({seed,restMoodDelta,exploreMoodDelta,restAt24h});
}


console.log('AFFECT_MOOD_ACTION_PRIOR_PAIRED=PASS',JSON.stringify(seedResults));

// Interoceptive affect uses elapsed-time filters too: equal trajectories at
// different publication rates must produce nearly equal posterior states.
const interoStart=Date.now()-120_000;
const denseIntero=new EmotionAppraisalEngine();
const sparseIntero=new EmotionAppraisalEngine();
for(const engine of [denseIntero,sparseIntero]){
  engine.appraise({tick:300,at:interoStart,goalPressure01:.55,goalCongruence01:.42,controllability01:.46,novelty01:.5,
    selfRelevance01:.6,socialMeaning01:.25,uncertainty01:.52,predictionError01:.3,homeostaticPressure01:.42,energy01:.5,success01:.48});
}
const sensorState={energy01:.4,thermal01:.46,capacity01:.52,load01:.58,homeostaticPressure01:.64};
for(let at=interoStart;at<=interoStart+60_000;at+=1_000)
  denseIntero.observeInteroception({...sensorState,at,sampleId:`dense:${at}`});
for(let at=interoStart;at<=interoStart+60_000;at+=10_000)
  sparseIntero.observeInteroception({...sensorState,at,sampleId:`sparse:${at}`});
const denseInteroState=denseIntero.snapshot().interoception;
const sparseInteroState=sparseIntero.snapshot().interoception;
for(const key of ['meanMismatch01','regulationPressure01','stability01','recovery01','predictionCalibration01'])
  assert.ok(Math.abs(denseInteroState[key]-sparseInteroState[key])<.025,
    `interoceptive posterior ${key} must not depend on call cadence (${denseInteroState[key]} vs ${sparseInteroState[key]})`);
assert.ok(Math.abs(denseInteroState.predicted.energy01-sparseInteroState.predicted.energy01)<.005);
const denseMood=denseIntero.moodSnapshot(interoStart+60_000);
const sparseMood=sparseIntero.moodSnapshot(interoStart+60_000);
for(const key of ['valence01','arousal01','stress01','socialSafety01'])
  assert.ok(Math.abs(denseMood[key]-sparseMood[key])<.025,
    `slow mood ${key} must not become stronger just because the sensor publishes more frequently`);
assert.equal(denseInteroState.recentSampleIds.length,61,
  'the 61 distinct timestamps in the inclusive one-minute trajectory must be retained inside the 64-sample replay window');
assert.equal(denseInteroState.lastAt,sparseInteroState.lastAt);
assert.equal(denseIntero.snapshot().mood.interoceptiveDurationMs,sparseIntero.snapshot().mood.interoceptiveDurationMs);

const replay=new EmotionAppraisalEngine();
replay.observeInteroception({...sensorState,at:interoStart,sampleId:'sensor:one'});
const afterReplay=replay.snapshot().interoception;
replay.observeInteroception({...sensorState,at:interoStart+1_000,sampleId:'sensor:one'});
assert.equal(replay.snapshot().interoception.cycles,afterReplay.cycles);
assert.equal(replay.snapshot().interoception.duplicateObservations,1);
replay.observeInteroception({...sensorState,at:interoStart-1_000,sampleId:'sensor:older'});
assert.equal(replay.snapshot().interoception.outOfOrderObservations,1);
replay.observeInteroception({...sensorState,at:interoStart+2_000,energy01:Number.NaN});
assert.equal(replay.snapshot().interoception.invalidObservations,1);
assert.equal(replay.snapshot().interoception.cycles,afterReplay.cycles);
const interoRestored=new EmotionAppraisalEngine();
interoRestored.restore(denseIntero.snapshot());
assert.deepEqual(interoRestored.snapshot().interoception,denseIntero.snapshot().interoception);
assert.equal(interoRestored.snapshot().mood.interoceptiveDurationMs,denseIntero.snapshot().mood.interoceptiveDurationMs);

console.log('INTEROCEPTIVE_AFFECT_TIME_NORMALIZATION=PASS',JSON.stringify({
  dense:{cycles:denseInteroState.cycles,mismatch:denseInteroState.meanMismatch01,pressure:denseInteroState.regulationPressure01,predictedEnergy:denseInteroState.predicted.energy01,mood:denseMood.stress01,evidenceMs:denseIntero.snapshot().mood.interoceptiveDurationMs},
  sparse:{cycles:sparseInteroState.cycles,mismatch:sparseInteroState.meanMismatch01,pressure:sparseInteroState.regulationPressure01,predictedEnergy:sparseInteroState.predicted.energy01,mood:sparseMood.stress01,evidenceMs:sparseIntero.snapshot().mood.interoceptiveDurationMs},
  replay:{duplicates:replay.snapshot().interoception.duplicateObservations,outOfOrder:replay.snapshot().interoception.outOfOrderObservations,invalid:replay.snapshot().interoception.invalidObservations}
}));


