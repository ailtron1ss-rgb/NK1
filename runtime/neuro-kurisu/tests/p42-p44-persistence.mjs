import assert from 'node:assert/strict';
import { P42UnifiedEmbodiedExperienceEngine } from '../src/organism/cognition/P42UnifiedEmbodiedExperience.ts';
import { P43EmbodiedImageryWorkspace } from '../src/organism/cognition/P43EmbodiedImageryWorkspace.ts';
import { P44EmbodiedPredictiveSelfWorld } from '../src/organism/world/P44EmbodiedPredictiveSelfWorld.ts';
const input={at:100,scene:'lab',entityLabels:['screen','desk'],relationLabels:['self:near:desk'],eventLabels:['screen-on'],audioActivity01:.2,visionChange01:.4,bodyEnergy01:.8,thermal01:.2,cognitiveCapacity01:.9,uncertainty01:.25,novelty01:.5,agency01:.7,selfCoherence01:.9,goalPressure01:.3,externalText:true};
const a=new P42UnifiedEmbodiedExperienceEngine(); const x=a.integrate(input); const a2=new P42UnifiedEmbodiedExperienceEngine(); a2.restore(x); assert.deepEqual(a2.snapshot(),x);
const b=new P43EmbodiedImageryWorkspace(); const y=b.integrate({at:100,scene:'lab',selfLocation:'phone',objects:['screen','desk'],relations:['self:near:desk'],memoryLabels:['lab'],predictionLabels:['lab:verify'],goal:'learn'}); const b2=new P43EmbodiedImageryWorkspace(); b2.restore(y); assert.deepEqual(b2.snapshot(),y);
const c=new P44EmbodiedPredictiveSelfWorld(); c.observe(x.current.vector,'explore',x.current.vector,.8); const z=c.snapshot(); const c2=new P44EmbodiedPredictiveSelfWorld(); c2.restore(z); assert.deepEqual(c2.snapshot(),z);
console.log('P42_P44_PERSISTENCE=PASS');
