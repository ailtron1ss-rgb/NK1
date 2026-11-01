import assert from 'node:assert/strict';
import { UserModelEvidenceModel } from '../src/organism/cognition/UserModelEvidenceModel.ts';

const model = new UserModelEvidenceModel();
assert.equal(model.recordExplicit({key:'response.style',domain:'interaction-style',value:'detailed',tick:10,evidenceRef:'user-explicit:style:10',explicit:true,sensitivity:'low-risk'}).accepted,true);
assert.equal(model.confirmedValue('response.style','interaction-style'),'detailed');
assert.equal(model.recordExplicit({key:'response.style',domain:'interaction-style',value:'concise',tick:11,evidenceRef:'user-explicit:style:11',explicit:true,sensitivity:'low-risk'}).status,'disputed');
model.observeBehavior({key:'response.style',domain:'interaction-style',value:'concise',tick:11,observationRef:'behavior:style:12',sensitivity:'low-risk'});
const forgotten=model.forgetExplicit({key:'response.style',domain:'interaction-style',tick:13,evidenceRef:'user-explicit:forget-style:13',explicit:true});
assert.deepEqual(forgotten,{accepted:true,removed:true,key:'response.style',domain:'interaction-style'});
assert.equal(model.confirmedValue('response.style','interaction-style'),null);
assert.equal(model.snapshot().claims.length,0);
assert.equal(model.snapshot().candidates.length,0);
assert.equal(model.snapshot().version,2);
assert.equal(model.snapshot().forgetTombstones.length,1);

// A tombstone, not the short replay ledger, blocks delayed facts and behavior.
for(let n=0;n<520;n++) model.observeBehavior({key:'noise.preference',domain:'content-preference',value:'x',tick:20+n,observationRef:'noise:'+n,sensitivity:'low-risk'});
const restored=new UserModelEvidenceModel();
restored.restore(model.snapshot());
assert.equal(restored.recordExplicit({key:'response.style',domain:'interaction-style',value:'detailed',tick:10,evidenceRef:'user-explicit:style:10',explicit:true,sensitivity:'low-risk'}).reason,'forgotten-before-event');
assert.equal(restored.observeBehavior({key:'response.style',domain:'interaction-style',value:'concise',tick:12,observationRef:'behavior:stale:12',sensitivity:'low-risk'}).reason,'forgotten-before-event');
assert.equal(restored.forgetExplicit({key:'response.style',domain:'interaction-style',tick:15,evidenceRef:'user-explicit:forget-style:13',explicit:true}).reason,'duplicate-evidence');

// Only a new explicit event after the deletion boundary may re-establish the preference.
assert.equal(restored.recordExplicit({key:'response.style',domain:'interaction-style',value:'concise',tick:16,evidenceRef:'user-explicit:style:16',explicit:true,sensitivity:'low-risk'}).status,'confirmed');
assert.equal(restored.confirmedValue('response.style','interaction-style'),'concise');
assert.equal(restored.snapshot().forgetTombstones.length,1);

assert.equal(restored.forgetExplicit({key:'response.style',domain:'interaction-style',tick:17,evidenceRef:'',explicit:true}).reason,'missing-evidence');
assert.equal(restored.forgetExplicit({key:'__proto__',domain:'interaction-style',tick:18,evidenceRef:'invalid:key',explicit:false}).reason,'invalid-input');

// Version-1 snapshots remain readable and are upgraded to version 2.
const legacy=new UserModelEvidenceModel();
legacy.restore({version:1,claims:[],candidates:[],processedEvidenceRefs:[],rejectedSensitiveCount:0,rejectedMalformedCount:0});
assert.equal(legacy.snapshot().version,2);
assert.equal(legacy.snapshot().forgetTombstones.length,0);
assert.equal(legacy.recordExplicit({key:'response.style',domain:'interaction-style',value:'balanced',tick:1,evidenceRef:'legacy:new:1',explicit:true,sensitivity:'low-risk'}).status,'confirmed');

console.log('UserModel durable forgetting, 512+ event replay resistance, fresh re-consent and v1 migration: all assertions passed');
