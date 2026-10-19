import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const state={schemaVersion:127,system:{semanticHoldoutB304:{version:1,ticks:128,trainingPulses:80,holdoutPulses:48,trainingFamilies:['a','b','c'],holdoutFamilies:['x','y','z'],novelHoldoutFamilyRate01:1,trainingActionDistribution:{verify:.4},holdoutActionDistribution:{respond:.5},trainingBias:{verify:.2},holdoutBias:{respond:-.1}}}};
const migrated=migratePersistedOrganism(state);
assert.equal(migrated.system.semanticHoldoutB304.holdoutPulses,48,'B304 migration lost holdout');
assert.equal(migrated.system.semanticHoldoutB304.novelHoldoutFamilyRate01,1,'B304 migration lost novelty');
assert.deepEqual(migrated.system.semanticHoldoutB304.holdoutFamilies,['x','y','z'],'B304 migration altered family set');
console.log(JSON.stringify({pass:true,schema:migrated.schemaVersion,holdoutPulses:migrated.system.semanticHoldoutB304.holdoutPulses,novelRate:migrated.system.semanticHoldoutB304.novelHoldoutFamilyRate01},null,2));
process.exit(0);
