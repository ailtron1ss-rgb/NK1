import assert from 'node:assert/strict';
import { P41TemporalPerceptionModel } from '../src/organism/cognition/P41TemporalPerceptionModel.ts';
const t=new P41TemporalPerceptionModel();
const seq=[
  {scene:'home',audioActivity01:.1,visionChange01:.02,uncertainty01:.2,entities:2,cues:['audio-silence'],at:1},
  {scene:'home',audioActivity01:.1,visionChange01:.02,uncertainty01:.2,entities:2,cues:['audio-silence'],at:2},
  {scene:'home',audioActivity01:.8,visionChange01:.4,uncertainty01:.35,entities:3,cues:['audio-activity'],at:3},
  {scene:'home',audioActivity01:.1,visionChange01:.02,uncertainty01:.2,entities:2,cues:['audio-silence'],at:4},
];
for(const x of seq)t.observe(x);
const s=t.snapshot();
assert.equal(s.tick,4);
assert.ok(Object.keys(s.transitionCounts).length>=2);
assert.ok(s.metrics.temporalBinding01>.1);
assert.ok(Number.isFinite(s.metrics.predictionAccuracy01));
console.log('P41_TEMPORAL=PASS');
console.log(`states=${Object.keys(s.visits).length} transitions=${Object.values(s.transitionCounts).reduce((n,r)=>n+Object.keys(r).length,0)} surprise=${s.metrics.surprise01.toFixed(3)}`);
