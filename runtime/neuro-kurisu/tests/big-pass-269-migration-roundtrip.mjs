import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const raw={system:{release:'35.6.1',organismCore:'test',schemaVersion:ORGANISM_STATE_SCHEMA,lastStateHash:'',replaySignature:'',lastReplayAt:0,capabilities:{},integrity:{},evolution:{},spikingPlasticNeuralB269:{version:1,neuronCount:48,cycles:33,learningUpdates:11,spikes:21,synapticUpdates:14,structuralUpdates:2,history:[{tick:33,action:'reflect',spikes:4,prediction01:.51,reward01:.8,modulation01:.67}]}}};
const out=migratePersistedOrganism(raw);
assert.equal(out.system.spikingPlasticNeuralB269.cycles,33);
assert.equal(out.system.spikingPlasticNeuralB269.history.length,1);
console.log(JSON.stringify({pass:true,schema:out.system.schemaVersion,preserved:out.system.spikingPlasticNeuralB269},null,2));
