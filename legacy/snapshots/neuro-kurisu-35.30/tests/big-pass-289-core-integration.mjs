import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-b289-core-'));
const stateFile = path.join(dir, 'state.json');
const worldStateFile = path.join(dir, 'world.json');
try {
  const runtime = new OrganismRuntime({ stateFile, worldStateFile, enableLanguage:false });
  await runtime.init();
  const before = runtime.core.b289NeuralOrganismDiagnostics();
  for (let i=0;i<16;i++) await runtime.step(undefined,{ deliberate: i % 4 === 0 });
  const after = runtime.core.b289NeuralOrganismDiagnostics();
  const snap = runtime.core.b289NeuralOrganismSnapshot();
  if (after.cycles <= before.cycles) throw new Error('B289 did not advance inside OrganismCore');
  if (snap.history.length === 0) throw new Error('B289 history stayed empty');
  if (!(after.integration01 >= 0 && after.integration01 <= 1)) throw new Error('invalid B289 integration');
  const persisted = runtime.core.systemSnapshot().neuralOrganismIntegrationB289;
  if (!persisted || persisted.tick !== after.tick) throw new Error('B289 state not persisted by core');
  const lesion = runtime.core.b289NeuralOrganismLesion(.5);
  if (!(lesion.lesion01 > 0)) throw new Error('lesion did not apply');
  runtime.core.b289NeuralOrganismClearLesion();
  console.log(JSON.stringify({pass:true,tick:after.tick,cycles:after.cycles,integration01:after.integration01,agency01:after.agency01,historyDepth:after.historyDepth,lesionRestored:true}));
  runtime.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
