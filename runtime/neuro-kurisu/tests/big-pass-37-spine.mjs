import assert from 'node:assert/strict';
import { ExternalEvidenceTrustEngine } from '../src/organism/system/ExternalEvidenceTrust.ts';
import { SelfPredictionBenchmark } from '../src/organism/system/SelfPredictionBenchmark.ts';
import { ModelOlympics } from '../src/organism/system/ModelOlympics.ts';
import { PredictionLedger } from '../src/organism/system/PredictionLedger.ts';
import { SelfModelEngine, defaultSelfModel } from '../src/organism/cognition/SelfModelV2.ts';

const ev=new ExternalEvidenceTrustEngine();
ev.observe({claimKey:'x',source:'organism',confidence01:.95,independenceKey:'self'});
const e2=ev.observe({claimKey:'x',source:'external-api',confidence01:.88,independenceKey:'api-a'});
const e3=ev.observe({claimKey:'x',source:'device',confidence01:.82,independenceKey:'sensor-a'});
assert.ok(e2.trust01>0.65); assert.ok(e3.independentSources>=3); assert.ok(ev.scoreClaim('x')>.7); assert.equal(ev.snapshot().acceptedCount>=1,true);

const sp=new SelfPredictionBenchmark();
sp.observe({tick:1,predicted:'explore',actual:'explore',confidence01:.8});
sp.observe({tick:2,predicted:'verify',actual:'explore',confidence01:.8});
assert.equal(sp.snapshot().samples,2); assert.ok(sp.snapshot().meanBrier01<.5);

const mo=new ModelOlympics();
mo.scoreRound({actual01:.9,predictions:{a:{predicted01:.85},b:{predicted01:.4}}});
mo.scoreRound({actual01:.1,predictions:{a:{predicted01:.75},b:{predicted01:.15}}});
assert.ok(mo.snapshot().winner); assert.equal(mo.snapshot().rounds,2);

const pl=new PredictionLedger();
const id=pl.record({tick:1,at:1,kind:'self',action:'explore',predicted01:1,confidence01:.8});
const r=pl.resolve(id,.0,2); assert.equal(r?.error01,1);
const sm=new SelfModelEngine(); sm.restore(defaultSelfModel()); sm.predict('explore',.8); sm.observe('explore',{needs:{identityCoherence:.8}} );
assert.ok(sm.snapshot().calibrationError < .5);
console.log('BIG_PASS_37_SPINE=PASS');
