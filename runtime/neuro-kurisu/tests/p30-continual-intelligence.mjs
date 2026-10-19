import assert from 'node:assert/strict';
import { P30ContinualIntelligenceEngine, defaultP30Continual } from '../src/organism/learning/P30ContinualIntelligence.ts';

function state(e=.8,l=.2,u=.2,n=.4){return {needs:{energy:e,cognitiveLoad:l,uncertainty:u,novelty:n,goalPressure:.3,socialNeed:.2,identityCoherence:.85},predictionError:u,attentionBudget:.8,lastAction:'wait',lastActionSuccess:.8,autonomyScore:.5,selfPredictionError:.1,predictedNextAction:'wait',lastPredictionConfidence:.7,worldContextVersion:1,version:33,at:Date.now(),tick:1};}
const p=new P30ContinualIntelligenceEngine(); p.restore(defaultP30Continual());
const a=state(.8,.2,.25,.7), b=state(.6,.45,.55,.25);
p.observeTrajectory(a,'explore',b,.8);
for(let i=0;i<40;i++)p.observeTrajectory(a,'explore',b,.8);
const traj=p.predictTrajectory(a,['explore','verify','rest','explore']);
assert.equal(traj.length,4);
assert.ok(p.snapshot().trajectory.samples>=41);
for(let i=0;i<4;i++)p.recordTaskScore('A',.85);
p.recordTaskScore('A',.45);
assert.ok(p.taskForgetting('A')>.2);
const exp=p.proposeExperiment({taskId:'A',uncertainty01:.9,predictionError01:.85,novelty01:.7,resourceBudget01:.9});
assert.ok(exp);
const before=p.snapshot(); p.captureRollback({p26:{x:1},p27:{y:2},p28:{z:3}});
assert.ok(p.rollbackBundle()?.p26?.x===1);
const gate=p.gate({action:'explore',candidateBias:.08,confidence01:.7,conflict01:.1,cost01:.4,taskId:'A'});
assert.ok(gate.scale01>0);
console.log(`P30_CONTINUAL=PASS samples=${before.trajectory.samples} horizon=${traj.length} forgetting=${p.taskForgetting('A').toFixed(3)} experiment=${Boolean(exp)} gate=${gate.scale01.toFixed(3)}`);
