import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const run=(label,args)=>{const out=execFileSync(args[0],args.slice(1),{encoding:'utf8'}); console.log(`[${label}] ${out.trim()}`);};
if(!existsSync('src/organism/learning/LifeCourseNavigator.ts')) throw new Error('missing life course engine');
run('TYPECHECK',['node','scripts/typecheck-runtime.mjs']);
run('TEST124',['node','--experimental-strip-types','tests/big-pass-124-life-course.mjs']);
run('TEST120',['node','--experimental-strip-types','tests/big-pass-120-developmental-executive.mjs']);
run('TEST123',['node','--experimental-strip-types','tests/big-pass-123-developmental-portfolio.mjs']);
console.log('AUDIT_BIG_PASS_124=PASS');
