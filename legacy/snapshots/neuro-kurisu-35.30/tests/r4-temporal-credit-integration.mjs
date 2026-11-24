import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';

const store=new MemoryStateStore();
const worldStore=new MemoryStateStore();
const runtime=new OrganismRuntime({
  stateFile:'/tmp/r4-temporal-credit.json',
  worldStateFile:'/tmp/r4-temporal-credit.world.json',
  stateStore:store,
  worldStateStore:worldStore,
  journal:new NoopOperationalJournal(),
  enableLanguage:false,
  autoRun:false,
  performanceProfile:'mobile',
  cycleResultMode:'summary',
});
await runtime.init();
await runtime.core.observe({
  text:'temporal credit probe A',
  worldContext:{objects:[{id:'a',category:'probe',distance:1}],events:[],uncertainty:.35,attention:.7,energy:.8},
  novelty:.4,
});
await runtime.core.observe({
  text:'temporal credit probe B',
  worldContext:{objects:[{id:'b',category:'probe',distance:2}],events:[],uncertainty:.28,attention:.72,energy:.76},
  novelty:.45,
});
const before=runtime.core.canonicalTemporalCreditDiagnostics();
const beforePolicy=runtime.core.snapshot().facets.learning.adaptivePolicy.values;
assert(before.registeredDecisions>=2);
assert(before.openDecisions>=2);
await runtime.core.feedback({success:.92,reward:.84,surprise:.08,evidenceSource:'user'});
const after=runtime.core.canonicalTemporalCreditDiagnostics();
const temporalState=runtime.core.systemSnapshot().canonicalTemporalCredit;
const assignments=temporalState?.recentAssignments ?? [];
const delayed=assignments.filter(a=>a.delayTicks>0);
const afterPolicy=runtime.core.snapshot().facets.learning.adaptivePolicy.values;
assert(after.resolvedDecisions>=2);
assert(after.delayedAssignments>=1);
assert.equal(after.openDecisions,0);
assert(delayed.some(a=>a.contextKey));
const delayedPolicyRows=delayed.map(a=>afterPolicy[a.contextKey]?.[a.action]).filter(Boolean);
assert(delayedPolicyRows.some(row=>Number(row.verifiedUpdates??0)>0));
console.log('R4_TEMPORAL_CREDIT_INTEGRATION_PASS',JSON.stringify({before,after,delayedAssignments:delayed.map(a=>({decisionId:a.decisionId,delayTicks:a.delayTicks,contextKey:a.contextKey,action:a.action,creditedReward01:a.creditedReward01,causalConfidence01:a.causalConfidence01})),policyVerifiedRows:delayedPolicyRows.map(r=>Number(r.verifiedUpdates??0)),policyContextsBefore:Object.keys(beforePolicy).length,policyContextsAfter:Object.keys(afterPolicy).length}));
await runtime.stop();
