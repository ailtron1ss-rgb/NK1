import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p17-'));
const rt=new OrganismRuntime({stateFile:path.join(dir,'organism.json'),worldStateFile:path.join(dir,'world.json'),autoRun:false,enableLanguage:true,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),languageInvoker:async()=>({text:JSON.stringify({summary:'evidence is incomplete',hypotheses:['verify before commitment'],uncertainty:.42,suggestedAction:'verify',evidenceNeeded:['sensor confirmation']}),backend:'test-llm',latencyMs:1})});
await rt.init();
const step=await rt.step('Проверь изменение среды и объясни, что изменилось.');
assert.ok(step.cycle.multimodal?.events>=3,'multimodal events');
assert.equal(step.cycle.cognitiveProposal?.suggestedAction,'verify');
const tools=rt.toolSnapshot(); assert.ok(tools.some(x=>x.id==='organism.inspect'));
const tool=await rt.executeTool('organism.inspect',{},'p17-test'); assert.equal(tool.ok,true); assert.equal(tool.verified,true);
const snap=rt.core.snapshot(); assert.ok(snap.facets.embodiment.toolAudit.length>=1);
console.log(`P17_EMBODIED_MULTIMODAL_AGENT=PASS modalities=${Object.values(step.cycle.multimodal.modalities).reduce((a,b)=>a+b,0)} proposal=${step.cycle.cognitiveProposal?.source} tools=${tools.length}`); rt.stop();
