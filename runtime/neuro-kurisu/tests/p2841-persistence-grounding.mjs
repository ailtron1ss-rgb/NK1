import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2841-persist-'));
const stateFile=path.join(dir,'state.json');

const makeRuntime=()=>new OrganismRuntime({
  stateFile,
  autoRun:false,
  enableLanguage:false,
  realityMode:'external-first',
  performanceProfile:'mobile'
});

const runtime=makeRuntime();
await runtime.init();
runtime.embodiedActions.execute=async(action)=>({
  version:1,action,status:'executed',realityClass:'device-observation',source:'android-termux',at:Date.now(),
  before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  after:{battery01:.79,thermal01:.21,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  stateDelta:{battery01:-.01,thermal01:.01,cognitiveCapacity01:0,awakeChanged:false},
  effect01:.72,reason:'p2841-persistence-observation',capability:'android.sensors',
  consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.64,reason:'p2841-independent-observation',verificationMode:'independent-observation'}
});
await runtime.step();
const before=runtime.core.groundedWorldSnapshot();
assert.ok(before.facts.some(x=>x.startsWith('external-observed:')));
assert.ok(before.events.some(x=>x.label.startsWith('external:')));
await runtime.stop();

const restored=makeRuntime();
await restored.init();
const after=restored.core.groundedWorldSnapshot();
assert.ok(after.facts.some(x=>x.startsWith('external-observed:')));
assert.ok(after.events.some(x=>x.label.startsWith('external:')));
assert.ok(after.revision>=before.revision);
assert.ok(after.lastHash);
console.log(JSON.stringify({ok:true,beforeRevision:before.revision,afterRevision:after.revision,afterHash:after.lastHash,externalFacts:after.facts.filter(x=>x.startsWith('external-observed:')).slice(-2)}));
await restored.stop();
