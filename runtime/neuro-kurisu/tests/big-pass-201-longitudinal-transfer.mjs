import assert from 'node:assert/strict';
import { LongitudinalSubjectTransferBattery, defaultLongitudinalSubjectTransfer } from '../src/organism/learning/LongitudinalSubjectTransferBattery.ts';
const b=new LongitudinalSubjectTransferBattery(); b.restore(defaultLongitudinalSubjectTransfer());
for(let i=0;i<18;i++) b.recordSession({id:`s-${i}`,taskFamily:['dialogue','science','planning','embodiment','reflection'][i%5],continuity01:.86-(i%7===0?.01:0),identity01:.82,agency01:.72,prediction01:.76,outcome01:.84,evidence01:i<12?.8:.65});
b.recordRestart(.95,.93); b.recordRestart(.92,.91);
for(let i=0;i<12;i++) b.recordTransfer(.82,.76+i*.01,.85);
const cert=b.certification(12); assert.equal(cert.status,'verified'); assert.equal(cert.criteria.restart,true); assert.equal(cert.criteria.transfer,true); assert.equal(cert.criteria.evidence,true);
const snap=b.snapshot(); const r=new LongitudinalSubjectTransferBattery(); r.restore(snap); assert.deepEqual(r.snapshot(),snap);
console.log('BIG_PASS_201_LONGITUDINAL_TRANSFER=PASS',JSON.stringify({sessions:snap.sessions,restarts:snap.restarts,transferTrials:snap.transferTrials,retention:cert.meanRetention01,transfer:cert.meanTransfer01,regressions:cert.regressions,status:cert.status,restore:'PASS'}));
