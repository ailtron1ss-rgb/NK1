import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const raw={schemaVersion:127,system:{executiveNeuralFusionB297:{version:1,cycles:11,outcomeUpdates:4,commits:9,holds:1,sourceReliability:{self:.7},pairRedundancy:{'self|policy':.6},actionReliability:{explore:.8},lastSignals:{explore:{self:.5}},lastAction:'explore',lastAutonomy01:.7,lastDisagreement01:.1,lastCommitMargin01:.2,lastFrame:[],history:[]}}};
const migrated=migratePersistedOrganism(raw);
const fusion=migrated.system.executiveNeuralFusionB297;
assert.ok(fusion,'B309 migration dropped B297 fusion state');
assert.equal(fusion.cycles,11,'B309 migration changed legacy cycle count');
assert.equal(fusion.consolidationEvents,0,'B309 legacy state should default consolidationEvents safely');
assert.equal(fusion.sourceConsolidation01,0,'B309 legacy state should default source consolidation safely');
assert.equal(fusion.lastDeduplicatedContribution01,0,'B309 legacy state should default dedup metric safely');
console.log(JSON.stringify({pass:true,schema:migrated.schemaVersion,cycles:fusion.cycles,consolidationEvents:fusion.consolidationEvents,sourceConsolidation01:fusion.sourceConsolidation01},null,2));
process.exit(0);
