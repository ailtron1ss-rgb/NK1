import assert from 'node:assert/strict';
import { AgencyDeliberationEngine, defaultAgencyDeliberation } from '../src/organism/cognition/evolution/AgencyDeliberationEngine.ts';

let clock=1700000000000;
const engine=new AgencyDeliberationEngine(()=>clock);
const first=engine.record({
  requestedAction:'wait',
  chosenAction:'investigate',
  externalPressure:Infinity,
  intrinsicPressure:0.9,
  reason:'internal uncertainty needs resolution',
  autonomous:true,
});
assert.equal(first.id,'agency-1700000000000-1');
assert.equal(first.externalPressure,0);
assert.equal(first.intrinsicPressure,0.9);
assert.equal(first.autonomous,true);
assert.ok(first.overrideStrength>0);
const second=engine.record({
  requestedAction:null,
  chosenAction:'reflect',
  externalPressure:0,
  intrinsicPressure:0.7,
  reason:'periodic reflection',
  autonomous:true,
});
assert.equal(second.id,'agency-1700000000000-2','same-clock decisions must still have unique deterministic IDs');
assert.equal(engine.snapshot().records.length,2);
assert.equal(engine.snapshot().autonomousChoiceRate,1);

const detached=engine.snapshot();
detached.records[0].chosenAction='tampered';
assert.equal(engine.snapshot().records[0].chosenAction,'reflect','snapshots must be detached');

const restored=new AgencyDeliberationEngine(()=>clock);
restored.restore({
  version:1,
  records:[
    {...first,id:'trusted-1'},
    {...first,id:'trusted-1'},
    {...second,id:'invalid-time',at:Infinity},
    {...second,id:'invalid-action',chosenAction:'  '},
  ],
  overrideRate:0,
  autonomousChoiceRate:0,
  lastDecisionAt:1,
});
const safe=restored.snapshot();
assert.equal(safe.records.length,1,'restore must deduplicate IDs and reject malformed records');
assert.equal(safe.overrideRate,1,'restored override rate must be recomputed from validated records');
assert.equal(safe.autonomousChoiceRate,1,'restored autonomy rate must come from validated records');
assert.equal(safe.lastDecisionAt,first.at,'restored lastDecisionAt must come from the newest accepted record');

const next=restored.record({
  requestedAction:null,
  chosenAction:'verify',
  externalPressure:0.2,
  intrinsicPressure:0.8,
  reason:'verify the previous inference',
  autonomous:false,
});
assert.notEqual(next.id,'trusted-1');
assert.equal(restored.snapshot().records.length,2);

assert.throws(()=>engine.record({
  requestedAction:null,chosenAction:'   ',externalPressure:0,intrinsicPressure:0,
  reason:'invalid',autonomous:true,
}),/chosenAction/);
const empty=defaultAgencyDeliberation();
restored.restore({...empty,version:99});
assert.deepEqual(restored.snapshot(),empty,'unknown state versions must fail closed to defaults');
console.log('WorkPass74 AgencyDeliberation integrity contract: PASS');
