import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge();
const scenario=forge.generate({split:'train',seed:81273,count:1})[0];
const initial=forge.startScenario(scenario);
assert.ok(initial);

const forgedCost=forge.step(initial,{action:'collect',cost:0});
assert.equal(forgedCost.accepted,false,'agents must not choose their own action cost');
assert.equal(forgedCost.reason,'invalid_action');
assert.equal(forgedCost.state.resourcesRemaining,initial.resourcesRemaining,'rejected cost tampering must not mutate resources');

let state=forge.startScenario(scenario);
const baselineForge=new WorldForge();
const baselineScenario=baselineForge.generate({split:'train',seed:81273,count:1})[0];
let baselineState=baselineForge.startScenario(baselineScenario);
assert.ok(baselineState);
const baselineWait=baselineForge.step(baselineState,{action:'wait'});
assert.equal(baselineWait.accepted,true);
const collect=forge.step(state,{action:'collect'});
assert.equal(collect.accepted,true);
assert.equal(collect.state.resourcesRemaining,baselineWait.state.resourcesRemaining-1,'resource collection must consume exactly one evaluator-owned unit in addition to the same hidden environment events');
state=collect.state;

const firstTarget=scenario.goalOptions[0];
const secondTarget=scenario.goalOptions[1];
state=forge.step(state,{action:'inspect',target:firstTarget}).state;
state=forge.step(state,{action:'inspect',target:secondTarget}).state;
const beforeVerify=forge.evaluateSession(scenario,state);
assert.equal(beforeVerify.evidenceCoverage01,0,'inspection is not independent verification');
state=forge.step(state,{action:'verify',evidence:firstTarget}).state;
state=forge.step(state,{action:'verify',evidence:secondTarget}).state;
const afterVerify=forge.evaluateSession(scenario,state);
assert.equal(afterVerify.evidenceCoverage01,1,'only successful verify actions may discharge critical evidence');
assert.ok(afterVerify.stepsUsed>=5);
console.log('World Forge action authority and evidence verification gates passed');
