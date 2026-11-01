import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

const source = new EmotionAppraisalEngine();
source.observeInteroception({energy01:.8,thermal01:.2,capacity01:.85,load01:.15});
const episode = source.appraise({tick:1,at:1001,novelty01:.8,uncertainty01:.4,success01:.9});
source.inferFeeling(episode,{energy01:.8,cognitiveLoad01:.2,uncertainty01:.3});
source.recordOutcome({action:'rest',success01:.9,surprise01:.1});
const valid = source.snapshot();
const roundTrip = new EmotionAppraisalEngine();
roundTrip.restore(valid);
assert.deepEqual(roundTrip.snapshot(), valid, 'valid v2 snapshot must round-trip exactly');

let getterCalls = 0;
const getterRoot = {};
Object.defineProperty(getterRoot,'episodes',{enumerable:true,get(){getterCalls++;return 99;}});
const fromGetter = new EmotionAppraisalEngine();
fromGetter.restore(getterRoot);
assert.equal(getterCalls,0,'root accessors must never execute');
assert.equal(fromGetter.snapshot().episodes,0,'accessor-backed root must fail closed');

const nestedGetter = { ...valid, interoception: {} };
Object.defineProperty(nestedGetter.interoception,'cycles',{enumerable:true,get(){getterCalls++;return 100;}});
const fromNestedGetter = new EmotionAppraisalEngine();
fromNestedGetter.restore(nestedGetter);
assert.equal(getterCalls,0,'nested accessors must never execute');
assert.equal(fromNestedGetter.snapshot().interoception.cycles,0,'malformed nested record must use defaults');

const inherited = Object.create({episodes:999});
inherited.lastLabel='joy';
const fromInherited = new EmotionAppraisalEngine();
fromInherited.restore(inherited);
assert.equal(fromInherited.snapshot().episodes,0,'inherited root must fail closed');

const hostile = new Proxy({}, { ownKeys(){throw new Error('hostile proxy'); } });
const fromProxy = new EmotionAppraisalEngine();
assert.doesNotThrow(()=>fromProxy.restore(hostile),'hostile proxy must fail closed');
assert.equal(fromProxy.snapshot().episodes,0);

const sparse = { ...valid, history: new Array(2) };
const fromSparse = new EmotionAppraisalEngine();
fromSparse.restore(sparse);
assert.equal(fromSparse.snapshot().history.length,0,'sparse arrays must be rejected');

const invalid = {
  ...valid,
  episodes: Infinity,
  lastAt: NaN,
  meanStress01: 7,
  meanArousal01: -4,
  history: [{ ...valid.history[0], arousal01: Infinity }],
  feelings: [{ ...valid.feelings[0], causeEmotionId:'missing-episode' }],
  outcomes: { rest:{attempts:-3,meanSuccess01:NaN,meanSurprise01:2,meanBenefit01:0.5} }
};
const sanitized = new EmotionAppraisalEngine();
sanitized.restore(invalid);
const snap = sanitized.snapshot();
assert.equal(snap.episodes,1,'episode count must remain at least retained valid history length');
assert.equal(snap.lastAt,0,'non-finite timestamp must be replaced');
assert.equal(snap.meanStress01,1,'normalized metrics must be clamped');
assert.equal(snap.meanArousal01,0,'normalized metrics must be clamped');
assert.equal(snap.history.length,0,'non-finite episode metrics must be dropped');
assert.equal(snap.feelings.length,0,'orphan feeling links must be dropped');
assert.equal(snap.outcomes.rest,undefined,'invalid outcome calibration must be dropped');

const badOutcome = { ...valid, outcomes: new Proxy({}, { ownKeys(){throw new Error('outcome proxy');} }) };
assert.doesNotThrow(()=>new EmotionAppraisalEngine().restore(badOutcome),'hostile nested proxy must fail closed');

console.log(JSON.stringify({pass:610,status:'PASS',checks:['v2-roundtrip','root-getter','nested-getter','inherited-root','hostile-proxy','sparse-array','finite-and-range-validation','orphan-feeling','outcome-validation']},null,2));
