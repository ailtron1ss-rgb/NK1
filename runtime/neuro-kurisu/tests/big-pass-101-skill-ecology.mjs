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
lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,independent:true,context:'holdout-1'});
lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,context:'holdout-2'});
const beforeFinal=lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,context:'holdout-3'});
lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,holdout:true,context:'holdout-4'});
const after=lib.recordVariantExecution(skill.id,variant.id,{success01:1,verified:true,holdout:true,context:'holdout-5'});
assert.ok(after); assert.equal(lib.snapshot().compoundSkills[0].activeVariantId,variant.id);
assert.equal(lib.snapshot().compoundSkills[0].steps[1].toolId,'tool.fallback');
const rolled=lib.rollbackCompoundSkill(skill.id,'regression-test');
assert.ok(rolled); assert.equal(lib.snapshot().compoundSkills[0].steps[1].toolId,'tool.primary');
assert.equal(lib.skillMetaOperation('compare-variants',skill.id).length,2);

const cx=new CausalExperienceStream();
const cr=cx.recordExternalLearningEvent({tick:7,taskId:'repair-task',action:'explore',reward01:.9,success01:1,surprise01:.55,novelty01:.6,causalStrength01:.8});
assert.ok(cr.causalStrength01>=.79);
const ul=new UnifiedLearningSubstrate();
const us=ul.ingestExternalSignal({taskId:'repair-task',action:'explore',reward01:.9,success01:1,surprise01:.55,novelty01:.6,causalStrength01:.8,transferPotential01:.72});
assert.ok(us.learningOpportunity01>.5);
console.log('BIG_PASS_101_SKILL_ECOLOGY=PASS',JSON.stringify({version:lib.snapshot().version,variant:variant.id,activeVariantAfterRollback:lib.snapshot().compoundSkills[0].activeVariantId,rollbackTo:rolled.id,causalRecords:cx.summary().records,learningOpportunity01:us.learningOpportunity01}));
