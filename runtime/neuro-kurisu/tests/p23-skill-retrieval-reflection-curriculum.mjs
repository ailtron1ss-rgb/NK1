import assert from 'node:assert/strict';
import { contextSimilarity01,retrieveSkills,retrievedSkillBias } from '../src/organism/learning/SkillRetrievalAugmentation.ts';
import { rankLearningTargets,reflectOnOutcomes } from '../src/organism/learning/OutcomeReflectionCurriculum.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
const ctx='e2|c2|u2|n2|g2|s2';
const skills=[
{id:'near-good',contextKey:'e2|c2|u2|n2|g3|s2',action:'verify',status:'promoted',validationSuccess01:.9,validationUses:12,confidence01:.8,updatedAt:1000,totalUses:20},
{id:'near-bad',contextKey:'e2|c2|u2|n2|g3|s2',action:'verify',status:'rejected',validationSuccess01:.2,validationUses:10,confidence01:.7,updatedAt:1000,totalUses:12},
{id:'weak',contextKey:'e0|c0|u0|n0|g0|s0',action:'verify',status:'promoted',validationSuccess01:.99,validationUses:1,confidence01:.9,updatedAt:1000,totalUses:50},
{id:'candidate',contextKey:ctx,action:'verify',status:'candidate',validationSuccess01:1,validationUses:30,confidence01:1,updatedAt:1000,totalUses:30}
];
assert.ok(contextSimilarity01(ctx,skills[0].contextKey)>.9);
assert.equal(retrieveSkills({contextKey:ctx,action:'verify',now:2000},skills).some(s=>s.id==='weak'),false);
assert.equal(retrieveSkills({contextKey:ctx,action:'verify',now:2000},skills).some(s=>s.id==='candidate'),false);
assert.ok(retrievedSkillBias({contextKey:ctx,action:'verify',now:2000},skills)>0);
const outcomes=Array.from({length:7},(_,i)=>({id:'x'+i,contextKey:ctx,action:'explore',success:i<2?0:.1,predictedUtility:.8,surprise:.9,tick:i}));
const reflections=reflectOnOutcomes(outcomes);

 // Equal-priority diagnoses must have identical order regardless of the order in which
 // provider/replay batches arrive. This keeps the autonomous repair queue reproducible.
 const tiedReflectionRows = ['z-context', 'a-context'].flatMap(contextKey =>
   Array.from({ length: 4 }, (_, i) => ({
     id: contextKey + '-' + i, contextKey, action: 'reflect', success: .1,
     predictedUtility: .8, surprise: .9, tick: i,
   })),
 );
 const tiedReflectionForward = reflectOnOutcomes(tiedReflectionRows);
 const tiedReflectionReverse = reflectOnOutcomes([...tiedReflectionRows].reverse());
 assert.deepEqual(
   tiedReflectionReverse.map(item => item.key),
   tiedReflectionForward.map(item => item.key),
   'equal-priority reflection queue ordering must not depend on input arrival order',
 );
 assert.deepEqual(
   tiedReflectionForward.map(item => item.contextKey),
   ['a-context', 'z-context'],
   'equal-priority diagnoses use stable code-unit tie-breaking after evidence strength/recency',
 );


const rewardAwareRows = Array.from({ length: 6 }, (_, i) => ({
  id: 'costly-' + i, contextKey: ctx, action: 'explore',
  success: .92, predictedUtility: .9, surprise: .08, reward: .12, tick: i,
}));
const rewardAwareReflection = reflectOnOutcomes(rewardAwareRows)[0];
assert.equal(rewardAwareReflection.kind, 'low-reward-efficiency',
  'repeated high-success but low-reward actions should trigger a cost-efficiency diagnosis');
assert.equal(rewardAwareReflection.rewardObserved01, .12);
assert.ok(rewardAwareReflection.rewardGap01 > .8);
assert.match(rewardAwareReflection.suggestedNextStep, /resource cost/,
  'the diagnosis should propose a targeted repair rather than label the action a success');
