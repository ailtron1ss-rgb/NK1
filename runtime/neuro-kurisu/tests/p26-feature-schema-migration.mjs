import assert from 'node:assert/strict';
import { ParametricPolicyLearner, defaultParametricPolicy } from '../src/organism/learning/ParametricPolicyLearner.ts';

const oldNames=['energy','cognitiveLoad','uncertainty','novelty','goalPressure','socialNeed','predictionError','attentionBudget','identityCoherence','externalInput','bodyCapacity','thermalPressure','boredom','resourceRisk','actionCost'];
const legacy=defaultParametricPolicy();
legacy.featureNames=[...oldNames];
for(const action of ['respond','explore','verify','rest','reflect','wait','defer'])legacy.weights[action]=new Array(15).fill(0);
legacy.weights.respond[0]=.25;
legacy.weights.respond[14]=1.5;
const learner=new ParametricPolicyLearner();
learner.restore(legacy);
const migrated=learner.snapshot();
assert.equal(migrated.featureNames.length,18);
assert.equal(migrated.weights.respond.length,18);
assert.equal(migrated.weights.respond[0],.25,'existing feature weight must be preserved');
assert.equal(migrated.weights.respond[14],0,'new interaction feature must initialize without stealing old action-cost weight');
assert.equal(migrated.weights.respond[17],1.5,'legacy action-cost weight must migrate by feature name');
assert.equal(migrated.featureNames[17],'actionCost');
console.log('P26_FEATURE_SCHEMA_MIGRATION=PASS',{oldFeatures:15,newFeatures:18,actionCostPreserved:true,newInteractionsZeroInitialized:true});
