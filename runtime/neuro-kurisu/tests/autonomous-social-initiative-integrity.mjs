import assert from 'node:assert/strict';
import {
  AutonomousSocialInitiativeEngine,
  defaultAutonomousSocialInitiative,
} from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const makeInput=(at,overrides={})=>({
  at,externalInput:false,socialNeed01:.9,relationship01:.4,energy01:.9,identity01:.95,novelty01:.9,
  topics:[{topic:'A distinct causal question about how memory evidence should change future decisions',source:'reflection',salience01:.9,freshness01:.9}],
  quietPeriodMs:0,cooldownMs:0,startupGraceMs:0,...overrides,
});
const message='A useful observation about the project can connect evidence to a better decision.';
const ttl=20*60_000;

const plannedEngine=new AutonomousSocialInitiativeEngine();
const planned=plannedEngine.cycle(makeInput(1000)).initiative;
assert.ok(planned);
assert.equal(plannedEngine.stageMessage(planned.id,message,999),false,'generation timestamps before plan creation must be rejected');
assert.equal(plannedEngine.defer(planned.id,999),false,'a plan cannot be resolved before it exists');
assert.equal(plannedEngine.latestPlanned(1000)?.id,planned.id);
assert.equal(plannedEngine.stageMessage(planned.id,message,1001),true);
assert.equal(plannedEngine.latestReady(1000),null,'a message cannot be delivered before staging');
assert.equal(plannedEngine.acknowledge(planned.id,1000),false,'delivery cannot precede stagedAt');
assert.equal(plannedEngine.acknowledge(planned.id,1002),true);
assert.equal(plannedEngine.acknowledge(planned.id,1003),false,'delivery acknowledgement remains idempotent');

const staleStage=new AutonomousSocialInitiativeEngine();
const stalePlan=staleStage.cycle(makeInput(2000)).initiative;
assert.ok(stalePlan);
assert.equal(staleStage.stageMessage(stalePlan.id,message,2000+ttl+1),false,
  'a delayed provider response must not stage a message after its plan expires');
assert.equal(staleStage.latestReady(2000+ttl+1),null);
assert.equal(staleStage.snapshot().initiatives[0].status,'deferred');

const staleReady=new AutonomousSocialInitiativeEngine();
const readyPlan=staleReady.cycle(makeInput(3000)).initiative;
assert.ok(readyPlan);
assert.equal(staleReady.stageMessage(readyPlan.id,message,3001),true);
assert.equal(staleReady.latestReady(3001)?.id,readyPlan.id);
assert.equal(staleReady.latestReady(3000+ttl+1),null,'ready messages expire even if no new cognitive cycle ran');
assert.equal(staleReady.acknowledge(readyPlan.id,3000+ttl+2),false);
assert.equal(staleReady.snapshot().initiatives[0].status,'deferred');
assert.equal(staleReady.summary().executed,0);

const stalePlanned=new AutonomousSocialInitiativeEngine();
const oldPlan=stalePlanned.cycle(makeInput(4000)).initiative;
assert.ok(oldPlan);
assert.equal(stalePlanned.latestPlanned(4000+ttl+1),null);
assert.equal(stalePlanned.snapshot().initiatives[0].status,'deferred');

const getterEngine=new AutonomousSocialInitiativeEngine();
let topGetterInvoked=false;
const topAccessor=Object.create(null);
Object.defineProperty(topAccessor,'initiatives',{get(){topGetterInvoked=true;throw new Error('must not execute');}});
getterEngine.restore(topAccessor);
assert.equal(topGetterInvoked,false,'top-level accessors must not execute during restore');
assert.deepEqual(getterEngine.snapshot(),defaultAutonomousSocialInitiative());

let itemGetterInvoked=false;
const hostileItem={
  id:'hostile-ready',kind:'share-thought',status:'ready',createdAt:5000,stagedAt:5001,
  reason:'A safe reason for a restored initiative',
  topic:'A safe topic about causal learning and memory',
};
Object.defineProperty(hostileItem,'message',{get(){itemGetterInvoked=true;throw new Error('must not execute');}});
const itemRestore=new AutonomousSocialInitiativeEngine();
itemRestore.restore({version:1,initiatives:[hostileItem]});
assert.equal(itemGetterInvoked,false,'nested accessors must not execute during restore');
assert.equal(itemRestore.latestReady(5001),null,'a ready item without a safe own-data message is deferred');
assert.equal(itemRestore.snapshot().initiatives[0].status,'deferred');

const proxyRestore=new AutonomousSocialInitiativeEngine();
proxyRestore.restore(new Proxy({}, {getPrototypeOf(){throw new Error('proxy trap');}}));
assert.deepEqual(proxyRestore.snapshot(),defaultAutonomousSocialInitiative(),
  'a throwing proxy must reset the restore boundary atomically');

const arrayProxyRestore=new AutonomousSocialInitiativeEngine();
const proxyArray=new Proxy([{id:'proxy',kind:'share-thought',status:'planned',createdAt:1,topic:'A safe topic about causal learning and memory'}],{
  getOwnPropertyDescriptor(){throw new Error('array descriptor trap');},
});
arrayProxyRestore.restore({version:1,initiatives:proxyArray});
assert.deepEqual(arrayProxyRestore.snapshot(),defaultAutonomousSocialInitiative(),
  'a hostile initiative collection must not partially restore state');

const sparseRestore=new AutonomousSocialInitiativeEngine();
const sparse=[, {id:'sparse-valid',kind:'share-thought',status:'planned',createdAt:6000,reason:'A safe reason for a restored initiative',topic:'A safe topic about causal learning and memory'}];
sparseRestore.restore({version:1,initiatives:sparse});
assert.equal(sparseRestore.snapshot().initiatives.length,1,'sparse slots are skipped without executing missing rows');
assert.equal(sparseRestore.latestPlanned(6000)?.id,'sparse-valid');

const duplicateRestore=new AutonomousSocialInitiativeEngine();
const duplicate={id:'same-id',kind:'share-thought',status:'planned',createdAt:7000,reason:'A safe reason for a restored initiative',topic:'A safe topic about causal learning and memory'};
duplicateRestore.restore({version:1,initiatives:[duplicate,{...duplicate}]});
assert.equal(duplicateRestore.snapshot().initiatives.length,1,'duplicate initiative identities are collapsed');
assert.equal(duplicateRestore.summary().deferred,1);

const invalidVersion=new AutonomousSocialInitiativeEngine();
invalidVersion.restore({version:99,cycles:100,initiatives:[]});
assert.deepEqual(invalidVersion.snapshot(),defaultAutonomousSocialInitiative(),
  'unknown snapshot versions reset instead of being merged optimistically');

const safeRoundTrip=new AutonomousSocialInitiativeEngine();
const safePlan=safeRoundTrip.cycle(makeInput(8000)).initiative;
assert.ok(safePlan);
assert.equal(safeRoundTrip.stageMessage(safePlan.id,message,8001),true);
const restoredSafe=new AutonomousSocialInitiativeEngine();
restoredSafe.restore(safeRoundTrip.snapshot());
assert.equal(restoredSafe.latestReady(8001)?.id,safePlan.id,
  'valid staged initiatives survive a bounded restore round trip');

console.log('AUTONOMOUS_SOCIAL_INITIATIVE_INTEGRITY=PASS');
