import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { FutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';
import { registerWorldForgeTools } from '../src/organism/developmental/WorldForgeTools.ts';

async function createGateway(){
  const gateway=new ActionGateway({live:false});
  const simulator=new FutureSimulator();
  registerWorldForgeTools(gateway,simulator);
  return gateway;
}
async function generate(gateway,split){
  const result=await gateway.executeTool('organism.worldforge.scenarios.generate',{
    split,count:1,difficulty01:.8,
  },'adaptive-curriculum-generate-'+split);
  assert.equal(result.ok,true,JSON.stringify(result.result));
  return result.result.scenarios[0];
}
async function begin(gateway,scenario){
  const result=await gateway.executeTool('organism.worldforge.sessions.begin',{
    scenarioId:scenario.id,
  },'adaptive-curriculum-begin-'+scenario.id);
  assert.equal(result.ok,true,JSON.stringify(result.result));
  return result.result.state;
}
async function evaluate(gateway,scenario,state){
  const result=await gateway.executeTool('organism.worldforge.sessions.evaluate',{
    scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
  },'adaptive-curriculum-evaluate-'+scenario.id+'-'+state.tick);
  assert.equal(result.ok,true,JSON.stringify(result.result));
  assert.equal(result.result.evaluation.syntheticOnly,true);
  assert.equal(result.result.evaluation.independentlyVerified,false);
  assert.ok(Array.isArray(result.result.evaluation.failureModes));
  return result.result.evaluation;
}
async function automaticFocus(gateway){
  const result=await gateway.executeTool('organism.worldforge.scenarios.generate-adversarial',{
    count:2,difficulty01:.85,focus:'auto',candidateMultiplier:2,
  },'adaptive-curriculum-auto-'+Math.random().toString(36).slice(2));
  assert.equal(result.ok,true,JSON.stringify(result.result));
  assert.equal(result.result.requestedFocus,'auto');
  assert.ok(['balanced','resource-shock','route-block','signal-noise','deadline-shift'].includes(result.result.focus));
  assert.ok(result.result.scenarios.every(s=>s.split==='train'&&s.syntheticOnly===true));
  assert.equal('trainingFeedback' in result.result,false,'internal curriculum counters must never be published');
  return result.result.focus;
}

const trainingGateway=await createGateway();
assert.equal(await automaticFocus(trainingGateway),'balanced','the curriculum must bootstrap without leaked or fabricated training evidence');

const firstTrainingScenario=await generate(trainingGateway,'train');
const firstTrainingState=await begin(trainingGateway,firstTrainingScenario);
const firstTrainingEvaluation=await evaluate(trainingGateway,firstTrainingScenario,firstTrainingState);
assert.ok(firstTrainingEvaluation.failureModes.includes('evidence-gap'));
assert.ok(firstTrainingEvaluation.failureModes.includes('goal-gap'));
assert.equal(await automaticFocus(trainingGateway),'signal-noise','train-only evidence gaps should focus the next curriculum on signal verification');

const deadlineScenario=await generate(trainingGateway,'train');
let deadlineState=await begin(trainingGateway,deadlineScenario);
let transitions=0;
while(deadlineState.status==='active'&&transitions<32){
  const transition=await trainingGateway.executeTool('organism.worldforge.sessions.step',{
    scenarioId:deadlineScenario.id,
    sessionId:deadlineState.sessionId,
    tick:deadlineState.tick,
    action:{action:'wait'},
  },'adaptive-curriculum-wait-'+deadlineScenario.id+'-'+transitions);
  assert.equal(transition.ok,true,JSON.stringify(transition.result));
  assert.equal(transition.result.transition.accepted,true);
  deadlineState=transition.result.transition.state;
  transitions++;
}
assert.equal(deadlineState.status,'exhausted');
const deadlineEvaluation=await evaluate(trainingGateway,deadlineScenario,deadlineState);
assert.ok(deadlineEvaluation.failureModes.includes('step-budget'),'exhaustion must be attributed as deadline pressure');
assert.equal(await automaticFocus(trainingGateway),'deadline-shift','repeated train exhaustion should redirect the next curriculum to deadline stress');

const validationGateway=await createGateway();
const validationScenario=await generate(validationGateway,'validation');
const validationState=await begin(validationGateway,validationScenario);
const validationEvaluation=await evaluate(validationGateway,validationScenario,validationState);
assert.ok(validationEvaluation.failureModes.includes('evidence-gap'));
assert.equal(await automaticFocus(validationGateway),'balanced','validation outcomes must not influence adaptive focus');

const invalidAuto=await validationGateway.executeTool('organism.worldforge.scenarios.generate-adversarial',{
  count:2,difficulty01:.8,focus:'private-oracle',candidateMultiplier:2,
},'adaptive-curriculum-invalid-focus');
assert.equal(invalidAuto.ok,false,'unknown focus names must fail closed');

console.log('World Forge train-only adaptive adversarial curriculum passed');
