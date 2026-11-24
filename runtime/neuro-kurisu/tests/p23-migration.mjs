import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const legacy = { schemaVersion:25, state:{ version:25, tick:7, needs:{energy:.8,cognitiveLoad:.2,uncertainty:.3,socialNeed:.2,novelty:.4,identityCoherence:.9,goalPressure:.2} }, goals:[], traces:[], memories:[], worldModel:{belief:null,transitions:[]}, facets:{ learning:{ adaptivePolicy:{version:1,values:{},updates:0,rewardedUpdates:0,penalizedUpdates:0,explorationRate01:.18,lastContextKey:'',lastAction:'none',lastUpdateAt:0} } } };
const migrated=migratePersistedOrganism(legacy);
assert.equal(migrated.schemaVersion,ORGANISM_STATE_SCHEMA);
assert.equal(migrated.state.version,ORGANISM_STATE_SCHEMA);
assert.ok(migrated.facets.learning.p23);
assert.equal(migrated.facets.learning.p23.version,1);
assert.deepEqual(migrated.facets.learning.p23.experiences,[]);
console.log('P23_MIGRATION=PASS schema=current');
