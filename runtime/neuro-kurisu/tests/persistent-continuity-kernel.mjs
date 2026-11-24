import assert from 'node:assert/strict';
import { PersistentContinuityKernel } from '../src/organism/system/PersistentContinuityKernel.ts';

const k=new PersistentContinuityKernel(64,32);
const material=(tick,action='wait')=>({subjectId:k.snapshot().subjectId,schemaVersion:165,tick,at:1_000+tick,lastAction:action,lastActionSuccess:1,identityFingerprint:'identity-A',identityContinuity01:.92,p84MomentId:`m:${tick}`,p84Continuity01:.91,p84CausalContinuity01:.88,memoryAnchorIds:[`mem:${tick}`],activeGoalIds:['goal:main'],unresolvedIntentions:1,worldRevision:tick,b1600CampaignStep:tick,b1600Development01:.8});
const first=material(0);const resume=k.beginSession({now:1000,tick:0,currentStateHash:k.materialHash(first),reason:'boot'});assert.equal(resume.verified,true);
for(let i=0;i<50;i++){const r=k.commit(material(i, i%3===0?'reflect':'wait'),'durable-checkpoint');assert.equal(r.ok,true);}
const d=k.diagnostics();assert.equal(d.verified,true);assert.equal(d.headSeq,50);assert.equal(d.commits,50);
const snap=k.snapshot();const k2=new PersistentContinuityKernel();k2.restore(snap);assert.equal(k2.verify(k2.materialHash(material(48,'reflect'))).currentOk,false);
const same={...material(49,'wait'),at:1_049,tick:49};assert.equal(k2.verify(k2.materialHash(same)).currentOk,true);
const head=k2.snapshot().lineage.at(-1);assert.ok(head);
const exact={...material(head.tick,head.lastAction),at:head.at};assert.equal(k2.verify(k2.materialHash(exact)).verified,true);
const tampered=k2.snapshot();tampered.lineage[10]={...tampered.lineage[10],eventHash:'tampered'};const attacker=new PersistentContinuityKernel();attacker.restore(tampered);assert.equal(attacker.verify().verified,false);
const gapSession=attacker.beginSession({now:9_000_000,tick:49,currentStateHash:attacker.snapshot().lineage.at(-1)?.stateHash ?? '',reason:'long-sleep-resume'});assert.equal(gapSession.verified,true);
console.log('PERSISTENT_CONTINUITY_KERNEL_PASS');
console.log(JSON.stringify({commits:d.commits,resumes:d.resumes,headSeq:d.headSeq,lineage:d.lineageLength,verified:d.verified,restartContinuity01:d.restartContinuity01}));
