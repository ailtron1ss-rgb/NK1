import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2842-'));
const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile'});
await runtime.init();
let motion01 = 0.1;
let sampleAt = Date.now();
const sampleBody = () => {
  sampleAt += 1_000;
  const base = defaultBodyState(sampleAt);
  return {
    ...base,
    sensoryFreshness01: 1,
    thermalStrain01: 0.12,
    telemetry: {
      ...base.telemetry,
      battery01: 0.82,
      ambientLight01: 0.1,
      proximity01: 0.1,
      motion01,
      networkOnline: false,
      sampledAt: sampleAt,
      source: 'android-termux',
      staleMs: 0,
    },
  };
};
// Deterministic, fresh samples exercise sensor -> perception -> cognitive ingress without device hardware.
runtime.embodiment.sample = async () => sampleBody();
runtime.embodiment.sampleActive = async () => sampleBody();
runtime.embodiedActions.execute=async(action)=>({
  version:1,action,status:'executed',realityClass:'device-observation',source:'android-termux',at:Date.now(),
  before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  after:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  stateDelta:{battery01:0,thermal01:0,cognitiveCapacity01:0,awakeChanged:false},
  effect01:.72,reason:'p2842-test-external-observation',capability:'android.sensors',
  consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.64,reason:'p2842-independent-observation',verificationMode:'independent-observation'}
});
const baselineResult = await runtime.step();
const initialPerception = runtime.perceptionSnapshot();
assert.equal(initialPerception.baselineInitialized, true, 'runtime perception should establish a fresh sensor baseline');
assert.equal(initialPerception.sensorChanges, 0, 'initial sample must not be mistaken for a sensor change');

motion01 = 0.72;
const result = await runtime.step();
const runtimePerception = runtime.perceptionSnapshot();
assert.equal(runtimePerception.lastEvent?.kind, 'motion', 'sensor change should reach the runtime-owned perception engine');
assert.equal(runtimePerception.sensorChanges, 1);
assert.equal(runtimePerception.baseline.motion01, motion01);
const active=runtime.core.activePerceptionSnapshot();
const calibration=runtime.core.worldCausalCalibrationSnapshot();
assert.ok(result.embodiedAction);
assert.equal(result.embodiedAction.source,'android-termux');
assert.equal(result.embodiedAction.consequenceVerification.verified,true);
assert.ok(active.executed>=1,'active perception request should be measured');
assert.ok(active.lastInformationGain01>=0);
assert.ok(calibration.resolved>=1,'runtime must resolve the exact pre-action prediction ticket');
assert.ok(calibration.records.some(x=>x.predictionId && x.verified01===1 && x.independent01===1));

// Semantic vision is produced after the camera pipeline and must enter the next
// canonical multimodal/cognitive cycle once, without replaying stale startup frames.
const beforeVisionFrames = runtime.core.p41PerceptionSnapshot().modalityReliability.vision.observations;
runtime.core.p41PerceptionIngest({
  vision: {
    semantic: true,
    sceneLabel: 'test-room',
    confidence01: 0.92,
    objects: [{ label: 'desk lamp', kind: 'object', confidence01: 0.87 }],
    relations: [{ from: 'desk lamp', relation: 'on', to: 'desk', confidence01: 0.81 }],
    events: [{ label: 'lamp-lit', confidence01: 0.84 }],
    latencyMs: 12,
  },
  at: sampleAt + 100,
});
assert.equal(
  runtime.core.p41PerceptionSnapshot().modalityReliability.vision.observations,
  beforeVisionFrames + 1,
);
await runtime.step();
const multimodalVision = runtime.core.multimodalSnapshot().recent.find(
  event => event.modality === 'vision' && event.summary.includes('scene=test-room'),
);
assert.ok(multimodalVision, 'new P41 semantic vision should surface in runtime multimodal ingress');
assert.ok(multimodalVision.confidence >= 0.84);

// A burst must be drained oldest-first rather than skipping every frame except the newest.
runtime.core.p41PerceptionIngest({
  vision: { semantic: true, sceneLabel: 'test-room-intermediate', confidence01: 0.88, objects: [{ label: 'chair', kind: 'object', confidence01: 0.8 }], latencyMs: 11 },
  at: sampleAt + 200,
});
runtime.core.p41PerceptionIngest({
  vision: { semantic: true, sceneLabel: 'test-room-latest', confidence01: 0.91, objects: [{ label: 'window', kind: 'object', confidence01: 0.85 }], latencyMs: 10 },
  at: sampleAt + 300,
});
await runtime.step();
const intermediateVision = runtime.core.multimodalSnapshot().recent.filter(
  event => event.modality === 'vision' && event.summary.includes('scene=test-room-intermediate'),
);
assert.equal(intermediateVision.length, 1, 'the oldest pending frame should be integrated first');
await runtime.step();
const latestVision = runtime.core.multimodalSnapshot().recent.filter(
  event => event.modality === 'vision' && event.summary.includes('scene=test-room-latest'),
);
assert.equal(latestVision.length, 1, 'the next pending frame should be integrated on the next cycle');
await runtime.step();
const repeatedVisionEvents = runtime.core.multimodalSnapshot().recent.filter(
  event => event.modality === 'vision' && /scene=test-room(?:-intermediate|-latest)?(?:;|$)/.test(event.summary),
);
assert.equal(
  repeatedVisionEvents.length,
  3,
  'integrated P41 vision snapshots must not be replayed on later cognitive cycles',
);

// A sensor becoming unavailable/recovering must be represented as availability,
// not as a fabricated zero or a physical motion event; user text must not starve sensing.
motion01 = null;
await runtime.step('the motion sensor is unavailable');
const lostMotion = runtime.perceptionSnapshot();
assert.equal(lostMotion.lastEvent?.kind, 'sensor-availability');
assert.ok(lostMotion.lastEvent?.evidence.includes('sensor=motion'));
assert.equal(lostMotion.baseline.motion01, null);

motion01 = 0.1;
await runtime.step('the motion sensor is available again');
const restoredMotion = runtime.perceptionSnapshot();
assert.equal(restoredMotion.lastEvent?.kind, 'sensor-availability');
assert.ok(restoredMotion.lastEvent?.evidence.includes('sensor=motion'));
assert.equal(restoredMotion.baseline.motion01, 0.1);
assert.equal(restoredMotion.sensorChanges, 3, 'one motion change plus loss and recovery should be counted');
console.log(JSON.stringify({
  ok: true,
  tick: result.cycle.state.tick,
  active: { executed: active.executed, lastInformationGain01: active.lastInformationGain01 },
  calibration: { resolved: calibration.resolved, last: calibration.records[0] },
  perception: { sensorChanges: restoredMotion.sensorChanges, availabilityTransitions: 2 },
}));
await runtime.stop?.();
