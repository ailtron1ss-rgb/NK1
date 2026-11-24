import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const dir = await mkdtemp(path.join(os.tmpdir(),'nk-p7-'));
const runtime = new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json')});
try {
  await runtime.init();
  for(let i=0;i<24;i++) await runtime.step(i%3===0?`Проверь гипотезу ${i}`:undefined);
  const s=runtime.core.snapshot();
  if(s.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('schema');
  if(!s.facets.evolution.network.lastBroadcast) throw new Error('network-broadcast-missing');
  if(s.facets.learning.neuromodulation.updateRate01<=0) throw new Error('neuromodulation-missing');
  if(s.facets.memory.semanticGraph.nodes.length===0) throw new Error('semantic-memory-empty');
  if(s.facets.evolution.network.totalIgnitions<0) throw new Error('network-counter-invalid');
  console.log(`P7_ORGANISM=PASS tick=${s.state.tick} nodes=${s.facets.memory.semanticGraph.nodes.length} edges=${s.facets.memory.semanticGraph.edges.length} ignitions=${s.facets.evolution.network.totalIgnitions}`);
} finally { runtime.stop(); await rm(dir,{recursive:true,force:true}); }
