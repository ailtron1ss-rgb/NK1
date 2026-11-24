import assert from 'node:assert/strict';
import { DevelopmentalSynthesisEngine } from '../src/organism/learning/DevelopmentalSynthesisEngine.ts';

const state=(tick=1)=>({version:122,tick,at:Date.now(),needs:{energy:.76,cognitiveLoad:.2,uncertainty:.36,novelty:.58,socialNeed:.24,identityCoherence:.88,goalPressure:.52},predictionError:.15,attentionBudget:.84,lastAction:'explore',lastActionSuccess:.84,autonomyScore:.79,selfPredictionError:.14,predictedNextAction:'verify',lastPredictionConfidence:.83,worldContextVersion:1});
const promoted=(id,seq)=>({id,sequence:seq,occurrences:8,successes:7,verified:7,holdoutTrials:4,holdoutSuccesses:4,distinctContexts:4,contextKeys:['a','b','c','d'],success01:.86,holdout01:.82,retention01:.8,confidence01:.78,transfer01:.76,status:'promoted',promotedAt:1,lastAt:1,lastOutcome01:.9,lastContext:'d',consecutiveFailures:0,delayedSuccesses:3});
const samples=[]; for(let i=0;i<18;i++)samples.push({id:`s${i}`,at:i,tick:i,taskId:'t',action:i%2?'verify':'explore',before:new Array(16).fill(.6),after:new Array(16).fill(.65),outcome01:.86,reward01:.84,surprise01:.12,causalStrength01:.76,evidenceQuality01:.92,verified:true,independent:true,contextKey:`ctx-${i%6}`});

const e=new DevelopmentalSynthesisEngine();
const a=promoted('a',['explore','verify']); const b=promoted('b',['verify','reflect']);
const composed=e.synthesize([a,b],samples,.82);
assert.ok(composed.created>=1,JSON.stringify(composed));
const macro=e.snapshot().macros.find(x=>x.sequence.join('>')==='explore>verify>reflect');
assert.ok(macro);
for(let i=0;i<7;i++) e.observeMacro(macro.sequence,{contextKey:`holdout-${i}`,outcome01:.88,verified:true,independent:i%2===0,holdout:i>=2,delayed:i>=4,counterfactualSupport01:.84,at:10000+i*7000});
const diag=e.diagnostics();
assert.ok(diag.promoted>=1,JSON.stringify(diag));
const prior=e.prior('reflect',['explore','verify'],state(99),'new-task');
assert.equal(prior.eligible,true,JSON.stringify(diag));
assert.ok(prior.bias01>0);
e.notePrior(prior);
const decision=e.recordDecision({tick:100,chosen:'explore',predictedChosen01:.52,predictedAlternatives:[{action:'verify',utility01:.83},{action:'reflect',utility01:.61}],realized01:.38,at:20000});
assert.ok(decision.regret01>.2);
assert.ok(e.diagnostics().revisionPressure01>.18);
for(let i=0;i<2;i++) e.observeMacro(macro.sequence,{contextKey:`bad-${i}`,outcome01:.15,verified:true,independent:true,holdout:true,delayed:true,counterfactualSupport01:.2,at:40000+i*7000});
assert.equal(e.snapshot().macros.find(x=>x.id===macro.id)?.status,'blocked');
const restored=new DevelopmentalSynthesisEngine();restored.restore(e.snapshot());
assert.equal(restored.snapshot().macros.length,e.snapshot().macros.length);
assert.ok(restored.diagnostics().counterfactualRegret01>0);
console.log(`BIG_PASS_119=PASS macros=${diag.macros} promoted=${diag.promoted} priorBias=${prior.bias01.toFixed(4)} regret=${decision.regret01.toFixed(3)} blocked=${restored.diagnostics().blockedCount}`);
