import assert from 'node:assert/strict';
import test from 'node:test';
import { WillIntegrationBridge } from '../../src/organism/integration/will/WillIntegrationBridge.ts';

test('WILL adapter ranks candidates deterministically and records competition', () => {
  const bridge = new WillIntegrationBridge();
  const candidates = [
    {id:'a',action:'respond',score:.50,predictedUtility:.62,predictedNeedRelief:.3,predictedCost:.2,confidence:.7,generatedAt:1},
    {id:'b',action:'verify',score:.48,predictedUtility:.58,predictedNeedRelief:.5,predictedCost:.3,confidence:.65,generatedAt:1},
  ];
  const out = bridge.rankCandidates(candidates, {needs:{energy:.7,cognitiveLoad:.2,uncertainty:.4,socialNeed:.3,novelty:.5,identityCoherence:.9,goalPressure:.4}, goalRelevance01:.5, planBias01:.2, socialPrior01:.3});
  assert.equal(out.length,2);
  assert.ok(bridge.diagnostics().counters.decisionCycles===1);
  assert.equal(bridge.snapshot().agency.lastScores.length,2);
});

test('compact PMA round-trips with exact fingerprint validation', () => {
  const bridge = new WillIntegrationBridge();
  bridge.observeOutcome({tick:1,action:'respond',success01:1,verified01:1,at:100});
  const pma = bridge.buildCompactPma({subjectId:'kurisu-test',identity:{name:'Kurisu'},goals:[{id:'g',status:'active'}],memories:[{id:'m',content:'hello'}],at:200});
  const check = bridge.validatePma(pma);
  assert.equal(check.ok,true);
  const altered = {...pma, goals:[{id:'evil'}]};
  assert.equal(bridge.validatePma(altered).ok,false);
});

test('transport deduplicates ACKs and preserves replay seam', () => {
  const bridge = new WillIntegrationBridge();
  bridge.enqueue({id:'e1',type:'chat',source:'test',payload:{text:'hello'},createdAt:1});
  const drained = bridge.drainQueue(4);
  assert.equal(drained.length,1);
  assert.equal(bridge.ack({envelopeId:'e1',accepted:true,at:2}),true);
  assert.equal(bridge.ack({envelopeId:'e1',accepted:true,at:3}),false);
  assert.equal(bridge.snapshot().transport.replay.length,1);
});

test('deterministic vector memory search is stable across snapshot/restore', () => {
  const bridge = new WillIntegrationBridge();
  bridge.indexText('m1','deterministic memory about neural continuity',10);
  bridge.indexText('m2','unrelated cooking memory',11);
  const first = bridge.searchText('neural continuity',2);
  const restored = new WillIntegrationBridge();
  restored.restore(bridge.snapshot());
  const second = restored.searchText('neural continuity',2);
  assert.deepEqual(second,first);
});

test('hash-chain record sequence advances monotonically', () => {
  const bridge = new WillIntegrationBridge();
  bridge.upsertDossier({handle:'user',alias:'operator',kind:'person',at:1});
  bridge.recordContextCut({tick:1,source:'test',budgetTokens:100,retainedTokens:80,droppedTokens:20,reason:'cut',at:2});
  const anchors=bridge.snapshot().recordChain.anchors;
  assert.equal(anchors.length,2);
  assert.equal(anchors[1].previousDigest,anchors[0].digest);
  assert.equal(anchors[1].seq,anchors[0].seq+1);
});

test('deterministic HNSW benchmark produces explicit promotion evidence', () => {
  const bridge = new WillIntegrationBridge();
  for (let i=0;i<48;i++) bridge.indexText(`m${i}`, `neural continuity memory item ${i} with stable retrieval semantics`, i+1);
  const result = bridge.benchmarkVectorIndex([
    'neural continuity memory item 3',
    'stable retrieval semantics item 18',
    'neural continuity item 37'
  ], 5, 48);
  assert.equal(result.engine, 'deterministic-hnsw');
  assert.ok(result.corpus >= 48);
  assert.ok(result.recallAtK01 >= 0.0 && result.recallAtK01 <= 1.0);
  assert.equal(typeof result.promoted, 'boolean');
  assert.ok(result.graphComparisons >= 0);
  assert.ok(result.exactComparisons >= result.graphComparisons);
  assert.equal(bridge.snapshot().vector.promoted, result.promoted);
});

test('tamper-evident chain detects digest corruption', () => {
  const bridge = new WillIntegrationBridge();
  bridge.upsertDossier({handle:'user',alias:'operator',kind:'person',at:1});
  bridge.recordContextCut({tick:1,source:'test',budgetTokens:100,retainedTokens:80,droppedTokens:20,reason:'cut',at:2});
  assert.equal(bridge.verifyRecordChain().ok,true);
  const snap = bridge.snapshot();
  snap.recordChain.anchors[0].digest = '0'.repeat(64);
  const restored = new WillIntegrationBridge();
  restored.restore(snap);
  assert.equal(restored.verifyRecordChain().ok,false);
});


