import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

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
runtime.embodiedActions.execute=async(_action,input={})=>createTrustedEmbodiedActionFixture('explore',{decisionId:input.decisionId});
await runtime.step();
const before=runtime.core.groundedWorldSnapshot();
assert.equal(before.facts.some(x=>x.startsWith('external-observed:')),false,'telemetry-only execution must not create external world facts');
assert.equal(before.events.some(x=>x.label.startsWith('external-observed:')),false,'telemetry-only execution must not create verified observation events');
await runtime.stop();

const restored=makeRuntime();
await restored.init();
const after=restored.core.groundedWorldSnapshot();
assert.equal(after.facts.some(x=>x.startsWith('external-observed:')),false,'restore must not invent external world facts');
assert.equal(after.events.some(x=>x.label.startsWith('external-observed:')),false,'restore must preserve the absence of verified world observations');
assert.ok(after.revision>=before.revision);
assert.ok(after.lastHash);
console.log(JSON.stringify({ok:true,beforeRevision:before.revision,afterRevision:after.revision,afterHash:after.lastHash,externalFacts:after.facts.filter(x=>x.startsWith('external-observed:')).slice(-2),telemetryOnly:true}));
await restored.stop();
