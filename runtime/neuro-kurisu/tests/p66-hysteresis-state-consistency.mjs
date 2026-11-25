import assert from 'node:assert/strict';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';
const p=new P66InteroceptiveHomeostasis(),base=Date.now()-20_000;
const observe=(tick,at,novelty01)=>p.observe({tick,at,energy01:.8,thermal01:.2,capacity01:.8,load01:.2,awake:true,uncertainty01:.1,predictionError01:.1,novelty01});
observe(1,base,.8);const result=observe(2,base+5_000,.8),s=p.snapshot();
assert.equal(result.mode,s.lastMode);assert.equal(s.history[0].mode,result.mode);assert.equal(s.modeCounts[result.mode],2);
console.log('P66_HYSTERESIS_STATE_CONSISTENCY=PASS');
