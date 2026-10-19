import assert from 'node:assert/strict';
import { P41NativePerceptionEngine } from '../src/organism/cognition/P41NativePerception.ts';
const p=new P41NativePerceptionEngine();
const s=p.ingest({audio:{samples:[0,0,0,0],sampleRate:16000},vision:{features:[.1,.2]}});
const text=JSON.stringify(s);
assert.match(text,/native-signal/);
assert.doesNotMatch(text,/human-level|sentient|consciousness-proven/i);
console.log('P41_TRUTHFULNESS=PASS');
