import { B295AdaptiveCognitiveBudget } from '../src/organism/system/B295AdaptiveCognitiveBudget.ts';

const b = new B295AdaptiveCognitiveBudget();
let seen = new Set();
for (let tick = 1; tick <= 1200; tick++) {
  const profile = tick % 3 === 0 ? 'mobile' : tick % 3 === 1 ? 'balanced' : 'quality';
  const phase=tick%240;
  const protect=phase<30;
  const deep=phase>=90 && phase<125;
  const explore=phase>=125 && phase<185;
  const economy=phase>=185 && phase<220;
  const p = b.plan({
    tick, profile,
    energy01: protect ? .18 : economy ? .45 : .76,
    thermal01: protect ? .84 : deep ? .28 : .22,
    cognitiveLoad01: protect ? .88 : economy ? .62 : deep ? .42 : .22,
    uncertainty01: deep||explore ? .68 : economy ? .42 : .20,
    novelty01: deep||explore ? .82 : .24,
    goalPressure01: deep||explore ? .84 : economy ? .55 : .24,
    predictionError01: deep||explore ? .86 : economy ? .48 : .12,
    externalInput01: tick % 17 === 0 ? 0.8 : 0.2,
    autonomy01: deep||explore ? .82 : .52,
    eventLineage01: Math.min(1, tick / 160),
    causalConfidence01: Math.min(1, 0.25 + tick / 1100),
    memoryLoad01: Math.min(1, tick / 900)
  });
  seen.add(p.mode);
  if (tick % 4 === 0) b.observeOutcome({tick,cost01:p.mode === 'deep' ? 0.64 : 0.28,utility01:p.mode === 'deep' ? 0.78 : 0.54,predictionError01:0.2,accepted01:true});
  for (const [name, c] of Object.entries(p.cadence)) {
    if (!(Number.isInteger(c) && c >= 1 && c <= 1024)) throw new Error(`bad cadence ${name}=${c}`);
  }
  if (!(p.budget01 >= 0 && p.budget01 <= 1 && p.neuralIntensity01 >= 0 && p.neuralIntensity01 <= 1)) throw new Error('budget bounds');
}
const targeted=[
  {tick:2001,profile:'quality',energy01:.78,thermal01:.28,cognitiveLoad01:.38,uncertainty01:.72,novelty01:.86,goalPressure01:.9,predictionError01:.9,externalInput01:.2,autonomy01:.85,eventLineage01:1,causalConfidence01:.9,memoryLoad01:.3},
  {tick:2002,profile:'mobile',energy01:.16,thermal01:.88,cognitiveLoad01:.9,uncertainty01:.55,novelty01:.4,goalPressure01:.5,predictionError01:.5,externalInput01:.1,autonomy01:.4,eventLineage01:.7,causalConfidence01:.6,memoryLoad01:.8},
  {tick:2003,profile:'quality',energy01:.75,thermal01:.2,cognitiveLoad01:.2,uncertainty01:.78,novelty01:.8,goalPressure01:.88,predictionError01:.78,externalInput01:.15,autonomy01:.82,eventLineage01:.95,causalConfidence01:.9,memoryLoad01:.2},
  {tick:2004,profile:'mobile',energy01:.35,thermal01:.35,cognitiveLoad01:.75,uncertainty01:.55,novelty01:.25,goalPressure01:.3,predictionError01:.2,externalInput01:.1,autonomy01:.5,eventLineage01:.5,causalConfidence01:.3,memoryLoad01:.95}
];
for(const q of targeted) seen.add(b.plan(q).mode);
const d = b.diagnostics();
if (seen.size < 3) throw new Error(`insufficient policy diversity: ${[...seen]}`);
if (d.decisions !== 1204) throw new Error('decision count mismatch');
if (d.costEma01 <= 0 || d.utilityEma01 <= 0) throw new Error('outcome learning not observed');
console.log(JSON.stringify({pass:true, decisions:d.decisions, modes:[...seen].sort(), budget01:d.budget01, computeDebt01:d.computeDebt01, utilityEma01:d.utilityEma01, costEma01:d.costEma01, protectedCycles:d.protectedCycles, deepCycles:d.deepCycles}, null, 2));
