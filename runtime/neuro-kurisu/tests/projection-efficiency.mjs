import assert from 'node:assert/strict';
import { AdvancedProjectionScheduler } from '../src/organism/persistence/AdvancedProjectionScheduler.ts';

const s = new AdvancedProjectionScheduler();
const ticks=96;
const counts={critical:0,memory:0,identity:0,reality:0,developmental:0,slow:0};
for(let tick=0;tick<ticks;tick++){
  for(const g of Object.keys(counts)){
    if(s.shouldMaterialize(g,tick,false,0)){counts[g]++;s.mark(g,tick);}
  }
}
const naive=ticks*Object.keys(counts).length;
const actual=Object.values(counts).reduce((a,b)=>a+b,0);
assert.ok(actual < naive*.45, `scheduler should cut projection operations: ${actual}/${naive}`);
assert.ok(counts.critical >= 90);
assert.ok(counts.slow <= 9);
console.log(`PROJECTION_EFFICIENCY=PASS naive=${naive} scheduled=${actual} reduction=${((1-actual/naive)*100).toFixed(1)}% counts=${JSON.stringify(counts)}`);
