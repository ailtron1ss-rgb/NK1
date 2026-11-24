import assert from 'node:assert/strict';
import test from 'node:test';
import { WillSdkFacade } from '../../src/organism/integration/will/WillSdkFacade.ts';
import { WillMcpJsonRpcServer } from '../../src/organism/integration/will/WillMcpJsonRpc.ts';
import { WillChannelAdapter } from '../../src/organism/integration/will/WillChannelAdapter.ts';

function bridgeMock(){
  const rows=[];
  return {rows,enqueue(x){rows.push(x);return x;},ack(){return true;},searchText(){return [{id:'m1',score01:1,textHash:'h'}];},benchmarkVectorIndex(){return {engine:'deterministic-hnsw',promoted:true};},diagnostics(){return {ok:true};}};
}

test('SDK facade exposes subject-oriented sense/state/save semantics', async()=>{
  const bridge=bridgeMock(); const host={snapshot:()=>({tick:2}),flush:async()=>{},step:async(message)=>({cycle:{input:message}}),exportWillPma:()=>({schemaVersion:1,subjectId:'kurisu',fingerprint:'x'}),validateWillPma:()=>({ok:true})};
  const sdk=new WillSdkFacade(host,bridge,'kurisu');
  const result=await sdk.sense({text:'hello',from:'user',provenance:'exafferent',correlationId:'c1'});
  assert.equal(result.cycle.input,'hello'); assert.equal(bridge.rows.length,1); assert.equal(sdk.capabilities().subjectId,'kurisu');
});

test('MCP JSON-RPC surface lists tools and executes state', async()=>{
  const bridge=bridgeMock(); const host={snapshot:()=>({tick:7}),flush:async()=>{},step:async()=>({}),exportWillPma:()=>({schemaVersion:1,subjectId:'kurisu',fingerprint:'x'}),validateWillPma:()=>({ok:true})};
  const mcp=new WillMcpJsonRpcServer(new WillSdkFacade(host,bridge,'kurisu'));
  const list=await mcp.handle({jsonrpc:'2.0',id:1,method:'tools/list'}); assert.ok(list.result.tools.some(x=>x.name==='perceive'));
  const state=await mcp.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'state',arguments:{}}}); assert.equal(state.result.tick,7);
});

test('channel adapter maps external messages into deterministic envelopes',()=>{
  const bridge=bridgeMock(); const adapter=new WillChannelAdapter(bridge,'test');
  const env=adapter.inbound({channel:'discord',externalId:'42',from:'alice',text:'hi',at:100});
  assert.equal(env.id,'test:discord:42'); assert.equal(env.source,'alice'); assert.equal(bridge.rows.length,1);
});
