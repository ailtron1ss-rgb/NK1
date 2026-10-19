import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const cfg={performanceProfile:'mobile',cycleResultMode:'full',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:16,enableLanguage:false};
const core=new OrganismCore(store,cfg); await core.init();
for(let i=1;i<=96;i++) await core.observe({
 text:i%12===0?`p19 persistence history ${i}`:undefined,
 reward:i%9===0?.64:undefined,
 surprise:i%11===0?.21:.05,
 novelty:.38+(i%5)*.04,
 embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.82,thermalStrain01:.17,sensoryFreshness01:.89,awake:true,battery01:.78,cpuLoad01:.21,ramPressure01:.2},
},'full');

const live={
 p49:core.p49Snapshot(),
 p56:core.p56Snapshot(),
 p59:core.memorySubsystem.p59MemoryOperatingSystem.snapshot(),
 p62:core.memorySubsystem.p62MemoryFabric.snapshot(),
 p63:core.organismSystems.self.p63DevelopmentalOperatingSystem.snapshot(),
 p66:core.p66InteroceptiveHomeostasis.snapshot(),
 p68:core.organismSystems.agency.p68GoalEcology.snapshot(),
};
assert.ok(live.p56.history.length>=48);
assert.ok(live.p59.history.length>=48);
assert.ok(live.p62.history.length>=8);
assert.ok(live.p63.history.length>=32);
assert.ok(live.p66.history.length>=64);
assert.ok(live.p68.history.length>=64);

await core.flush();
const persisted=await store.load();
const a=persisted.facets.advanced;
assert.ok(a.p49TemporalLife.episodes.length<=96);
assert.ok(a.p49TemporalLife.beliefs.length<=96);
assert.equal(a.p49TemporalLife.journalHash,live.p49.journalHash);
assert.ok(a.p56IntegratedDevelopmentalMind.history.length<=48);
assert.ok(a.p59MemoryOperatingSystem.history.length<=48);
assert.ok(a.p62MemoryFabric.history.length<=8);
assert.ok(a.p63DevelopmentalOperatingSystem.history.length<=32);
assert.ok(a.p66InteroceptiveHomeostasis.history.length<=64);
assert.ok(a.p68GoalEcology.history.length<=64);

const restoredStore=new MemoryStateStore({initial:persisted});
const restored=new OrganismCore(restoredStore,cfg); await restored.init();
const snap=restored.snapshot();
assert.equal(snap.state.tick,96);
assert.equal(snap.facets.advanced.p49TemporalLife.journalHash,live.p49.journalHash);
assert.equal(snap.facets.advanced.p63DevelopmentalOperatingSystem.cycles,live.p63.cycles);
assert.equal(snap.facets.advanced.p66InteroceptiveHomeostasis.cycles,live.p66.cycles);
assert.equal(snap.facets.advanced.p68GoalEcology.cycles,live.p68.cycles);
console.log(JSON.stringify({
 pass:true,
 tick:snap.state.tick,
 live:{p49Episodes:live.p49.episodes.length,p56History:live.p56.history.length,p59History:live.p59.history.length,p62History:live.p62.history.length,p63History:live.p63.history.length,p66History:live.p66.history.length,p68History:live.p68.history.length},
 persisted:{p49Episodes:a.p49TemporalLife.episodes.length,p49Beliefs:a.p49TemporalLife.beliefs.length,p56History:a.p56IntegratedDevelopmentalMind.history.length,p59History:a.p59MemoryOperatingSystem.history.length,p62History:a.p62MemoryFabric.history.length,p63History:a.p63DevelopmentalOperatingSystem.history.length,p66History:a.p66InteroceptiveHomeostasis.history.length,p68History:a.p68GoalEcology.history.length},
},null,2));
