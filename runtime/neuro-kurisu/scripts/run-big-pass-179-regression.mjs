import { spawn } from 'node:child_process';
const tests=[
  ['169','tests/big-pass-169-cognitive-integration.mjs'],
  ['170','tests/big-pass-170-personality-causality.mjs'],
  ['171','tests/big-pass-171-memory-value-identity-personality.mjs'],
  ['172','tests/big-pass-172-emotion-interoceptive-mind.mjs'],
  ['173','tests/big-pass-173-world-model-2.mjs'],
  ['174','tests/big-pass-174-function-reality-and-world-tickets.mjs'],
  ['175','tests/big-pass-175-autonomous-project-life.mjs'],
  ['176-long','tests/big-pass-176-longitudinal-integrity.mjs'],
  ['176-life','tests/big-pass-176-lifecycle-closure.mjs'],
  ['177-android','tests/big-pass-177-android-sensorimotor.mjs'],
  ['177-body','tests/big-pass-177-core-embodiment-causality.mjs'],
  ['178-compound','tests/big-pass-178-compound-adversarial.mjs'],
  ['178-core','tests/big-pass-178-core-adversarial.mjs'],
  ['179-consciousness','tests/big-pass-179-consciousness-battery.mjs'],
  ['179-core','tests/big-pass-179-core-causal-evidence.mjs']
];
const run=(file)=>new Promise((resolve,reject)=>{const cp=spawn(process.execPath,['--experimental-strip-types',file],{stdio:'inherit'});cp.on('exit',code=>code===0?resolve():reject(new Error(`${file} exit ${code}`)));cp.on('error',reject);});
for(const [name,file] of tests){console.log(`=== ${name} ===`);await run(file);}
console.log(JSON.stringify({pass:179,tests:tests.length,status:'PASS'}));
