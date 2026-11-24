import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';
const a=new B272EndogenousGoalGenesis();
const r=a.step({tick:1,selfLatent:Array(16).fill(.2),worldLatent:Array(16).fill(.4),needs:{energy01:.7,uncertainty01:.5,novelty01:.6,goalPressure01:.4,socialNeed01:.3},traits:{curiosity:.7,caution:.6,'truth-seeking':.65,'self-reflection':.6,'self-preservation':.7,care:.55,'social-attunement':.5,persistence:.7},predictionError01:.35,autobiographicalContinuity01:.7,identityContinuity01:.8,intrinsicReward01:.6,lastAction:null,lastReward01:.5});
a.learnFromOutcome({tick:1,action:r.action,reward01:.72,predictionError01:.2,externalEvidence01:1,independentEvaluatorGain01:.08,acceptedExternalGoal:true});
const snap=a.snapshot(); const b=new B272EndogenousGoalGenesis(); b.restore(snap);
assert.deepEqual(b.snapshot(),snap,'B272 migration snapshot mismatch');
console.log(JSON.stringify({pass:true,goal:b.currentGoal(),diagnostics:b.diagnostics()},null,2));
