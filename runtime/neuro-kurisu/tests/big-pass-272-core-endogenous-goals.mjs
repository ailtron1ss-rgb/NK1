import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'}); await core.init();
for(let i=0;i<96;i++){
  const r=core.b272EndogenousGoalStep({tick:i,selfLatent:Array.from({length:16},(_,j)=>Math.tanh(Math.sin(i*.07+j*.13))),worldLatent:Array.from({length:16},(_,j)=>Math.cos(i*.05+j*.11)),needs:{energy01:.78-(i%15)*.008,uncertainty01:i%19<6?.72:.28,novelty01:.35+(i%9)*.045,goalPressure01:.25+(i%19<6?.24:.04),socialNeed01:i%11===0?.72:.27},traits:{curiosity:.70,caution:.63,'truth-seeking':.74,'self-reflection':.67,'self-preservation':.68,care:.56,'social-attunement':.58,persistence:.72},predictionError01:i%19<6?.62:.16,autobiographicalContinuity01:.74,identityContinuity01:.80,intrinsicReward01:.62,lastAction:null,lastReward01:.5});
  core.b272EndogenousGoalLearn({tick:i,action:r.action,reward01:r.action==='explore'?.72:r.action==='verify'?.68:.59,predictionError01:i%19<6?.42:.17,externalEvidence01:i%17===0?1:0,independentEvaluatorGain01:i%19<6?.04:.02,acceptedExternalGoal:i%5!==0});
}
// Verify the live Core facade preserves both the internally generated proposal
// and the policy-selected action when they differ.
const beforeMismatchDiagnostics=core.b272EndogenousGoalDiagnostics();
const nextGoal=core.b272EndogenousGoalStep({tick:96,selfLatent:new Array(16).fill(.2),worldLatent:new Array(16).fill(.1),needs:{energy01:.7,uncertainty01:.4,novelty01:.5,goalPressure01:.3,socialNeed01:.2},traits:{curiosity:.7,caution:.6,'truth-seeking':.7,'self-reflection':.6,'self-preservation':.7,care:.6,'social-attunement':.5,persistence:.7},predictionError01:.3,autobiographicalContinuity01:.8,identityContinuity01:.8,intrinsicReward01:.6,lastAction:null,lastReward01:.5});
const actualAction=nextGoal.action==='verify'?'explore':'verify';
const mismatchLearning=core.b272EndogenousGoalLearn({tick:96,action:nextGoal.action,executedAction:actualAction,reward01:.95,predictionError01:.05,externalEvidence01:1,independentEvaluatorGain01:.8,acceptedExternalGoal:true});
assert.equal(mismatchLearning.proposedAction,nextGoal.action);
assert.equal(mismatchLearning.executedAction,actualAction);
assert.equal(core.b272EndogenousGoalDiagnostics().learningUpdates,beforeMismatchDiagnostics.learningUpdates+1,'Core did not persist outcome learning for a governed alternate action');
const d=core.b272EndogenousGoalDiagnostics();
assert.ok(d.learningUpdates>=90,'B272 did not learn in core');
assert.ok(d.generatedGoals>=90,'B272 did not generate goals in core');
assert.ok(d.goalEntropy01>.20,'core goal diversity collapsed');
assert.ok(d.prototypeDiversity01>.04,'core action prototypes did not differentiate');
assert.ok(d.agency01>.20,'core agency remained inert');
// A real observe/feedback cycle must carry the exact canonical authorship
// decision across the trace boundary; feedback must not guess it from intent.
const traceCore=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'}); await traceCore.init();
await traceCore.observe({});
const authoredTrace=traceCore.snapshot().traces[0];
assert.equal(typeof authoredTrace.goalAuthorshipAdmitted,'boolean','decision trace omitted canonical B272 authorship admission');
await traceCore.feedback({success:.7,reward:.7});
const feedbackUpdates=traceCore.b272EndogenousGoalDiagnostics().learningUpdates;
assert.equal(feedbackUpdates,authoredTrace.goalAuthorshipAdmitted?1:0,'feedback did not respect the recorded canonical goal-authorship decision');

const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile'}); await core2.init();
assert.deepEqual(core2.b272EndogenousGoalDiagnostics(),d,'B272 state did not survive Core restart');
console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b272EndogenousGoalDiagnostics()},null,2));
