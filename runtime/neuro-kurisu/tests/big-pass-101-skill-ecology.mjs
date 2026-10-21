import assert from 'node:assert/strict';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';

const lib=new ProceduralSkillLibrary();
const skill=lib.compileCompoundSkill({projectId:'eco-101',name:'variant-skill',origin:'intrinsic',steps:[
 {id:'a',action:'explore',toolId:'tool.a'},
 {id:'b',action:'verify',toolId:'tool.primary',fallbackToolIds:['tool.fallback']}
]});
assert.ok(skill);

// A verified in-distribution repair observation should materialize a staged variant
// through the existing repair-recording path; it must not activate that variant.
const autoRepair = lib.compileCompoundSkill({projectId:'eco-101',name:'auto-repair',origin:'intrinsic',steps:[
 {id:'a',action:'explore',toolId:'tool.a'},
 {id:'b',action:'verify',toolId:'tool.primary',fallbackToolIds:['tool.fallback']}
]});
assert.ok(autoRepair);
const repaired = lib.recordCompoundRepair(autoRepair.id,{
 stepId:'b',toolId:'tool.primary',error:'execution error',ok:false,verified:true,
 confidence01:.9,context:'verified runtime failure',candidateTools:['tool.fallback'],selectedTool:'tool.fallback',holdout:false
});
assert.ok(repaired);
assert.ok(repaired.variants.some(v=>v.status==='candidate'&&v.toTool==='tool.fallback'));
assert.notEqual(repaired.activeVariantId,repaired.variants.find(v=>v.toTool==='tool.fallback')?.id,
 'recording repair evidence must stage, not activate, the new variant');

const stagedCount = repaired.variants.filter(v=>v.toTool==='tool.fallback').length;
const repeated = lib.recordCompoundRepair(autoRepair.id,{
 stepId:'b',toolId:'tool.primary',error:'execution error',ok:false,verified:true,
 confidence01:.9,context:'verified runtime failure',candidateTools:['tool.fallback'],selectedTool:'tool.fallback',holdout:false
});
assert.ok(repeated);
assert.equal(repeated.variants.filter(v=>v.toTool==='tool.fallback').length,stagedCount,
 'replaying the same repair observation must not mint a new variant');

// A different observation may arrive between retries; deduplication must still
// search the bounded ledger, not just its newest row.
const interleaved = lib.recordCompoundRepair(autoRepair.id,{
 stepId:'b',toolId:'tool.primary',error:'attempt limit reached',ok:false,verified:true,
 confidence01:.9,context:'independent repair context',candidateTools:['tool.fallback'],selectedTool:'tool.fallback',holdout:false
});
assert.ok(interleaved);
const countAfterInterleaving = interleaved.variants.filter(v=>v.toTool==='tool.fallback').length;
const replayAfterInterleaving = lib.recordCompoundRepair(autoRepair.id,{
 stepId:'b',toolId:'tool.primary',error:'execution error',ok:false,verified:true,
 confidence01:.9,context:'verified runtime failure',candidateTools:['tool.fallback'],selectedTool:'tool.fallback',holdout:false
});
assert.ok(replayAfterInterleaving);
assert.equal(replayAfterInterleaving.variants.filter(v=>v.toTool==='tool.fallback').length,countAfterInterleaving,
 'an older repair observation must remain deduplicated after intervening ledger entries');

// Holdout-only evidence must not be used to construct a repair candidate.
const holdoutOnly = lib.compileCompoundSkill({projectId:'eco-101',name:'holdout-only',origin:'intrinsic',steps:[
 {id:'a',action:'explore',toolId:'tool.a'},
 {id:'b',action:'verify',toolId:'tool.primary',fallbackToolIds:['tool.fallback']}
]});
assert.ok(holdoutOnly);
const held = lib.recordCompoundRepair(holdoutOnly.id,{
 stepId:'b',toolId:'tool.primary',error:'execution error',ok:false,verified:true,
 confidence01:.95,context:'sealed holdout failure',candidateTools:['tool.fallback'],selectedTool:'tool.fallback',holdout:true
});
assert.ok(held);
assert.equal(held.variants.filter(v=>v.toTool==='tool.fallback').length,0,
 'holdout observations must remain evaluation-only');

