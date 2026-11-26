import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { CognitiveImmuneSystem } from '../src/organism/cognition/CognitiveImmuneSystem.ts';
import { validateRuntimeCheckpointEnvelope } from '../src/organism/system/RuntimeCheckpointEnvelope.ts';

const directory=await mkdtemp(path.join(os.tmpdir(),'nk-runtime-checkpoint-envelope-'));
const stateFile=path.join(directory,'organism.json');
const worldStateFile=path.join(directory,'world.json');
const sidecar=(name)=>stateFile+'.'+name+'.json';
const backingWorldStore=new FileStateStore(worldStateFile);
let failNextWorldSave=false;
const journalEvents=[];
const journal={write:async(level,event,data)=>{journalEvents.push({level,event,data});}};
const faultingWorldStore={
  load:()=>backingWorldStore.load(),
  save:async(value)=>{
    if(failNextWorldSave){failNextWorldSave=false;throw new Error('injected-world-sidecar-write-failure');}
    await backingWorldStore.save(value);
  },
};
const createRuntime=()=>new OrganismRuntime({
  stateFile,
  worldStateFile,
  enableLanguage:false,
  autoRun:false,
  cognitiveHealthSystem:new CognitiveImmuneSystem(),
  worldStateStore:faultingWorldStore,
  journal,
});

