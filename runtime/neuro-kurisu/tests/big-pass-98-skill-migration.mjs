import assert from 'node:assert/strict';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';
const legacy = new ProceduralSkillLibrary({ version:2, skills:[], promotions:0, demotions:0 });
const restored = legacy.snapshot();
assert.equal(restored.version, 8);
assert.ok(Array.isArray(restored.compoundSkills));
assert.equal(restored.compoundSkills.length, 0);
console.log('BIG_PASS_98_SKILL_MIGRATION=PASS');

const v3 = new ProceduralSkillLibrary();
v3.restore({ version:3, skills:[], compoundSkills:[{id:'compound:legacy',name:'legacy',origin:'project',projectSignature:'legacy',steps:[{id:'a',action:'explore',toolId:'tool.a',input:{}}],uses:0,successes:0,verifiedExecutions:0,independentExecutions:0,distinctContexts:1,confidence01:0,transferScore01:0,lastOutcome01:0,lastContext:'',status:'candidate',createdAt:0,lastUsedAt:0}],promotions:0,demotions:0,compoundPromotions:0 });
const restoredV3=v3.snapshot();
assert.equal(restoredV3.version,8);
assert.equal(restoredV3.compoundSkills[0].allowUnverified,undefined);
console.log('BIG_PASS_98_SKILL_MIGRATION_V5=PASS');
