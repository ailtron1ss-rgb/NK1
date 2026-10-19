import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';

const kernel = new SocialMindKernel();
const p1 = kernel.observePerson({id:'vision-person-a',displayName:'person-a',at:1000,confidence01:.84,visible01:.9,source:'vision',position:{x:.2,y:.2,z:1}});
const p2 = kernel.observePerson({id:'vision-person-b',displayName:'person-b',at:2000,confidence01:.82,visible01:.86,source:'vision',position:{x:.205,y:.205,z:1}});
assert.equal(p1.id, p2.id, 'nearby re-identification should preserve person continuity');
const intent = kernel.observeText(p1.id, 'Почему это так? Объясни, пожалуйста.', 3000);
assert.equal(intent.kind, 'information');
assert.ok(intent.confidence01 > .4);
kernel.observeRelation(p1.id, 'near', 'terminal', .8, 3100, 'vision');
const error = kernel.recordOutcome(p1.id, {actualIntent:'information',outcome01:.9,surprise01:.1,at:4000});
assert.ok(error < .5);
const diagnostics = kernel.diagnostics();
assert.equal(diagnostics.personCount, 1);
assert.ok(diagnostics.evidenceCount >= 3);
assert.ok(diagnostics.episodeCount >= 1);

const dir = await mkdtemp(path.join(os.tmpdir(), 'neuro-pass94-'));
const stateFile = path.join(dir, 'organism.json');
try {
  const core = new OrganismCore(new FileStateStore(stateFile), {enableLanguage:false, checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1});
  await core.init();
  await core.observe({
    text:'Почему терминал не работает?',
    vision:{features:[.7,.2,.1],width:8,height:8,rawRgb:Array.from({length:64*3},(_,i)=>i%3===0?220:40),sceneLabel:'laboratory',confidence01:.9,objects:[{label:'researcher',kind:'person',confidence01:.93,x:.2,y:.2,z:1},{label:'terminal',kind:'object',confidence01:.9,x:.5,y:.4,z:1}],relations:[{from:'researcher',relation:'near',to:'terminal',confidence01:.81}]},
    embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.9,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.82,cpuLoad01:.2,ramPressure01:.2}
  });
  const snap = core.snapshot();
  assert.ok(snap.facets.advanced.socialMind);
  assert.ok(snap.facets.advanced.socialMind.persons.length >= 1);
  assert.ok(snap.facets.advanced.socialMind.evidence.length >= 1);
  await core.flush();
  const persisted = JSON.parse(await readFile(stateFile,'utf8'));
  assert.ok(persisted.facets.advanced.socialMind);
  const restored = new OrganismCore(new FileStateStore(stateFile), {enableLanguage:false, checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1});
  await restored.init();
  const rs = restored.snapshot();
  assert.equal(rs.facets.advanced.socialMind.persons.length, snap.facets.advanced.socialMind.persons.length);
  assert.equal(restored.socialMindBeliefHash('user'), core.socialMindBeliefHash('user'));
} finally {
  await rm(dir,{recursive:true,force:true});
}
console.log(`BIG_PASS_94=PASS persons=${diagnostics.personCount} evidence=${diagnostics.evidenceCount} episodes=${diagnostics.episodeCount}`);