const conflictingRewardIdentity = reflectOnOutcomes([
  ...rewardAwareRows,
  { ...rewardAwareRows[0], reward: .99 },
]);
assert.ok(!conflictingRewardIdentity[0]?.sourceExperienceIds.includes('costly-0'),
  'reusing an evidence identity with a contradictory reward must quarantine it');
const legacyRewardReflection = reflectOnOutcomes(outcomes)[0];
assert.equal(legacyRewardReflection.rewardObserved01, undefined,
  'legacy reflection rows without reward preserve the old score schema and ranking semantics');

assert.ok(reflections.length>0);
assert.equal(reflections[0].kind,'repeated-context-failure');
assert.ok(reflections[0].priority01>.6);
assert.ok(reflections[0].evidenceNeeded.includes('independent'));
assert.equal(reflections[0].occurrences, 7);
assert.equal(reflections[0].sampleCount, 7, 'sampleCount must describe the exact window used for the metrics');
assert.equal(reflections[0].windowStartTick, 0);
assert.equal(reflections[0].windowEndTick, 6);
const longWindowRows = Array.from({ length: 12 }, (_, i) => ({
  id: 'long-window-' + i, contextKey: ctx, action: 'explore',
  success: .1, predictedUtility: .8, surprise: .7, tick: i,
}));
const longWindowReflection = reflectOnOutcomes(longWindowRows)[0];
assert.equal(longWindowReflection.occurrences, 12, 'occurrences retains the full valid history count');
assert.equal(longWindowReflection.sampleCount, 8, 'metrics explicitly report the capped recent window');
assert.equal(longWindowReflection.windowStartTick, 4);
assert.equal(longWindowReflection.windowEndTick, 11);
assert.equal(longWindowReflection.sourceExperienceIds.length, longWindowReflection.sampleCount);
assert.equal(reflections[0].passThreshold01, .5, 'the pass/fail boundary must be explicit and stable');
assert.equal(reflections[0].passRate01, 0, 'task-success pass rate uses the explicit 0.5 threshold');
 assert.equal(reflections[0].wilsonLowerPassRate01, 0, 'all-failure windows must not manufacture a positive lower success bound');
 assert.ok(reflections[0].wilsonUpperPassRate01 > 0 && reflections[0].wilsonUpperPassRate01 < 1,
   'small samples must report a non-zero uncertainty interval rather than certainty');
 assert.ok(reflections[0].passRateIntervalWidth01 > 0 && reflections[0].passRateIntervalWidth01 <= 1);
 assert.ok(reflections[0].confidence01 < 1, 'repeat observations must not be interpreted as certainty');

 // Observation identities are immutable: duplicates are idempotent and conflicting reuse is quarantined.
 const exactDuplicate = reflectOnOutcomes([...outcomes, { ...outcomes[0] }]);
 assert.equal(exactDuplicate[0].occurrences, 7, 'replayed identical evidence must not inflate reflection confidence');
 assert.equal(new Set(exactDuplicate[0].sourceExperienceIds).size, 7, 'reflection evidence IDs must remain unique');
 const identityConflict = reflectOnOutcomes([...outcomes, { ...outcomes[0], success: .99 }]);
 assert.equal(identityConflict[0].occurrences, 6, 'conflicting payloads sharing one event ID must quarantine that identity');
 assert.ok(!identityConflict[0].sourceExperienceIds.includes('x0'));
 const invalidIdentityReuse = reflectOnOutcomes([...outcomes, { ...outcomes[0], success: Number.NaN }]);
 assert.equal(invalidIdentityReuse[0].occurrences, 6, 'malformed reuse must not let an earlier valid row survive');
 assert.ok(!invalidIdentityReuse[0].sourceExperienceIds.includes('x0'));

 // Reflection and curriculum must never execute caller-owned getters.
 let experienceGetterCalls = 0;
 const getterExperience = Object.defineProperties({}, {
   id: { enumerable: true, get() { experienceGetterCalls++; return 'getter-experience'; } },
   contextKey: { enumerable: true, value: ctx },
   action: { enumerable: true, value: 'explore' },
   success: { enumerable: true, value: .1 },
   predictedUtility: { enumerable: true, value: .9 },
   surprise: { enumerable: true, value: .9 },
   tick: { enumerable: true, value: 1 },
 });
 assert.deepEqual(reflectOnOutcomes([getterExperience]), []);
 assert.equal(experienceGetterCalls, 0, 'an accessor-backed evidence ID must not run');
 let arrayGetterCalls = 0;
 const getterArray = new Array(1);
 Object.defineProperty(getterArray, '0', { enumerable: true, configurable: true, get() { arrayGetterCalls++; return outcomes[0]; } });
 assert.deepEqual(reflectOnOutcomes(getterArray), []);
 assert.equal(arrayGetterCalls, 0, 'array accessors must be rejected without being invoked');
 const revokedExperienceArray = Proxy.revocable([], {});
 revokedExperienceArray.revoke();
 assert.deepEqual(reflectOnOutcomes(revokedExperienceArray.proxy), [],
   'a revoked input-array proxy must be rejected rather than escaping the trust boundary');
 const revokedExperience = Proxy.revocable({ id: 'revoked-object' }, {});
 revokedExperience.revoke();
 assert.deepEqual(reflectOnOutcomes([revokedExperience.proxy]), [],
   'a revoked event proxy must be rejected rather than escaping the trust boundary');
 const revokedTargetArray = Proxy.revocable([], {});
 revokedTargetArray.revoke();
 assert.deepEqual(rankLearningTargets(revokedTargetArray.proxy), [],
   'a revoked curriculum-array proxy must be rejected rather than escaping the trust boundary');
 const revokedTarget = Proxy.revocable({ id: 'revoked-target' }, {});
 revokedTarget.revoke();
 assert.deepEqual(rankLearningTargets([revokedTarget.proxy]), [],
   'a revoked target proxy must be rejected without throwing');
 assert.deepEqual(reflectOnOutcomes(Array.from({ length: 4097 }, (_, i) => ({ ...outcomes[0], id: 'oversized-' + i }))), [],
   'oversized reflection batches must fail closed instead of truncating into a biased sample');

 const screenedTargets = rankLearningTargets([
   { id: 'valid-target', family: 'memory', uncertainty01: .7, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
   { id: 'invalid-target', family: 'memory', uncertainty01: Number.NaN, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
 ]);
 assert.deepEqual(screenedTargets.map(target => target.id), ['valid-target'], 'malformed target scores must not enter priority ranking');
assert.deepEqual(rankLearningTargets([
   { id: 'duplicate-target', family: 'memory', uncertainty01: .7, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
   { id: 'duplicate-target', family: 'memory', uncertainty01: .7, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
 ]).map(target => target.id), ['duplicate-target'], 'an exact duplicate target must not occupy two curriculum slots');
 assert.deepEqual(rankLearningTargets([
   { id: 'conflict-target', family: 'memory', uncertainty01: .7, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
   { id: 'conflict-target', family: 'memory', uncertainty01: .99, readiness01: .99, transfer01: .99, novelty01: .99, verificationCost01: 0, repairValue01: .99 },
   { id: 'independent-target', family: 'personality', uncertainty01: .6, readiness01: .7, transfer01: .5, novelty01: .3, verificationCost01: .3, repairValue01: .7 },
 ]).map(target => target.id), ['independent-target'], 'conflicting target IDs must be excluded instead of selecting whichever row scores higher');
 assert.deepEqual(rankLearningTargets([
   { id: 'malformed-target', family: 'memory', uncertainty01: .7, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
   { id: 'malformed-target', family: 'memory', uncertainty01: Number.NaN, readiness01: .8, transfer01: .6, novelty01: .4, verificationCost01: .2, repairValue01: .9 },
 ]), [], 'a malformed row cannot leave a same-ID valid row eligible');
 let targetGetterCalls = 0;
 const getterTarget = Object.defineProperties({}, {
   id: { enumerable: true, get() { targetGetterCalls++; return 'getter-target'; } },
   family: { enumerable: true, value: 'memory' },
   uncertainty01: { enumerable: true, value: .8 }, readiness01: { enumerable: true, value: .8 },
   transfer01: { enumerable: true, value: .8 }, novelty01: { enumerable: true, value: .8 },
   verificationCost01: { enumerable: true, value: .1 }, repairValue01: { enumerable: true, value: .9 },
 });
 assert.deepEqual(rankLearningTargets([getterTarget]), []);
 assert.equal(targetGetterCalls, 0, 'target accessors must never run during curriculum ranking');
const targets=rankLearningTargets([
{id:'blocked',family:'a',uncertainty01:1,readiness01:1,transfer01:1,novelty01:1,verificationCost01:0,repairValue01:1,blocked:true},
{id:'repair',family:'b',uncertainty01:.7,readiness01:.8,transfer01:.7,novelty01:.6,verificationCost01:.2,repairValue01:.9},
{id:'low-value',family:'c',uncertainty01:.1,readiness01:.1,transfer01:.1,novelty01:.1,verificationCost01:.9,repairValue01:.1}
]);
assert.equal(targets[0].id,'repair');
assert.equal(targets.find(x=>x.id==='blocked').score01,0);
assert.ok(targets.every(target => target.score01 >= 0 && target.score01 <= 1),
  'score01 must remain normalized even when verification cost dominates value');
const diverseTargets = rankLearningTargets([
  {id:'memory-high',family:'memory',uncertainty01:1,readiness01:1,transfer01:1,novelty01:1,verificationCost01:0,repairValue01:1},
  {id:'memory-next',family:'memory',uncertainty01:.8,readiness01:.8,transfer01:.8,novelty01:.8,verificationCost01:.1,repairValue01:.8},
  {id:'perception-high',family:'perception',uncertainty01:.7,readiness01:.7,transfer01:.7,novelty01:.7,verificationCost01:.1,repairValue01:.7},
  {id:'perception-next',family:'perception',uncertainty01:.4,readiness01:.4,transfer01:.4,novelty01:.4,verificationCost01:.2,repairValue01:.4},
  {id:'emotion-high',family:'emotion',uncertainty01:.5,readiness01:.5,transfer01:.5,novelty01:.5,verificationCost01:.2,repairValue01:.5},
], 5);
assert.equal(diverseTargets[0].id,'memory-high',
  'family diversity must preserve the globally best immediate repair target');
assert.equal(new Set(diverseTargets.slice(0,3).map(target=>target.family)).size,3,
  'curriculum interleaving should cover distinct eligible families before repeating a family');
const equalScoreTargets = rankLearningTargets([
  {id:'alpha',family:'single',uncertainty01:.5,readiness01:.5,transfer01:.5,novelty01:.5,verificationCost01:.2,repairValue01:.5},
  {id:'Älpha',family:'single',uncertainty01:.5,readiness01:.5,transfer01:.5,novelty01:.5,verificationCost01:.2,repairValue01:.5},
  {id:'Zulu',family:'single',uncertainty01:.5,readiness01:.5,transfer01:.5,novelty01:.5,verificationCost01:.2,repairValue01:.5},
],3);
assert.deepEqual(equalScoreTargets.map(target=>target.id),['Zulu','alpha','Älpha'],
  'equal-score curriculum tie-breaking must use deterministic code-unit order, independent of host locale');

// GEPA-inspired frontier selection: preserve a complementary learning direction
// before filling the queue with a dominated near-duplicate of the top target.
const frontierFixtures = [
  {id:'frontier-repair',family:'same',uncertainty01:.95,readiness01:.6,transfer01:.8,novelty01:.3,verificationCost01:.4,repairValue01:.9},
  {id:'dominated-near-clone',family:'same',uncertainty01:.9,readiness01:.55,transfer01:.75,novelty01:.25,verificationCost01:.5,repairValue01:.85},
  {id:'complementary-novelty',family:'same',uncertainty01:.4,readiness01:.3,transfer01:.2,novelty01:1,verificationCost01:.7,repairValue01:.3},
];
assert.deepEqual(rankLearningTargets(frontierFixtures,3).map(target=>target.id),
  ['frontier-repair','dominated-near-clone','complementary-novelty'],
  'the default weighted-score strategy remains backward-compatible');
assert.deepEqual(rankLearningTargets(frontierFixtures,3,'pareto-frontier').map(target=>target.id),
  ['frontier-repair','complementary-novelty','dominated-near-clone'],
  'Pareto-frontier mode must keep complementary strengths ahead of dominated near-duplicates');

const blockedFrontier = rankLearningTargets([
  {id:'blocked-super-score',family:'memory',uncertainty01:1,readiness01:1,transfer01:1,novelty01:1,verificationCost01:0,repairValue01:1,blocked:true},
  {id:'eligible-lower-score',family:'memory',uncertainty01:.6,readiness01:.6,transfer01:.5,novelty01:.4,verificationCost01:.3,repairValue01:.7},
],2,'pareto-frontier');
assert.deepEqual(blockedFrontier.map(target=>target.id),['eligible-lower-score','blocked-super-score'],
  'blocked prerequisites must remain behind every eligible Pareto layer even when their weighted score is higher');

const deterministicFrontierInput = [
  {id:'zeta',family:'alpha',uncertainty01:.5,readiness01:.5,transfer01:.5,novelty01:.5,verificationCost01:.2,repairValue01:.5},
  {id:'alpha',family:'alpha',uncertainty01:.5,readiness01:.5,transfer01:.5,novelty01:.5,verificationCost01:.2,repairValue01:.5},
];
assert.deepEqual(
  rankLearningTargets(deterministicFrontierInput,2,'pareto-frontier').map(target=>target.id),
  rankLearningTargets([...deterministicFrontierInput].reverse(),2,'pareto-frontier').map(target=>target.id),
  'Pareto ordering must not depend on caller insertion order when candidates have equal objective vectors');

const engine=new P23LearningEngine();
const policy={bias:()=>0};
const needs={energy:.8,cognitiveLoad:.2,uncertainty:.5,novelty:.5,goalPressure:.5,socialNeed:.5};
for(let i=0;i<8;i++){
 const trace={id:'integration-'+i,tick:i+1,createdAt:1000+i,stateBefore:{needs},
   selected:{action:'explore',predictedUtility:.2,confidence:.8,score:.8},
   predictedOutcomes:[{action:'explore',utility:.2}],
   candidates:[{action:'explore',score:.8,predictedUtility:.2}]};
 engine.recordExperience(trace,{needs},{success:.9,reward:.9,surprise:.1},policy);
}
const integrated=engine.learningSummary();
assert.ok(integrated.topSkills.some(s=>s.status==='promoted'),'validated P23 skill remains available');
assert.ok(integrated.reflections.some(r=>r.kind==='prediction-gap'),'P23 summary exposes outcome reflections');
assert.ok(integrated.nextLearningTargets.length>0,'P23 summary exposes actionable next learning targets');
const reflectedTarget = integrated.nextLearningTargets.find(target => target.id.startsWith('reflection:'));
assert.ok(reflectedTarget, 'P23 curriculum must surface at least one reflected repair target');
assert.equal(reflectedTarget.family,'reflection:prediction-gap:explore',
  'runtime curriculum families must encode the diagnosed failure mechanism, not only the selected action');
assert.equal(reflectedTarget.transfer01, 0,
  'repeating a failure in one context must not be misreported as cross-context skill transfer');
const debtTarget = integrated.nextLearningTargets.find(target => target.id.startsWith('debt-'));
assert.ok(debtTarget, 'P23 curriculum must surface outstanding verification debt');
assert.equal(debtTarget.family,'verification-debt:explore',
  'verification debt must not collapse into the reflection family merely because both reference the same action');
assert.equal(debtTarget.transfer01, 0,
  'information gain per verification cost is not evidence of skill transfer');
assert.ok(reflectedTarget.uncertainty01 > 0, 'reflection targets must include conservative observed failure risk');
console.log('P23_SKILL_RETRIEVAL_REFLECTION_CURRICULUM=PASS');