let first;
let restarted;
let legacy;
try {
  await backingWorldStore.save(new WorldEnvironment().persisted());
  first=createRuntime();
  await first.init();

  // Mutate real runtime-owned state before the coordinated Core flush.
  first.environment.commit(first.environment.simulate('move'));
  // Fail exactly the next World projection after Core has durably committed the envelope.
  failNextWorldSave=true;
  const obligation=await first.registerOpenLoop({
    title:'checkpoint envelope obligation',
    description:'survive a process restart without mixing owner generations',
    kind:'task',
    owner:'user',
    accepted:true,
    source:'runtime-checkpoint-envelope-test',
  });
  assert.ok(obligation?.id,'the real OpenLoopRadar mutation must be accepted');
  assert.ok(journalEvents.some(row=>row.event==='runtime.checkpoint-envelope.projection-failed'&&row.data?.owner==='world'),
    'a failed post-commit sidecar projection must be reported as a bounded warning');
  const worldAfterFailedProjection=await backingWorldStore.load();
  assert.equal(worldAfterFailedProjection.snapshot.location,'home',
    'the injected failed World projection must leave the old sidecar untouched');
  assert.equal(first.environment.snapshot().location,'lab',
    'the live World owner must keep its committed post-mutation state');
  await first.step('checkpoint the shared runtime state',{deliberate:true,suppressResponse:true});
  await first.flush();

  const persisted=JSON.parse(await readFile(stateFile,'utf8'));
  const envelope=persisted.system?.runtimeCheckpointEnvelope;
  assert.ok(envelope&&envelope.version===1,
    'a durable Core flush must commit a versioned runtime checkpoint envelope in the canonical Core file');
  assert.ok(Number.isSafeInteger(envelope.generation)&&envelope.generation>=1,
    'the envelope must carry a monotonic generation');
  assert.ok(typeof envelope.checkpointId==='string'&&envelope.checkpointId.length>=16,
    'the envelope must identify this exact checkpoint');
  assert.equal(envelope.coreTick,persisted.state.tick,
    'the Core tick recorded in the envelope must match the Core snapshot committed in the same atomic file');
  const validatedEnvelope=validateRuntimeCheckpointEnvelope(envelope);
  assert.equal(validatedEnvelope.ok,true,'the committed envelope must pass whole-bundle hash and owner validation');
  const envelopeSnapshots=validatedEnvelope.snapshots;
  // A declared one-byte compressed owner must not cause a large base64 allocation.
  const oversizedBase64Envelope=structuredClone(envelope);
  const worldCompressedBytes=oversizedBase64Envelope.owners.world.compressedBytes;
  oversizedBase64Envelope.owners.world.compressedBytes=1;
  oversizedBase64Envelope.owners.world.payloadBase64='A'.repeat(1024*1024);
  oversizedBase64Envelope.compressedBytes=oversizedBase64Envelope.compressedBytes-worldCompressedBytes+1;
  const oversizedBase64Result=validateRuntimeCheckpointEnvelope(oversizedBase64Envelope);
  assert.equal(oversizedBase64Result.ok,false,
    'base64 length inconsistent with declared compressed bytes must be rejected during preflight');
  assert.equal(oversizedBase64Result.reason,'world:owner-payload-base64-length-invalid',
    'the preflight must reject the encoded length before attempting base64 decode or decompression');

  const tamperedEnvelope=structuredClone(envelope);
  tamperedEnvelope.ownerHashes.world='0'.repeat(64);
  assert.equal(validateRuntimeCheckpointEnvelope(tamperedEnvelope).ok,false,
    'one owner hash mismatch must reject the complete checkpoint rather than permit partial recovery');
  const oversizedEnvelope=structuredClone(envelope);
  oversizedEnvelope.payloadBytes=25*1024*1024;
  assert.equal(validateRuntimeCheckpointEnvelope(oversizedEnvelope).ok,false,
    'declared aggregate payload limits must be rejected before attempting owner decompression');
  const extendedEnvelope={...envelope,unexpectedPayload:new Array(1024).fill('unbounded')};
  assert.equal(validateRuntimeCheckpointEnvelope(extendedEnvelope).ok,false,
    'unknown top-level fields must be rejected instead of being cloned into canonical state');

  // A hostile object can pass the prototype check and still throw from ownKeys.
  // Validation must reject it as data, not let a Proxy trap crash runtime startup.
  const hostileKeysEnvelope = new Proxy(envelope, {
    ownKeys() { throw new Error('hostile-ownKeys-trap'); },
  });
  let hostileKeysResult;
  assert.doesNotThrow(() => {
    hostileKeysResult = validateRuntimeCheckpointEnvelope(hostileKeysEnvelope);
  }, 'malformed Proxy envelopes must be rejected without throwing through the validation boundary');
  assert.equal(hostileKeysResult.ok, false,
    'an object whose ownKeys trap fails must never be accepted as a checkpoint envelope');
  assert.equal(envelope.worldTick,envelopeSnapshots.world.snapshot.tick);
  assert.deepEqual(
    Object.keys(envelope.ownerHashes).sort(),
    ['cognitiveHealth','cognitiveSpine','openLoop','riskAwareRecovery','world'],
    'all critical runtime-owned state owners must be covered by the same generation',
  );
  for(const [owner,hash] of Object.entries(envelope.ownerHashes)){
    assert.match(hash,/^[a-f0-9]{64}$/,owner+' must have a SHA-256 payload digest');
  }
  assert.ok(envelopeSnapshots.openLoop.records.some(record=>record.id===obligation.id),
    'the committed owner bundle must include the accepted OpenLoop obligation');
  const committedWorld=structuredClone(envelopeSnapshots.world);
  const committedOpenLoop=structuredClone(envelopeSnapshots.openLoop);

  // Simulate a crash after only some legacy sidecar projections have advanced.
  // Startup must restore one committed generation from Core, then repair the projections.
  const staleWorld=structuredClone(committedWorld);
  staleWorld.snapshot.tick+=500;
  staleWorld.snapshot.location='stale-sidecar-location';
  staleWorld.transitions=[];
  await writeFile(worldStateFile,JSON.stringify(staleWorld));
  await writeFile(sidecar('open-loops'),JSON.stringify({version:1,records:[],sequence:0}));
  await writeFile(sidecar('cognitive-spine'),JSON.stringify({version:1,mode:'reflex'}));
  await writeFile(sidecar('risk-aware-recovery'),JSON.stringify({version:1}));
  await writeFile(sidecar('cognitive-health'),JSON.stringify({version:1,rejectedCount:999}));

  restarted=createRuntime();
  await restarted.init();

  assert.match(restarted.runtimeCheckpointDiagnostics().restoreStatus,/^restored:/,
    'startup must accept and restore the verified canonical envelope: '+restarted.runtimeCheckpointDiagnostics().restoreStatus);
  assert.equal(restarted.environment.snapshot().tick,committedWorld.snapshot.tick,
    'a newer but uncommitted World sidecar must not override the canonical checkpoint generation');
  assert.equal(restarted.environment.snapshot().location,committedWorld.snapshot.location);
  assert.ok(restarted.openLoopRadar.snapshot().records.some(record=>record.id===obligation.id),
    'a sidecar from a different generation must not erase an accepted obligation');
  assert.deepEqual(restarted.cognitiveSpineScheduler.snapshot(),envelopeSnapshots.cognitiveSpine);
  assert.deepEqual(restarted.unifiedCycle.riskAwareRecoverySnapshot(),envelopeSnapshots.riskAwareRecovery);
  assert.deepEqual(restarted.cognitiveImmuneSystem.snapshot(),envelopeSnapshots.cognitiveHealth);

  const restoredGeneration=restarted.runtimeCheckpointDiagnostics().generation;
  await restarted.flush();
  assert.ok(restarted.runtimeCheckpointDiagnostics().generation>restoredGeneration,
    'the next durable checkpoint after restart must advance the restored generation');

  const repairedWorld=JSON.parse(await readFile(worldStateFile,'utf8'));
  const repairedOpenLoop=JSON.parse(await readFile(sidecar('open-loops'),'utf8'));
  assert.deepEqual(repairedWorld,committedWorld,
    'World sidecar must be rebuilt from the committed envelope after recovery');
  assert.deepEqual(repairedOpenLoop,committedOpenLoop,
    'OpenLoop sidecar must be rebuilt from the committed envelope after recovery');

  // A historical Core file without the envelope must continue to restore through
  // the pre-existing sidecar path rather than fail closed or erase runtime owners.
  const legacyCore=JSON.parse(await readFile(stateFile,'utf8'));
  delete legacyCore.system.runtimeCheckpointEnvelope;
  await writeFile(stateFile,JSON.stringify(legacyCore));
  const legacyWorld=structuredClone(repairedWorld);
  legacyWorld.snapshot.tick+=500;
  legacyWorld.snapshot.location='legacy-sidecar-location';
  legacyWorld.transitions=[];
  await writeFile(worldStateFile,JSON.stringify(legacyWorld));
  legacy=createRuntime();
  await legacy.init();
  assert.equal(legacy.runtimeCheckpointDiagnostics().restoreStatus,'legacy-no-envelope',
    'pre-envelope Core files must remain compatible with the legacy sidecar recovery path');
  assert.equal(legacy.environment.snapshot().tick,legacyWorld.snapshot.tick);
  assert.equal(legacy.environment.snapshot().location,'legacy-sidecar-location');
  assert.ok(legacy.openLoopRadar.snapshot().records.some(record=>record.id===obligation.id),
    'legacy OpenLoop sidecar obligations must remain recoverable without an envelope');

  console.log(JSON.stringify({
    runtimeCheckpointEnvelope:'PASS',
    generation:envelope.generation,
    coreTick:envelope.coreTick,
    worldTick:envelope.worldTick,
    owners:Object.keys(envelope.ownerHashes).sort(),
    mixedSidecarsRejected:true,
    projectionsRepaired:true,
  },null,2));
} finally {
  if(legacy) await legacy.stop().catch(()=>{});
  if(restarted) await restarted.stop().catch(()=>{});
  if(first) await first.stop().catch(()=>{});
  await rm(directory,{recursive:true,force:true});
}
