import assert from 'node:assert/strict';
import { B391B400NeuralDevelopmentalIntegrationCore } from '../src/organism/system/B391B400NeuralDevelopmentalIntegrationCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=(i)=>({tick:i,context01:Array.from({length:8},(_,j)=>.18+((i*17+j*11)%68)/100),baseProbabilities:Object.fromEntries(actions.map((a,j)=>[a,j===1?.36:.106])),baseUtilities:Object.fromEntries(actions.map((a,j)=>[a,j===1?.78:j===2?.68:.45+j*.01])),energy01:.76,uncertainty01:.55,novelty01:.64,cognitiveLoad01:.22,autonomy01:.82,predictionError01:.18,goal:{id:'goal:understand',vector:[.74,.69,.68,.42,.82,.34,.38,.46],ownership01:.79,commitment01:.73},reward01:.5});
const core=new B391B400NeuralDevelopmentalIntegrationCore();
for(let i=1;i<=96;i++){
 const input=base(i); const d=core.beforeDecision(input); assert.equal(Object.keys(d.actionBias).length,7); assert.ok(d.integratedConfidence01>=0&&d.integratedConfidence01<=1);
 if(i%2===0) core.afterOutcome({tick:i,action:i%4===0?'verify':'explore',context01:input.context01,reward01:i%6===0?.18:.88,predictionError01:i%6===0?.62:.12,verified01:1,independent01:1,salience01:.72,goalId:'goal:understand',outcomeVector01:[.79,.86,.52,.70,.83,.18,.24,.62]});
}
const diag=core.diagnostics();
assert.ok(diag.development.experienceCount>=96);
assert.ok(diag.memory.consolidated>=40);
assert.ok(diag.prediction.updates>0);
assert.ok(diag.neural.cycles>0);
assert.ok(diag.goals.length>0);
const holdout=base(777); holdout.context01=[.92,.11,.88,.27,.76,.42,.69,.84];
const ko=core.evaluateKnockout(holdout); assert.ok(ko.causalDelta01>.01); assert.ok(ko.retrievalDelta01>=0);
const lesion=core.evaluateLesion(holdout,{neural:true}); assert.ok(lesion.delta01>.0001);
core.markUnseenEvaluation(.73);
const snap=core.snapshot(); const restored=new B391B400NeuralDevelopmentalIntegrationCore(); restored.restore(snap); restored.markRestart();
const rd=restored.diagnostics(); assert.equal(rd.memory.episodes.length,diag.memory.episodes.length); assert.equal(rd.development.experienceCount,diag.development.experienceCount); assert.equal(rd.goals.length,diag.goals.length);
console.log(JSON.stringify({pass:true,status:'B391_B400_NEURAL_DEVELOPMENTAL_INTEGRATION_PASS',experienceCount:rd.development.experienceCount,episodes:rd.memory.episodes.length,retrievals:rd.memory.retrievals,consolidated:rd.memory.consolidated,predictionUpdates:rd.prediction.updates,neuralCycles:rd.neural.cycles,goals:rd.goals.length,causalKnockout01:ko.causalDelta01,neuralLesion01:lesion.delta01,holdout01:rd.development.lastHoldout01,restarts:rd.development.restarts,integrity01:rd.development.lastIntegrity01},null,2));
