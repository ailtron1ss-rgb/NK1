import assert from 'node:assert/strict';
import { contextSimilarity01,retrieveSkills,retrievedSkillBias } from '../src/organism/learning/SkillRetrievalAugmentation.ts';
import { rankLearningTargets,reflectOnOutcomes } from '../src/organism/learning/OutcomeReflectionCurriculum.ts';
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
const targets=rankLearningTargets([
{id:'blocked',family:'a',uncertainty01:1,readiness01:1,transfer01:1,novelty01:1,verificationCost01:0,repairValue01:1,blocked:true},
{id:'repair',family:'b',uncertainty01:.7,readiness01:.8,transfer01:.7,novelty01:.6,verificationCost01:.2,repairValue01:.9},
{id:'low-value',family:'c',uncertainty01:.1,readiness01:.1,transfer01:.1,novelty01:.1,verificationCost01:.9,repairValue01:.1}
]);
assert.equal(targets[0].id,'repair');
assert.equal(targets.find(x=>x.id==='blocked').score01,0);
console.log('WorkPass119 skill retrieval + outcome reflection + curriculum: PASS');
