import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const dir = await mkdtemp(join(tmpdir(),'neuro-p61-p63-'));
const file = join(dir,'state.json');
const store = new FileStateStore(file);
const core = new OrganismCore(store, { checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1 });
await core.init();
for (let i=0;i<8;i++) {
  await core.observe({
    text: i%2===0 ? `Наблюдение ${i}: проверить гипотезу о последствиях действия` : undefined,
    novelty: i%3===0 ? .86 : .34,
    embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.84,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.81,cpuLoad01:.22,ramPressure01:.24},
  });
  await core.feedback({success:i%2?.74:.58,reward:i%2?.44:.16,surprise:i%2?.12:.26,notes:`external outcome ${i}`});
}
const before = { p56: core.p56Snapshot(), p57: core.p57Snapshot(), p61: core.p61Snapshot(), p62: core.p62Summary(), p63: core.p63Summary(), p66: core.p66Summary(), p67: core.p67Summary(), p68: core.p68Summary() };
assert.ok(before.p56.assessments>0, 'P56 must be exercised by live runtime');
assert.ok(before.p61.cycles>0, 'P61 must be exercised by live runtime');
assert.ok(before.p62.queries>0, 'P62 must be exercised by live runtime');
assert.ok(before.p63.cycles>0, 'P63 must be exercised by live runtime');
await core.flush();
const raw = JSON.parse(await readFile(file,'utf8'));
assert.equal(raw.schemaVersion, RELEASE_CONTRACT.stateSchema);
assert.ok(raw.facets.advanced.p61IntegratedMind.cycles>0);
assert.ok(raw.facets.advanced.p62MemoryFabric.queries>0);
assert.ok(raw.facets.advanced.p63DevelopmentalOperatingSystem.cycles>0);
assert.ok(raw.facets.advanced.p66InteroceptiveHomeostasis.cycles>0);
assert.ok(raw.facets.advanced.p67AutonomousGoalGenesis.cycles>0);
assert.ok(raw.facets.advanced.p68GoalEcology.cycles>0);
const core2 = new OrganismCore(new FileStateStore(file), { checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1 });
await core2.init();
const after = { p56: core2.p56Snapshot(), p57: core2.p57Snapshot(), p61: core2.p61Snapshot(), p62: core2.p62Summary(), p63: core2.p63Summary(), p66: core2.p66Summary(), p67: core2.p67Summary(), p68: core2.p68Summary() };
assert.ok(after.p56.assessments>=before.p56.assessments);
assert.ok(after.p61.cycles>=before.p61.cycles);
assert.ok(after.p62.queries>=before.p62.queries);
assert.ok(after.p63.cycles>=before.p63.cycles); assert.ok(after.p66.cycles>=before.p66.cycles); assert.ok(after.p67.cycles>=before.p67.cycles); assert.ok(after.p68.cycles>=before.p68.cycles);
assert.ok(after.p57.anchorsAccepted>=before.p57.anchorsAccepted);
await rm(dir,{recursive:true,force:true});
console.log('P61_P62_P63_RUNTIME_PERSISTENCE=PASS');
