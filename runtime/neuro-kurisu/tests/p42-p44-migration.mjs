import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
const raw={schemaVersion:45,state:{version:45,tick:0},facets:{embodiment:{},learning:{}}};
const out=migratePersistedOrganism(raw);
assert.equal(ORGANISM_STATE_SCHEMA,RELEASE_CONTRACT.stateSchema); assert.equal(out.schemaVersion,RELEASE_CONTRACT.stateSchema); assert.equal(out.facets.embodiment.p42Experience.version,1); assert.equal(out.facets.embodiment.p43Imagery.version,1); assert.equal(out.facets.learning.p44PredictiveWorld.version,1); assert.equal(out.facets.advanced.p49TemporalLife.version,1); assert.equal(out.facets.advanced.p50CausalSelfWorld.version,1); assert.equal(out.facets.advanced.p51GroundedCausalWorkspace.version,1); assert.equal(out.facets.advanced.p52CounterfactualDevelopment.version,1); assert.equal(out.facets.advanced.p61IntegratedMind.version,1); assert.equal(out.facets.advanced.p62MemoryFabric.version,1); assert.equal(out.facets.advanced.p63DevelopmentalOperatingSystem.version,2);
assert.equal(out.facets.advanced.p66InteroceptiveHomeostasis.version,1); assert.equal(out.facets.advanced.p67AutonomousGoalGenesis.version,1); assert.equal(out.facets.advanced.p68GoalEcology.version,1);
console.log('P42_P44_MIGRATION=PASS schema='+out.schemaVersion);
