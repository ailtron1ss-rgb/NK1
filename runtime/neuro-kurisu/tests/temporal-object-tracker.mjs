import assert from 'node:assert/strict';
import { TemporalObjectTracker, isValidNormalizedBoundingBox } from '../src/organism/body/TemporalObjectTracker.ts';
import { P41SemanticPerceptionEngine } from '../src/organism/cognition/P41SemanticPerception.ts';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';

const box=(x,y,width=.18,height=.3)=>({x,y,width,height});
assert.equal(isValidNormalizedBoundingBox(box(.1,.1)), true);
assert.equal(isValidNormalizedBoundingBox(box(-.1,.1)), false);
assert.equal(isValidNormalizedBoundingBox(box(.9,.1,.2,.3)), false);
assert.equal(isValidNormalizedBoundingBox({x:.1,y:.1,width:0,height:.2}), false);

const tracker=new TemporalObjectTracker({sessionId:'test-session',maxTrackGapMs:2_000,maxTrackAgeMs:5_000});
const first=tracker.update({
  cameraId:0,at:1_000,frameId:'receipt-1',
  objects:[
    {label:'chair',kind:'object',confidence01:.9,bbox:box(.08,.1),bboxConfidence01:.88},
    {label:'chair',kind:'object',confidence01:.9,bbox:box(.7,.1),bboxConfidence01:.88},
  ],
});
assert.equal(first.metrics.acceptedFrame,true);
assert.equal(first.metrics.newTrackCount,2);
const firstIds=first.objects.map(object=>object.trackId);
assert.equal(new Set(firstIds).size,2);
assert.ok(firstIds.every(id=>id?.startsWith('local:test-session:0:')));
assert.ok(first.objects.every(object=>object.sourceId==='nk1-temporal-box-tracker'&&object.trackingStatus==='new'));

// Detection order changes, but the two spatial instances retain their identities.
const second=tracker.update({
  cameraId:0,at:1_500,frameId:'receipt-2',
  objects:[
    {label:'chair',kind:'object',confidence01:.92,bbox:box(.72,.11),bboxConfidence01:.9},
    {label:'chair',kind:'object',confidence01:.91,bbox:box(.10,.11),bboxConfidence01:.9},
  ],
});
assert.equal(second.metrics.associatedTrackCount,2);
assert.equal(second.objects[0].trackId,firstIds[1]);
assert.equal(second.objects[1].trackId,firstIds[0]);

// The camera tracker feeds the canonical P41 identity layer: separate same-label
// objects remain separate semantic entities and retain their IDs across frames.
const p41=new P41SemanticPerceptionEngine();
const firstSemantic=p41.ingest({
  at:1_000,
  vision:{cameraId:0,semantic:true,sceneLabel:'laboratory',confidence01:.9,objects:first.objects},
});
const secondSemantic=p41.ingest({
  at:1_500,
  vision:{cameraId:0,semantic:true,sceneLabel:'laboratory',confidence01:.9,objects:second.objects},
});
const p41Chairs=secondSemantic.entities.filter(entity=>entity.label==='chair'&&entity.kind==='object');
assert.equal(p41Chairs.length,2);
assert.equal(new Set(p41Chairs.map(entity=>entity.trackId)).size,2);
assert.ok(p41Chairs.every(entity=>entity.modalities.includes('vision')));
assert.ok(p41Chairs.every(entity=>entity.imageBox&&entity.imageBoxCameraId===0&&entity.imageBoxAt===1_500));
assert.ok(p41Chairs.every(entity=>entity.position===null),'image-space boxes must not be promoted into world coordinates');
assert.ok(firstSemantic.entities.some(entity=>entity.label==='chair'));
const invalidBoxConfidenceEngine=new P41SemanticPerceptionEngine();
const invalidBoxConfidence=invalidBoxConfidenceEngine.ingest({
  at:1_600,
  vision:{cameraId:0,semantic:true,objects:[{
    label:'table',confidence01:.99,
    bbox:{x:.1,y:.1,width:.3,height:.4},bboxConfidence01:4,
  }]},
});
assert.equal(invalidBoxConfidence.entities.find(entity=>entity.label==='table')?.imageBox,undefined);
const evidenceCompiler=new PerceptualEvidenceCompiler();
const evidenceState=evidenceCompiler.compile({at:1_500,semantic:secondSemantic});
const groundedWorld=new GroundedWorldState();
const worldSnapshot=groundedWorld.integrate({at:1_500,perception:secondSemantic,evidence:evidenceState});
const groundedChairs=worldSnapshot.objects.filter(object=>object.label==='chair');
assert.equal(groundedChairs.length,2);
assert.ok(groundedChairs.every(object=>object.bbox2D&&object.bboxCameraId===0&&object.bboxAt===1_500));
assert.deepEqual(groundedChairs.map(object=>object.bbox2D).sort((a,b)=>a.x-b.x),[
  {x:.1,y:.11,width:.18,height:.3},
  {x:.72,y:.11,width:.18,height:.3},
]);

