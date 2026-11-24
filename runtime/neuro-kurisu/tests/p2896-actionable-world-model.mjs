import assert from 'node:assert/strict';
import { B261UnifiedWorldModel } from '../src/organism/cognition/B261UnifiedWorldModel.ts';
const actions=['wait','explore','verify','respond','rest','inspect','move','plan'];
const rewardByAction={wait:.20,explore:.58,verify:.54,respond:.43,rest:.31,inspect:.67,move:.12,plan:.73};
const samples=[];
for(let i=0;i<96;i++){
  const before=new Array(24).fill(0).map((_,j)=>((i+j*3)%11)/10);
  const outcomes={};
  for(const a of actions){
    const ai=actions.indexOf(a);
    const stateSignal=((before[(ai*3)%24]??0)-.5)*.42+((before[(ai*3+7)%24]??0)-.5)*.18;
    outcomes[a]={after:before.map((v,j)=>Math.tanh(v*.82+(j===ai?0.18:0))),reward01:Math.max(0,Math.min(1,rewardByAction[a]+stateSignal))};
  }
  samples.push({before,outcomes});
}
const m=new B261UnifiedWorldModel();
for(let epoch=0;epoch<28;epoch++) for(let i=0;i<64;i++) for(const a of actions){
  m.train(samples[i].before,a,samples[i].outcomes[a].after,samples[i].outcomes[a].reward01,i+epoch*1000,'online');
}
const bench=m.actionabilityBenchmark(samples.slice(64));
assert.ok(bench.modelRegret01<=bench.baselineRegret01+.05,'world model should improve or closely track deterministic baseline');
assert.ok(bench.actionHitRate01>=.5,'model should choose near-optimal action on held-out reward surface');
assert.ok(bench.actionSensitivity01>.02,'model should distinguish actions using state-conditioned reward differences');
console.log(JSON.stringify({pass:true,trainedOn:64,heldOut:32,...bench,diagnostics:m.diagnostics()}));
