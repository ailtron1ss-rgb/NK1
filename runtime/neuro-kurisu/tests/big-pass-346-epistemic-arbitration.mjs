import assert from 'node:assert/strict';
import { DecisionActionPipeline } from '../src/organism/core/DecisionActionPipeline.ts';
const pipeline = new DecisionActionPipeline();
const candidate = (action, score) => ({ id: action, action, score, predictedUtility: score, predictedNeedRelief: .2, predictedCost: .2, confidence: .6, generatedAt: Date.now() });
const learned = [
  { action:'explore', expectedReward01:.55, confidence01:.35, samples:0 },
  { action:'verify', expectedReward01:.62, confidence01:.91, samples:12 },
];
const out = pipeline.rank([candidate('explore', .70), candidate('verify', .699)], [], learned, { epistemicPressure01:.92, cognitiveLoad01:.12, externalRequested:false });
const ex = out.epistemic.find(x=>x.action==='explore');
const ver = out.epistemic.find(x=>x.action==='verify');
assert(ex && ver);
assert(ex.adjustment > 0);
assert(ex.adjustment > 0);
assert(ex.learnability01 >= 0 && ver.learnability01 >= 0);
assert(ex.cost01 >= 0 && ver.cost01 >= 0);
assert(out.candidates[0].action === 'explore');
const blocked = pipeline.rank([candidate('explore', .70), candidate('verify', .699)], [], learned, { epistemicPressure01:.92, cognitiveLoad01:.12, externalRequested:true });
assert(blocked.epistemic.every(x=>x.adjustment === 0));
console.log('B346_EPISTEMIC_ARBITRATION=PASS', JSON.stringify({epistemic:out.epistemic, top:out.candidates[0].action, blocked:blocked.epistemic},null,2));
