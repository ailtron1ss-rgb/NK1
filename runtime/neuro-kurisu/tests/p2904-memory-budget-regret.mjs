import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
const m=new MemoryOS2();
for(let i=0;i<180;i++) m.encode({
  content:`r23 budget witness fact ${i} about continuity memory action context token-${i}`,
  kind:i%9===0?'procedural':'episodic', source:i%3===0?'device-r23':i%3===1?'user-r23':'agent-r23',
  tags:['r23','budget',`group-${i%12}`], context:{group:`${i%12}`},
  salience:.12+(i%10)/14, emotionalWeight:(i%7)/12, identityRelevance:i%31===0?.7:.08,
  goalRelevance:(i%9)/12, socialRelevance:(i%11)/14, predictionError:(i%13)/15,
  confidence:.48+(i%17)/34, epistemicStatus:'fact', entities:[`entity-${i%12}`], semanticLinks:[], temporalLinks:[], causalLinks:[], contradictionLinks:[],
  provenanceClass:i%3===0?'device':i%3===1?'user':'agent', sourceAuthority01:i%3===0?.95:i%3===1?.82:.60,
});
const before=m.residencyDiagnostics().estimatedBytes;
const budget=Math.max(16384,Math.floor(before*.46));
const result=m.enforceByteBudget({maxBytes:budget,tick:123,protectedIds:[]});
const diag=m.budgetDiagnostics();
assert.ok(result.evicted.length>0,'byte budget should evict real memories');
assert.ok(diag.estimatedBytes<=budget || m.size()===0,'memory must respect the enforced byte budget unless only protected items remain');
assert.ok(diag.witnesses>0,'every real eviction should leave a witness');
const query='r23 budget witness fact continuity memory token';
const rows=m.retrieve(query,6);
const afterDiag=m.budgetDiagnostics();
assert.ok(Number.isFinite(afterDiag.meanEvictionRegret01));
console.log(JSON.stringify({pass:true,beforeBytes:before,budget,afterBytes:afterDiag.estimatedBytes,evictions:result.evicted.length,witnesses:afterDiag.witnesses,budgetMisses:afterDiag.budgetMisses,meanEvictionRegret01:afterDiag.meanEvictionRegret01,retrieved:rows.length}));
