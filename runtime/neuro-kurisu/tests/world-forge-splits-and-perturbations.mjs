import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';
const forge=new WorldForge();
const cases=forge.generate({split:'validation',seed:20261117,count:64,difficulty01:.8});
assert.equal(cases.length,64);
assert.ok(cases.every(c=>c.disturbances.length>=1&&c.disturbances.every(d=>d.magnitude01>=0&&d.magnitude01<=1)));
assert.ok(cases.every(c=>c.constraints.maxSteps>=4&&c.constraints.maxSteps<=16));
assert.ok(new Set(cases.map(c=>c.domain)).size>=2);
for(const c of cases){
 const result=forge.evaluate(c,[{action:'observe',target:'signal-a',evidence:'signal-a',cost:.1,risk01:.1},{action:'inspect',target:'signal-b',evidence:'signal-b',cost:.1,risk01:.1},{action:'verify',target:'confirm',evidence:'budget-check',cost:.1,risk01:.1}]);
 for(const key of ['score01','evidenceCoverage01','efficiency01','robustness01'])assert.ok(Number.isFinite(result[key])&&result[key]>=0&&result[key]<=1);
 assert.equal(result.split,'validation');assert.equal(result.independentlyVerified,false);
}
const holdout=forge.generate({split:'holdout',seed:20261117,count:3});
assert.ok(holdout.every(c=>!JSON.stringify(c).includes('minimumScore01')&&!JSON.stringify(c).includes('criticalEvidence')));
console.log('World Forge split, perturbation, and metric bounds passed');
