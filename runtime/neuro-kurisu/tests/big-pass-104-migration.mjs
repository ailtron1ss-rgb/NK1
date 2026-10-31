import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const raw={
  schemaVersion:112,
  state:{tick:0},goals:[],traces:[],memories:[],
  facets:{
    advanced:{
      experienceContinuum:{
        version:4,
        graphNodes:[{memoryId:'m-old',lastReplayedAt:0,stability01:.4,replayPriority01:.5,activeGoalIds:[]}],
        graphEdges:[],clusters:[],
        replay:{events:[],validations:[{id:'old',memoryId:'m-old',at:10,retentionScore01:.7,transferPotential01:0,interferenceRisk01:0,independentVerified:true,evidenceKey:'old'}],experiments:[]}
      }
    }
  }
};
const migrated=migratePersistedOrganism(raw);
const ec=migrated.facets.advanced.experienceContinuum;
assert.equal(ec.version,7);
assert.ok(ec.retention);
assert.ok(Array.isArray(ec.memorySkillBindings));
assert.equal(ec.graphNodes[0].memoryId,'m-old');
assert.equal(fs.existsSync('VERSION.json'),true);
console.log('BIG_PASS_104_MIGRATION=PASS',JSON.stringify({version:ec.version,stateSchema:migrated.schemaVersion,retentionValidated:ec.retention.validated,memorySkillBindings:ec.memorySkillBindings.length}));
