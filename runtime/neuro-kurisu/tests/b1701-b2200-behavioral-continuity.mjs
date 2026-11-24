import assert from 'node:assert/strict';
import { B1701B2200UnifiedLifeContinuityCore, defaultB1701B2200State } from '../src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const inp=(tick,utilities,reward=.85)=>({tick,at:1000+tick,context01:Array.from({length:48},(_,i)=>(i%7)/6),baseUtilities:utilities,priorBias:Object.fromEntries(A.map(a=>[a,0])),uncertainty01:.22,predictionError01:.12,novelty01:.18,confidence01:.8,energy01:.72,cognitiveLoad01:.28,identityContinuity01:.96,subjectId:'subject-continuity',identityFingerprint:'kurisu-anchor-v1',activeGoalIds:['goal:understand'],intentionIds:['intent:continue'],activeProjectId:'project-kurisu',preferenceKeys:['pref:verify-before-commit'],valueKeys:['value:coherence'],p84MomentId:`m:${tick}`,memoryAnchorIds:[`m:${Math.floor(tick/4)}`],reward01:reward});
const utilities=Object.fromEntries(A.map((a,i)=>[a,i===0?1:0]));
const c=new B1701B2200UnifiedLifeContinuityCore(); c.restore(defaultB1701B2200State()); c.beginSession('subject-continuity','',0,1000);
for(let t=1;t<=240;t++){const o=c.beforeDecision(inp(t,utilities,.9));c.afterOutcome({tick:t,at:1000+t,action:'respond',context01:Array(48).fill(.6),nextContext01:Array(48).fill(.61),reward01:.9,predictionError01:.08,success01:1,verified01:1,goalIds:['goal:understand'],memoryIds:[`m:${Math.floor(t/4)}`]});}
const s=c.snapshot();assert.ok(s.headSeq>=240);const transfer=c.exportTransferEnvelope('termux');
const restored=new B1701B2200UnifiedLifeContinuityCore();restored.restore(s);assert.equal(restored.verify().verified,true);const out=restored.beforeDecision(inp(241,utilities,.9));const argmax=Object.entries(out.actionBias).sort((a,b)=>b[1]-a[1])[0][0];assert.equal(argmax,'respond');
const imported=new B1701B2200UnifiedLifeContinuityCore();imported.restore(defaultB1701B2200State());imported.restore({...s,headSeq:0,headStateHash:'',headReceiptHash:'',hotReceipts:[],segments:[]});
const transferResult=imported.importTransferEnvelope(transfer);assert.equal(transferResult.accepted,true);assert.equal(transferResult.headSeq,s.headSeq);
const rollback=imported.importTransferEnvelope({...transfer,headSeq:1});assert.equal(rollback.accepted,false);
console.log('B1701_B2200_BEHAVIORAL_CONTINUITY_PASS');console.log(JSON.stringify({headSeq:s.headSeq,postRestartPreferredAction:argmax,behaviorContinuity01:s.behaviorContinuity01,identityContinuity01:s.identityContinuity01,transferAccepted:transferResult.accepted,rollbackRejected:rollback.accepted===false}));
