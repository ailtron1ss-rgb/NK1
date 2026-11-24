import assert from 'node:assert/strict';
import { OperationalLifeEngine } from '../src/organism/learning/OperationalLifeEngine.ts';
const engine=new OperationalLifeEngine();
for(let i=0;i<12;i++){
  engine.beginCycle({state:{tick:i,at:1000+i,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.5,socialNeed:.4,novelty:.5,identityCoherence:.9,goalPressure:.5}}});
  const d=engine.registerDecision({action:i%2?'reflect':'observe',predicted01:.6,confidence01:.8,horizon01:.7,at:1000+i});
  engine.recordPostcondition({decisionId:d,expected:'success>=0.5',observed:'verified world transition',passed:true,evidenceClass:'world-transition',confidence01:.9,independent01:.8,at:1000+i});
  engine.registerOutcome({decisionId:d,actual01:.68,reward01:.68,verified01:.9,external01:.8,causal01:.6,evidenceCount:1,at:1000+i});
  const p=engine.chooseActivePerception({mode:'world-state',uncertainty01:.6,actionability01:.7,cost01:.2,at:1000+i}); engine.verifyPerception(p.id,.58,.9);
  engine.recordCausalIntervention({target:'policy-test',control01:.42,treatment01:.61,confidence01:.8,independent01:.8,repetitions:3,at:1000+i});
  engine.proposeSelfDevelopmentTrial({hypothesis:'test improves holdout',intervention:'bounded proposal',baseline01:.5,treatment01:.72,holdout01:.62,safety01:.95,at:1000+i});
  engine.samplePersonality({curiosity:.7,persistence:.72,caution:.55},.82,.4,1000+i);
  engine.sampleSocial(`person-${i%3}`,{trust01:.7,expectation01:.65,repair01:.2,predictionError01:.18,continuity01:.76,at:1000+i});
  engine.recordReplication({track:'closed-loop',seed:i,control01:.5,treatment01:.65,holdout01:.62,evaluator:'deterministic',at:1000+i});
}
engine.closeWindow(2000);
engine.beginCycle({state:{tick:20,at:3000,needs:{energy:.82,cognitiveLoad:.18,uncertainty:.35,socialNeed:.3,novelty:.4,identityCoherence:.9,goalPressure:.3}}});
assert.equal(engine.selfAudit().pass,true);
assert.ok(engine.benchmark().closedLoop01>.2);
console.log(`BIG_PASS_157=PASS decisions=${engine.snapshot().decisions.length} outcomes=${engine.snapshot().outcomes.length} windows=${engine.snapshot().windows.length} overall=${engine.benchmark().overall01.toFixed(3)}`);
