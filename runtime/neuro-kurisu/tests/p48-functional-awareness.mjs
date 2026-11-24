import assert from 'node:assert/strict';
import { P48FunctionalAwarenessCore, defaultP48State } from '../src/organism/cognition/P48FunctionalAwarenessCore.ts';

const p=new P48FunctionalAwarenessCore();
p.restore(defaultP48State());
const s=p.step({now:1000,attention01:.82,predictionError01:.22,identityContinuity01:.91,metacognitiveAccuracy01:.84,confidence01:.78,revisionReadiness01:.18,agency01:.72,recurring01:.66,workspaceItems:[{id:'a',source:'decision',salience:.92,content:{action:'verify'}},{id:'b',source:'memory',salience:.52,content:{action:'reflect'}}],body:{energy01:.78,thermal01:.21,capacity01:.79,sensoryFreshness01:.72,awake:true}});
assert.equal(s.version,1); assert.equal(s.cycles,1); assert.equal(s.workspaceCapacity,5); assert.ok(s.ignitionCount>=1); assert.ok(s.higherOrder.selfRepresentation01>.6); assert.ok(s.interoception.freeEnergyProxy01<.5); assert.equal(s.indicators.length,10);
const before=p.snapshot();
p.step({now:2000,attention01:.3,predictionError01:.8,identityContinuity01:.5,metacognitiveAccuracy01:.35,confidence01:.9,revisionReadiness01:.8,agency01:.4,recurring01:.15,workspaceItems:[{id:'x',source:'surprise',salience:.2,content:{}}],body:{energy01:.22,thermal01:.83,capacity01:.25,sensoryFreshness01:.18,awake:false},sleepPressure01:.86});
const after=p.snapshot(); assert.ok(after.interoception.freeEnergyProxy01>before.interoception.freeEnergyProxy01); assert.ok(after.higherOrder.monitoringLag01>=before.higherOrder.monitoringLag01); assert.equal(after.indicators.find(i=>i.domain==='causal-integration')?.causalEvidence01, 0);
console.log('P48 FUNCTIONAL AWARENESS PASS');
