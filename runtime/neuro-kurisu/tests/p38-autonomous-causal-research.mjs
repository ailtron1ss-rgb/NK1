import assert from 'node:assert/strict';
import { P38AutonomousCausalResearchEngine } from '../src/organism/learning/P38AutonomousCausalResearch.ts';
const e=new P38AutonomousCausalResearchEngine();
const state={tick:7,predictionError:.62,selfPredictionError:.22,autonomyScore:.61,attentionBudget:.74,needs:{energy:.72,cognitiveLoad:.22,uncertainty:.68,socialNeed:.21,novelty:.44,identityCoherence:.83,goalPressure:.36},lastAction:'explore',lastActionSuccess:.5};
e.beginCycle();
const h=e.proposal({state,needs:state.needs,predictionError01:.62,p37Conflict01:.55,worldError01:.58,activeAction:'explore'});
assert.ok(h,'P38 should propose a hypothesis');
const preds=[
 {action:'explore',utility:.61,confidence:.74,reasons:[],nextState:{energy:.62,cognitiveLoad:.3,uncertainty:.42,novelty:.32}},
 {action:'verify',utility:.54,confidence:.77,reasons:[],nextState:{energy:.65,cognitiveLoad:.27,uncertainty:.32,novelty:.24}},
];
const t=e.runSandbox({hypothesisId:h.id,state,predictions:preds,seed:3});
assert.ok(t,'P38 should run bounded sandbox trial');
assert.equal(t.sandboxed,true);
assert.equal(t.independent,false);
assert.equal(t.runs,3);
assert.equal(t.replicaDeltas.length,3);
assert.ok(t.replicationConsistency01>=2/3);
assert.equal(t.replicated,true);
assert.ok(e.snapshot().evidence.length>=1);
assert.ok(e.snapshot().acceptedUpdates>=1);
console.log(`P38_AUTONOMOUS_CAUSAL_RESEARCH=PASS hypothesis=${h.id} trial=${t.id} replicated=${t.replicated}`);
