import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

class MemoryStore {
  value = null;
  async load(){ return this.value ? structuredClone(this.value) : null; }
  async save(value){ this.value = structuredClone(value); }
  metrics(){ return null; }
}
class Journal { async write(){ return undefined; } }

const dir=await mkdtemp(path.join(tmpdir(),'nk-p22-chat-'));
try {
  const calls=[];
  const invoker=async request=>{ calls.push(request); const isProposal=request.system.includes('Cognitive Proposal'); return { backend:'test-llm', text:isProposal?JSON.stringify({summary:'deliberation',hypotheses:[],uncertainty:.4,suggestedAction:'reflect',evidenceNeeded:[]}):'final answer' }; };
  const runtime=new OrganismRuntime({
    stateFile:path.join(dir,'organism.json'), worldStateFile:path.join(dir,'world.json'), autoRun:false, enableLanguage:true,
    languageInvoker:invoker, stateStore:new MemoryStore(), worldStateStore:new MemoryStore(), journal:new Journal(),
    phonePolicy:{ mode:'eco', baseIntervalMs:30000, samplerIntervalMs:60000, checkpointMinIntervalMs:60000, checkpointMaxDirtyCycles:3, worldCheckpointMinIntervalMs:300000, worldCheckpointMaxDirtyCycles:10, maxConsecutiveActiveCycles:1 },
  });
  await runtime.init();
  calls.length=0;
  const normal=await runtime.step('hello', {deliberate:false});
  assert.equal(normal.cycle.cognitiveProposal, null);
  assert.equal(calls.length,1);
  calls.length=0;
  const deliberate=await runtime.step('please deliberate', {deliberate:true});
  assert.ok(deliberate.cycle.cognitiveProposal);
  assert.equal(calls.length,2);
  await runtime.flush();
  await runtime.stop();
  console.log('P22_CHAT_ROUTING=PASS normalCalls=1 deliberateCalls=2');
} finally { await rm(dir,{recursive:true,force:true}); }
