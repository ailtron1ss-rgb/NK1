import assert from 'node:assert/strict';
import { comparePairedContinualRuns } from '../src/organism/learning/ContinualBenchmarkComparison.ts';
const fp='a'.repeat(64);
const runs=[
 {method:'baseline',seed:1,manifestFingerprint:fp,taskScores:{a:0.5,b:0.4},forgettingByTask:{a:0.2,b:0.3}},
 {method:'candidate',seed:1,manifestFingerprint:fp,taskScores:{a:0.7,b:0.5},forgettingByTask:{a:0.1,b:0.2}},
 {method:'baseline',seed:2,manifestFingerprint:fp,taskScores:{a:0.6,b:0.4},forgettingByTask:{a:0.1,b:0.3}},
 {method:'candidate',seed:2,manifestFingerprint:fp,taskScores:{a:0.8,b:0.6},forgettingByTask:{a:0.1,b:0.1}},
 {method:'candidate',seed:3,manifestFingerprint:fp,taskScores:{a:0.9,b:0.9},forgettingByTask:{a:0.1,b:0.1}},
];
const summary=comparePairedContinualRuns(runs,'baseline','candidate');
assert.equal(summary.pairedN,2);
assert.equal(summary.successScore.pairedN,2,'uncertainty uses matched runs, not correlated task cells');
assert.equal(summary.forgetting.pairedN,2);
assert.ok(Math.abs(summary.successScore.meanDelta-0.175)<1e-12);
assert.ok(Math.abs(summary.forgetting.meanDelta-(-0.1))<1e-12);
assert.ok(summary.successScore.approximate95CI);
assert.ok(summary.successScore.approximate95CI[0] < summary.successScore.meanDelta);
assert.ok(summary.successScore.approximate95CI[1] > summary.successScore.meanDelta);
assert.ok(summary.successScore.approximate95CI[1] - summary.successScore.approximate95CI[0] > 0.6,
  'two paired seeds must use the conservative small-sample Student-t interval, not a narrow normal interval');
assert.equal(summary.unpairedBaselineRuns,0);
assert.equal(summary.unpairedCandidateRuns,1);
const onePair=comparePairedContinualRuns(runs.slice(0,2),'baseline','candidate');
assert.equal(onePair.pairedN,1);
assert.equal(onePair.successScore.approximate95CI,null,'do not report a confidence interval from one paired run');
assert.throws(()=>comparePairedContinualRuns([...runs,runs[0]],'baseline','candidate'),/duplicate run/);
assert.throws(()=>comparePairedContinualRuns([{...runs[0],manifestFingerprint:'bad'}],'baseline','candidate'),/SHA-256/);
assert.throws(()=>comparePairedContinualRuns([
 runs[0],{...runs[1],taskScores:{other:0.7},forgettingByTask:{other:0.1}}
],'baseline','candidate'),/identical task set/);
assert.throws(()=>comparePairedContinualRuns([
 runs[0],{...runs[1],forgettingByTask:{a:0.1}}
],'baseline','candidate'),/task sets must match/);
assert.throws(()=>comparePairedContinualRuns(runs,'baseline','baseline'),/two distinct methods/);
console.log('PASS paired continual benchmark: run-level uncertainty, same-seed pairing, manifest/task integrity, forgetting and success deltas');
