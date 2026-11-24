import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P80UnifiedSelfState } from '../src/organism/cognition/P80UnifiedSelfState.ts';
import { P81PredictiveAttention } from '../src/organism/cognition/P81PredictiveAttention.ts';
import { P82RealityProgressController } from '../src/organism/system/P82RealityProgressController.ts';

test('P80 builds a coherent self-state and resists action monotony', () => {
  const self = new P80UnifiedSelfState();
  for (let i=0;i<10;i++) self.update({tick:i,mode:'explore',identity01:.92,memoryContinuity01:.9,realityGap01:.3,predictionError01:.2,uncertainty01:.3,energy01:.8,cognitiveCapacity01:.9,goalPressure01:.4,grounding01:.85,causal01:.82,workspace01:.8,action:'explore',actionScore01:.65,externalInput:false,novelty01:.42});
  const s=self.snapshot();
  assert.equal(s.cycles,10); assert.equal(s.modeStreak,10); assert.ok(s.noveltyPressure01>.2); assert.ok(self.actionBias('explore')<=0);
});

test('P81 balances exploitation with information seeking', () => {
  const attention=new P81PredictiveAttention();
  const r=attention.evaluate({tick:1,candidates:[{action:'explore',score:.52,predictedUtility:.51,confidence:.5},{action:'verify',score:.55,predictedUtility:.54,confidence:.6},{action:'wait',score:.57,predictedUtility:.52,confidence:.7}],uncertainty01:.82,predictionError01:.72,goalPressure01:.3,noveltyPressure01:.7,attentionBudget01:.55,externalInput:false});
  assert.ok(r.expectedInformationGain01>.45); assert.equal(attention.snapshot().cycles,1); assert.ok(attention.actionBias('verify')>0);
});

test('P82 never converts missing outcomes into reality evidence', () => {
  const progress=new P82RealityProgressController();
  progress.observe({tick:1,capability01:.8,complexity01:.2,externalEvidence:false,identity01:.9,continuity01:.9});
  assert.equal(progress.snapshot().evidenceCount,0); assert.equal(progress.snapshot().evidenceQuality01,0);
  progress.observe({tick:2,capability01:.8,complexity01:.2,externalEvidence:true,identity01:.9,continuity01:.9});
  assert.equal(progress.snapshot().evidenceCount,1); assert.equal(progress.snapshot().lastExternalTick,2);
});
