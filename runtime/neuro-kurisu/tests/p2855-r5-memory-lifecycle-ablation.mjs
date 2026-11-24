import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const os = new MemoryOS2();
const base = (i, kind='episodic') => ({
  id:`r5-${i}`, kind, content:`low value memory ${i}`, salience:.18, emotionalWeight:.05,
  identityRelevance: kind==='identity'?1:.02, goalRelevance:.02, socialRelevance:0,
  predictionError:.02, confidence:.25, epistemicStatus:'belief', source:'r5-test', entities:[], semanticLinks:[], temporalLinks:[], causalLinks:[]
});
for(let i=0;i<1480;i++) os.encode(base(i));
os.encode({...base('identity','identity'),content:'hard invariant identity memory'});
os.encode({...base('bio','autobiographical'),content:'autobiographical continuity memory'});
const before=os.size();
os.maintain({pressure01:.92,maxItems:640});
const after=os.size();
assert.ok(after<=640);
assert.ok(os.get('r5-identity'));
assert.ok(os.get('r5-bio'));
os.applyResidencyPlan({pressure01:.92,hotBudget:24,warmBudget:96,coldBudget:256,identityTension01:.8});
const residency=os.residencyDiagnostics();
assert.ok(residency.materializedVectors<=residency.counts.hot+residency.counts.warm);
console.log(JSON.stringify({pass:true,before,after,forgetCount:os.statsLight().forgetCount,residency}));
