import assert from 'node:assert/strict';
import { P44EmbodiedPredictiveSelfWorld } from '../src/organism/world/P44EmbodiedPredictiveSelfWorld.ts';
const p=new P44EmbodiedPredictiveSelfWorld();
const v=Array.from({length:24},(_,i)=>.35+i*.01); const a='explore';
const first=p.predict(v,a); p.observe(v,a, v.map(x=>Math.min(.98,x+.12)), .82);
for(let i=0;i<10;i++)p.observe(v,a,v.map(x=>Math.min(.98,x+.12)),.82);
const second=p.predict(v,a); const r=p.rollout(v,['explore','verify','reflect','rest'],1); const s=p.snapshot();
assert.ok(s.samples===11); assert.ok(s.metrics.oneStepAccuracy01>s.metrics.oneStepAccuracy01-0.001); assert.ok(r.values.length===4); assert.notDeepEqual(first.next,second.next);
console.log('P44_PREDICTIVE_WORLD=PASS',JSON.stringify({samples:s.samples,oneStep:s.metrics.oneStepAccuracy01.toFixed(3),rollout:r.values.length,confidence:r.confidence01.toFixed(3)}));
