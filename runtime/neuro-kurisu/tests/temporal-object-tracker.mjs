import assert from 'node:assert/strict';
import { TemporalObjectTracker, isValidNormalizedBoundingBox } from '../src/organism/body/TemporalObjectTracker.ts';

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

// A single prior track cannot be assigned to two competing current detections.
const ambiguousTracker=new TemporalObjectTracker({sessionId:'ambiguity',maxTrackGapMs:2_000});
const seed=ambiguousTracker.update({cameraId:0,at:1_000,objects:[{label:'cup',bbox:box(.35,.3),confidence01:.9}]});
assert.equal(seed.metrics.newTrackCount,1);
const ambiguity=ambiguousTracker.update({cameraId:0,at:1_100,objects:[
  {label:'cup',bbox:box(.36,.3),confidence01:.9},
  {label:'cup',bbox:box(.34,.3),confidence01:.9},
]});
assert.equal(ambiguity.metrics.associatedTrackCount,0);
assert.equal(ambiguity.metrics.ambiguousCount,2);
assert.ok(ambiguity.objects.every(object=>!object.trackId&&object.trackingStatus==='ambiguous'));

// Same-frame duplicate boxes are not converted into two fabricated identities.
const duplicate=ambiguousTracker.update({cameraId:0,at:1_200,objects:[
  {label:'bottle',bbox:box(.1,.1),confidence01:.9},
  {label:'bottle',bbox:box(.101,.101),confidence01:.9},
]});
assert.equal(duplicate.metrics.newTrackCount,0);
assert.equal(duplicate.metrics.ambiguousCount,2);

// Provider-owned IDs are preserved even when no 2D box is available.
const provider=tracker.update({cameraId:1,at:1_000,objects:[
  {label:'person',trackId:'vendor-17',sourceId:'detector-A',confidence01:.95},
]});
assert.equal(provider.objects[0].trackId,'vendor-17');
assert.equal(provider.objects[0].sourceId,'detector-A');
assert.equal(provider.objects[0].trackingStatus,'provider');

// No bounding box, low-confidence box, or invalid geometry never seeds local identity.
const untracked=tracker.update({cameraId:2,at:1_000,objects:[
  {label:'person',confidence01:.99},
  {label:'person',confidence01:.99,bbox:box(.1,.1),bboxConfidence01:.2},
  {label:'person',confidence01:.99,bbox:{x:.9,y:.9,width:.3,height:.3},bboxConfidence01:.99},
]});
assert.equal(untracked.metrics.newTrackCount,0);
assert.ok(untracked.objects.every(object=>!object.trackId));

// Camera namespaces do not cross-associate identical objects.
const camera1=tracker.update({cameraId:3,at:1_000,objects:[{label:'lamp',bbox:box(.1,.1),confidence01:.9}]});
const camera2=tracker.update({cameraId:4,at:1_000,objects:[{label:'lamp',bbox:box(.1,.1),confidence01:.9}]});
assert.notEqual(camera1.objects[0].trackId,camera2.objects[0].trackId);

// Out-of-order and duplicate capture receipts cannot mutate the latest camera state.
const before=tracker.snapshot(0)[0];
const stale=tracker.update({cameraId:0,at:1_400,frameId:'receipt-stale',objects:[{label:'chair',bbox:box(.1,.1),confidence01:.9}]});
assert.equal(stale.metrics.acceptedFrame,false);
assert.equal(stale.metrics.reason,'stale-frame');
const duplicateFrame=tracker.update({cameraId:0,at:2_000,frameId:'receipt-2',objects:[{label:'chair',bbox:box(.1,.1),confidence01:.9}]});
assert.equal(duplicateFrame.metrics.acceptedFrame,false);
assert.equal(duplicateFrame.metrics.reason,'duplicate-frame');
assert.equal(tracker.snapshot(0)[0].lastFrameAt,before.lastFrameAt);

// Expired tracks are not revived after a long gap.
const expiryTracker=new TemporalObjectTracker({sessionId:'expiry',maxTrackGapMs:1_000,maxTrackAgeMs:2_000});
const old=expiryTracker.update({cameraId:0,at:1_000,objects:[{label:'book',bbox:box(.2,.2),confidence01:.9}]});
const fresh=expiryTracker.update({cameraId:0,at:4_000,objects:[{label:'book',bbox:box(.2,.2),confidence01:.9}]});
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
