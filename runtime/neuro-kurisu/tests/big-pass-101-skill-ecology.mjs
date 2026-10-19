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
