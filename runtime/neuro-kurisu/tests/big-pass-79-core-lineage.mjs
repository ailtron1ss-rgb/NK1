import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p79-'));
try {
  const core=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await core.init();
  await core.observe({text:'Мне важно понять, что произошло.',worldContext:{tick:1,location:'lab',energy:.8,attention:.7,uncertainty:.25,facts:['lamp=on'],objects:[{label:'lamp'}],events:['inspection']},vision:{sceneLabel:'lab',objects:[{label:'lamp'}],confidence01:.81}});
  const p84=core.autobiographicalContinuityRecent(4)[0];
  const graph=core.identityCausalitySnapshot();
  const summary=core.identityCausalitySummary();
  assert.ok(graph.version===2); assert.ok(graph.nodes.some(n=>n.kind==='observation')); assert.ok(graph.nodes.some(n=>n.kind==='identity')); assert.ok(graph.edges.some(e=>e.relation==='about'));
  assert.ok(p84 && Array.isArray(p84.evidenceIds) && p84.beliefIds && p84.personIds);
  assert.ok(summary.edges>=3);
  await core.flush();
  const restored=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await restored.init();
  const rg=restored.identityCausalitySnapshot();
  assert.equal(rg.version,2); assert.ok(rg.edges.length>=summary.edges);
  assert.equal(restored.autobiographicalContinuitySnapshot().version,5);
  console.log(`BIG_PASS_79_CORE_LINEAGE=PASS graphNodes=${rg.nodes.length} graphEdges=${rg.edges.length} p84Version=${restored.autobiographicalContinuitySnapshot().version}`);
} finally { await rm(dir,{recursive:true,force:true}); }
