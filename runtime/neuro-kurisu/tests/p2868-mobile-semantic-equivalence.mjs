import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const script=new URL('./p2868-mobile-semantic-equivalence-worker.mjs',import.meta.url).pathname;
function run(envPatch={}){
  const r=spawnSync(process.execPath,['--experimental-strip-types',script],{env:{...process.env,...envPatch},encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
  if(r.status!==0) throw new Error(`worker failed: ${r.stderr||r.stdout}`);
  return JSON.parse(r.stdout.trim().split(/\n/).filter(Boolean).pop());
}
const normal=run({NODE_OPTIONS:''});
const mobile=run({NODE_OPTIONS:'--max-old-space-size=192'});
assert.deepEqual(mobile.actions,normal.actions,'mobile V8 profile changed action sequence');
assert.equal(mobile.tick,normal.tick,'mobile V8 profile changed logical tick');
assert.equal(mobile.learningUpdates,normal.learningUpdates,'mobile V8 profile changed learning update count');
assert.ok(Math.abs(mobile.replayAdaptation01-normal.replayAdaptation01)<1e-3,'mobile V8 profile changed replay adaptation materially');
assert.ok(Math.abs(mobile.grounded01-normal.grounded01)<1e-3,'mobile V8 profile changed grounded world signal materially');
console.log(`P2868_MOBILE_DECISION_EQUIVALENCE=PASS tick=${mobile.tick} actions=${mobile.actions.join(',')} learning=${mobile.learningUpdates}`);
