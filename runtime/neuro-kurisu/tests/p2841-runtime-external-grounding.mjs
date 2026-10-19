import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2841-'));
const stateFile=path.join(dir,'state.json');
const runtime=new OrganismRuntime({stateFile,autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile'});
await runtime.init();

runtime.embodiedActions.execute=async(action)=>({
  version:1,action,status:'executed',realityClass:'device-observation',source:'android-termux',at:Date.now(),
  before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  after:{battery01:.79,thermal01:.21,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  stateDelta:{battery01:-.01,thermal01:.01,cognitiveCapacity01:0,awakeChanged:false},
  effect01:.72,reason:'test-external-observation',capability:'android.sensors',
  consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.64,reason:'test-independent-observation',verificationMode:'independent-observation'}
});

const result=await runtime.step();
const world=runtime.core.groundedWorldSnapshot();
const reality=runtime.realityGroundingSnapshot();
assert.ok(result.embodiedAction);
assert.equal(result.embodiedAction.source,'android-termux');
assert.ok(world.facts.some(x=>x.startsWith('external-observed:')));
assert.ok(world.events.some(x=>x.label.startsWith('external:')));
assert.ok(reality.last);
assert.equal(reality.last?.source,'external');
assert.ok((reality.last?.evidence01 ?? 0) > .5);
console.log(JSON.stringify({ok:true,tick:result.cycle.state.tick,worldRevision:world.revision,lastGroundedHash:world.lastHash,externalFact:world.facts.slice(-2),grounding:{source:reality.last?.source,verified01:reality.last?.verified01,evidence01:reality.last?.evidence01}}));
await runtime.stop?.();
