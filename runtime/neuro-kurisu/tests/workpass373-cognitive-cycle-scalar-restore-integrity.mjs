import assert from 'node:assert/strict';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';

const validCompleteState=(overrides={})=>({
  version:1,
  cycles:2,
  completeCycles:2,
  incompleteCycles:0,
  brokenLineages:0,
  meanStageCoverage01:1,
  meanCausalContinuity01:0.95,
  lastTick:2,
  lastComplete:true,
  lastMissingStages:[],
  ...overrides,
});

const valid=new UnifiedCognitiveCycle();
valid.restore(validCompleteState());
assert.equal(valid.snapshot().lastComplete,true,'valid persisted scalar evidence should remain restorable');

const malformedCases=[
  ['incompleteCycles','0'],
  ['incompleteCycles',-1],
  ['brokenLineages','0'],
  ['brokenLineages',Number.NaN],
  ['meanStageCoverage01',1.5],
  ['meanStageCoverage01','1'],
  ['meanCausalContinuity01',Number.POSITIVE_INFINITY],
  ['meanCausalContinuity01',-0.1],
];
for(const [field,value] of malformedCases) {
  const cycle=new UnifiedCognitiveCycle();
  cycle.restore(validCompleteState({[field]:value}));
  assert.equal(cycle.snapshot().lastComplete,false,field+'='+String(value)+' must not restore a complete cycle');
}

for(const [field,value] of [['lastTick','2'],['cycles','2'],['completeCycles','2']]) {
  const cycle=new UnifiedCognitiveCycle();
  cycle.restore(validCompleteState({[field]:value}));
  assert.equal(cycle.snapshot().lastComplete,false,field+'='+String(value)+' must not restore a complete cycle');
}

const legacy=validCompleteState();
delete legacy.incompleteCycles;
delete legacy.brokenLineages;
delete legacy.meanStageCoverage01;
delete legacy.meanCausalContinuity01;
const compatible=new UnifiedCognitiveCycle();
compatible.restore(legacy);
assert.equal(compatible.snapshot().lastComplete,true,'absent optional legacy fields remain compatible');

console.log('WorkPass373 cognitive-cycle scalar restore integrity: PASS');
