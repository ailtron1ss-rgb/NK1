import assert from 'node:assert/strict';
import {
  P2702PersistentPersonalityDynamics,
  defaultP2702PersistentPersonality,
} from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';

const defaults=defaultP2702PersistentPersonality();
const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const original=new P2702PersistentPersonalityDynamics();
original.beforeDecision({
  tick:7,novelty01:.8,uncertainty01:.25,goalPressure01:.6,identityGap01:.1,
  reward01:.7,actionUtilities:actions,identityVector:new Array(24).fill(.4),
  relationshipId:'user:stable',
});
original.afterOutcome({
  tick:7,reward01:.9,verified01:1,predictionError01:.1,identityGap01:.1,
  action:'explore',relationshipId:'user:stable',
});
const valid=original.snapshot();
const restored=new P2702PersistentPersonalityDynamics();
restored.restore(valid);
assert.deepEqual(restored.snapshot(),valid,'valid canonical personality snapshots must round-trip');

let getterCalls=0;
const accessorRoot={};
Object.defineProperty(accessorRoot,'experienceCount',{
  enumerable:true,get(){getterCalls++;throw new Error('root getter invoked');},
});
const rootGuard=new P2702PersistentPersonalityDynamics();
assert.doesNotThrow(()=>rootGuard.restore(accessorRoot));
assert.equal(getterCalls,0,'root getters must not execute');
assert.deepEqual(rootGuard.snapshot(),defaults,'accessor-backed root snapshots must fail closed');

const nestedAccessor={...valid,relationshipTrust:{}};
Object.defineProperty(nestedAccessor.relationshipTrust,'user:stable',{
  enumerable:true,get(){getterCalls++;return .99;},
});
const nestedGuard=new P2702PersistentPersonalityDynamics();
assert.doesNotThrow(()=>nestedGuard.restore(nestedAccessor));
assert.equal(getterCalls,0,'nested getters must not execute');
assert.deepEqual(nestedGuard.snapshot().relationshipTrust,{},'accessor-backed nested maps must default');

const inherited=Object.create({tick:999,experienceCount:999});
inherited.version=1;
const inheritedGuard=new P2702PersistentPersonalityDynamics();
inheritedGuard.restore(inherited);
assert.deepEqual(inheritedGuard.snapshot(),defaults,'inherited root properties must be ignored');

const hostileRoot=new Proxy({},{
  getPrototypeOf(){throw new Error('hostile getPrototypeOf');},
});
const proxyGuard=new P2702PersistentPersonalityDynamics();
assert.doesNotThrow(()=>proxyGuard.restore(hostileRoot));
assert.deepEqual(proxyGuard.snapshot(),defaults,'hostile root proxies must fail closed');

const revoked=Proxy.revocable({},{});revoked.revoke();
assert.doesNotThrow(()=>new P2702PersistentPersonalityDynamics().restore(revoked.proxy));
const revokedArray=Proxy.revocable([],{});revokedArray.revoke();
const revokedArrayInput={...valid,adaptiveValues:revokedArray.proxy};
const revokedArrayGuard=new P2702PersistentPersonalityDynamics();
assert.doesNotThrow(()=>revokedArrayGuard.restore(revokedArrayInput));
assert.deepEqual(revokedArrayGuard.snapshot().adaptiveValues,defaults.adaptiveValues);

const sparseValues=new Array(valid.adaptiveValues.length);
const sparseGuard=new P2702PersistentPersonalityDynamics();
sparseGuard.restore({...valid,adaptiveValues:sparseValues});
assert.deepEqual(sparseGuard.snapshot().adaptiveValues,defaults.adaptiveValues,'sparse vectors must use canonical defaults');

const shortVector=new P2702PersistentPersonalityDynamics();
shortVector.restore({...valid,selfBeliefs:[.1,.2]});
assert.deepEqual(shortVector.snapshot().selfBeliefs,defaults.selfBeliefs,'wrong vector dimensions must not truncate identity state');

const coercion={valueOf(){getterCalls++;throw new Error('coercion invoked');},[Symbol.toPrimitive](){getterCalls++;throw new Error('primitive conversion invoked');}};
const coercionGuard=new P2702PersistentPersonalityDynamics();
assert.doesNotThrow(()=>coercionGuard.restore({
  ...valid,
  tick:coercion,
  relationshipTrust:{'user:coercion':coercion},
  actionPreference:{explore:coercion},
}));
assert.equal(getterCalls,0,'restore must not coerce object-valued persisted fields');
assert.equal(coercionGuard.snapshot().tick,defaults.tick);
assert.equal(coercionGuard.snapshot().relationshipTrust['user:coercion'],undefined);
assert.equal(coercionGuard.snapshot().actionPreference.explore,defaults.actionPreference.explore);

const dangerousTrust={'user:good':.7,'user:bad':NaN};
Object.defineProperty(dangerousTrust,'__proto__',{value:.99,enumerable:true});
Object.defineProperty(dangerousTrust,'constructor',{value:.8,enumerable:true});
const malformed={
  ...valid,
  version:1,
  tick:-1,
  experienceCount:Infinity,
  learningUpdates:1.5,
  adaptiveValues:valid.adaptiveValues.map((value,index)=>index===0?NaN:index===1?2:value),
  valueNames:['renamed-value',...valid.valueNames.slice(1)],
  selfUncertainty:valid.selfUncertainty.map((value,index)=>index===0?0:value),
  stability01:Infinity,
  coherence01:-3,
  actionPreference:{explore:3,respond:-3,unknown:1},
  relationshipTrust:dangerousTrust,
};
const sanitized=new P2702PersistentPersonalityDynamics();
sanitized.restore(malformed);
const snapshot=sanitized.snapshot();
assert.equal(snapshot.tick,defaults.tick,'invalid counters fall back instead of wrapping');
assert.equal(snapshot.experienceCount,defaults.experienceCount);
assert.equal(snapshot.learningUpdates,defaults.learningUpdates);
assert.deepEqual(snapshot.adaptiveValues,defaults.adaptiveValues,'mislabelled personality vectors reset as a unit');
assert.deepEqual(snapshot.valueNames,defaults.valueNames);
assert.deepEqual(snapshot.valueWeights,defaults.valueWeights);
assert.equal(snapshot.selfUncertainty[0],.03,'finite metrics are clamped to their documented uncertainty floor');
assert.deepEqual(snapshot.selfUncertainty.slice(1),valid.selfUncertainty.slice(1),'valid historical uncertainty entries must survive partial sanitization');
assert.equal(snapshot.stability01,defaults.stability01);
assert.equal(snapshot.coherence01,0);
assert.equal(snapshot.actionPreference.explore,1);
assert.equal(snapshot.actionPreference.respond,-1);
assert.equal(snapshot.actionPreference.unknown,undefined);
assert.deepEqual(snapshot.relationshipTrust,{'user:good':.7});

const badVersion=new P2702PersistentPersonalityDynamics();
badVersion.restore({...valid,version:99});
assert.deepEqual(badVersion.snapshot(),defaults,'unsupported schema versions must fail closed');

console.log(JSON.stringify({
  pass:612,
  status:'PASS',
  assertions:[
    'canonical-roundtrip',
    'root-and-nested-accessor-rejection',
    'inherited-record-rejection',
    'hostile-and-revoked-proxy-rejection',
    'sparse-and-wrong-dimension-vector-rejection',
    'no-implicit-coercion',
    'canonical-personality-vector-alignment',
    'finite-counter-and-metric-sanitization',
    'allowlisted-action-preferences',
    'bounded-relationship-trust',
    'unsupported-version-rejection',
  ],
},null,2));
