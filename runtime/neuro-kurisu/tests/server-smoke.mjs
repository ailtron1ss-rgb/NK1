import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { pollUntilReady, timeoutWithinDeadline } from '../scripts/server-smoke-poll.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir=await mkdtemp(path.join(tmpdir(),'nk-server-')); const port=32000 + Math.floor(Math.random()*3000);
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:dir};
const rawFetch=globalThis.fetch;
const totalTimeoutCandidate = Number(process.env.NK_SERVER_SMOKE_TOTAL_TIMEOUT_MS);
const totalTimeoutMs = Number.isFinite(totalTimeoutCandidate)
  ? Math.max(10_000, Math.min(180_000, totalTimeoutCandidate))
  : 90_000;
const smokeStartedAt = Date.now();
const smokeDeadline = smokeStartedAt + totalTimeoutMs;
const traceSmoke = process.env.NK_SERVER_SMOKE_TRACE === '1';
const fetch=async (input,init={})=>{
  const timeoutMs = timeoutWithinDeadline(smokeDeadline, 4_000);
  if (timeoutMs <= 0) throw new Error(`server smoke total deadline exceeded after ${Date.now()-smokeStartedAt}ms`);
  const url = String(input);
  const started = Date.now();
  if (traceSmoke) console.error(`SMOKE_HTTP_START ${init.method || 'GET'} ${new URL(url).pathname}`);
  const response = await rawFetch(input,{...init,signal:init.signal ?? AbortSignal.timeout(timeoutMs)});
  if (traceSmoke) console.error(`SMOKE_HTTP_HEADERS ${response.status} ${new URL(url).pathname} ${Date.now()-started}ms`);
  if (!traceSmoke) return response;
  return new Proxy(response, {
    get(target, property) {
      const original = Reflect.get(target, property, target);
      if (property === 'json' || property === 'text') return async (...args) => {
        const bodyStarted = Date.now();
        console.error(`SMOKE_BODY_START ${String(property)} ${new URL(url).pathname}`);
        try {
          const value = await original.apply(target, args);
          console.error(`SMOKE_BODY_END ${String(property)} ${new URL(url).pathname} ${Date.now()-bodyStarted}ms`);
          return value;
        } catch (error) {
          console.error(`SMOKE_BODY_FAIL ${String(property)} ${new URL(url).pathname} ${error?.name || 'Error'}`);
          throw error;
        }
      };
      return typeof original === 'function' ? original.bind(target) : original;
    },
  });
};
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:runtimeRoot,env,stdio:['ignore','pipe','pipe']});
let output=''; let childExit=null;
child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
child.once('exit',(code,signal)=>{childExit={code,signal};});
const startupTimeoutMs = Number.isFinite(Number(process.env.NK_SERVER_SMOKE_STARTUP_TIMEOUT_MS))
  ? Math.max(1_000, Math.min(120_000, Number(process.env.NK_SERVER_SMOKE_STARTUP_TIMEOUT_MS)))
  : 30_000;
