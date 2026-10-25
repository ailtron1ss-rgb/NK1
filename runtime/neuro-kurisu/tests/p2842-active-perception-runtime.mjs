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
console.log(JSON.stringify({ok:true,tick:result.cycle.state.tick,active:{executed:active.executed,lastInformationGain01:active.lastInformationGain01},calibration:{resolved:calibration.resolved,last:calibration.records[0]}}));
await runtime.stop?.();
