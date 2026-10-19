import assert from 'node:assert/strict';
import { P58CognitiveKernel } from '../src/organism/cognition/P58CognitiveKernel.ts';
import { P59MemoryOperatingSystem } from '../src/organism/developmental/P59MemoryOperatingSystem.ts';
import { P60IdentityGuardian } from '../src/organism/system/P60IdentityGuardian.ts';

const kernel=new P58CognitiveKernel();
const frame=kernel.integrate(1,Date.now(),{identity01:.9,workspace01:.8,metacognitive01:.8,predictionError01:.65,uncertainty01:.7,novelty01:.75,grounding01:.72,causal01:.7,bodyEnergy01:.8,thermal01:.2,cognitiveCapacity01:.8,memoryPressure01:.2,socialNeed01:.3,goalPressure01:.5,realityGap01:.45});
assert.equal(frame.tick,1);
assert.ok(Object.keys(frame.actionBias).length===7);
assert.ok(frame.reasons.length>0);
const snap=kernel.snapshot(); const restored=new P58CognitiveKernel(); restored.restore(snap); assert.equal(restored.snapshot().cycles,1);

const mem=new P59MemoryOperatingSystem();
const plan=mem.plan({tick:1,at:Date.now(),eventCount:10,memoryCount:1200,retrievalHits:6,predictionError01:.5,identity01:.88,goalPressure01:.6,novelty01:.3,uncertainty01:.4});
assert.ok(['maintenance','encode','reconsolidate','compress','protect'].includes(plan.mode));
const ms=new P59MemoryOperatingSystem(); ms.restore(mem.snapshot()); assert.equal(ms.snapshot().cycles,1);

const guardian=new P60IdentityGuardian();
assert.equal(guardian.evaluate({continuity01:.92,drift01:.06,valueContinuity01:.9,goalContinuity01:.88,memoryContinuity01:.92,authorship01:.8,candidateRisk01:.1}), 'allow');
assert.equal(guardian.evaluate({continuity01:.55,drift01:.55,valueContinuity01:.5,goalContinuity01:.5,memoryContinuity01:.5,authorship01:.5,candidateRisk01:.8}), 'veto');
const gs=guardian.snapshot(); const gr=new P60IdentityGuardian(); gr.restore(gs); assert.equal(gr.snapshot().checks,2);
console.log('P58_P59_P60=PASS');
