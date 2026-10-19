import assert from 'node:assert/strict';
import { P39ContinuousArtificialLifeEngine, defaultP39ContinuousLife } from '../src/organism/learning/P39ContinuousArtificialLife.ts';
const a=new P39ContinuousArtificialLifeEngine();
a.restore(defaultP39ContinuousLife());
let at=Date.now();
for(let i=0;i<1000;i++){
  at+=60_000;
  const awake=(i%120)!==100 && (i%120)!==101;
  a.beginCycle({at,host:i<500?'phone-host':'phone-host-v2',awake,energy01:.78-(i%90===0?.18:0),cognitiveLoad01:.38+(i%17===0?.2:0),battery01:.8-(i%250===0?.55:0),thermal01:i%137===0?.88:.22,storagePressure01:i%211===0?.84:.2});
  if(!awake){const started=at-2*60_000;a.startSleep(started,'scheduled');a.endSleep(at,started,'scheduled',.88);}
  if(i%97===0)a.recordAction(.35);
  if(i%53===0)a.recordOutcome(.9,true);
  if(i%89===0)a.completeMaintenance({at,reason:'scheduled-long-horizon',compactions:1,memoryDormantDelta:1});
}
const before=a.snapshot();
assert.equal(before.lifeTicks,1000);
assert.ok(before.totalActiveMs>0);
assert.ok(before.totalSleepMs>0);
assert.ok(before.host.transfers>=1);
assert.ok(before.metrics.continuityGaps<3);
const cert=a.certification(1000);
assert.equal(cert.status,'verified');
const b=new P39ContinuousArtificialLifeEngine(); b.restore(before);
assert.deepEqual(b.snapshot(),before,'restart restore must preserve life state exactly');
const post=b.beginCycle({at:at+60_000,host:'phone-host-v2',awake:true,energy01:.8,cognitiveLoad01:.4,battery01:.78,thermal01:.2,storagePressure01:.2});
assert.equal(post.phase,b.snapshot().phase);
console.log('BIG_PASS_197_CONTINUOUS_LIFE=PASS',JSON.stringify({ticks:before.lifeTicks,activeMs:before.totalActiveMs,sleepMs:before.totalSleepMs,transfers:before.host.transfers,gaps:before.metrics.continuityGaps,certification:cert.status,continuity:cert.continuity01,restore:'PASS'}));
