import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const mobile=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'}); await mobile.init();
assert.equal(mobile.config.performanceProfile,'mobile'); assert.equal(mobile.config.checkpointMaxDirtyCycles,12);
await mobile.observe({text:'mobile'}); assert.equal(mobile.persistenceProjectionSnapshot().lastProjectionWasFull,false); await mobile.flush(); assert.equal(mobile.persistenceProjectionSnapshot().lastProjectionWasFull,true);
const quality=new OrganismCore(new MemoryStateStore(),{performanceProfile:'quality'}); await quality.init(); assert.equal(quality.config.checkpointMaxDirtyCycles,3);
console.log('MOBILE_PERFORMANCE_PROFILE=PASS');
process.exit(0);
