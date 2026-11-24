import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { PersistenceDurabilityGovernor } from '../src/organism/persistence/PersistenceDurabilityGovernor.ts';

const dir=await mkdtemp(path.join(tmpdir(),'neuro-kurisu-b320-'));
try {
  const file=path.join(dir,'organism.json');
  const store=new FileStateStore(file,{backupEverySaves:4,directoryFsyncEverySaves:4});
  const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:4,enableTemporalResolutionGovernor:false,operationalPulseEvery:1});
  await core.init();

  // Seed enough state for a meaningful serialization measurement.
  for(let i=0;i<8;i++) await core.observe({text:`b320 durability measurement ${i} causal learning phone persistence`});
  await core.flush();
  const metrics=core.persistenceMetrics();
  assert.ok(metrics?.lastPayloadBytes>0,'B320 payload measurement missing');
  assert.ok(metrics?.lastSaveMs>=0,'B320 save latency missing');

  const normal=core.persistenceDurabilitySnapshot();
  assert.ok(normal.effectiveMaxDirtyCycles>=4,'B320 failed to keep mobile dirty window bounded');

  const gov=new PersistenceDurabilityGovernor();
  const slow=gov.decide({profile:'mobile',baseMaxDirtyCycles:4,battery01:.82,thermal01:.18,ramPressure01:.15,payloadBytes:3*1024*1024,saveMs:420});
  assert.ok(slow>4,'B320 large/slow state did not widen checkpoint window');
  const battery=gov.decide({profile:'mobile',baseMaxDirtyCycles:4,battery01:.10,thermal01:.35,ramPressure01:.25,payloadBytes:3*1024*1024,saveMs:420});
  assert.ok(battery<=4,'B320 low-battery policy did not tighten checkpoint window');
  const pressure=gov.decide({profile:'mobile',baseMaxDirtyCycles:4,battery01:.82,thermal01:.90,ramPressure01:.90,payloadBytes:3*1024*1024,saveMs:420});
  assert.ok(pressure>=4,'B320 pressure policy became less durable than base');


  // End-to-end checkpoint-window proof: after a large/slow mobile save the
  // controller widens the dirty window, so intermediate cycles stay hot and the
  // bounded full checkpoint closes the window deterministically.
  const durableBeforeWindow = JSON.parse(await readFile(file,'utf8'));
  const startTick = core.snapshot().state.tick;
  const window = Math.max(1, normal.effectiveMaxDirtyCycles);
  const embodiment={bodyEnergy01:.82,thermalStrain01:.18,cognitiveCapacity01:.84,ramPressure01:.18,battery01:.82,cpuLoad01:.20,sensoryFreshness01:.9,awake:true};
  for(let i=0;i<window;i++) await core.observe({embodiment});
  const hotDisk = JSON.parse(await readFile(file,'utf8'));
  assert.equal(hotDisk.state.tick,durableBeforeWindow.state.tick,'B320 adaptive window flushed before its bounded threshold');
  assert.equal(core.snapshot().state.tick,startTick+window,'B320 integration cycle count mismatch before threshold');
  await core.observe({embodiment});
  const closedDisk = JSON.parse(await readFile(file,'utf8'));
  assert.equal(closedDisk.state.tick,core.snapshot().state.tick,'B320 adaptive window failed to close at bounded threshold');
  assert.ok(closedDisk.state.tick-durableBeforeWindow.state.tick<=window+1,'B320 durability window exceeded bounded threshold');

  // Verify the durable file still contains exactly the last flushed organism tick.
  const disk=JSON.parse(await readFile(file,'utf8'));
  assert.equal(disk.state.tick,core.snapshot().state.tick,'B320 final durable tick mismatch');
  const fileBytes=(await stat(file)).size;
  assert.ok(fileBytes>=metrics.lastPayloadBytes,'B320 on-disk footprint mismatch');

  console.log(JSON.stringify({
    pass:true,
    profile:'mobile',
    durableFileBytes:fileBytes,
    payloadBytes:metrics.lastPayloadBytes,
    lastSaveMs:metrics.lastSaveMs,
    adaptiveWindow:normal.effectiveMaxDirtyCycles,
    syntheticSlowWindow:slow,
    lowBatteryWindow:battery,
    resourcePressureWindow:pressure,
    decisionReason:gov.snapshot().lastDecision,
  },null,2));
} finally { await rm(dir,{recursive:true,force:true}); }
