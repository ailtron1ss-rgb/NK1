import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-b380-'));
const config={stateFile:path.join(dir,'organism.json'),worldStateFile:path.join(dir,'world.json'),intervalMs:5000,enableLanguage:false,autoRun:false,checkpointMinIntervalMs:1,checkpointMaxDirtyCycles:1};
const runtime=new OrganismRuntime(config); await runtime.init();
let calls=0;
runtime.embodiedActions.execute=async(action)=>{
  calls++;
  const ok=calls%5!==0;
  return {version:1,action,status:ok?'executed':'failed',realityClass:ok?'device-observation':'derived',source:'android-termux',at:Date.now(),before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.8,awake:true,source:'android-termux'},after:{battery01:.8,thermal01:.2,cognitiveCapacity01:.8,awake:true,source:'android-termux'},stateDelta:{battery01:0,thermal01:0,cognitiveCapacity01:0,awakeChanged:false},effect01:ok?.45:0,reason:ok?'synthetic-ok':'synthetic-failure',capability:'synthetic',consequenceVerification:{attempted:true,independent:ok,verified:ok,sourceStable:true,freshBefore01:1,freshAfter01:ok?1:0,changed01:ok?.45:0,reason:ok?'independent':'failed',verificationMode:ok?'independent-observation':'none'}};
};
for(let i=0;i<12;i++) await runtime.step(undefined,{deliberate:false});
const temporal=runtime.core.b380TemporalLifeSnapshot();
assert.equal(temporal.metrics.completed,12);
assert.ok(temporal.metrics.completed>0);
assert.ok(temporal.metrics.recoveryEvents>0);
assert.ok(temporal.metrics.influence01>0);
await runtime.core.checkpoint(true);
const restarted=new OrganismRuntime(config); await restarted.init();
assert.deepEqual(restarted.core.b380TemporalLifeSnapshot(),temporal);
console.log(JSON.stringify({pass:true,status:'B380_RUNTIME_TEMPORAL_LIFE_PASS',cycles:temporal.metrics.completed,recoveryEvents:temporal.metrics.recoveryEvents,influence01:temporal.metrics.influence01,tokens:temporal.tokens.length,restartEqual:true},null,2));
await fs.rm(dir,{recursive:true,force:true});
