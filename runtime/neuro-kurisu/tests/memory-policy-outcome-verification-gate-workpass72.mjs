import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { MemoryFabric as _MemoryFabricTypeGuard } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const now=Date.now();
const memory=new MemoryOS2({signalFusionProfile:'balanced',embeddingProvider:null});
memory.encode({
  id:'policy-evidence-memory',content:'A unique policy outcome memory for verified delayed replay.',
  kind:'semantic',source:'workpass72-verified-outcome-fixture',tags:[],context:{},
  salience:.9,emotionalWeight:.1,identityRelevance:.6,goalRelevance:.6,socialRelevance:.1,
  predictionError:.4,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],
  temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-1000,observedAt:now-500,
});
const fabric=new MemoryFabric(memory,new EventLog(),new MultiTimescaleMemory(),new MemorySubstrateCoordinator(),new UnifiedMemorySystem(),new P62MemoryFabric(),new SemanticMemoryGraph());
const query='unique policy outcome memory verified delayed replay';
const registered=fabric.retrieveWithPolicyDecision(query,1,.6,.6);
assert.ok(registered.decisionId);
assert.equal(registered.rows[0]?.id,'policy-evidence-memory');

const beforeUnverified=structuredClone(memory.adaptivePolicyDiagnostics());
const unverified=fabric.resolveAdaptivePolicyOutcome({
  memoryId:'policy-evidence-memory',decisionId:registered.decisionId,validationAt:now+1000,
  retentionScore01:.95,transferPotential01:.95,interferenceRisk01:.02,causalCredit01:.95,
  independentVerified:false,
});
assert.ok(unverified);
assert.equal(unverified.independentVerified,false);
assert.equal(unverified.reward01,0,'unverified observations must not publish a policy reward');
assert.deepEqual(memory.adaptivePolicyDiagnostics(),beforeUnverified,'unverified replay must not change adaptive policy state');
const unverifiedDiag=fabric.adaptivePolicyOutcomeDiagnostics();
assert.equal(unverifiedDiag.unverifiedResolved,1);
assert.equal(unverifiedDiag.verifiedResolved,0);
assert.equal(unverifiedDiag.meanDelayedReward01,0);
assert.equal(unverifiedDiag.meanCausalCredit01,0);
assert.equal(unverifiedDiag.rewardEvidenceScope,'independently-verified-only');

const second=fabric.retrieveWithPolicyDecision(query,1,.6,.6);
assert.ok(second.decisionId);
const beforeVerified=structuredClone(memory.adaptivePolicyDiagnostics());
const verified=fabric.resolveAdaptivePolicyOutcome({
  memoryId:'policy-evidence-memory',decisionId:second.decisionId,validationAt:now+2000,
  retentionScore01:.95,transferPotential01:.95,interferenceRisk01:.02,causalCredit01:.95,
  independentVerified:true,
});
assert.ok(verified);
assert.equal(verified.independentVerified,true);
assert.ok(verified.reward01>0);
const afterVerified=memory.adaptivePolicyDiagnostics();
assert.notDeepEqual(afterVerified.reward,beforeVerified.reward,'verified replay must update the selected policy reward');
const finalDiag=fabric.adaptivePolicyOutcomeDiagnostics();
assert.equal(finalDiag.unverifiedResolved,1);
assert.equal(finalDiag.verifiedResolved,1);
assert.ok(finalDiag.meanDelayedReward01>0);
assert.ok(finalDiag.meanCausalCredit01>0);

const restoredLedger=new (await import('../src/organism/system/MemoryPolicyOutcomeLedger.ts')).MemoryPolicyOutcomeLedger();
restoredLedger.restore({version:1,registered:2,resolved:2,dropped:0,meanDelayedReward01:.4,meanCausalCredit01:.3,pending:[]});
assert.equal(restoredLedger.diagnostics().verifiedResolved,0,'legacy snapshots load with explicit unknown verification counts');
assert.equal(restoredLedger.diagnostics().unverifiedResolved,0);
console.log('WORKPASS72_POLICY_VERIFICATION_GATE=PASS',JSON.stringify({unverifiedPolicyStateUnchanged:true,verifiedRewardUpdated:true,ledger:finalDiag}));
