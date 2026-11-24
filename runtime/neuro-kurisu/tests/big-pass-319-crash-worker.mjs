import assert from 'node:assert/strict';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const [,,stateFile,point] = process.argv;
assert.ok(stateFile && point);
const store=new FileStateStore(stateFile,{backupEverySaves:1,directoryFsyncEverySaves:1});
const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:2,checkpointMaxDirtyCycles:1,checkpointMinIntervalMs:0});
await core.init();
// Explicit checkpoint reaches the injected save point. NEURO_CRASH_INJECT controls which point kills this worker.
await core.flush();
