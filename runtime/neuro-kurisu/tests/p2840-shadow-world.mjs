import assert from 'node:assert/strict';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { RealityShadowBridge } from '../src/organism/system/RealityShadowBridge.ts';

const world=new WorldEnvironment();
const bridge=new RealityShadowBridge();
const start=world.snapshot();
const shadow=world.simulate('inspect',start);
const external=bridge.resolve({source:'external',shadowReward01:shadow.displayReward01,groundedReward01:.22,shadowSurprise01:shadow.surprise});
assert.equal(external.commitShadow,false);
assert.equal(world.snapshot().tick,start.tick);
const sim=bridge.resolve({source:'simulation',shadowReward01:shadow.displayReward01,groundedReward01:shadow.displayReward01,shadowSurprise01:shadow.surprise});
assert.equal(sim.commitShadow,true);
world.commit(shadow);
assert.equal(world.snapshot().tick,start.tick+1);
console.log(JSON.stringify({ok:true,external,simulation:sim,diagnostics:bridge.diagnostics()}));
