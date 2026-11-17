import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge();
const scenario=forge.generate({split:'train',seed:117,count:1})[0];
assert.ok(scenario);
assert.equal(typeof forge.evaluate,'undefined','raw caller-supplied action traces must not be scoreable through a public engine method');
assert.equal(typeof forge.evaluateSession,'function','evaluation must be bound to a canonical engine-owned session');

// Evaluator-only answer keys must not be reachable through enumerable or
// ordinary property access on the runtime object.
assert.equal(Object.hasOwn(forge,'answers'),false,'evaluator registry must use a true private field');
assert.equal('answers' in forge,false,'ordinary runtime property access must not expose evaluator keys');

// A caller-controlled getter is executable code. Evaluating an untrusted trace
// must inspect data descriptors, not invoke getters while reading action fields.
let getterInvoked=false;
const hostileStep={};
Object.defineProperty(hostileStep,'action',{enumerable:true,get(){getterInvoked=true;return 'verify';}});
const evaluation=forge.evaluate(scenario,[hostileStep]);
assert.equal(getterInvoked,false,'malformed action traces must not execute getters');
assert.equal(evaluation.success,false);
assert.ok(evaluation.constraintViolations>0);
let splitGetterInvoked=false;
const hostileRequest={seed:5};
Object.defineProperty(hostileRequest,'split',{enumerable:true,get(){splitGetterInvoked=true;return 'train';}});
assert.deepEqual(forge.generate(hostileRequest),[],'generation must reject accessor-backed input records');
assert.equal(splitGetterInvoked,false,'generation must not execute input getters');

let scenarioGetterInvoked=false;
const hostileScenario={split:'train',domain:scenario.domain,syntheticOnly:true};
Object.defineProperty(hostileScenario,'id',{enumerable:true,get(){scenarioGetterInvoked=true;return scenario.id;}});
assert.equal(forge.evaluate(hostileScenario,[]).success,false);
assert.equal(scenarioGetterInvoked,false,'scenario identity validation must not execute getters');
console.log('World Forge evaluator isolation regressions passed');
