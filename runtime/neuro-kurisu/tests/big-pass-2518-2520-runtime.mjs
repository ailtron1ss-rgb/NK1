import assert from 'node:assert/strict';
import {OrganismCore} from '../src/organism/core/OrganismCore.ts';
import {MemoryStateStore} from '../src/organism/persistence/MemoryStateStore.ts';
const cfg={performanceProfile:'mobile',enableLanguage:false,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64};
const core=new OrganismCore(new MemoryStateStore(),cfg); await core.init();
for(let i=0;i<3;i++) await core.autonomousHeartbeat();
const a=core.b2518PersistentSelfWorldDiagnostics(); const b=core.b2519LongHorizonPlannerDiagnostics(); const c=core.b2520SensorimotorImaginationDiagnostics();
assert.ok(a.cycles>0&&b.cycles>0&&c.cycles>0); assert.ok(b.rollouts>0&&c.imaginations>0);
console.log('B2518_2520_RUNTIME_PASS',JSON.stringify({b2518Cycles:a.cycles,b2518Learning:a.learningUpdates,b2519Cycles:b.cycles,b2519Rollouts:b.rollouts,b2520Cycles:c.cycles,b2520Imaginations:c.imaginations}));
