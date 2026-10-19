import assert from 'node:assert/strict';
import { B286SelfConflictContinuityCore } from '../src/organism/cognition/B286SelfConflictContinuityCore.ts';
const a=new B286SelfConflictContinuityCore();
for(let t=1;t<=120;t++) a.step({tick:t,identityLatent:[...Array(24)].map((_,i)=>Math.sin(t*.03+i)),worldLatent:[...Array(16)].map((_,i)=>Math.cos(t*.02+i)),goalVector:[...Array(8)].map((_,i)=>Math.sin(t*.05+i)),relationshipId:t<60?'a':'b',reward01:t<60?.82:.41,predictionError01:.17,importance01:.6});
const s=a.snapshot(); const b=new B286SelfConflictContinuityCore(); b.restore(s); assert.deepEqual(b.snapshot(),s); console.log(JSON.stringify({pass:true,steps:b.diagnostics().steps,revisions:b.diagnostics().revisionCount,relations:b.diagnostics().relationCount}));
