import test from 'node:test';
import assert from 'node:assert/strict';
import { WillIntegrationBridge } from '../../src/organism/integration/will/WillIntegrationBridge.ts';
import { WillChannelAdapter } from '../../src/organism/integration/will/WillChannelAdapter.ts';
import { LuminaAdaptationFabric } from '../../src/organism/integration/lumina/LuminaAdaptationFabric.ts';

test('record chain remains verifiable after retention compaction',()=>{
  const w=new WillIntegrationBridge();
  for(let i=0;i<900;i++) w.recordContextCut({tick:i,source:'test',budgetTokens:100,retainedTokens:90,droppedTokens:10,reason:'budget'});
  const v=w.verifyRecordChain();
  assert.equal(v.ok,true);
  assert.equal(v.anchors,512);
  assert.ok(v.baseSeq>=0);
});

test('outbound channel id is deterministic and idempotent',()=>{
  const w=new WillIntegrationBridge();
  const c=new WillChannelAdapter({enqueue:x=>w.enqueue(x),ack:x=>w.ack(x)});
  const a=c.outbound('telegram','chat-1',{text:'hello'},'corr-1');
  const b=c.outbound('telegram','chat-1',{text:'hello'},'corr-1');
  assert.equal(a.id,b.id);
  assert.equal(w.snapshot().transport.queue.length,1);
});

test('Lumina outbound policy enforces explicit confirmation',()=>{
  const l=new LuminaAdaptationFabric();
  const denied=l.authorizeCapability('channel.outbound','telegram',false);
  const allowed=l.authorizeCapability('channel.outbound','telegram',true);
  assert.equal(denied.allowed,false);
  assert.equal(denied.reason,'confirmation-required');
  assert.equal(allowed.allowed,true);
});
