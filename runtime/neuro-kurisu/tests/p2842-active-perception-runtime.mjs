import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2842-'));
const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile'});
await runtime.init();
runtime.embodiedActions.execute=async(action)=>({
  version:1,action,status:'executed',realityClass:'device-observation',source:'android-termux',at:Date.now(),
  before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  after:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  stateDelta:{battery01:0,thermal01:0,cognitiveCapacity01:0,awakeChanged:false},
  effect01:.72,reason:'p2842-test-external-observation',capability:'android.sensors',
  consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.64,reason:'p2842-independent-observation',verificationMode:'independent-observation'}
});
const result=await runtime.step();
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