test('transport replay re-feeds retained history as new deterministic envelopes',()=>{
  const bridge=new WillIntegrationBridge();
  bridge.enqueue({id:'original',type:'chat',source:'test',payload:{text:'hello'},createdAt:1});
  bridge.drainQueue(1); bridge.ack({envelopeId:'original',accepted:true,at:2});
  const replay=bridge.replayTransport(4);
  assert.equal(replay.length,1); assert.notEqual(replay[0].id,'original'); assert.equal(replay[0].payload.replayOf,'original');
});

test('LLM attribution is persisted and counted separately from policy',()=>{
  const bridge=new WillIntegrationBridge();
  bridge.recordLanguageCompletion({provider:'kobold',model:'local',success:true,latencyMs:42,at:10});
  bridge.recordLanguageCompletion({provider:'gemini',model:'flash',success:false,latencyMs:87,at:11});
  const d=bridge.diagnostics(); assert.equal(d.llm.completions,2); assert.equal(d.llm.failures,1); assert.equal(d.llm.lastProvider,'gemini');
});

test('transport rejects same-id logical request collisions and replays exact duplicates only once',()=>{
  const bridge=new WillIntegrationBridge();
  const first=bridge.enqueue({id:'stable-envelope',type:'chat',source:'test',payload:{b:2,a:1},createdAt:10});
  const duplicate=bridge.enqueue({id:'stable-envelope',type:'chat',source:'test',payload:{a:1,b:2},createdAt:999});
  assert.equal(duplicate.envelopeHash,first.envelopeHash,'duplicate must return the original canonical envelope');
  assert.throws(()=>bridge.enqueue({id:'stable-envelope',type:'chat',source:'test',payload:{a:9},createdAt:11}),e=>e.code==='transport-envelope-id-conflict');
  assert.equal(bridge.snapshot().transport.queue.length,1,'collision must not create a second queue item');
  assert.equal(bridge.diagnostics().transport.idempotencyConflicts,1);
});

test('transport rejects unknown and conflicting acknowledgements; ACK removes queued work',()=>{
  const bridge=new WillIntegrationBridge();
  const unknown=bridge.ackDetailed({envelopeId:'does-not-exist',accepted:true,at:10});
  assert.equal(unknown.ok,false); assert.equal(unknown.error,'transport-envelope-not-found');
  bridge.enqueue({id:'ack-envelope',type:'task',source:'test',payload:{task:'safe'},createdAt:1});
  const first=bridge.ackDetailed({envelopeId:'ack-envelope',accepted:true,at:2});
  assert.equal(first.ok,true); assert.equal(first.reused,false);
  assert.equal(bridge.snapshot().transport.queue.length,0,'an ACK must prevent later dispatch from the queue');
  const replay=bridge.ackDetailed({envelopeId:'ack-envelope',accepted:true,at:3});
  assert.equal(replay.ok,true); if(replay.ok) assert.equal(replay.reused,true);
  const conflict=bridge.ackDetailed({envelopeId:'ack-envelope',accepted:false,at:4,reason:'different outcome'});
  assert.equal(conflict.ok,false); assert.equal(conflict.error,'transport-ack-conflict');
  assert.equal(bridge.diagnostics().transport.rejectedAcks,1);
  assert.equal(bridge.diagnostics().transport.ackConflicts,1);
});

test('transport queue backpressure preserves existing envelopes instead of dropping them',()=>{
  const bridge=new WillIntegrationBridge();
  for(let i=0;i<256;i++) bridge.enqueue({id:`fill-${i}`,type:'task',source:'test',payload:{i},createdAt:i});
  assert.throws(()=>bridge.enqueue({id:'overflow',type:'task',source:'test',payload:{overflow:true},createdAt:999}),e=>e.code==='transport-queue-full');
  const snap=bridge.snapshot(); assert.equal(snap.transport.queue.length,256); assert.equal(snap.transport.queue[0].id,'fill-0'); assert.equal(snap.transport.queueBackpressure,1);
});

