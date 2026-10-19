import assert from 'node:assert/strict';
import { CognitiveBudgetManager } from '../src/organism/cognition/CognitiveBudgetManager.ts';
import { PredictionLedger } from '../src/organism/system/PredictionLedger.ts';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';
import { RuntimeEvidenceBus } from '../src/organism/system/RuntimeEvidenceBus.ts';

const b=new CognitiveBudgetManager();
b.decide({battery01:0.9,thermal01:0.1,ramPressure01:0.1,cpuLoad01:0.1,attention01:0.9,expectedInformationGain01:0.7,complexity01:0.7,sleepPressure01:0.05});
const s=b.spend('llm-deep',.3,.8,{tick:1});
assert.equal(s.accepted,true); assert.ok(b.snapshot().spent01>0);

const p=new PredictionLedger();
const id=p.record({tick:1,at:1,kind:'world',action:'x',predicted01:.8,confidence01:.9});
const r=p.resolve(id,.2,2);
assert.ok(r); assert.ok(Math.abs(r.error01-.6)<1e-9);

const e=new P65EpistemicLedger();
const pid=e.record({tick:1,at:1,kind:'prediction',content:'x',confidence01:.9,predicted01:.8,source:'organism'});
const pr=e.resolvePrediction(pid,.2);
assert.ok(Math.abs(pr.error01-.6)<1e-9);
const bid=e.record({tick:1,at:1,kind:'belief',content:'temporary',confidence01:.8,source:'user'});
e.expireBeliefs(1+15*24*60*60*1000,7*24*60*60*1000);
assert.equal(e.snapshot().claimsData.find(x=>x.id===bid).status,'expired');

const bus=new RuntimeEvidenceBus(128);
const a=bus.publish({tick:1,kind:'observation',source:'test',confidence01:.9});
bus.publish({tick:1,kind:'action',source:'test',parentIds:[a.id],payload:{ok:true}});
const bs=bus.snapshot();
assert.equal(bs.linkedParentEvents,1); assert.equal(bs.danglingParentLinks,0); assert.equal(bs.lineageIntegrity01,1);
const restored=new RuntimeEvidenceBus(128); restored.restore(bs); assert.equal(restored.snapshot().total,bs.total);
console.log('BIG_PASS_36_BUDGET_EVIDENCE=PASS');
