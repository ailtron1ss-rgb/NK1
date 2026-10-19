import assert from 'node:assert/strict';
import { P41NativePerceptionEngine } from '../src/organism/cognition/P41NativePerception.ts';

const p = new P41NativePerceptionEngine();
const sine = Array.from({length:4096}, (_,i)=>Math.sin(2*Math.PI*440*i/16000)*0.9);
const silence = Array.from({length:2048}, ()=>0);
const rgb = [];
for (let i=0;i<64*48;i++) { rgb.push(235,235,235); }
const first = p.ingest({audio:{samples:sine,sampleRate:16000},vision:{rawRgb:rgb,width:64,height:48},at:1000});
assert.equal(first.audioFrames,1);
assert.equal(first.imageFrames,1);
assert.ok(first.lastAudio?.activity01 > 0.05);
assert.ok(first.lastImage?.brightness01 > 0.7);
assert.ok(first.semanticCues.some(c=>c.label==='audio-activity') || first.semanticCues.some(c=>c.label==='high-frequency-activity'));
assert.ok(first.semanticCues.some(c=>c.label==='bright-scene'));
const second = p.ingest({audio:{samples:silence,sampleRate:16000},vision:{rawRgb:rgb,width:64,height:48},at:2000});
assert.equal(second.audioFrames,2);
assert.ok(second.semanticCues.some(c=>c.label==='audio-silence'));
assert.ok(second.metrics.nativeCoverage01 > 0);
console.log('P41_NATIVE_PERCEPTION=PASS');
console.log(`audioActivity=${second.metrics.audioActivity01.toFixed(3)} visionChange=${second.metrics.visionChange01.toFixed(3)} cues=${second.semanticCues.length}`);