// Serialize and restore both canonical P41 and GroundedWorldState before
// rebuilding the tracker. This models a real runtime process restart.
const persistedP41=JSON.parse(JSON.stringify(secondSemantic));
const restoredP41Engine=new P41SemanticPerceptionEngine();
restoredP41Engine.restore(persistedP41);
const restoredP41=restoredP41Engine.snapshot();
assert.deepEqual(
  restoredP41.entities.filter(entity=>entity.label==='chair').map(entity=>entity.imageBox).sort((a,b)=>a.x-b.x),
  p41Chairs.map(entity=>entity.imageBox).sort((a,b)=>a.x-b.x),
);
const persistedGrounded=JSON.parse(JSON.stringify(groundedWorld.snapshot()));
const restoredGroundedWorld=new GroundedWorldState();
restoredGroundedWorld.restore(persistedGrounded);
assert.deepEqual(
  restoredGroundedWorld.snapshot().entities.filter(entity=>entity.label==='chair').map(entity=>entity.imageBox).sort((a,b)=>a.x-b.x),
  groundedWorld.snapshot().entities.filter(entity=>entity.label==='chair').map(entity=>entity.imageBox).sort((a,b)=>a.x-b.x),
);

// Simulate process restart: restore local temporal identities from the persisted
// canonical P41 snapshot, then continue tracking on a third camera frame.
const restartedTracker=new TemporalObjectTracker({sessionId:'new-process'});
const restoreResult=restartedTracker.restoreFromPerception(restoredP41.entities,1_600);
assert.equal(restoreResult.restored,2);
const third=restartedTracker.update({
  cameraId:0,at:2_000,frameId:'receipt-3',
  objects:[
    {label:'chair',kind:'object',confidence01:.92,bbox:box(.74,.12),bboxConfidence01:.9},
    {label:'chair',kind:'object',confidence01:.91,bbox:box(.12,.12),bboxConfidence01:.9},
  ],
});
assert.equal(third.metrics.associatedTrackCount,2);
assert.equal(third.objects[0].trackId,second.objects[0].trackId);
assert.equal(third.objects[1].trackId,second.objects[1].trackId);
const thirdSemantic=restoredP41Engine.ingest({
  at:2_000,
  vision:{cameraId:0,semantic:true,sceneLabel:'laboratory',confidence01:.9,objects:third.objects},
});
assert.equal(thirdSemantic.entities.filter(entity=>entity.label==='chair').length,2);
assert.ok(thirdSemantic.entities.filter(entity=>entity.label==='chair').every(entity=>entity.imageBoxAt===2_000));

