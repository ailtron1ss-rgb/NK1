import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

const fabric=new OrganismSystemFabric();
const names=fabric.names();
assert.deepEqual(names,['self','governance','memory','world','embodiment','agency','research']);
const snap=fabric.snapshot();
assert.equal(snap.version,1);
for(const name of names){ assert.ok(snap.systems[name], `missing ${name}`); assert.equal(fabric.get(name), fabric[name]); }
assert.ok(fabric.manifest().every(x=>x.owner==='physical'));
assert.ok(fabric.self.p48Awareness);
assert.ok(fabric.self.p49TemporalLife);
assert.ok(fabric.agency.p67AutonomousGoalGenesis);
assert.ok(fabric.agency.p68GoalEcology);
assert.ok(fabric.embodiment.p66InteroceptiveHomeostasis);
assert.ok(fabric.research.p38Research);
assert.ok(fabric.research.p53DevelopmentalSelfModification);
console.log('BIG_PASS_56_SYSTEM_FABRIC=PASS',JSON.stringify({systems:names.length,manifest:fabric.manifest().length}));
