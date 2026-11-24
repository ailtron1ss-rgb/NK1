import assert from 'node:assert/strict';
import test from 'node:test';
import { LuminaAdaptationFabric } from '../../src/organism/integration/lumina/LuminaAdaptationFabric.ts';

test('Lumina adaptation provides capability policy and exact lexical search over canonical projections',()=>{
  const fabric=new LuminaAdaptationFabric();
  assert.ok(fabric.capabilities('ui').some(c=>c.id==='memory.search.exact'));
  const result=fabric.search([
    {id:'m1',kind:'memory',text:'Neural continuity and persistent identity',at:100,source:'memory'},
    {id:'g1',kind:'goal',text:'Verify browser policy',at:101,source:'goal'},
  ],'neural continuity',8);
  assert.equal(result.hits[0]?.id,'m1');
  assert.ok(result.hits[0]?.matchedTerms.includes('neural'));
});

test('Lumina idempotency prevents duplicate application and stores result hash',()=>{
  const fabric=new LuminaAdaptationFabric();
  const key=fabric.idempotencyKey({tool:'transport',id:'42'});
  assert.equal(fabric.beginIdempotent(key).fresh,true);
  fabric.commitIdempotent(key,{accepted:true});
  const second=fabric.beginIdempotent(key);
  assert.equal(second.fresh,false);
  assert.deepEqual(second.existing?.result,{accepted:true});
  assert.equal(fabric.diagnostics().idempotency.hits,1);
});

test('Lumina capability enforcement requires explicit confirmation and blocks loopback web targets',async()=>{
  const fabric=new LuminaAdaptationFabric();
  const denied=fabric.authorizeCapability('channel.outbound','telegram',false);
  const allowed=fabric.authorizeCapability('channel.outbound','telegram',true);
  assert.equal(denied.reason,'confirmation-required');
  assert.equal(allowed.allowed,true);
  const web=await fabric.validateWebTarget('http://127.0.0.1');
  assert.equal(web.allowed,false);
  assert.equal(web.reason,'private-or-special-address');
});