const variant=lib.createRepairVariant(skill.id,{stepId:'b',toTool:'tool.fallback',reason:'verified alternative'});
assert.ok(variant); assert.equal(variant.status,'candidate');
// Direct promotion and the meta-operation must enforce the same evidence gate
// as automatic promotion; an untested candidate cannot replace the active variant.
assert.equal(lib.promoteVariant(skill.id,variant.id),null,
 'direct promotion must reject candidates without independent verified evidence');
assert.equal(lib.skillMetaOperation('promote-variant',skill.id,{variantId:variant.id}),null,
 'meta-operation promotion must not bypass the evidence gate');
assert.equal(lib.snapshot().compoundSkills.find(s=>s.id===skill.id).activeVariantId,`base:${skill.id}`);
assert.equal(lib.snapshot().compoundSkills.find(s=>s.id===skill.id).variants.find(v=>v.id===variant.id).status,'candidate');
lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,independent:true,context:'live-1'});
lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,context:'live-2'});
const beforeFinal=lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,context:'live-3'});
assert.equal(beforeFinal.status,'candidate','three live outcomes remain below the confidence gate');
const liveFour=lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,context:'live-4'});
assert.equal(liveFour.status,'active','sufficient non-holdout evidence may promote the candidate');
const confidenceBeforeHoldout=liveFour.confidence01;
lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,holdout:true,context:'holdout-1'});
const after=lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,holdout:true,context:'holdout-2'});
assert.ok(after); assert.equal(after.confidence01,confidenceBeforeHoldout,'holdout must not inflate confidence');
assert.equal(lib.snapshot().compoundSkills[0].activeVariantId,variant.id);
assert.equal(lib.snapshot().compoundSkills[0].steps[1].toolId,'tool.fallback');
const rolled=lib.rollbackCompoundSkill(skill.id,'regression-test');
assert.ok(rolled); assert.equal(lib.snapshot().compoundSkills[0].steps[1].toolId,'tool.primary');
assert.equal(lib.skillMetaOperation('compare-variants',skill.id).length,2);

// Holdout outcomes are evaluation-only: even repeated verified successes cannot
// satisfy the independent execution requirement or promote a candidate.
const sealedSkill = lib.compileCompoundSkill({projectId:'eco-101',name:'sealed-holdout-promotion',origin:'intrinsic',steps:[
 {id:'a',action:'explore',toolId:'tool.a'},
 {id:'b',action:'verify',toolId:'tool.primary',fallbackToolIds:['tool.fallback']}
]});
assert.ok(sealedSkill);
const sealedVariant = lib.createRepairVariant(sealedSkill.id,{stepId:'b',toTool:'tool.fallback',reason:'holdout isolation regression'});
assert.ok(sealedVariant);
for (let n=0;n<5;n++) {
  const observed=lib.recordVariantExecution(sealedSkill.id,sealedVariant.id,{
    success01:1,verified:true,independent:true,holdout:true,context:`sealed-holdout-${n}`
  });
  assert.ok(observed);
}
// One verified deployment result plus many holdout successes is still
// insufficient: holdout outcomes cannot supply the second promotion witness.
const mixedSkill = lib.compileCompoundSkill({projectId:'eco-101',name:'mixed-holdout-promotion',origin:'intrinsic',steps:[
 {id:'a',action:'explore',toolId:'tool.a'},
 {id:'b',action:'verify',toolId:'tool.primary',fallbackToolIds:['tool.fallback']}
]});
assert.ok(mixedSkill);
const mixedVariant = lib.createRepairVariant(mixedSkill.id,{stepId:'b',toTool:'tool.fallback',reason:'mixed evidence regression'});
assert.ok(mixedVariant);
lib.recordVariantExecution(mixedSkill.id,mixedVariant.id,{success01:1,verified:true,independent:true,context:'independent-live-context'});
for(let n=0;n<4;n++) lib.recordVariantExecution(mixedSkill.id,mixedVariant.id,{
 success01:1,verified:true,independent:true,holdout:true,context:`mixed-holdout-${n}`
});
const mixedAfter=lib.snapshot().compoundSkills.find(s=>s.id===mixedSkill.id);
const mixedFinal=mixedAfter.variants.find(v=>v.id===mixedVariant.id);
assert.equal(mixedFinal.verifiedNonHoldoutExecutions,1);
assert.equal(mixedFinal.nonHoldoutTrials,1);
const mixedConfidence=mixedFinal.confidence01;
assert.equal(mixedFinal.status,'candidate','holdout results cannot satisfy the second verified non-holdout witness');
assert.notEqual(mixedAfter.activeVariantId,mixedVariant.id);
for(let n=0;n<3;n++) lib.recordVariantExecution(mixedSkill.id,mixedVariant.id,{success01:1,verified:true,holdout:true,context:`mixed-extra-holdout-${n}`});
const mixedAfterHoldout=lib.snapshot().compoundSkills.find(s=>s.id===mixedSkill.id).variants.find(v=>v.id===mixedVariant.id);
assert.equal(mixedAfterHoldout.confidence01,mixedConfidence,'holdout outcomes must not increase candidate confidence');
assert.equal(mixedAfterHoldout.nonHoldoutTrials,1);

