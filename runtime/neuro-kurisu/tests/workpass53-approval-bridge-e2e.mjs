import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const stateDir=resolve(root,'.workpass53-e2e-state');
rmSync(stateDir,{recursive:true,force:true});mkdirSync(stateDir,{recursive:true});
const children=[];
const spawnCapture=(label,command,args,env)=>{
  const child=spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  let output=''; child.stdout.on('data',data=>output+=String(data)); child.stderr.on('data',data=>output+=String(data));
  child._capturedOutput=()=>output; children.push(child); return child;
};
const requestJson=async(url,bodyValue)=>{
  const response=await fetch(url,bodyValue===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(bodyValue),cache:'no-store'});
  let data={};try{data=await response.json();}catch{}
  return {response,data};
};
try {
  const runtime=spawnCapture('runtime','node',['--experimental-strip-types','runtime/neuro-kurisu/src/server/server.mjs'],{PORT:'3311',HOST:'127.0.0.1',STATE_DIR:resolve(stateDir,'organism'),NODE_ENV:'test'});
  const bridge=spawnCapture('research-bridge','python3',['research/research_bridge.py'],{RESEARCH_PORT:'8766',ORGANISM_RUNTIME_URL:'http://127.0.0.1:3311'});
  let ready=false;
  for(let i=0;i<80;i++){
    if(runtime.exitCode!==null) throw new Error(`runtime exited early: ${runtime._capturedOutput()}`);
    try { const health=await requestJson('http://127.0.0.1:3311/health'); if(health.response.ok && health.data.ready===true){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.equal(ready,true,`runtime did not become ready: ${runtime._capturedOutput()}`);
  const bridgeStatus=await requestJson('http://127.0.0.1:8766/api/research/status');
  assert.equal(bridgeStatus.response.ok,true);

  // Both current and legacy outbound routes must block before creating an envelope.
  const outboundPayload={channel:'telegram',target:'chat-42',payload:{text:'workpass53 approval boundary probe'},confirmed:true};
  const outbound=await requestJson('http://127.0.0.1:3311/api/organism/integration/outbound',outboundPayload);
  assert.equal(outbound.response.status,403);
  assert.equal(outbound.data.approvalRequired,true);
  assert.equal(Boolean(outbound.data.envelope),false,'outbound envelope must not be created before owner approval');
  const legacyOutbound=await requestJson('http://127.0.0.1:3311/api/organism/will/channel/outbound',{...outboundPayload,channel:'discord'});
  assert.equal(legacyOutbound.response.status,403,'legacy WILL outbound endpoint must not bypass the gate');
  assert.equal(legacyOutbound.data.approvalRequired,true);
  const voice=await requestJson('http://127.0.0.1:3311/api/organism/voice/listen',{});
  assert.equal(voice.response.status,403,'microphone capture requires explicit approval');
  assert.equal(voice.data.approvalRequired,true);

  const probeUrl='http://127.0.0.1:8766/api/research/probe/nomega-registry';
  const blocked=await requestJson(probeUrl,{});
  assert.equal(blocked.response.status,403);
  assert.equal(blocked.data.approvalRequired,true);
  const ticket=blocked.data.approvalRequest;
  assert.ok(ticket?.id);
  assert.equal(ticket.toolId,'http.research.probe.nomega-registry');

  const snapshot=await requestJson('http://127.0.0.1:3311/api/organism/tools/permissions');
  assert.equal(snapshot.response.ok,true);
  const publicTicket=snapshot.data.permissions.requests.find(row=>row.id===ticket.id);
  assert.equal(publicTicket.status,'pending');
  assert.equal(Object.hasOwn(publicTicket,'requestHash'),false,'private request hash must never be exposed over the API');

  const approved=await requestJson('http://127.0.0.1:3311/api/organism/tools/permissions/resolve',{requestId:ticket.id,approved:true});
  assert.equal(approved.response.ok,true);
  assert.equal(approved.data.request.status,'approved');

  const executed=await requestJson(probeUrl,{approvalId:ticket.id});
  assert.equal(executed.response.ok,true,`probe failed after explicit approval: ${JSON.stringify(executed.data)}`);
  assert.equal(executed.data.status,'pass');

  const replay=await requestJson(probeUrl,{approvalId:ticket.id});
  assert.equal(replay.response.status,403,'a consumed approval cannot be replayed');
  const finalSnapshot=await requestJson('http://127.0.0.1:3311/api/organism/tools/permissions');
  const finalTicket=finalSnapshot.data.permissions.requests.find(row=>row.id===ticket.id);
  assert.equal(finalTicket.status,'consumed');
  assert.equal(finalSnapshot.data.permissions.consumed,1);
  console.log('WORKPASS53_APPROVAL_BRIDGE_E2E=PASS scenarios=20 probe=nomega-registry outbound=blocked voice=blocked legacy-outbound=blocked');
} finally {
  for(const child of children) child.kill('SIGTERM');
  await Promise.all(children.map(child=>new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve();});})));
  rmSync(stateDir,{recursive:true,force:true});
}
