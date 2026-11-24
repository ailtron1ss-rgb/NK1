import assert from 'node:assert/strict';
import { P42UnifiedEmbodiedExperienceEngine } from '../src/organism/cognition/P42UnifiedEmbodiedExperience.ts';
const p=new P42UnifiedEmbodiedExperienceEngine(); const start=performance.now();
for(let i=0;i<10000;i++) p.integrate({at:i,scene:i%2?'lab':'home',entityLabels:['screen','desk'],relationLabels:['self:near:desk'],eventLabels:['screen-on'],audioActivity01:i%10/10,visionChange01:i%7/7,bodyEnergy01:.8,thermal01:.2,cognitiveCapacity01:.9,uncertainty01:.3,novelty01:.4,agency01:.7,selfCoherence01:.9,goalPressure01:.2,externalText:false});
const ms=performance.now()-start; assert.ok(ms<5000); console.log('P42_P44_PERFORMANCE=PASS cycles=10000 ms='+ms.toFixed(1));
