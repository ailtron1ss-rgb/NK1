import assert from 'node:assert/strict';
import { P42UnifiedEmbodiedExperienceEngine } from '../src/organism/cognition/P42UnifiedEmbodiedExperience.ts';
const p=new P42UnifiedEmbodiedExperienceEngine();
p.integrate({at:1,scene:'lab',entityLabels:['desk','screen'],relationLabels:['self:near:desk'],eventLabels:['screen-on'],audioActivity01:.1,visionChange01:.05,bodyEnergy01:.8,thermal01:.2,cognitiveCapacity01:.9,uncertainty01:.2,novelty01:.4,agency01:.7,selfCoherence01:.9,goalPressure01:.3,externalText:true});
const s=p.integrate({at:2,scene:'lab',entityLabels:['desk','screen'],relationLabels:['self:near:desk'],eventLabels:['screen-on'],audioActivity01:.8,visionChange01:.55,bodyEnergy01:.78,thermal01:.22,cognitiveCapacity01:.86,uncertainty01:.45,novelty01:.65,agency01:.72,selfCoherence01:.9,goalPressure01:.4,externalText:false});
assert.equal(s.tick,2); assert.ok(s.history.length===2); assert.ok(s.metrics.integration01>.1); assert.ok(s.current.surprise01>=0); assert.ok(signedFinite(Object.values(s.actionBias)));
console.log('P42_UNIFIED_EXPERIENCE=PASS',JSON.stringify({tick:s.tick,salience:s.current.salience01.toFixed(3),surprise:s.current.surprise01.toFixed(3),integration:s.metrics.integration01.toFixed(3)}));
function signedFinite(v){return v.every(x=>Number.isFinite(x));}
