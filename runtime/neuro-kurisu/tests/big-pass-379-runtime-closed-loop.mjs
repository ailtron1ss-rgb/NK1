import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-b379-'));
const stateFile=path.join(dir,'organism.json');
const worldStateFile=path.join(dir,'world.json');
const config={stateFile,worldStateFile,intervalMs:5000,enableLanguage:false,autoRun:false,checkpointMinIntervalMs:1,checkpointMaxDirtyCycles:1};
const runtime=new OrganismRuntime(config);
await runtime.init();
let count=0;
runtime.embodiedActions.execute=async(action)=>{
  count++;
  const failed=count%4===0;
  return {
    version:1, action, status:failed?'failed':'executed',
    realityClass:failed?'derived':'device-observation', source:'android-termux', at:Date.now(),
    before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.8,awake:true,source:'android-termux'},
    after:{battery01:.8,thermal01:.2,cognitiveCapacity01:.8,awake:true,source:'android-termux'},
    stateDelta:{battery01:0,thermal01:0,cognitiveCapacity01:0,awakeChanged:false},
    effect01:failed?0:.4,
    reason:failed?'synthetic-failure':'synthetic-verified-observation', capability:'synthetic',
    consequenceVerification:{
      attempted:true, independent:!failed, verified:!failed, sourceStable:true,
      freshBefore01:1, freshAfter01:failed?0:1, changed01:failed?0:.4,
      reason:failed?'synthetic-failure':'synthetic-independent-proof',
      verificationMode:failed?'none':'independent-observation'
    }
  };
};
for(let i=0;i<16;i++) await runtime.step(undefined,{deliberate:false});
const before=runtime.embodiedRecoverySnapshot();
assert.equal(before.totalEpisodes,16);
assert.ok(before.recoveryEvents>0);
assert.ok(before.verifiedEpisodes>0);
await runtime.core.checkpoint(true);
const persisted=JSON.parse(await fs.readFile(stateFile,'utf8'));
assert.ok(persisted.facets.embodiment.embodiedRecovery);
assert.equal(persisted.facets.embodiment.embodiedRecovery.totalEpisodes,16);
const restarted=new OrganismRuntime(config);
await restarted.init();
assert.deepEqual(restarted.embodiedRecoverySnapshot(),before);
console.log(JSON.stringify({pass:true,status:'B379_RUNTIME_CLOSED_LOOP_PASS',episodes:before.totalEpisodes,verified:before.verifiedEpisodes,recoveryEvents:before.recoveryEvents,mode:before.mode,globalReliability01:before.globalReliability01,restartEqual:true},null,2));
await fs.rm(dir,{recursive:true,force:true});