// A single prior track cannot be assigned to two competing current detections.
const ambiguousTracker=new TemporalObjectTracker({sessionId:'ambiguity',maxTrackGapMs:2_000});
const seed=ambiguousTracker.update({cameraId:0,at:1_000,objects:[{label:'cup',bbox:box(.35,.3),confidence01:.9,bboxConfidence01:.9}]});
assert.equal(seed.metrics.newTrackCount,1);
const ambiguity=ambiguousTracker.update({cameraId:0,at:1_100,objects:[
  {label:'cup',bbox:box(.36,.3),confidence01:.9,bboxConfidence01:.9},
  {label:'cup',bbox:box(.34,.3),confidence01:.9,bboxConfidence01:.9},
]});
assert.equal(ambiguity.metrics.associatedTrackCount,0);
assert.equal(ambiguity.metrics.ambiguousCount,2);
assert.ok(ambiguity.objects.every(object=>!object.trackId&&object.trackingStatus==='ambiguous'));

// Same-frame duplicate boxes are not converted into two fabricated identities.
const duplicate=ambiguousTracker.update({cameraId:0,at:1_200,objects:[
  {label:'bottle',bbox:box(.1,.1),confidence01:.9,bboxConfidence01:.9},
  {label:'bottle',bbox:box(.101,.101),confidence01:.9,bboxConfidence01:.9},
]});
assert.equal(duplicate.metrics.newTrackCount,0);
assert.equal(duplicate.metrics.ambiguousCount,2);

// ByteTrack-style two-stage behavior: a medium-confidence box may continue
// an existing track but cannot create a new identity on its own.
const twoStage=new TemporalObjectTracker({sessionId:'two-stage'});
const strongSeed=twoStage.update({cameraId:0,at:1_000,objects:[
  {label:'person',bbox:box(.2,.2),confidence01:.95,bboxConfidence01:.94},
]});
const weakContinuation=twoStage.update({cameraId:0,at:1_500,objects:[
  {label:'person',bbox:box(.21,.2),confidence01:.65,bboxConfidence01:.58},
]});
assert.equal(weakContinuation.metrics.associatedTrackCount,1);
assert.equal(weakContinuation.objects[0].trackId,strongSeed.objects[0].trackId);
const weakNew=twoStage.update({cameraId:1,at:1_500,objects:[
  {label:'person',bbox:box(.21,.2),confidence01:.65,bboxConfidence01:.58},
]});
assert.equal(weakNew.metrics.newTrackCount,0);
assert.equal(weakNew.objects[0].trackingStatus,'untracked');

// A bounded constant-velocity prediction helps retain identity across a larger
// inter-frame displacement without introducing a Kalman/3D-world claim.
const motionTracker=new TemporalObjectTracker({sessionId:'motion'});
const motionSeed=motionTracker.update({cameraId:0,at:1_000,objects:[
  {label:'person',bbox:box(.1,.2),confidence01:.95,bboxConfidence01:.94},
]});
const motionNext=motionTracker.update({cameraId:0,at:2_000,objects:[
  {label:'person',bbox:box(.29,.2),confidence01:.95,bboxConfidence01:.94},
]});
assert.equal(motionNext.metrics.associatedTrackCount,1);
assert.equal(motionNext.objects[0].trackId,motionSeed.objects[0].trackId);

// Provider-owned IDs are preserved even when no 2D box is available.
const detectorTracker=new TemporalObjectTracker({sessionId:'detector-source'});
const detectorFrame=detectorTracker.update({cameraId:7,at:1_000,objects:[
  {label:'person',sourceId:'detector-back-camera',bbox:box(.3,.2),bboxConfidence01:.93,confidence01:.95},
]});
const detectorP41=new P41SemanticPerceptionEngine();
const detectorSnapshot=detectorP41.ingest({
  at:1_000,
  vision:{cameraId:7,semantic:true,objects:detectorFrame.objects},
});
assert.ok(detectorSnapshot.entities[0].trackId?.includes(':detector-back-camera:nk1-temporal-box-tracker:'));
const detectorRestored=new TemporalObjectTracker({sessionId:'detector-restored'});
assert.equal(detectorRestored.restoreFromPerception(detectorSnapshot.entities,1_100).restored,1);

