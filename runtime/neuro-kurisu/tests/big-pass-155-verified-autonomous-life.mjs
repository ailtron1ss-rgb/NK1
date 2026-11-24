import assert from 'node:assert/strict';
import { VerifiedAutonomousLifeEngine, defaultVerifiedAutonomousLife } from '../src/organism/learning/VerifiedAutonomousLifeEngine.ts';
const e=new VerifiedAutonomousLifeEngine(); e.restore(defaultVerifiedAutonomousLife());
let lastId=null;
for(let i=0;i<40;i++){
  const at=Date.now()+i*1000;
  e.beginCycle({state:{tick:i,at,needs:{energy:.75,cognitiveLoad:.2,uncertainty:.45,socialNeed:.4,novelty:.55,identityCoherence:.8,goalPressure:.5},predictionError:.2,selfPredictionError:.2},overall01:.62,agency01:.55,prediction01:.64,verification01:i%3? .8:.95,recovery01:.7,activePerception01:.6,longHorizon01:.58,interaction01:.55,contextKey:`ctx-${i}`,at});
  lastId=e.recordDecision({action:i%2?'verify':'explore',predicted01:.62,confidence01:.72,contextKey:`ctx-${i}`,at});
  const r=e.recordOutcome({decisionId:lastId,actual01:i%4===0?.71:.58,reward01:i%4===0?.72:.58,verified01:i%3?.8:.95,causal01:.68,basis:i%3?'internal-transition':'external-postcondition',at,stateAfter:{tick:i,at,needs:{energy:.74,cognitiveLoad:.19,uncertainty:.42,socialNeed:.38,novelty:.51,identityCoherence:.82,goalPressure:.47},predictionError:.18,selfPredictionError:.17}});
  assert.equal(r.ok,true);
  e.appendLongitudinal({overall01:.61+(i%5)*.01,agency01:.55,prediction01:.64,verification01:.8,recovery01:.7,activePerception01:.6,longHorizon01:.58,interaction01:.55,at});
}
const d=e.diagnostics(), b=e.benchmark(), a=e.selfAudit();
assert.equal(a.pass,true); assert.equal(d.unresolvedDecisions,0); assert.equal(d.decisionCount,40); assert.equal(d.outcomeCount,40); assert.equal(b.matchedOutcomes,40); assert(b.integrity01>=.99); assert(b.overall01>.45);
const snap=e.snapshot(); const e2=new VerifiedAutonomousLifeEngine(); e2.restore(snap); assert.deepEqual(e2.selfAudit(),a);
console.log(`BIG_PASS_155_VERIFIED_LIFE=PASS cycles=${d.cycles} decisions=${d.decisionCount} outcomes=${d.outcomeCount} closedLoop=${d.metrics.closedLoop01.toFixed(3)} overall=${b.overall01.toFixed(3)} integrity=${b.integrity01.toFixed(3)}`);
