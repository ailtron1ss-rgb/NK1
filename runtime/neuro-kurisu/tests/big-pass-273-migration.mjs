import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';
const a=new B273AutonomousGoalLifecycle();
const r=a.step({tick:1,endogenousGoalVector:[.3,-.2,.6,.1,-.4,.5,.2,-.1],selfLatent:Array(16).fill(.2),worldLatent:Array(16).fill(.1),neuralAssembly:Array(16).fill(.15),needs:{energy01:.72,uncertainty01:.48,novelty01:.61,goalPressure01:.46,socialNeed01:.35,autonomy01:.62,coherence01:.71},traits:{curiosity:.7,caution:.6,'truth-seeking':.7,'self-reflection':.65,'self-preservation':.68,care:.55,'social-attunation':.5,persistence:.72},predictionError01:.3,identityContinuity01:.8,autobiographicalContinuity01:.76});
a.learnFromOutcome({tick:1,action:r.action,plan:r.plan,reward01:.74,predictionError01:.22,independentGain01:.11,personalityAlignment01:.61,externalEvidence01:1});
const snap=a.snapshot(); const b=new B273AutonomousGoalLifecycle(); b.restore(snap); assert.deepEqual(b.snapshot(),snap,'B273 migration round-trip mismatch');
console.log(JSON.stringify({pass:true,diagnostics:b.diagnostics()},null,2));
