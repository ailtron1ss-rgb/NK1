import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const makeItem=(i)=>({
  id:`cold-${i}`, content:`long episodic memory about subject ${i} and retrieval context`,
  kind:'episodic', salience:i%7===0?.72:.22, emotionalWeight:.1, identityRelevance:i%31===0?.55:.04,
  goalRelevance:i%13===0?.64:.05, socialRelevance:.1, predictionError:i%11===0?.4:.08,
  confidence:.72, epistemicStatus:'fact', source:'p2697', entities:[], semanticLinks:[], temporalLinks:[], causalLinks:[],
});

const source=new MemoryOS2();
for(let i=0;i<900;i++) source.encode(makeItem(i),{clone:false});
source.applyResidencyPlan({hotBudget:8,warmBudget:64,coldBudget:828,pressure01:.7});
const before=source.residencyDiagnostics();
assert.equal(before.targetItems,900);
assert.ok(before.materializedVectors <= 80, `expected bounded materialization, got ${before.materializedVectors}`);

const snapshot=source.snapshot({clone:true});
const restored=new MemoryOS2();
restored.restore(snapshot);
const afterRestore=restored.residencyDiagnostics();
assert.equal(afterRestore.targetItems,900);
assert.equal(afterRestore.materializedVectors,before.materializedVectors);

const rows=restored.retrieve('subject 777 retrieval context',8,.2,.1);
assert.ok(rows.length>0);
const afterRetrieve=restored.residencyDiagnostics();
assert.equal(afterRetrieve.materializedVectors, before.materializedVectors, 'retrieval must not materialize hash vectors for cold candidates when vectors do not participate in ranking');
assert.deepEqual(afterRetrieve.counts, before.counts, 'retrieval must not silently reclassify cold memories as warm');
assert.ok(afterRetrieve.materializedVectors <= 112, `bounded residency failed: ${afterRetrieve.materializedVectors}`);

const diag=restored.retrievalDiagnostics();
assert.ok(diag.candidateCount<=192);
console.log(JSON.stringify({
  version:'P2697', ok:true, before, afterRestore, afterRetrieve,
  rows:rows.length, candidateCount:diag.candidateCount,
},null,2));
