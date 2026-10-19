import {spawn} from 'node:child_process';
const tests=[
'tests/big-pass-169-cognitive-integration.mjs',
  'tests/big-pass-169-recovery-certification.mjs',
  'tests/big-pass-169-functional-sweep.mjs',
  'tests/big-pass-170-personality-causality.mjs',
  'tests/big-pass-171-memory-value-identity-personality.mjs',
  'tests/big-pass-172-emotion-interoceptive-mind.mjs',
  'tests/big-pass-173-world-model-2.mjs',
  'tests/big-pass-174-function-reality-and-world-tickets.mjs',
  'tests/big-pass-175-autonomous-project-life.mjs',
  'tests/big-pass-175-core-project-closure.mjs',
  'tests/big-pass-175-project-recovery.mjs',
  'tests/big-pass-175-project-scheduler.mjs',
  'tests/big-pass-176-lifecycle-closure.mjs',
  'tests/big-pass-176-longitudinal-integrity.mjs',
  'tests/big-pass-177-android-sensorimotor.mjs',
  'tests/big-pass-177-core-embodiment-causality.mjs',
  'tests/big-pass-177-device-truthfulness.mjs',
  'tests/big-pass-178-compound-adversarial.mjs',
  'tests/big-pass-178-core-adversarial.mjs',
  'tests/big-pass-179-consciousness-battery.mjs',
  'tests/big-pass-179-core-causal-evidence.mjs',
  'tests/big-pass-180-lifecycle-function-closure.mjs',
  'tests/big-pass-180-reproducibility.mjs',
  'tests/big-pass-181-function-reality-closure.mjs'
];
const results=[]; const limit=4; let idx=0; const run=()=>{while(idx<tests.length && results.filter(r=>r.running).length<limit){const test=tests[idx++];const r={test,running:true,status:'RUNNING',startedAt:Date.now()};results.push(r);const p=spawn(process.execPath,['--experimental-strip-types',test],{stdio:'pipe'});let out='';let err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>{r.running=false;r.code=code;r.status=code===0?'PASS':'FAIL';r.durationMs=Date.now()-r.startedAt; delete r.running; delete r.stdout; delete r.stderr;run();});}}
run(); await new Promise(resolve=>{const check=setInterval(()=>{if(results.length===tests.length && results.every(r=>!r.running)){clearInterval(check);resolve();}},50)});
const summary={pass:181,total:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,tests:results};
import fs from 'node:fs'; fs.writeFileSync('BIG_PASS_181_REGRESSION_EVIDENCE.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({pass:181,total:summary.total,passed:summary.passed,failed:summary.failed},null,2));process.exit(summary.failed?1:0);
