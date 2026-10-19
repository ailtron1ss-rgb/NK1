import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
const input={schemaVersion:41, state:{version:41,tick:4,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.3,socialNeed:.2,novelty:.3,identityCoherence:.9,goalPressure:.1}},facets:{learning:{p38:{cycles:2},p39:{lifeTicks:4,host:{current:'poco',history:['poco'],transfers:0}}}}};
const out=migratePersistedOrganism(input); assert.equal(out.schemaVersion,ORGANISM_STATE_SCHEMA); assert.equal(out.facets.learning.p39.lifeTicks,4); assert.equal(out.facets.learning.p39.host.current,'poco'); console.log(`P39_MIGRATION=PASS schema=${out.schemaVersion}`);
