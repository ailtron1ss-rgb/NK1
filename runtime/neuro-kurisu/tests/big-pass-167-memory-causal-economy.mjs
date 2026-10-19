import assert from 'node:assert/strict';
import { MemoryCausalEconomy } from '../src/organism/system/MemoryCausalEconomy.ts';
import { IdentityTrajectoryEngine, defaultIdentityTrajectory } from '../src/organism/cognition/evolution/IdentityTrajectoryEngine.ts';

const mem=new MemoryCausalEconomy();
const a=mem.observeMemory({memoryId:'m1',content:'the sensor is safe',tick:1,sourceClass:'user',sourceKey:'alice',confidence01:.78,contradiction01:0});
assert.equal(a.claim.status,'candidate');
const b=mem.observeMemory({memoryId:'m2',content:'the sensor is safe',tick:2,sourceClass:'device',sourceKey:'device-1',confidence01:.82,contradiction01:0});
assert.equal(b.claim.status,'supported');
const out=mem.observeOutcome({memoryId:'m1',decisionId:'d1',tick:3,action:'explore',success01:.86,surprise01:.34,sourceClass:'device'});
mem.observeOutcome({memoryId:'m1',decisionId:'d2',tick:4,action:'explore',success01:.81,surprise01:.28,sourceClass:'external-api'});
mem.observeOutcome({memoryId:'m1',decisionId:'d3',tick:5,action:'verify',success01:.74,surprise01:.22,sourceClass:'device'});
assert.ok(out.influence01>0);
const readiness=mem.promotionReadiness('m1');
assert.ok(readiness>0);

const contradiction=new MemoryCausalEconomy();
contradiction.observeMemory({memoryId:'c1',content:'door is open',tick:1,sourceClass:'user',sourceKey:'alice',confidence01:.88});
contradiction.observeMemory({memoryId:'c2',content:'door is open',tick:2,sourceClass:'device',sourceKey:'camera-1',confidence01:.81,contradiction01:.82});
contradiction.observeMemory({memoryId:'c3',content:'door is open',tick:3,sourceClass:'external-api',sourceKey:'sensor-2',confidence01:.77,contradiction01:.72});
const claim=contradiction.claim('claim:'.padEnd(7,'x')); // ensure claim API itself is safe
const candidates=contradiction.summary();
assert.ok(candidates.contestedClaims+candidates.quarantinedClaims>=1);

const ids=new IdentityTrajectoryEngine();
ids.restore(defaultIdentityTrajectory());
for(let i=0;i<6;i++) ids.observeOutcome({action:'explore',success01:.82,surprise01:.65,trust01:.9,phase:'exploring',attractor:'curiosity',identityPressure01:.2,predictionError01:.3});
const before=ids.snapshot().pathDependence01;
const influence=ids.observeMemoryInfluence({magnitude01:.82,independentSources:2,outcomeCount:3,verified:true,memoryIds:['m1'],at:Date.now()});
assert.equal(influence.applied,true);
assert.ok(ids.snapshot().pathDependence01>before);
console.log(JSON.stringify({pass:167,status:'PASS',supportedClaim:b.claim,contradictionSummary:candidates,outcomes:mem.summary(),promotionReadiness01:readiness,identityInfluence:influence},null,2));
