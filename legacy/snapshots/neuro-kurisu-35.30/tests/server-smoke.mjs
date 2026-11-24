import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const dir=await mkdtemp(path.join(tmpdir(),'nk-server-')); const port=32000 + Math.floor(Math.random()*3000);
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:dir};
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:path.resolve(process.cwd()),env,stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
try {
  let healthy=false; for(let i=0;i<300;i++){ await new Promise(r=>setTimeout(r,100)); try{ const r=await fetch(`http://127.0.0.1:${port}/api/health`); const h=await r.json(); if(r.ok && h.ready===true){healthy=true; break;} }catch{} }
  if(!healthy) throw new Error(`server did not become healthy: ${output.slice(-500)}`);
  const root=await (await fetch(`http://127.0.0.1:${port}/`)).text(); if(!root.includes('Neuro‑Kurisu') && root.includes('Unified Organism')) throw new Error('UI release marker mismatch');
  const h=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  if(h.version!==RELEASE_CONTRACT.application || h.organismCore!==RELEASE_CONTRACT.organismCore || h.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('server release contract mismatch');
  const lite=await (await fetch(`http://127.0.0.1:${port}/api/organism/status-lite`)).json(); if(!lite.ok || !lite.voice?.state || !Object.prototype.hasOwnProperty.call(lite.voice,'plan')) throw new Error('status-lite voice surface missing');
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
  const embodiment=await (await fetch(`http://127.0.0.1:${port}/api/embodiment/status`)).json(); if(!embodiment.ok || !embodiment.modelPresent || !embodiment.corePresent || !embodiment.texturePresent) throw new Error('embodiment assets endpoint');
  const camera=await fetch(`http://127.0.0.1:${port}/api/organism/vision/capture`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); if(![200,503].includes(camera.status)) throw new Error(`camera:${camera.status}`);
  const socialMind=await (await fetch(`http://127.0.0.1:${port}/api/organism/social-mind`)).json(); if(!socialMind.ok || !socialMind.socialMind || !socialMind.diagnostics || typeof socialMind.diagnostics.socialDemand01!=='number') throw new Error('social-mind endpoint mismatch');
  const skills=await (await fetch(`http://127.0.0.1:${port}/api/organism/skills`)).json(); if(!skills.ok || !Array.isArray(skills.compoundSkills) || !Array.isArray(skills.deviceTools)) throw new Error('skills endpoint mismatch');
  const observer=await (await fetch(`http://127.0.0.1:${port}/api/organism/external-observer`)).json(); if(!observer.ok || observer.summary?.version!==2 || !Array.isArray(observer.causalAutobiography)) throw new Error('external observer endpoint mismatch');
  const reality=await (await fetch(`http://127.0.0.1:${port}/api/organism/persistent-reality`)).json(); if(!reality.ok || !reality.summary || !Array.isArray(reality.continuity)) throw new Error('persistent reality endpoint mismatch');
  const autobiography=await (await fetch(`http://127.0.0.1:${port}/api/organism/autobiographical-continuity`)).json(); if(!autobiography.ok || !autobiography.summary || !Array.isArray(autobiography.continuity)) throw new Error('autobiographical continuity endpoint mismatch');
  const observed=await fetch(`http://127.0.0.1:${port}/api/organism/external-observer/observe`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceId:'server-smoke',sourceClass:'device',channel:'sensor',claimKey:'smoke',observedPostcondition:'smoke=ok',confidence01:.95,expectedPostcondition:'smoke=ok'})}); if(!observed.ok) throw new Error('external observer ingestion endpoint');
  console.log('SERVER_SMOKE=PASS');
} finally { child.kill('SIGTERM'); await new Promise(r=>setTimeout(r,400)); await rm(dir,{recursive:true,force:true}); }
