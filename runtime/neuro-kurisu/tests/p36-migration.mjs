import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const migrated=migratePersistedOrganism({
  schemaVersion:38,
  state:{tick:3,needs:{energy:.8}},
  facets:{learning:{p36:{
    version:5,
    currentHypothesisId:'persisted-promoted-hypothesis',
    hypotheses:[{id:'persisted-promoted-hypothesis',area:'learning',status:'completed',evidenceGate:'replicated',result01:.91,completedAt:123}],
    externalEvidence:[{id:'persisted-evidence',hypothesisId:'persisted-promoted-hypothesis',contextKey:'old-context',control01:.4,treatment01:.9,delta01:.5,independentVerified:true,observationId:'forged-saved-receipt',holdout:true,delayMs:6000,evaluatorVersion:'old',evidenceSource:'external-evaluator',at:123}],
    acceptedChanges:7,
    developmentCycles:[{id:'old-cycle',hypothesisId:'persisted-promoted-hypothesis',stage:'replicated',verifiedEvidenceCount:6,lastEvidenceAt:123}],
    actionBias:{respond:0,explore:.12,verify:0,rest:0,reflect:0,wait:0,defer:0},
    curriculum:{focus:'learning',mastery:{learning:.99},plannedSteps:9,completedSteps:7},
    metrics:{selfDevelopmentCoherence01:.99,experimentSuccess01:.99,autonomy01:.99,developmentalReadiness01:.99,longHorizonImprovement01:.99},
    developmentalMaturity:{stage:'stable',score01:1,verifiedOutcomeCount:12,retainedOutcomeCount:8,transferredOutcomeCount:6,regressionCount:0,lastTransitionAt:123,history:[]},
  }}},
});
assert.equal(migrated.schemaVersion,RELEASE_CONTRACT.stateSchema);
assert.equal(migrated.state.version,RELEASE_CONTRACT.stateSchema);
const p36=migrated.facets.learning.p36;
assert.ok(p36);
assert.equal(p36.version,6);
assert.equal(p36.hypotheses[0].status,'awaiting-evidence');
assert.equal(p36.hypotheses[0].evidenceGate,'none');
assert.equal(p36.hypotheses[0].result01,null);
assert.equal(p36.externalEvidence[0].independentVerified,false);
assert.equal(p36.externalEvidence[0].observationId,undefined);
assert.equal(p36.acceptedChanges,0);
assert.equal(p36.actionBias.explore,0);
assert.equal(p36.curriculum.mastery.learning,.5);
assert.equal(p36.curriculum.completedSteps,0);
assert.equal(p36.developmentalMaturity.verifiedOutcomeCount,0);
assert.equal(p36.developmentalMaturity.stage,'seed');
assert.equal(p36.developmentCycles[0].stage,'awaiting-evidence');
assert.equal(p36.developmentCycles[0].verifiedEvidenceCount,0);
assert.equal(p36.developmentCycles[0].lastEvidenceAt,0);
console.log('P36_MIGRATION=PASS',JSON.stringify({schema:migrated.schemaVersion,p36Version:p36.version,hypotheses:p36.hypotheses.length,evidenceRows:p36.externalEvidence.length,restoredPromotion:p36.hypotheses[0].status}));
