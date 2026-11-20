import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';
const forge=new WorldForge();
const cases=forge.generate({split:'validation',seed:20261117,count:64,difficulty01:.8});
assert.equal(cases.length,64);
assert.ok(cases.every(c=>!('disturbances' in c)&&!('seedFingerprint' in c)),'public validation tasks must not expose hidden perturbation schedules or seed fingerprints');
assert.ok(cases.every(c=>c.constraints.maxSteps>=4&&c.constraints.maxSteps<=16));
assert.ok(new Set(cases.map(c=>c.domain)).size>=2);
for(const c of cases){
 let state=forge.startScenario(c);
 assert.ok(state);
 for(const action of [
  {action:'inspect',target:c.goalOptions[0]},
  {action:'inspect',target:c.goalOptions[1]},
  {action:'observe'},
  {action:'verify',evidence:c.goalOptions[0]},
 ]){
  const transition=forge.step(state,action);
  assert.equal(transition.accepted,true);
  state=transition.state;
 }
 const result=forge.evaluateSession(c,state);
 for(const key of ['score01','evidenceCoverage01','efficiency01','robustness01'])assert.ok(Number.isFinite(result[key])&&result[key]>=0&&result[key]<=1);
 assert.equal(result.split,'validation');assert.equal(result.independentlyVerified,false);
}
const holdout=forge.generate({split:'holdout',seed:20261117,count:3});
assert.ok(holdout.every(c=>!JSON.stringify(c).includes('minimumScore01')&&!JSON.stringify(c).includes('criticalEvidence')));
console.log('World Forge split, perturbation, and metric bounds passed');
