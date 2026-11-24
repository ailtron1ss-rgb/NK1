import assert from 'node:assert/strict';
import { ConsciousnessAdversarialHarness } from '../src/organism/research/ConsciousnessAdversarialHarness.ts';
const h=new ConsciousnessAdversarialHarness();
const base={condition:'control',cycles:100,autonomyRate:.4,actionEntropy:.3,selfPrediction:.5,identityContinuity:.8,workspaceIgnition:.2,intrinsicGoalRate:.1,valueRevisions:1};
const treatment={...base,condition:'treatment',autonomyRate:.7,actionEntropy:.6,workspaceIgnition:.6,intrinsicGoalRate:.4,valueRevisions:3};
const sham={...base,condition:'sham',autonomyRate:.41,actionEntropy:.31,workspaceIgnition:.21,intrinsicGoalRate:.11,valueRevisions:1};
const lesion={...base,condition:'lesion',autonomyRate:.2,actionEntropy:.12,workspaceIgnition:.08,intrinsicGoalRate:.03,valueRevisions:0};
const results=h.compare(base,treatment,sham,lesion); assert.equal(results.length,7); assert.ok(results.some(r=>r.interpretation==='lesion-sensitive')); assert.ok(results.some(r=>r.interpretation==='lesion-sensitive')); const s=h.summary(results); assert.equal(s.version,1); assert.match(s.warning,/not evidence of phenomenal consciousness/i); console.log(`BIG_PASS_81_ADVERSARIAL_CONSCIOUSNESS=PASS positive=${s.positiveCount} lesionSensitive=${s.lesionSensitiveCount}`);
