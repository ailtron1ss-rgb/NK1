import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { defaultB265IndependentPolicyEvaluator } from '../src/organism/cognition/B265IndependentPolicyEvaluator.ts';
const raw={schemaVersion:ORGANISM_STATE_SCHEMA,system:{independentPolicyEvaluatorB265:{...defaultB265IndependentPolicyEvaluator(),evaluations:7,steps:56,lastTaskId:'migration-b265'}}};
const migrated=migratePersistedOrganism(raw);
assert.equal(migrated.system.independentPolicyEvaluatorB265.evaluations,7);
assert.equal(migrated.system.independentPolicyEvaluatorB265.steps,56);
assert.equal(migrated.system.independentPolicyEvaluatorB265.lastTaskId,'migration-b265');
console.log(JSON.stringify({pass:true,schema:ORGANISM_STATE_SCHEMA,restored:migrated.system.independentPolicyEvaluatorB265},null,2));
