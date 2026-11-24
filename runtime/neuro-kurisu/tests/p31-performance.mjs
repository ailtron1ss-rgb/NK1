import assert from 'node:assert/strict';
import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../src/organism/cognition/P31FunctionalConsciousness.ts';
const p=new P31FunctionalConsciousnessEngine();p.restore(defaultP31Consciousness());
const start=Date.now();
for(let i=0;i<10000;i++){
  p.integrate({tick:i,observationId:`o-${i}`,externalInput:i%3===0,selectedAction:i%2?'explore':'verify',selectedConfidence:.7,workspaceCapacity:5,workspaceItems:[{id:'a',source:'goal',salience:.8,content:{action:'explore'}},{id:'b',source:'body',salience:.4,content:{action:'rest'}}],identityContinuity01:.85,metacognitiveAccuracy01:.75,decisionUncertainty01:.25,predictionError01:.2,body:{energy:.7,cognitiveLoad:.3,uncertainty:.25,novelty:.5,identityCoherence:.86}});
}
const ms=Date.now()-start;assert.ok(ms<5000);
console.log(`P31_PERFORMANCE=PASS cycles=10000 ms=${ms}`);