// Provider-owned IDs are preserved even when no 2D box is available.
const provider=tracker.update({cameraId:1,at:1_000,objects:[
  {label:'person',trackId:'vendor-17',sourceId:'detector-A',confidence01:.95},
]});
assert.equal(provider.objects[0].trackId,'vendor-17');
assert.equal(provider.objects[0].sourceId,'detector-A');
assert.equal(provider.objects[0].trackingStatus,'provider');
const providerTextId=tracker.update({cameraId:6,at:1_000,objects:[
  {label:'printer',trackId:'north-terminal-track-17',sourceId:'front-camera',confidence01:.95},
]});
assert.equal(providerTextId.objects[0].trackId,'north-terminal-track-17');
assert.equal(providerTextId.objects[0].sourceId,'front-camera','sanitization must not remove ordinary r/n/t characters');

// Object confidence alone is not localization confidence.
const noBoxConfidence=tracker.update({cameraId:5,at:1_000,objects:[
  {label:'person',confidence01:.99,bbox:box(.1,.1)},
]});
assert.equal(noBoxConfidence.metrics.newTrackCount,0);
assert.equal(noBoxConfidence.objects[0].trackingStatus,'untracked');

// No bounding box, low-confidence box, or invalid geometry never seeds local identity.
const untracked=tracker.update({cameraId:2,at:1_000,objects:[
  {label:'person',confidence01:.99},
  {label:'person',confidence01:.99,bbox:box(.1,.1),bboxConfidence01:.2},
  {label:'person',confidence01:.99,bbox:{x:.9,y:.9,width:.3,height:.3},bboxConfidence01:.99},
]});
assert.equal(untracked.metrics.newTrackCount,0);
assert.ok(untracked.objects.every(object=>!object.trackId));

// Camera namespaces do not cross-associate identical objects.
const camera1=tracker.update({cameraId:3,at:1_000,objects:[{label:'lamp',bbox:box(.1,.1),confidence01:.9,bboxConfidence01:.9}]});
const camera2=tracker.update({cameraId:4,at:1_000,objects:[{label:'lamp',bbox:box(.1,.1),confidence01:.9,bboxConfidence01:.9}]});
assert.notEqual(camera1.objects[0].trackId,camera2.objects[0].trackId);

// Out-of-order and duplicate capture receipts cannot mutate the latest camera state.
const before=tracker.snapshot(0)[0];
const stale=tracker.update({cameraId:0,at:1_400,frameId:'receipt-stale',objects:[{label:'chair',bbox:box(.1,.1),confidence01:.9,bboxConfidence01:.9}]});
assert.equal(stale.metrics.acceptedFrame,false);
assert.equal(stale.metrics.reason,'stale-frame');
const duplicateFrame=tracker.update({cameraId:0,at:2_000,frameId:'receipt-2',objects:[{label:'chair',bbox:box(.1,.1),confidence01:.9}]});
assert.equal(duplicateFrame.metrics.acceptedFrame,false);
assert.equal(duplicateFrame.metrics.reason,'duplicate-frame');
assert.equal(tracker.snapshot(0)[0].lastFrameAt,before.lastFrameAt);

// Expired tracks are not revived after a long gap.
const expiryTracker=new TemporalObjectTracker({sessionId:'expiry',maxTrackGapMs:1_000,maxTrackAgeMs:2_000});
const old=expiryTracker.update({cameraId:0,at:1_000,objects:[{label:'book',bbox:box(.2,.2),confidence01:.9,bboxConfidence01:.9}]});
const fresh=expiryTracker.update({cameraId:0,at:4_000,objects:[{label:'book',bbox:box(.2,.2),confidence01:.9,bboxConfidence01:.9}]});
assert.notEqual(old.objects[0].trackId,fresh.objects[0].trackId);
assert.equal(fresh.metrics.newTrackCount,1);

console.log(JSON.stringify({
  ok:true,
  twoInstanceTracking:true,
  detectionOrderInvariant:true,
  ambiguousMatchesRejected:true,
  duplicateBoxesRejected:true,
  providerIdsPreserved:true,
  noBoxMeansNoLocalIdentity:true,
  cameraIsolation:true,
  staleReceiptGuard:true,
  expiryGuard:true,
}));
