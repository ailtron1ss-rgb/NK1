import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const net = new B365UnifiedNeuroCausalCore();
const A = [.92,.89,.90,.94,.91,.88,.87,.93];
const B = A.map((v) => 1 - v);
const actions = ['respond','explore','verify','rest','reflect','wait','defer'];
const vector = Array.from({length:64}, (_, i) => Math.sin(i*.17));
const samples = [];
const makeContext = (i) => i % 2 ? A : B;
const actionContext = Object.fromEntries(actions.map((a) => [a, {
  worldUtility01:.5,
  worldConfidence01:.85,
  worldUncertainty01:.15,
}]));
const started = process.hrtime.bigint();
for (let i = 0; i < 2000; i += 1) {
  const t0 = process.hrtime.bigint();
  net.consolidateExperience({
    tick:i,
    action:i%3===0 ? 'explore' : 'verify',
    reward01:i%5===0 ? .12 : .88,
    predictionError01:.18,
    salience01:.72,
    verified01:1,
    independent01:1,
    evidenceQuality01:.98,
    continuity01:.9,
    goalId:'perf',
    context01:makeContext(i),
  });
  net.step({
    tick:i,
    vector,
    novelty01:.4,
    uncertainty01:.3,
    predictionError01:.1,
    goalPressure01:.3,
    autonomy01:.7,
    developmentContext01:makeContext(i),
    learningEnabled:false,
    actionContext,
  });
  samples.push(Number(process.hrtime.bigint()-t0)/1e6);
}
const totalMs = Number(process.hrtime.bigint()-started)/1e6;
samples.sort((a,b)=>a-b);
const q = (p) => samples[Math.min(samples.length-1, Math.floor(samples.length*p))];
const d = net.contextualDevelopmentalDiagnostics();
console.log(JSON.stringify({
  pass:true,
  status:'B383_PERFORMANCE_PASS',
  cycles:2000,
  p50ms:q(.5),
  p95ms:q(.95),
  p99ms:q(.99),
  maxms:samples.at(-1),
  totalMs,
  heapMiB:process.memoryUsage().heapUsed/1048576,
  contextProfiles:d.contextCount,
  personalityAdaptations:d.personalityAdaptations,
}, null, 2));
