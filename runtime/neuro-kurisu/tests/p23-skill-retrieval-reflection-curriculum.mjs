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
assert.ok(reflections.length>0);
assert.equal(reflections[0].kind,'repeated-context-failure');
assert.ok(reflections[0].priority01>.6);
assert.ok(reflections[0].evidenceNeeded.includes('independent'));

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
console.log('WorkPass119 skill retrieval + outcome reflection + curriculum: PASS');
