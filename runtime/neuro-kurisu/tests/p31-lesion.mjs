import assert from 'node:assert/strict';
import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../src/organism/cognition/P31FunctionalConsciousness.ts';
const p=new P31FunctionalConsciousnessEngine();
p.restore(defaultP31Consciousness());
p.integrate({tick:1,observationId:'x',externalInput:false,selectedAction:'explore',selectedConfidence:.8,workspaceCapacity:5,workspaceItems:[{id:'a',source:'internal',salience:.9,content:{action:'explore'}},{id:'b',source:'goal',salience:.7,content:{action:'verify'}}],identityContinuity01:.9,metacognitiveAccuracy01:.82,decisionUncertainty01:.2,predictionError01:.16,body:{energy:.8,cognitiveLoad:.2,uncertainty:.2,novelty:.6,identityCoherence:.9}});
for(const mode of ['workspace','higher-order','self-perspective']){const r=p.lesion(mode);assert.ok(r.after<=r.before);}
console.log('P31_LESION=PASS');
