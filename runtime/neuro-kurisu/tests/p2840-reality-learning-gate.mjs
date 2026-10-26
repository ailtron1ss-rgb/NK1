import assert from 'node:assert/strict';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';

const gate=new RealityLearningGate();
const sim=gate.decide({source:'simulation',evidence01:.18,verified01:0,independent01:0,consequence01:.18,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8});
const externalWeak=gate.decide({source:'external',evidence01:.44,verified01:0,independent01:1,consequence01:.08,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:true,resource01:.8});
const externalStrong=gate.decide({source:'external',evidence01:.96,verified01:1,independent01:1,consequence01:.9,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8});
assert(sim.learningScale01 < externalWeak.learningScale01);
assert(externalWeak.learningScale01 < externalStrong.learningScale01);
assert(externalWeak.identityUpdateScale01 < .4);
assert(externalStrong.identityUpdateScale01 > .5);

 // Persistence must not hydrate NaN counters, invalid scores, or malformed decisions.
 const restored = new RealityLearningGate();
 restored.restore({
   decisions: -7,
   externalDecisions: 2,
   simulationDecisions: 3,
   attenuatedDecisions: 999,
   strongDecisions: Number.NaN,
   meanLearningScale01: Number.NaN,
   meanNeuralUpdateScale01: Number.POSITIVE_INFINITY,
   meanWorldModelUpdateScale01: 2,
   meanMemoryPromotionScale01: -1,
   meanIdentityUpdateScale01: 'bad',
   last: { ...externalStrong, identityUpdateScale01: Number.POSITIVE_INFINITY },
   history: [
     { ...externalStrong, reason: 'newest-valid' },
     { ...sim, reason: 'older-valid' },
     { ...sim, learningScale01: Number.NaN, reason: 'poisoned-score' },
     { ...sim, source: 'untrusted-source', reason: 'invalid-source' },
     null,
   ],
 });
 const restoredSnapshot = restored.snapshot();
 assert.equal(restoredSnapshot.decisions, 5, 'decision count must cover valid source counters');
 assert.equal(restoredSnapshot.externalDecisions, 2);
 assert.equal(restoredSnapshot.simulationDecisions, 3);
 assert.equal(restoredSnapshot.attenuatedDecisions, 5, 'subset counters must not exceed total decisions');
 assert.equal(restoredSnapshot.strongDecisions, 0, 'invalid counters fall back to safe defaults');
 assert.equal(restoredSnapshot.meanLearningScale01, .42);
 assert.equal(restoredSnapshot.meanNeuralUpdateScale01, .42);
 assert.equal(restoredSnapshot.meanWorldModelUpdateScale01, 1, 'finite out-of-range scores are clamped');
 assert.equal(restoredSnapshot.meanMemoryPromotionScale01, 0);
 assert.equal(restoredSnapshot.meanIdentityUpdateScale01, .20);
 assert.equal(restoredSnapshot.last?.reason, 'newest-valid', 'invalid last decision falls back to newest valid history item');
 assert.deepEqual(restoredSnapshot.history.map(row => row.reason), ['newest-valid', 'older-valid']);
 const postRestore = restored.decide({
   source:'simulation',evidence01:.2,verified01:0,independent01:0,consequence01:.1,
   predictionError01:.4,surprise01:.2,reward01:.7,success01:.8,actuation:false,resource01:.7,
 });
 assert(Object.values(postRestore).filter(value => typeof value === 'number').every(Number.isFinite));
 assert(Object.values(restored.diagnostics()).filter(value => typeof value === 'number').every(Number.isFinite),
   'a restored gate must keep all diagnostic aggregates finite');

 // Runtime histories are newest-first; restore must retain their head, not the old tail.
 const longHistory = Array.from({length:300}, (_, index) => ({ ...sim, reason: `decision-${index}` }));
 const bounded = new RealityLearningGate();
 bounded.restore({ history: longHistory });
 assert.equal(bounded.snapshot().history.length, 256);
 assert.equal(bounded.snapshot().history[0]?.reason, 'decision-0');
 assert.equal(bounded.snapshot().history[255]?.reason, 'decision-255');
console.log(JSON.stringify({ok:true,sim,externalWeak,externalStrong,diagnostics:gate.diagnostics()}));