try {
  const readiness = await pollUntilReady({
    timeoutMs: Math.max(1, Math.min(startupTimeoutMs, smokeDeadline - Date.now())),
    intervalMs: 100,
    probeTimeoutMs: 1_000,
    isChildExited: () => childExit !== null,
    probe: async (timeoutMs) => {
      const response = await rawFetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, smokeDeadline - Date.now()))) });
      if (!response.ok) return false;
      const body = await response.json();
      return body.ready === true;
    },
  });
  if (!readiness.ready) {
    const exit = childExit ? `child-exit=${childExit.code ?? 'null'}/${childExit.signal ?? 'none'}` : 'child-still-running';
    throw new Error(`server did not become healthy within ${readiness.elapsedMs}ms after ${readiness.attempts} probes (${exit}; lastProbe=${readiness.lastError || 'none'}): ${output.slice(-500)}`);
  }
  const root=await (await fetch(`http://127.0.0.1:${port}/`)).text(); if(!root.includes('Neuro‑Kurisu') && root.includes('Unified Organism')) throw new Error('UI release marker mismatch');
  const memoryInspectorStartedAt=Date.now();
  const memoryInspectorResponse=await fetch(`http://127.0.0.1:${port}/api/organism/memory-inspector?q=workpass26-temporal-inspector&limit=0`);
  const memoryInspector=await memoryInspectorResponse.json();
  if(!memoryInspectorResponse.ok || memoryInspector.ok!==true || memoryInspector.temporalMode!=='current' || !Number.isFinite(memoryInspector.asOfAt) || memoryInspector.asOfAt<memoryInspectorStartedAt-2_000 || memoryInspector.asOfAt>Date.now()+2_000 || !Array.isArray(memoryInspector.memories) || memoryInspector.memories.length>1) throw new Error(`memory inspector must default absent asOfAt to now and clamp limit to 1: status=${memoryInspectorResponse.status} body=${JSON.stringify(memoryInspector)}`);
  const explicitEpochResponse=await fetch(`http://127.0.0.1:${port}/api/organism/memory-inspector?q=workpass26-temporal-inspector&temporalMode=at&asOfAt=0&limit=not-a-number`);
  const explicitEpoch=await explicitEpochResponse.json();
  if(!explicitEpochResponse.ok || explicitEpoch.temporalMode!=='at' || explicitEpoch.asOfAt!==0 || !Array.isArray(explicitEpoch.memories) || explicitEpoch.memories.length>16) throw new Error('memory inspector must preserve an explicit timestamp zero and bound an invalid limit');
  const h=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  if(h.version!==RELEASE_CONTRACT.application || h.organismCore!==RELEASE_CONTRACT.organismCore || h.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('server release contract mismatch');
  // A physical camera side effect must be rejected before runtime execution when a stable retry key is absent.
  const cameraWithoutKeyResponse=await fetch(`http://127.0.0.1:${port}/api/organism/vision/capture`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cameraId:0,retain:false})});
  const cameraWithoutKey=await cameraWithoutKeyResponse.json();
  if(cameraWithoutKeyResponse.status!==400 || cameraWithoutKey.error!=='idempotency-key-required') throw new Error(`physical camera route must require Idempotency-Key before execution: HTTP ${cameraWithoutKeyResponse.status} ${JSON.stringify(cameraWithoutKey)}`);
  if(!h.actionLedger || h.actionLedger.durablePersisterConfigured!==true || !h.actionLedger.archive?.loaded || !Number.isInteger(h.actionLedger.hotRecords) || !Number.isInteger(h.actionLedger.archive.entries) || !Number.isFinite(h.actionLedger.archive.bytes)) throw new Error('server action-ledger durability diagnostics contract mismatch');
  const brainResponse=await fetch(`http://127.0.0.1:${port}/api/organism/cognitive-architecture`); const brain=await brainResponse.json();
  const architecture=brain.architecture;
  const subsystemCount=architecture?.subsystems?.length;
  const flowCount=architecture?.flows?.length;
  if(!brainResponse.ok || brain.ok!==true || brain.readOnly!==true ||
     architecture?.validation?.ok!==true ||
     !Array.isArray(architecture?.subsystems) || subsystemCount<14 ||
     !Array.isArray(architecture?.flows) || flowCount<22 ||
     architecture.validation.subsystemCount!==subsystemCount ||
     architecture.validation.flowCount!==flowCount ||
     !Array.isArray(architecture?.runtimeSnapshot?.systems) ||
     !Number.isFinite(architecture?.runtimeSnapshot?.tick)) {
    throw new Error(`cognitive architecture endpoint/runtime health contract mismatch: ${JSON.stringify({
      status:brainResponse.status,ok:brain.ok,readOnly:brain.readOnly,
      validation:architecture?.validation,subsystemCount,flowCount,
      runtimeSystems:Array.isArray(architecture?.runtimeSnapshot?.systems)?architecture.runtimeSnapshot.systems.length:null,
      tick:architecture?.runtimeSnapshot?.tick,
    })}`);
  }
  // Exercise the real language-completion path: telemetry is best-effort and must
  // not turn a generated answer into an HTTP 500.
  const chatResponse=await fetch(`http://127.0.0.1:${port}/api/organism/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Reply briefly with a greeting for the server smoke test.'})});
  const chat=await chatResponse.json();
  if(!chatResponse.ok || chat.ok!==true || typeof chat.language?.text!=='string') throw new Error(`organism chat completion failed: HTTP ${chatResponse.status} ${chat.error ?? ''}`);
  const lite=await (await fetch(`http://127.0.0.1:${port}/api/organism/status-lite`)).json(); if(!lite.ok || !lite.voice?.state || !Object.prototype.hasOwnProperty.call(lite.voice,'plan')) throw new Error('status-lite voice surface missing');
  const will=await (await fetch(`http://127.0.0.1:${port}/api/organism/will`)).json(); if(!will.ok || will.integration?.schemaVersion!==1) throw new Error('will integration endpoint mismatch');
  const willEnvelopeUrl=`http://127.0.0.1:${port}/api/organism/will/envelope`;
  const willEnvelopePost=(payload)=>fetch(willEnvelopeUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const willEnvelope={id:'workpass10-server-envelope',type:'smoke.task',source:'server-smoke',payload:{value:1},createdAt:100};
  const willEnvelopeFirstResponse=await willEnvelopePost(willEnvelope); const willEnvelopeFirst=await willEnvelopeFirstResponse.json();
  if(willEnvelopeFirstResponse.status!==200 || !willEnvelopeFirst.ok || !willEnvelopeFirst.envelope?.envelopeHash) throw new Error('will envelope enqueue contract');
  const willEnvelopeDuplicate=await willEnvelopePost({...willEnvelope,createdAt:200});
  if(willEnvelopeDuplicate.status!==200 || (await willEnvelopeDuplicate.json()).envelope?.envelopeHash!==willEnvelopeFirst.envelope.envelopeHash) throw new Error('will envelope idempotent duplicate');
  const willEnvelopeCollision=await willEnvelopePost({...willEnvelope,payload:{value:2}}); const collisionBody=await willEnvelopeCollision.json();
  if(willEnvelopeCollision.status!==409 || collisionBody.error!=='transport-envelope-id-conflict') throw new Error('will envelope id collision must return 409');
  const unknownWillAck=await fetch(`http://127.0.0.1:${port}/api/organism/will/ack`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({envelopeId:'does-not-exist-workpass10',accepted:true,at:201})});
  if(unknownWillAck.status!==404 || (await unknownWillAck.json()).error!=='transport-envelope-not-found') throw new Error('will unknown ACK must return 404');
  const validWillAck=await fetch(`http://127.0.0.1:${port}/api/organism/will/ack`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({envelopeId:willEnvelopeFirst.envelope.id,accepted:true,at:202})});
  if(validWillAck.status!==200 || !(await validWillAck.json()).ack?.ok) throw new Error('will valid ACK contract');
  const conflictingWillAck=await fetch(`http://127.0.0.1:${port}/api/organism/will/ack`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({envelopeId:willEnvelopeFirst.envelope.id,accepted:false,at:203,reason:'changed outcome'})});
  if(conflictingWillAck.status!==409 || (await conflictingWillAck.json()).error!=='transport-ack-conflict') throw new Error('will ACK conflict must return 409');
  const sdk=await (await fetch(`http://127.0.0.1:${port}/api/organism/will/sdk`)).json(); if(!sdk.ok || !sdk.sdk?.semantics?.includes('sense')) throw new Error('will sdk surface mismatch');
  const mcp=await (await fetch(`http://127.0.0.1:${port}/api/organism/will/mcp`)).json(); if(!mcp.ok || !mcp.mcp?.tools?.some(t=>t.name==='perceive')) throw new Error('will mcp surface mismatch');
  const mcpState=await (await fetch(`http://127.0.0.1:${port}/api/organism/will/mcp`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'state',arguments:{}}})})).json(); if(mcpState.error || mcpState.result?.state?.tick==null) throw new Error('will mcp call mismatch');
  const integrity=await (await fetch(`http://127.0.0.1:${port}/api/organism/will/integrity`)).json(); if(!integrity.ok || integrity.integrity?.ok!==true) throw new Error('will integrity endpoint mismatch');
  const integration=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/overview`)).json(); if(!integration.ok || !integration.lumina || !Array.isArray(integration.capabilities)) throw new Error('integration overview surface mismatch');
  const capabilities=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/capabilities?channel=ui`)).json(); if(!capabilities.ok || !capabilities.capabilities.some(x=>x.id==='memory.search.exact')) throw new Error('integration capability profile mismatch');
  const search=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/search?q=memory&k=4`)).json(); if(!search.ok || !Array.isArray(search.hits)) throw new Error('exact search surface mismatch');
  const idempotency=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/idempotency`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payload:{smoke:'once'}})})).json(); if(!idempotency.ok || idempotency.fresh!==true) throw new Error('idempotency first pass mismatch');
  const duplicate=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/idempotency`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:idempotency.key,payload:{smoke:'once'}})})).json(); if(!duplicate.ok || duplicate.fresh!==false) throw new Error('idempotency duplicate mismatch');
  const inboundTransportUrl=`http://127.0.0.1:${port}/api/organism/integration/transport`;
  const inboundTransportPost=(payload)=>fetch(inboundTransportUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const inboundTransport={id:'workpass10-inbound-key',channel:'http',externalId:'workpass10-external-id',from:'server-smoke',text:'same logical request',metadata:{source:'smoke'}};
  const inboundFirstResponse=await inboundTransportPost(inboundTransport); const inboundFirst=await inboundFirstResponse.json();
  if(inboundFirstResponse.status!==200 || !inboundFirst.ok || inboundFirst.replayed!==false) throw new Error('integration transport initial enqueue');
  const inboundReplayResponse=await inboundTransportPost(inboundTransport); const inboundReplay=await inboundReplayResponse.json();
  if(inboundReplayResponse.status!==200 || !inboundReplay.ok || inboundReplay.replayed!==true || inboundReplay.result?.envelope?.id!==inboundFirst.result?.envelope?.id) throw new Error('integration transport exact replay');
  const inboundCollisionResponse=await inboundTransportPost({...inboundTransport,text:'different message under same key'}); const inboundCollision=await inboundCollisionResponse.json();
  if(inboundCollisionResponse.status!==409 || inboundCollision.error!=='idempotency-key-conflict') throw new Error('integration transport key collision must return 409');
  const abandonedKey='workpass10-abandoned-operation';
  await fetch(`http://127.0.0.1:${port}/api/organism/integration/idempotency`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:abandonedKey})});
  const abandonedResponse=await inboundTransportPost({...inboundTransport,id:abandonedKey,externalId:'workpass10-abandoned-external'}); const abandonedBody=await abandonedResponse.json();
  if(abandonedResponse.status!==409 || abandonedBody.error!=='idempotency-outcome-unknown') throw new Error('integration transport must fail closed when prior outcome is unknown');
  const pma=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/pma`)).json(); if(!pma.ok || !pma.pma?.fingerprint) throw new Error('integration PMA surface mismatch');
  const pmaCheck=await (await fetch(`http://127.0.0.1:${port}/api/organism/integration/pma/validate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pma:pma.pma})})).json(); if(!pmaCheck.ok || pmaCheck.validation?.ok!==true) throw new Error('integration PMA validation mismatch');
  const voiceStatus=await (await fetch(`http://127.0.0.1:${port}/api/organism/voice/status`)).json(); if(!voiceStatus.ok || !voiceStatus.voice) throw new Error('voice interface surface mismatch');
  const voiceInterruptResponse=await fetch(`http://127.0.0.1:${port}/api/organism/voice/interrupt`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason:'server-smoke-idle'})}); const voiceInterrupt=await voiceInterruptResponse.json(); if(![200,202,503].includes(voiceInterruptResponse.status) || voiceInterrupt.ok===undefined || voiceInterrupt.playbackVerified!==false || !voiceInterrupt.status) throw new Error(`voice interrupt must report request status without claiming playback verification: HTTP ${voiceInterruptResponse.status} ${JSON.stringify(voiceInterrupt)}`);
  const badJson=await fetch(`http://127.0.0.1:${port}/api/organism/will/mcp`,{method:'POST',headers:{'content-type':'application/json'},body:'{bad'}); if(badJson.status!==400) throw new Error(`malformed-json:${badJson.status}`);
  const m=await (await fetch(`http://127.0.0.1:${port}/api/metrics`)).json(); if(!m.ok || !m.system?.integrity?.ok || !m.sensorium?.socialMind || typeof m.sensorium.socialMind.socialDemand01!=='number') throw new Error('metrics social-mind surface missing');
  const st=await (await fetch(`http://127.0.0.1:${port}/api/organism/status`)).json(); if(!st.cognition?.cognitiveField || st.cognition?.budget == null || !st.unifiedMemory || !st.socialDevelopment || !st.perception || !st.voice?.state) throw new Error('developmental/voice surface missing');
  const perception=await (await fetch(`http://127.0.0.1:${port}/api/organism/perception`)).json(); if(!perception.ok || perception.perception?.version !== 2) throw new Error('perception endpoint mismatch');
  const worldIdentity=await (await fetch(`http://127.0.0.1:${port}/api/organism/world-identity`)).json(); if(!worldIdentity.ok || worldIdentity.p24?.version !== 1 || worldIdentity.p24?.bodyWorld?.version !== 1) throw new Error('P24 world-identity endpoint mismatch');
  const scientific=await (await fetch(`http://127.0.0.1:${port}/api/organism/scientific-development`)).json(); if(!scientific.ok || scientific.p25?.version !== 1) throw new Error('P25 scientific-development endpoint mismatch');
  const experiment=await fetch(`http://127.0.0.1:${port}/api/organism/scientific-development/experiment`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'smoke',controlLabel:'A',treatmentLabel:'B',metric:'success',controlValue:.4,treatmentValue:.6,sampleSize:4,independentConditions:true})}); if(!experiment.ok) throw new Error('P25 experiment endpoint mismatch');
  const benchmark=await (await fetch(`http://127.0.0.1:${port}/api/organism/model-switch/benchmark`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:'smoke',backendA:'a',backendB:'b',responseA:'verify facts',responseB:'verify facts',latencyAms:10,latencyBms:12,constraints:['verify']})})).json(); if(!benchmark.ok || benchmark.trial?.requestId!=='smoke') throw new Error('P24 benchmark endpoint mismatch');
  const event=await fetch(`http://127.0.0.1:${port}/api/organism/event`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({detail:'server smoke event',importance:0.7})}); if(!event.ok) throw new Error('event endpoint');
  const avatar=await (await fetch(`http://127.0.0.1:${port}/api/organism/avatar`)).json(); if(!avatar.ok) throw new Error('avatar endpoint');
  const subject=await (await fetch(`http://127.0.0.1:${port}/api/organism/subject-continuity`)).json(); if(!subject.ok || subject.nonConsciousnessClaim!==true || !subject.subject || typeof subject.subject.bottleneck01!=='number') throw new Error('subject continuity endpoint');
  const subjectFidelity=await (await fetch(`http://127.0.0.1:${port}/api/organism/subject-fidelity`)).json(); if(!subjectFidelity.ok || subjectFidelity.readOnly!==true || subjectFidelity.behavioralEquivalenceClaim!==false || !['verified','partial','insufficient'].includes(subjectFidelity.report?.status)) throw new Error('portable subject fidelity endpoint');
  const memoryStrategy=await (await fetch(`http://127.0.0.1:${port}/api/organism/memory-strategy`)).json(); if(!memoryStrategy.ok || memoryStrategy.readOnly!==true || !memoryStrategy.diagnostics || !Number.isFinite(memoryStrategy.diagnostics.maxAbsoluteBias01)) throw new Error('adaptive memory strategy endpoint');
  const contextBudget=await (await fetch(`http://127.0.0.1:${port}/api/organism/context-budget`)).json(); if(!contextBudget.ok || contextBudget.readOnly!==true || contextBudget.report?.owner!=='LanguageOrgan' || !Array.isArray(contextBudget.report?.receipts)) throw new Error('language context budget endpoint');
  const knownEntities=await (await fetch(`http://127.0.0.1:${port}/api/organism/known-entities?limit=8`)).json(); if(!knownEntities.ok || knownEntities.readOnly!==true || knownEntities.report?.derivedProjection!==true || knownEntities.report?.writesCanonicalState!==false || !Array.isArray(knownEntities.report?.entities)) throw new Error('known entity dossier projection endpoint');
  const memoryBenchmark=await (await fetch(`http://127.0.0.1:${port}/api/organism/memory-benchmark`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({examples:[{id:'smoke-train',query:'server status',relevantIds:['missing-id'],split:'train'},null],options:{seed:19,bootstrapSamples:200,datasetProvenance:{datasetId:'server-smoke',datasetVersion:'1',sourceRef:'server-smoke-test',labelingProtocol:'single explicit synthetic smoke label'}}})})).json(); if(!memoryBenchmark.ok || memoryBenchmark.readOnly!==true || memoryBenchmark.report?.guardrails?.liveMemoryMutated!==false || memoryBenchmark.report?.promotion?.allowed!==false || memoryBenchmark.report?.datasetIntegrity?.unknownRelevantMemoryIdCount!==1 || memoryBenchmark.report?.datasetIntegrity?.droppedExamples!==1 || memoryBenchmark.report?.promotion?.reason!=='dataset-integrity-failed' || memoryBenchmark.report?.confidence?.seed!==19) throw new Error('memory retrieval benchmark dataset-integrity/no-promotion endpoint');
  const sensoriumStatus=await (await fetch(`http://127.0.0.1:${port}/api/organism/sensorium/status`)).json(); if(!sensoriumStatus.ok) throw new Error('organism sensorium status route mismatch');
  const embodiment=await (await fetch(`http://127.0.0.1:${port}/api/embodiment/status`)).json(); if(!embodiment.ok || !embodiment.modelPresent || !embodiment.corePresent || !embodiment.texturePresent) throw new Error('embodiment assets endpoint');
  const camera=await fetch(`http://127.0.0.1:${port}/api/organism/vision/capture-if-useful`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); const cameraBody=await camera.json(); if(!((camera.status===200 && cameraBody.skipped===true) || (camera.status===400 && cameraBody.error==='camera-capture-idempotency-key-required'))) throw new Error(`capture-if-useful must skip safely or require a key before physical capture: HTTP ${camera.status} ${JSON.stringify(cameraBody)}`);
  const socialMind=await (await fetch(`http://127.0.0.1:${port}/api/organism/social-mind`)).json(); if(!socialMind.ok || !socialMind.socialMind || !socialMind.diagnostics || typeof socialMind.diagnostics.socialDemand01!=='number') throw new Error('social-mind endpoint mismatch');
  const skills=await (await fetch(`http://127.0.0.1:${port}/api/organism/skills`)).json(); if(!skills.ok || !Array.isArray(skills.compoundSkills) || !Array.isArray(skills.deviceTools)) throw new Error('skills endpoint mismatch');
  const observer=await (await fetch(`http://127.0.0.1:${port}/api/organism/external-observer`)).json(); if(!observer.ok || observer.summary?.version!==2 || !Array.isArray(observer.causalAutobiography)) throw new Error('external observer endpoint mismatch');
  const reality=await (await fetch(`http://127.0.0.1:${port}/api/organism/persistent-reality`)).json(); if(!reality.ok || !reality.summary || !Array.isArray(reality.continuity)) throw new Error('persistent reality endpoint mismatch');
  const autobiography=await (await fetch(`http://127.0.0.1:${port}/api/organism/autobiographical-continuity`)).json(); if(!autobiography.ok || !autobiography.summary || !Array.isArray(autobiography.continuity)) throw new Error('autobiographical continuity endpoint mismatch');
  const observed=await fetch(`http://127.0.0.1:${port}/api/organism/external-observer/observe`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceId:'server-smoke',sourceClass:'device',channel:'sensor',claimKey:'smoke',observedPostcondition:'smoke=ok',confidence01:.95,expectedPostcondition:'smoke=ok'})}); if(!observed.ok) throw new Error('external observer ingestion endpoint');
  console.log('SERVER_SMOKE=PASS');
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)), new Promise(resolve=>setTimeout(resolve,1_500))]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)), new Promise(resolve=>setTimeout(resolve,1_000))]);
  }
  await rm(dir,{recursive:true,force:true});
}