const sealedAfter=lib.snapshot().compoundSkills.find(s=>s.id===sealedSkill.id);
assert.equal(sealedAfter.variants.find(v=>v.id===sealedVariant.id).status,'candidate',
 'holdout-only outcomes must not promote a variant');
assert.notEqual(sealedAfter.activeVariantId,sealedVariant.id,
 'holdout-only outcomes must never change the active tool');

// Persisted candidate evidence must survive restore, while legacy snapshots
// without the new field fail closed instead of borrowing old holdout-ambiguous counts.
const persistedState=lib.snapshot();
const persistedMixed=persistedState.compoundSkills.find(s=>s.id===mixedSkill.id);
assert.ok(persistedMixed);
const restoredLibrary=new ProceduralSkillLibrary();
restoredLibrary.restore(persistedState);
const restoredMixed=restoredLibrary.snapshot().compoundSkills.find(s=>s.id===mixedSkill.id);
assert.equal(restoredMixed.variants.find(v=>v.id===mixedVariant.id).verifiedNonHoldoutExecutions,1,
 'new evidence counters must survive a save/restore cycle');
const legacyState=structuredClone(persistedState);
for(const s of legacyState.compoundSkills) for(const v of s.variants) delete v.verifiedNonHoldoutExecutions; delete v.nonHoldoutTrials; delete v.nonHoldoutSuccesses;
const restoredLegacy=new ProceduralSkillLibrary();
restoredLegacy.restore(legacyState);
const legacyMixed=restoredLegacy.snapshot().compoundSkills.find(s=>s.id===mixedSkill.id);
assert.equal(legacyMixed.variants.find(v=>v.id===mixedVariant.id).nonHoldoutTrials,0,
 'legacy snapshots must not infer trusted non-holdout trial counts');
assert.equal(legacyMixed.variants.find(v=>v.id===mixedVariant.id).verifiedNonHoldoutExecutions,0,
 'legacy evidence without holdout provenance must not be promoted into trusted non-holdout evidence');

const cx=new CausalExperienceStream();
const cr=cx.recordExternalLearningEvent({tick:7,taskId:'repair-task',action:'explore',reward01:.9,success01:1,surprise01:.55,novelty01:.6,causalStrength01:.8});
assert.ok(cr.causalStrength01>=.79);
const ul=new UnifiedLearningSubstrate();
const us=ul.ingestExternalSignal({taskId:'repair-task',action:'explore',reward01:.9,success01:1,surprise01:.55,novelty01:.6,causalStrength01:.8,transferPotential01:.72});
assert.ok(us.learningOpportunity01>.5);
console.log('BIG_PASS_101_SKILL_ECOLOGY=PASS',JSON.stringify({version:lib.snapshot().version,variant:variant.id,activeVariantAfterRollback:lib.snapshot().compoundSkills[0].activeVariantId,rollbackTo:rolled.id,causalRecords:cx.summary().records,learningOpportunity01:us.learningOpportunity01}));
