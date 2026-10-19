import assert from 'node:assert/strict';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';

const lib=new ProceduralSkillLibrary();
const skill=lib.compileCompoundSkill({projectId:'repair-100',name:'repairable',origin:'intrinsic',steps:[
 {id:'a',action:'explore',toolId:'tool.a',maxAttempts:1},
 {id:'b',action:'verify',toolId:'tool.primary',fallbackToolIds:['tool.fallback'],maxAttempts:1}
]});
assert.ok(skill);
const d=lib.diagnoseCompoundFailure({stepId:'b',toolId:'tool.primary',error:'execution failed code 502',ok:false,verified:false,context:'holdout science task'});
assert.equal(d.diagnosis,'execution-error');
assert.ok(d.failureFingerprint);
const r1=lib.recordCompoundRepair(skill.id,{stepId:'b',toolId:'tool.primary',error:'execution failed code 502',ok:false,verified:false,context:'holdout science task',candidateTools:['tool.primary','tool.fallback']});
assert.equal(r1.repairsLedger.length,1);
const r2=lib.adaptCompoundSkill(skill.id,{stepId:'b',fromTool:'tool.primary',toTool:'tool.fallback',reason:'verified alternative',verified:true,confidence01:.95});
assert.equal(r2.repairs,1);
const r2b=lib.adaptCompoundSkill(skill.id,{stepId:'b',fromTool:'tool.primary',toTool:'tool.fallback',reason:'verified alternative repeated',verified:true,confidence01:.95});
assert.equal(r2b.repairs,2);
const r3=lib.recordCompoundRepair(skill.id,{stepId:'b',toolId:'tool.primary',ok:true,verified:true,confidence01:.95,context:'different holdout task',candidateTools:['tool.primary','tool.fallback'],selectedTool:'tool.fallback',holdout:true});
assert.ok(r3.repairsLedger.some(x=>x.holdout));
const promoted=lib.promoteFallbackIfReliable(skill.id,'b','tool.fallback',{verified:true,confidence01:.95});
assert.ok(promoted);
assert.equal(promoted.steps[1].toolId,'tool.fallback');
assert.ok(promoted.lineageVersion>=3);
const candidates=lib.repairCandidates(skill.id,'b','tool.fallback');
assert.ok(candidates.includes('tool.primary'));
assert.equal(lib.snapshot().version,8);
console.log('BIG_PASS_100_SELF_REPAIR=PASS',JSON.stringify({version:lib.snapshot().version,diagnosis:d.diagnosis,ledger:r3.repairsLedger.length,lineage:promoted.lineageVersion,preferred:promoted.steps[1].toolId}));
