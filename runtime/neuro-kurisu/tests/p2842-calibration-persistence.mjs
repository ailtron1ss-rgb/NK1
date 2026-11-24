import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2842-persist-'));
const stateFile=path.join(dir,'state.json');
const make=()=>new OrganismRuntime({stateFile,autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile'});
const install=runtime=>{ runtime.embodiedActions.execute=async(action)=>({
  version:1,action,status:'executed',realityClass:'device-observation',source:'android-termux',at:Date.now(),
  before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  after:{battery01:.79,thermal01:.21,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  stateDelta:{battery01:-.01,thermal01:.01,cognitiveCapacity01:0,awakeChanged:false},effect01:.72,reason:'p2842-persistence',capability:'android.sensors',
  consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.64,reason:'p2842-independent-observation',verificationMode:'independent-observation'}
}); };
const first=make(); await first.init(); install(first); await first.step(); await first.step();
const before=first.core.worldCausalCalibrationSnapshot();
assert.ok(before.resolved>=2);
await first.stop();
const second=make(); await second.init();
const after=second.core.worldCausalCalibrationSnapshot();
assert.ok(after.resolved>=before.resolved);
assert.ok(after.records.some(row=>row.verified01===1 && row.independent01===1));
console.log(JSON.stringify({ok:true,beforeResolved:before.resolved,afterResolved:after.resolved,lastRecord:after.records[0]}));
await second.stop();
