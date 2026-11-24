import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const marker={version:1,inspections:7,compactions:4,cyclesObserved:9,tier:'pressure',pressure01:.61,lastBytesBefore:9000,lastBytesAfter:7000,bytesSavedTotal:2000,lastSaved01:.22,lastReason:'marker',lastLimits:{traces:10,eventLog:72,ownershipCheckpoints:32,p30Nodes:72,p30Edges:48,p49Episodes:12,p49SeenEventIds:96,p84Moments:10,b284Episodes:10,b285Episodes:10,recurrentEpisodes:12,shadowRecent:12,longHorizonRecent:16,emotionHistory:12,p42History:12,p58Frames:12,evolutionNetworkHistory:12,agencyRecords:12,autobiographicalMemories:24},protectedCanonicalBranches:['system.canonicalNeuralSubstrate']};
const migrated=migratePersistedOrganism({schemaVersion:127,system:{mobileStateEconomyB301:marker}});
assert.deepEqual(migrated.system.mobileStateEconomyB301,marker,'B301 migration did not preserve state');
console.log(JSON.stringify({pass:true,schema:migrated.schemaVersion,mobileStateEconomyB301:migrated.system.mobileStateEconomyB301}));
