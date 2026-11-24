import { spawn } from 'node:child_process';
const checks=[
 ['reality','npm run audit:reality:all'],
 ['b188','npm run test:big-pass-188'],
 ['b187','npm run test:big-pass-187'],
 ['b186','npm run test:big-pass-186'],
 ['b185','npm run test:big-pass-185'],
 ['b183','npm run test:big-pass-183'],
 ['p23','npm run test:p23:learning && npm run test:p23:integration'],
 ['p26','npm run test:p26:true-learning && npm run test:p26:world'],
 ['p28','npm run test:p28:plasticity'],
 ['p29','npm run test:p29:governance && npm run test:p29:continual'],
 ['p30','npm run test:p30:continual && npm run test:p30:trajectory'],
 ['p31','npm run test:p31:consciousness && npm run test:p31:lesion && npm run test:p31:truthfulness'],
 ['p32','npm run test:p32:causal && npm run test:p32:lesion && npm run test:p32:truthfulness'],
 ['p33','npm run test:p33:personhood && npm run test:p33:continuity'],
 ['p34','npm run test:p34:personhood'],
 ['p38','npm run test:p38:research'],
 ['p39','npm run test:p39:life'],
 ['p40','npm run test:p40:semantic && npm run test:p40:server'],
 ['p41','npm run test:p41:native && npm run test:p41:semantic && npm run test:p41:temporal && npm run test:p41:truthfulness'],
 ['long','npm run test:long-horizon:operational:250 && node --experimental-strip-types tests/long-horizon-memory.mjs'],
 ['runtime','npm run test:smoke && npm run test:restart && npm run test:memory && npm run test:concurrency'],
 ['quality','npm run audit:architecture && npm run audit:integrity && npm run audit:forensics && npm run audit:hygiene && npm run verify:release-source'],
];
const run=cmd=>new Promise(resolve=>{const c=spawn(cmd,{shell:true,stdio:'inherit',env:process.env});c.on('close',code=>resolve(code??1));});
for(const [name,cmd] of checks){console.log(`\n=== ${name} ===`);const code=await run(cmd);if(code!==0){console.error(`AUDIT_188=FAIL stage=${name} code=${code}`);process.exit(code)}}
console.log('AUDIT_188=PASS');
