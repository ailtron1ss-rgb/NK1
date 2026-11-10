import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2841-'));
const stateFile=path.join(dir,'state.json');
const runtime=new OrganismRuntime({stateFile,autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile'});
await runtime.init();

runtime.embodiedActions.execute=async(_action,input={})=>createTrustedEmbodiedActionFixture('explore',{decisionId:input.decisionId});

const result=await runtime.step();
const world=runtime.core.groundedWorldSnapshot();
const reality=runtime.realityGroundingSnapshot();
assert.ok(result.embodiedAction);
assert.equal(result.embodiedAction.source,'android-termux');
assert.ok(world.facts.some(x=>x.startsWith('external-observed:')));
assert.ok(world.events.some(x=>x.label.startsWith('external-observed:')));
assert.ok(reality.last);
assert.equal(reality.last?.source,'external');
assert.equal(reality.last?.proofClass,'independent-observation');
assert.equal(reality.last?.verified01,1);
assert.equal(reality.last?.independent01,1);
assert.ok((reality.last?.evidence01 ?? 0) > .5);
console.log(JSON.stringify({ok:true,tick:result.cycle.state.tick,worldRevision:world.revision,lastGroundedHash:world.lastHash,externalFact:world.facts.slice(-2),grounding:{source:reality.last?.source,verified01:reality.last?.verified01,evidence01:reality.last?.evidence01}}));
await runtime.stop?.();
