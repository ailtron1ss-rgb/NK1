import assert from 'node:assert/strict';
import { P40SemanticIntelligenceEngine } from '../src/organism/cognition/P40SemanticIntelligence.ts';
const e=new P40SemanticIntelligenceEngine(); const start=Date.now();
for(let i=0;i<10000;i++) e.ingest({scene:i%2?'lab':'home',agreement01:.7,uncertainty01:.3,claims:[{modality:'world',subject:'organism',predicate:'in-scene',object:i%2?'lab':'home',confidence01:.7}]},false);
const ms=Date.now()-start; assert.ok(ms<1500,`P40 performance regression: ${ms}ms`); console.log(`P40_PERFORMANCE=PASS ms=${ms}`);
