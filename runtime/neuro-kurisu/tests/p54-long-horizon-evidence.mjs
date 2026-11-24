import assert from 'node:assert/strict';
import { P54LongHorizonEvidence } from '../src/organism/developmental/P54LongHorizonEvidence.ts';
const e=new P54LongHorizonEvidence();
for(let i=1;i<=24;i++) e.observe({tick:i,at:i,predictionError01:.6-.01*i,selfPredictionError01:.1,identity01:.9,grounding01:.8,causalAlignment01:.75});
const s=e.summary(); assert.equal(s.windows,2); assert.ok(s.stability01>.8); assert.ok(s.currentError01<.5); console.log('p54 long-horizon evidence PASS');
