import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.34+i*.04]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>task===0?Math.sin(k*.11+t*.031)*.42:Math.cos(k*.083+t*.027)*.38+Math.sin(k*.17)*.07);
const decision=(b,task,t)=>b.beforeDecision({tick:t,input:vec(task,t),baseUtilities:utilities,predictionError01:task?.30:.16,novelty01:task?.70:.18,uncertainty01:task?.54:.16,homeostasis01:.45,identityGap01:task?.32:.15,goalPressure01:task?.52:.32,reward01:.55,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.17+t*.01)+task*.22)});

function run(experimental){
 const b=new NeuralExperienceBranch();b.setExperimentalLayerEnabled(experimental);
 let updates=0;
 for(let t=0;t<72;t++){const task=t<24?0:t<48?1:0;const r=decision(b,task,t);b.afterOutcome({tick:t+1,action:task?'explore':'respond',reward01:task?.78:.82,predictionError01:task?.22:.12,verified01:.92,nextInput:vec(task,t+1),holdout01:t%3===0?1:0,goalPressure01:task?.52:.32,identityGap01:task?.32:.15});updates+=1;}
 const d=b.diagnostics();
 return {b,d,updates,adaptive:d.adaptiveLifelong,weights:d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)};
}
const exp=run(true),ctl=run(false);
assert.equal(exp.d.version,25);
assert.ok(exp.adaptive.outcomes>=72);
assert.ok(exp.adaptive.contextNovelty01>=0 && exp.adaptive.contextNovelty01<=1);
assert.ok(exp.adaptive.sparseUpdateFraction01<.7);
assert.ok(exp.adaptive.delayConfidence01>=0 && exp.adaptive.delayConfidence01<=1);
assert.ok(Math.abs(exp.weights-ctl.weights)>.001,'experimental path must alter trajectory');
const snap=exp.b.diagnostics();const resumed=new NeuralExperienceBranch();resumed.restore(snap);const r=resumed.diagnostics();assert.equal(r.version,25);assert.ok(r.adaptiveLifelong.outcomes>=72);
console.log(`P2720_ADAPTIVE_LIFELONG=PASS outcomes=${exp.adaptive.outcomes} contextNovelty=${exp.adaptive.contextNovelty01.toFixed(4)} match=${exp.adaptive.contextMatch01.toFixed(4)} sparse=${exp.adaptive.sparseUpdateFraction01.toFixed(4)} protected=${exp.adaptive.protectedFraction01.toFixed(4)} delayConf=${exp.adaptive.delayConfidence01.toFixed(4)} modelConf=${exp.adaptive.modelConfidence01.toFixed(4)} trajectoryDiff=${Math.abs(exp.weights-ctl.weights).toFixed(4)} restartOutcomes=${r.adaptiveLifelong.outcomes}`);
