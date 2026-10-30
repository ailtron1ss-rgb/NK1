import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(os.tmpdir(), 'neuro-p41-'));
const stateFile = path.join(dir, 'organism.json');
const worldFile = path.join(dir, 'world.json');
const store = new FileStateStore(stateFile);
const runtime = new OrganismRuntime({
  stateFile,
  worldStateFile: worldFile,
  stateStore: store,
  worldStateStore: new FileStateStore(worldFile),
  enableLanguage: false,
});
await runtime.init();
const samples = Array.from({length:2048},(_,i)=>Math.sin(i/9)*.25);
const rawRgb = [];
for (let i=0;i<64;i++) rawRgb.push(230,40,20);
await runtime.core.observe({
  text:'Kurisu sees a terminal in the laboratory',
  vision:{features:[.8,.2,.4],width:8,height:8,rawRgb,sceneLabel:'laboratory',confidence01:.9,objects:[{label:'terminal',kind:'object',confidence01:.95,x:1,y:0,z:2}]},
  audio:{samples, sampleRate:16000, events:[]},
  worldContext:{tick:1,location:'laboratory',energy:.8,attention:.8,uncertainty:.2,facts:['terminal active'],objects:[{id:'t1',label:'terminal',location:'laboratory',value:.7,visible:true,collected:false}],events:['screen-on']},
  embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.9,thermalStrain01:.2,sensoryFreshness01:1,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2},
});
await runtime.core.flush();
const snapshot = runtime.core.snapshot();
assert.equal(snapshot.schemaVersion, RELEASE_CONTRACT.stateSchema);
assert.ok(snapshot.facets.embodiment.p41NativePerception.imageFrames >= 1);
assert.ok(snapshot.facets.embodiment.p41NativePerception.audioFrames >= 1);
assert.ok(snapshot.facets.embodiment.p41SemanticPerception.snapshots.length >= 1);
assert.ok(snapshot.facets.embodiment.p41SemanticPerception.entities.length >= 1);
const terminalTracks = snapshot.facets.embodiment.p41SemanticPerception.entities.filter(entity => entity.label === 'terminal' && entity.kind === 'object');
assert.equal(terminalTracks.length, 1, 'vision and canonical world IDs must associate a single observed terminal');
assert.ok(terminalTracks[0].modalities.includes('vision') && terminalTracks[0].modalities.includes('world'));
assert.ok(terminalTracks[0].trackId?.includes('t1'), 'canonical world object identity must survive semantic fusion');

const calibrationReceiptId = 'p41-human-annotation-receipt-0001';
runtime.core.setRuntimeEvidence({
  version: 2,
  capacity: 128,
  total: 1,
  externalCount: 1,
  byKind: { observation:0, prediction:0, action:0, outcome:1, resource:0, model:0, goal:0, contradiction:0 },
  recent: [{
    id: calibrationReceiptId,
    at: Date.now(),
    tick: snapshot.state.tick,
    kind: 'outcome',
    source: 'human-annotation',
    confidence01: 1,
    external01: true,
    parentIds: [],
    payload: { modality:'vision', predictedConfidence01:.9, correctness01:.8, evidenceSource:'human-annotation' },
  }],
  linkedParentEvents: 0,
  danglingParentLinks: 0,
  lineageIntegrity01: 1,
  coverage01: 1,
  recentWindowTicks: 32,
});
const calibrationInput = {
  modality:'vision',
  predictedConfidence01:.9,
  correctness01:.8,
  evidenceId:calibrationReceiptId,
  evidenceSource:'human-annotation',
};
assert.equal(runtime.core.p41ObserveModalityOutcome(calibrationInput), true, 'Core accepts calibration backed by an exact independent receipt');
assert.equal(runtime.core.p41ObserveModalityOutcome(calibrationInput), false, 'calibration evidence cannot be replayed');
assert.equal(runtime.core.p41ObserveModalityOutcome({ ...calibrationInput, evidenceId:'unbacked-model-claim' }), false, 'a source label without a Core-owned receipt is not trusted');
await runtime.core.flush();
const calibratedSnapshot = runtime.core.snapshot();
assert.equal(calibratedSnapshot.facets.embodiment.p41SemanticPerception.modalityReliability.vision.calibrationSamples, 1);
const persisted = JSON.parse(await readFile(stateFile,'utf8'));
assert.ok(persisted.facets.embodiment.p41NativePerception);
assert.ok(persisted.facets.embodiment.p41SemanticPerception);
await runtime.stop();
await rm(dir,{recursive:true,force:true});
console.log(`P41_INTEGRATION=PASS nativeFrames=${snapshot.facets.embodiment.p41NativePerception.frames} entities=${snapshot.facets.embodiment.p41SemanticPerception.entities.length}`);
