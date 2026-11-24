import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const raw={system:{release:'35.6.1',organismCore:'test',schemaVersion:ORGANISM_STATE_SCHEMA,lastStateHash:'',replaySignature:'',lastReplayAt:0,capabilities:{},integrity:{},evolution:{},neuralGerminalOrganismB270:{version:1,tick:91,cycles:91,learningUpdates:33,autonomousSelections:91,successfulSelections:14,traitValues:{curiosity:.72,caution:.61},needs:{autonomy01:.68,coherence01:.75},selfLatent:Array(16).fill(.1),neuralEmbryos:[],history:[]}}};
const out=migratePersistedOrganism(raw);
assert.equal(out.system.neuralGerminalOrganismB270.tick,91);
assert.equal(out.system.neuralGerminalOrganismB270.learningUpdates,33);
assert.equal(out.system.neuralGerminalOrganismB270.traitValues.curiosity,.72);
console.log(JSON.stringify({pass:true,preserved:out.system.neuralGerminalOrganismB270},null,2));
