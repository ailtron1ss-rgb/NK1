import assert from 'node:assert/strict';
import { ConscioAdaptationFabric, defaultConscioAdaptationState } from '../../src/organism/integration/conscio/ConscioAdaptationFabric.ts';

const fabric = new ConscioAdaptationFabric();
assert.equal(defaultConscioAdaptationState().source.name, 'Conscio-4.8.2');

const sync = fabric.syncDocuments([
  { id:'m1', title:'Memory', content:'Trading strategy was tested in a sandbox and validated.', source:'user', kind:'episodic', updatedAt:1 },
  { id:'m2', title:'World', content:'The sandbox strategy failed under network loss.', source:'external', kind:'semantic', updatedAt:2 },
  { id:'m3', title:'Skill', content:'verified browser automation skill', source:'derived', kind:'procedural', updatedAt:3 },
]);
assert.equal(sync.total,3);
const hits=fabric.hybridSearch('sandbox strategy',8);
assert(hits.length>=2);
assert(hits[0].rrfScore>=hits[1].rrfScore);

assert.equal(fabric.sourceBoundary('legacy/input-archives/x.zip','canonical').ok,false);
assert.equal(fabric.sourceBoundary('legacy/input-archives/x.zip','canonical').state,'provenance-only');
assert.equal(fabric.sourceBoundary('research/foo.py','canonical').ok,false);
assert.equal(fabric.sourceBoundary('runtime/neuro-kurisu/src/x.ts','canonical').ok,true);
assert.equal(fabric.hybridSearch('" OR 1=1 --',8).length,0);

const skill=fabric.publishSkill({name:'browser-scout',summary:'inspect and report a page',provenance:'external-source'});
assert.equal(skill.status,'quarantined');
assert.equal(fabric.reviewSkill(skill.id,'approve').ok,false);
assert.equal(fabric.trialSkill(skill.id,true,'sandbox trial 1').ok,true);
assert.equal(fabric.trialSkill(skill.id,true,'sandbox trial 2').ok,true);
assert.equal(fabric.reviewSkill(skill.id,'approve').ok,true);

const peer=fabric.pairPeer({id:'peer-1',label:'Phone',capabilities:['message'],trust01:.8});
assert.equal(peer.status,'pending');
fabric.decidePeer(peer.id,'trust');
const msg=fabric.queuePeerMessage({from:'kurisu',to:'peer-1',payload:{text:'hello'}});
assert.equal(msg.message.status,'queued');
assert.equal(fabric.ackPeerMessage(msg.message.id,true).ok,true);
const idem=fabric.queuePeerMessage({from:'kurisu',to:'peer-1',space:'default',payload:{text:'single logical message',meta:{b:2,a:1}},idempotencyKey:'conscio-idem-1'});
assert.equal(idem.ok,true);
const idemReplay=fabric.queuePeerMessage({from:'kurisu',to:'peer-1',space:'default',payload:{meta:{a:1,b:2},text:'single logical message'},idempotencyKey:'conscio-idem-1'});
assert.equal(idemReplay.ok,true);
assert.equal(idemReplay.reused,true,'same canonical request should reuse the original message');
assert.equal(idemReplay.message.id,idem.message.id);
const idemConflict=fabric.queuePeerMessage({from:'kurisu',to:'peer-1',space:'default',payload:{text:'different message'},idempotencyKey:'conscio-idem-1'});
assert.equal(idemConflict.ok,false,'same idempotency key must not alias a different payload');
assert.equal(idemConflict.error,'idempotency-key-conflict');
assert.equal(idemConflict.existingId,idem.message.id);
assert.equal('message' in idemConflict,false,'conflict response must not disclose the original payload');
assert.equal(fabric.snapshot().metrics.peerIdempotencyConflicts,1);

const obs=fabric.observeConfidence({key:'claim',predicted01:.8,outcome01:1,evidenceTrust01:.9});
assert(obs.brier<.1);
assert.equal(fabric.calibration('claim').samples,1);
assert.equal(fabric.recordClaim({claim:'sent message',expectedAction:'peer-1',supported:true}).ok, false);
const claim=fabric.recordClaim({claim:'sent message',expectedAction:'peer-1',supported:true,evidence:[`obs:${msg.message.id}`]});
assert.equal(claim.supported,true);
assert.equal(fabric.assessMetabolic(9000,16384).state,'fatigue');

const legacySnapshot=fabric.snapshot(); delete legacySnapshot.metrics.peerIdempotencyConflicts;
const restoredLegacy=new ConscioAdaptationFabric(); restoredLegacy.restore(legacySnapshot);
assert.equal(restoredLegacy.snapshot().metrics.peerIdempotencyConflicts,0,'legacy snapshots receive the new metric default');
const restored=new ConscioAdaptationFabric(); restored.restore(fabric.snapshot());
const restoredReplay=restored.queuePeerMessage({from:'kurisu',to:'peer-1',space:'default',payload:{text:'single logical message',meta:{a:1,b:2}},idempotencyKey:'conscio-idem-1'});
assert.equal(restoredReplay.ok,true);
assert.equal(restoredReplay.reused,true,'idempotency survives snapshot/restore');
assert.equal(restoredReplay.message.id,idem.message.id);
assert.equal(restored.snapshot().metrics.peerIdempotencyConflicts,1,'conflict telemetry survives snapshot/restore');
assert.equal(restored.diagnostics().counts.skills,1);
assert.equal(restored.diagnostics().counts.peers,1);
assert(restored.hybridSearch('sandbox',4).length>=2);
console.log('CONSCIO_ADAPTATION_PASS');
console.log(JSON.stringify(restored.diagnostics(),null,2));
