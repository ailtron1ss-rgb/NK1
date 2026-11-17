import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { FutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';
import { registerWorldForgeTools } from '../src/organism/developmental/WorldForgeTools.ts';

const gateway=new ActionGateway({live:false});
const simulator=new FutureSimulator();
registerWorldForgeTools(gateway,simulator);
const tools=gateway.listTools().map(tool=>tool.id);
for(const id of [
 'organism.worldforge.scenarios.generate',
 'organism.worldforge.sessions.begin',
 'organism.worldforge.sessions.step',
 'organism.worldforge.sessions.evaluate',
 'organism.worldforge.scenarios.release',
])assert.ok(tools.includes(id),`runtime must register ${id}`);
const registered=new Map(gateway.listTools().map(tool=>[tool.id,tool]));
for(const id of tools.filter(id=>id.startsWith('organism.worldforge.'))){
  assert.equal(registered.get(id)?.requiresIdempotencyKey,false,`${id} mutates only the bounded synthetic sandbox, not an external side effect`);
  assert.equal(registered.get(id)?.hasOutputContract,true,`${id} must validate its bounded output envelope`);
}
const generatedScenarioContract=registered.get('organism.worldforge.scenarios.generate')?.outputSchema.properties.scenarios.items;
assert.equal(generatedScenarioContract?.additionalProperties,false,'scenario outputs must reject evaluator-only or undeclared fields');
assert.equal('disturbances' in generatedScenarioContract.properties,false,'runtime output schema must not expose hidden perturbations');
assert.equal('seedFingerprint' in generatedScenarioContract.properties,false,'runtime output schema must not expose seed material');

const generated=await gateway.executeTool('organism.worldforge.scenarios.generate',{
 split:'train',count:2,difficulty01:.65,
},'worldforge-runtime-test');
assert.equal(generated.ok,true,JSON.stringify(generated.result));
const scenarios=generated.result.scenarios;
assert.equal(scenarios.length,2);
assert.ok(scenarios.every(row=>row.syntheticOnly===true),'generated scenarios must be explicitly marked synthetic');
const scenario=scenarios[0];
assert.equal('disturbances' in scenario,false);
assert.equal('seedFingerprint' in scenario,false);

const holdout=await gateway.executeTool('organism.worldforge.scenarios.generate',{
 split:'holdout',count:1,difficulty01:.65,
},'worldforge-holdout-attempt');
assert.equal(holdout.ok,false,'runtime tool contract must reject holdout generation');

const started=await gateway.executeTool('organism.worldforge.sessions.begin',{
 scenarioId:scenario.id,
},'worldforge-start');
assert.equal(started.ok,true,JSON.stringify(started.result));
let state=started.result.state;
const forgedCost=await gateway.executeTool('organism.worldforge.sessions.step',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
 action:{action:'collect',cost:0},
},'worldforge-forged-cost');
assert.equal(forgedCost.ok,false,'ActionGateway schema must reject caller-provided cost');
assert.equal(forgedCost.result.error,'tool-input-invalid');

const baselineStarted=await gateway.executeTool('organism.worldforge.sessions.begin',{
 scenarioId:scenario.id,
},'worldforge-baseline-start');
assert.equal(baselineStarted.ok,true);
const baselineState=baselineStarted.result.state;
const baselineWait=await gateway.executeTool('organism.worldforge.sessions.step',{
 scenarioId:scenario.id,sessionId:baselineState.sessionId,tick:baselineState.tick,
 action:{action:'wait'},
},'worldforge-baseline-wait');
assert.equal(baselineWait.ok,true);

const beforeResources=state.resourcesRemaining;
const collect=await gateway.executeTool('organism.worldforge.sessions.step',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
 action:{action:'collect'},
},'worldforge-collect');
assert.equal(collect.ok,true,JSON.stringify(collect.result));
state=collect.result.transition.state;
assert.equal(state.resourcesRemaining,baselineWait.result.transition.state.resourcesRemaining-1,'runtime tools must use fixed evaluator-owned cost after the same hidden environment event');

const inspected=await gateway.executeTool('organism.worldforge.sessions.step',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
 action:{action:'inspect',target:scenario.goalOptions[0]},
},'worldforge-inspect');
assert.equal(inspected.ok,true);
state=inspected.result.transition.state;
const beforeVerify=await gateway.executeTool('organism.worldforge.sessions.evaluate',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
},'worldforge-evaluate-before-verify');
assert.equal(beforeVerify.ok,true);
assert.equal(beforeVerify.result.evaluation.evidenceCoverage01,0,'inspection alone cannot count as verified evidence');

const verified=await gateway.executeTool('organism.worldforge.sessions.step',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
 action:{action:'verify',evidence:scenario.goalOptions[0]},
},'worldforge-verify');
assert.equal(verified.ok,true);
state=verified.result.transition.state;
const evaluation=await gateway.executeTool('organism.worldforge.sessions.evaluate',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
},'worldforge-evaluate');
assert.equal(evaluation.ok,true);
assert.equal(evaluation.result.evaluation.syntheticOnly,true);
assert.equal(evaluation.result.evaluation.independentlyVerified,false);
assert.equal(evaluation.result.evaluation.evidenceCoverage01,.5);

const released=await gateway.executeTool('organism.worldforge.scenarios.release',{
 scenarioId:scenario.id,
},'worldforge-release');
assert.equal(released.ok,true);
const afterRelease=await gateway.executeTool('organism.worldforge.sessions.evaluate',{
 scenarioId:scenario.id,sessionId:state.sessionId,tick:state.tick,
},'worldforge-evaluate-after-release');
assert.equal(afterRelease.ok,false);
console.log('World Forge ActionGateway runtime integration passed');
