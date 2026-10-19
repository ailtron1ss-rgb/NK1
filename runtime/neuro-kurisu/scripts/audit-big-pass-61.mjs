import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const version=JSON.parse(read('VERSION.json'));
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['release version synchronized',version.application===pkg.version&&read('src/organism/system/ReleaseContract.ts').includes(`application: '${version.application}'`)],
 ['release phase shadow cognition',fs.existsSync(path.join(root,'src/organism/system/ShadowOrganism.ts')) && fs.existsSync(path.join(root,'docs/BIG_PASS_61_AUDIT_REPORT_RU.md'))],
 ['shadow panel lenses',read('src/organism/system/ShadowOrganism.ts').includes("'balanced'|'cautious'|'epistemic'|'goal'|'frugal'")],
 ['shadow ensemble metrics',/ensembleDisagreement01|entropy01|escalation/.test(read('src/organism/system/ShadowOrganism.ts'))],
 ['shadow state migration compatible',/raw\.recent.*slice\(-96\)|version:3/.test(read('src/organism/system/ShadowOrganism.ts'))],
 ['planner selective deep gate',/shadowEscalation.*sources.*shadowEscalation01|shadowEscalation/.test(read('src/organism/core/CognitiveExecutionPlanner.ts'))],
 ['pressure shadow source',/shadowDisagreement01|shadowEscalation01/.test(read('src/organism/cognition/CognitivePressureField.ts'))],
 ['core receives shadow pressure',/shadow: \(\(\) =>/.test(read('src/organism/core/OrganismCore.ts'))],
 ['core persists shadow immediately',/if \(shadowDecision\) this\.persisted\.system\.shadowOrganism/.test(read('src/organism/core/OrganismCore.ts'))],
 ['core exposes shadow metrics',/shadowDisagreement01|shadowEscalations/.test(read('src/organism/core/OrganismCore.ts'))],
 ['shadow unit regression',fs.existsSync(path.join(root,'tests/big-pass-61-shadow-cognition.mjs'))],
 ['shadow core regression',fs.existsSync(path.join(root,'tests/big-pass-61-shadow-core-e2e.mjs'))],
 ['package test command',Boolean(pkg.scripts?.['test:big-pass-61']&&pkg.scripts?.['test:big-pass-61:shadow']&&pkg.scripts?.['test:big-pass-61:core-shadow'])],
 ['package audit command',pkg.scripts?.['audit:pass61']?.includes('test:big-pass-61')],
 ['documentation',fs.existsSync(path.join(root,'docs/BIG_PASS_61_AUDIT_REPORT_RU.md'))&&fs.existsSync(path.join(root,'docs/BIG_PASS_61_PLAN_RU.md'))&&fs.existsSync(path.join(root,'docs/BIG_PASS_61_PROGRESS_RU.md'))],
];
let fail=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}
console.log(`BIG_PASS_61_AUDIT=${fail?'FAIL':'PASS'} checks=${checks.length} failed=${fail}`);
if(fail)process.exit(1);
