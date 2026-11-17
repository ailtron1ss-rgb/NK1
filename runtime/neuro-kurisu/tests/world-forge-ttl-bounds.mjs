import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

let now=10_000;
const bounded=new WorldForge({now:()=>now,scenarioTtlMs:1_000,maxActiveScenarios:16,maxCasesPerBatch:32});
const batch=bounded.generate({split:'train',seed:808,count:17});
assert.equal(batch.length,17);
assert.equal(bounded.startScenario(batch[0]),null,'oldest evaluator key must be evicted when the active registry is full');
assert.ok(bounded.startScenario(batch[1]),'newer scenarios remain evaluable within the active registry bound');

const timed=new WorldForge({now:()=>now,scenarioTtlMs:1_000});
const scenario=timed.generate({split:'validation',seed:809,count:1})[0];
const state=timed.startScenario(scenario);
assert.ok(state);
now+=1_001;
const expired=timed.step(state,{action:'wait'});
assert.equal(expired.accepted,false);
assert.equal(expired.reason,'session_expired','expired simulation sessions must fail closed');
assert.equal(timed.startScenario(scenario),null,'expired scenarios cannot start new sessions');
assert.equal(timed.evaluate(scenario,[]).success,false,'expired evaluator keys cannot score traces');
console.log('World Forge TTL and bounded registry regressions passed');
