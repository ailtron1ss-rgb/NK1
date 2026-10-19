import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { speakViaTermuxWithOutcome, interruptTermuxTtsWithOutcome } from '../src/organism/body/AndroidEmbodimentBridge.ts';

const originalPath=process.env.PATH;
const originalMode=process.env.NK_TTS_MODE;
const originalLog=process.env.NK_TTS_LOG;
const temp=await mkdtemp(path.join(os.tmpdir(),'nk-workpass69-tts-'));
const shim=path.join(temp,'termux-tts-speak');
const log=path.join(temp,'calls.log');
try {
  await writeFile(shim,`#!/bin/sh\nprintf '%s\\n' "$1" >> "$NK_TTS_LOG"\ncase "$NK_TTS_MODE" in wait) exec sleep 20;; success) exit 0;; *) exit 21;; esac\n`,'utf8');
  await chmod(shim,0o755);
  process.env.PATH=`${temp}:/usr/bin:/bin`;
  process.env.NK_TTS_LOG=log;
  process.env.NK_TTS_MODE='wait';
  const activeSpeak=speakViaTermuxWithOutcome('first utterance',{},8000,'speech-target-a');
  let started=false;
  for(let i=0;i<100;i++){
    try { const v=await readFile(log,'utf8'); if(v.trim()){started=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(started,true,'fake TTS process should start before overlap probes');
  const concurrent=await speakViaTermuxWithOutcome('must not overlap',{},1000,'speech-target-b');
  assert.equal(concurrent.status,'not-started');
  assert.equal(concurrent.reason,'prior-tts-process-still-unresolved');
  const wrongTarget=await interruptTermuxTtsWithOutcome('speech-target-b',200);
  assert.equal(wrongTarget.status,'unknown');
  assert.match(wrongTarget.reason,/target-mismatch/);
  const interrupted=await interruptTermuxTtsWithOutcome('speech-target-a',1500);
  assert.equal(interrupted.status,'requested');
  assert.equal(interrupted.operationId,'speech-target-a');
  assert.equal(interrupted.processExited,true);
  assert.equal(interrupted.playbackVerified,false);
  const originalOutcome=await activeSpeak;
  assert.equal(originalOutcome.status,'unknown','SIGTERM of a live speech process does not prove whether audio reached the listener');
  assert.match(originalOutcome.reason,/uncertain-playback/);
  process.env.NK_TTS_MODE='success';
  const next=await speakViaTermuxWithOutcome('after cleanup',{},1000,'speech-target-c');
  assert.equal(next.status,'completed','new speech can start after the original process is definitively closed');
  console.log('WORKPASS69_TTS_CONCURRENCY=PASS no-implicit-cancel=true target-bound-interrupt=true playback-unverified=true');
} finally {
  process.env.PATH=originalPath;
  if(originalMode===undefined) delete process.env.NK_TTS_MODE; else process.env.NK_TTS_MODE=originalMode;
  if(originalLog===undefined) delete process.env.NK_TTS_LOG; else process.env.NK_TTS_LOG=originalLog;
  await rm(temp,{recursive:true,force:true});
}
