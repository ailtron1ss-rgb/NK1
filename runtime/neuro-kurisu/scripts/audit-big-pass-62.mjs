import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const version=JSON.parse(read('VERSION.json')); const pkg=JSON.parse(read('package.json'));
const gateway=read('src/organism/system/ActionGateway.ts'); const verifier=read('src/organism/system/OutcomeVerificationService.ts'); const core=read('src/organism/core/OrganismCore.ts');
const checks=[
 ['release synchronized',version.application===pkg.version&&version.stateSchema===95&&version.phase.includes('external-outcome-verification')&&read('src/organism/system/ReleaseContract.ts').includes(`application: '${version.application}'`)],
 ['verification service',verifier.includes('class OutcomeVerificationService')&&verifier.includes('external-postcondition')],
 ['tool verifier contract',gateway.includes('verify?:OutcomeVerifier')],
 ['structured verification result',gateway.includes('verification:OutcomeVerification')],
 ['destructive verifier gate',gateway.includes('live-destructive-verifier-required')],
 ['external evidence ledger',core.includes('outcomeVerification')&&core.includes('recordOutcomeVerification')],
 ['external outcome event',core.includes("'external-outcome-verified'" )],
 ['epistemic bridge',core.includes("claimKey:`tool:${id}:postcondition`")],
 ['world bridge',core.includes('observedWorldContextAfter')&&core.includes('worldSubsystem.observeGroundedContext')],
 ['migration 94 to 95',read('src/organism/persistence/StateMigrations.ts').includes('outcomeVerification:')],
 ['regression test',fs.existsSync(path.join(root,'tests/big-pass-62-outcome-verification.mjs'))],
 ['package command',Boolean(pkg.scripts?.['test:big-pass-62'])],
 ['docs',fs.existsSync(path.join(root,'docs/BIG_PASS_62_AUDIT_REPORT_RU.md'))&&fs.existsSync(path.join(root,'docs/BIG_PASS_62_PLAN_RU.md'))&&fs.existsSync(path.join(root,'docs/BIG_PASS_62_FINAL_STATUS_RU.md'))],
 ['current enhanced wired',pkg.scripts?.['audit:current-enhanced']?.includes('test:big-pass-62')],
 ['archive release notes',fs.existsSync(path.join(root,'RELEASE_NOTES_34.33.0_RU.md'))],
];
let fail=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(!ok) fail++;}
console.log(`BIG_PASS_62_AUDIT=${fail?'FAIL':'PASS'} checks=${checks.length} failed=${fail}`); if(fail)process.exit(1);