test('transport replay is stable, does not recursively replay replay envelopes, and restores legacy snapshots',()=>{
  const bridge=new WillIntegrationBridge();
  bridge.enqueue({id:'replay-source',type:'chat',source:'test',payload:{text:'hello'},createdAt:1});
  bridge.drainQueue(1); bridge.ack({envelopeId:'replay-source',accepted:true,at:2});
  const first=bridge.replayTransport(8); assert.equal(first.length,1);
  const replayId=first[0].id;
  bridge.drainQueue(1); bridge.ack({envelopeId:replayId,accepted:true,at:3});
  assert.equal(bridge.replayTransport(16).length,0,'a replay must not generate replay-of-replay or repeat a prior replay');
  const legacy=bridge.snapshot(); delete legacy.transport.seenEnvelopes; delete legacy.transport.idempotencyConflicts; delete legacy.transport.rejectedAcks; delete legacy.transport.ackConflicts; delete legacy.transport.rejectedEnvelopes; delete legacy.transport.queueBackpressure;
  const restored=new WillIntegrationBridge(); restored.restore(legacy);
  assert.equal(restored.diagnostics().transport.idempotencyConflicts,0);
  assert.equal(restored.diagnostics().transport.ackConflicts,0); assert.equal(restored.diagnostics().transport.rejectedEnvelopes,0); assert.equal(restored.diagnostics().transport.queueBackpressure,0);
  assert.equal(restored.diagnostics().transport.rejectedAcks,0);
  assert.ok(Array.isArray(restored.snapshot().transport.seenEnvelopes));
  assert.ok(restored.snapshot().transport.seenEnvelopes.some(x=>x.id==='replay-source'),'legacy retained transport history should rebuild request fingerprints');
  assert.equal(restored.replayTransport(16).length,0,'restored replay indexes must keep already-generated replay from being regenerated');
});

test('transport envelope validation rejects invalid identifiers and non-JSON payloads',()=>{
  const bridge=new WillIntegrationBridge();
  assert.throws(()=>bridge.enqueue({id:'',type:'chat',source:'test',payload:{text:'x'}}),e=>e.code==='transport-envelope-invalid');
  assert.throws(()=>bridge.enqueue({id:'bad-payload',type:'chat',source:'test',payload:undefined}),e=>e.code==='transport-envelope-invalid');
  const invalidAck=bridge.ackDetailed({envelopeId:'',accepted:true,at:1}); assert.equal(invalidAck.ok,false); if(!invalidAck.ok) assert.equal(invalidAck.error,'transport-ack-invalid');
});

test('WILL agency records the pre-adjustment baseline and a bounded applied delta', () => {
  const bridge = new WillIntegrationBridge();
  const candidates = [
    {id:'a',action:'respond',score:.50,predictedUtility:.62,predictedNeedRelief:.3,predictedCost:.2,confidence:.7,generatedAt:1},
    {id:'b',action:'verify',score:.48,predictedUtility:.58,predictedNeedRelief:.5,predictedCost:.3,confidence:.65,generatedAt:1},
  ];
  const original = candidates.map(c => ({action:c.action,score:c.score}));
  bridge.rankCandidates(candidates, {needs:{energy:.7,cognitiveLoad:.2,uncertainty:.4,socialNeed:.3,novelty:.5,identityCoherence:.9,goalPressure:.4}, goalRelevance01:.5});
  const rows = bridge.snapshot().agency.lastScores;
  for (const row of rows) {
    const before = original.find(c => c.action === row.action).score;
    const after = candidates.find(c => c.action === row.action).score;
    assert.equal(row.base01, before, 'diagnostics must preserve the pre-adjustment score');
    assert.ok(Math.abs(row.delta01) <= .0400001, 'WILL contribution must remain bounded');
    assert.ok(Math.abs(after - before - row.delta01) < 1e-9, 'reported delta must match the actual score change');
  }
});

test('unverified success cannot inflate WILL competence or confidence',()=>{
  const bridge=new WillIntegrationBridge();
  bridge.observeOutcome({tick:1,action:'unsafe-action',success01:1,verified01:0,at:10});
  let skill=bridge.competenceForAction('unsafe-action');
  assert.equal(skill.uses,1,'all observations remain visible');
  assert.equal(skill.verifiedUses,0,'unverified outcome provides no competence evidence');
  assert.equal(skill.successes,0);
  assert.equal(skill.successRate01,0);
  assert.equal(skill.confidence01,.5,'unverified success must not raise habit confidence');
  bridge.observeOutcome({tick:2,action:'unsafe-action',success01:1,verified01:1,at:20});
  skill=bridge.competenceForAction('unsafe-action');
  assert.equal(skill.uses,2);
  assert.equal(skill.verifiedUses,1);
  assert.equal(skill.successes,1);
  assert.equal(skill.successRate01,1);
  assert.ok(skill.confidence01>.5,'verified success may update competence');
});

test('legacy competence snapshot cannot promote unverified historical success',()=>{
  const restored=new WillIntegrationBridge();
  restored.restore({competence:{artifacts:[{id:'legacy',action:'legacy-action',uses:10,successes:10,successRate01:1,confidence01:.99,cost01:.2,updatedAt:5} ]}});
  const skill=restored.competenceForAction('legacy-action');
  assert.equal(skill.uses,10);
  assert.equal(skill.verifiedUses,0);
  assert.equal(skill.successes,0);
  assert.equal(skill.successRate01,0);
  assert.equal(skill.confidence01,.5);
});
