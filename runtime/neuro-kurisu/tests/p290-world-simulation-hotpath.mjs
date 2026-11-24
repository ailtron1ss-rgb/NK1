import assert from 'node:assert/strict';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const world = new WorldEnvironment();
for (let i=0;i<500;i++) world.step(i % 2 ? 'observe' : 'move');
const before = world.snapshot();
const historyBefore = world.history();
const actions = ['observe','inspect','move','collect','rest','communicate'];
for (let i=0;i<4000;i++) {
  const transition = world.simulate(actions[i % actions.length], before);
  assert.equal(transition.after.tick, before.tick + 1);
  const projection = world.project(actions[(i+1) % actions.length], before);
  assert.equal(projection.next.tick, before.tick + 1);
}
assert.deepEqual(world.snapshot(), before, 'pure predictions must not mutate canonical world');
assert.deepEqual(world.history(), historyBefore, 'pure predictions must not mutate history');
assert.equal(world.history().length, 500);
console.log(JSON.stringify({ok:true,history:world.history().length,tick:world.snapshot().tick}));
