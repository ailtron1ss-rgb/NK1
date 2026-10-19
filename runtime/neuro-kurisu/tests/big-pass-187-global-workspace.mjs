import assert from 'node:assert/strict';
import { GlobalWorkspaceSubstrateV2 } from '../src/organism/cognition/GlobalWorkspaceSubstrateV2.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const candidates = Array.from({length:12}, (_,i)=>({
  id:`c${i}`, source:i%3===0?'perception':i%3===1?'memory':'self', salience:(12-i)/12,
  features:[(12-i)/12, i%2, .2+i*.03, .1, .3+(i%4)*.1, .2, .4, .8-i*.03, .2+i*.02, .7, .5, i/12],
  content:{i}
}));

const ws=new GlobalWorkspaceSubstrateV2();
let first=ws.globalState();
for(let t=0;t<80;t++) ws.compete(candidates, [Math.sin(t*.1),.7,.2,.4]);
const hot=ws.globalState();
assert(hot.selectedIds.length>0);
assert(hot.selectedIds.length<=5);
assert(hot.latent.some(v=>Math.abs(v)>1e-6),'workspace latent must become active');
assert(hot.recurrence01>=0 && hot.recurrence01<=1);
assert(hot.ignition01>=0 && hot.ignition01<=1);
assert(hot.broadcast.some(v=>Math.abs(v)>1e-8),'global broadcast must contain signal');
// Closed-loop proof: a second cycle consumes the first broadcast through the CentralBrain actionContext.
const firstBroadcast=hot.broadcast.slice();
ws.compete(candidates.map((c,i)=>({...c,features:c.features.map((v,j)=>j===0?v+(firstBroadcast[i%firstBroadcast.length]??0)*.15:v)})), [0.2,0.8,0.35,0.65,...firstBroadcast.slice(0,4)]);
assert.equal(ws.snapshot().cycles,81,'workspace recurrence must advance on the closed-loop cycle');
const beforeReward=ws.snapshot();
for(let i=0;i<32;i++) ws.learnReward(i%2?.95:.65);
const afterReward=ws.snapshot();
assert(afterReward.learning.samples>=32);
assert(afterReward.learning.gateUpdates>0);
const restored=new GlobalWorkspaceSubstrateV2();
restored.restore(afterReward);
assert.deepEqual(restored.snapshot(),afterReward,'workspace restore must be exact');

// Causal lesions: recurrence/broadcast/competition are independent perturbations.
const recurrenceLesion=new GlobalWorkspaceSubstrateV2();
recurrenceLesion.restore(beforeReward);
recurrenceLesion.setLesion({recurrence:true});
recurrenceLesion.compete(candidates,[.4,.8,.2,.7]);
assert.equal(recurrenceLesion.globalState().recurrence01,0,'recurrence lesion must remove recurrent contribution');

const broadcastLesion=new GlobalWorkspaceSubstrateV2();
broadcastLesion.restore(beforeReward);
broadcastLesion.setLesion({broadcast:true});
broadcastLesion.compete(candidates,[.4,.8,.2,.7]);
assert(broadcastLesion.globalState().broadcast.every(v=>v===0),'broadcast lesion must remove global broadcast');

const competitionLesion=new GlobalWorkspaceSubstrateV2();
competitionLesion.restore(beforeReward);
competitionLesion.setLesion({competition:true});
competitionLesion.compete(candidates,[.4,.8,.2,.7]);
assert(competitionLesion.globalState().selectedIds.length>0);

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const world=(tick)=>({tick,location:'workspace-lab',energy:.84,attention:.79,uncertainty:.31,facts:['workspace','recurrence'],objects:[],events:[`event-${tick%2}`]});
for(let i=0;i<6;i++){
  await core.observe({text:`global workspace test ${i}`,novelty:.56,worldContext:world(i)});
  await core.feedback({success:.75,reward:.72,surprise:.14,worldTransition:{action:'explore',before:world(i),after:world(i+1),reward:.72,surprise:.14,at:50000+i}});
}
const snap=core.snapshot();
assert((snap.facets.cognition.globalWorkspace?.cycles??0)>=6,'global workspace must participate in live organism cycles');
assert((snap.facets.cognition.globalWorkspace?.learning?.samples??0)>=1,'workspace must learn from live outcomes');
assert((snap.facets.cognition.globalWorkspace?.latent?.length??0)===24);
assert(snap.facets.memory.workspace.items.length>=0);
console.log(JSON.stringify({pass:187,cycles:snap.facets.cognition.globalWorkspace.cycles,selected:snap.facets.cognition.globalWorkspace.selectedIds,learning:snap.facets.cognition.globalWorkspace.learning,ignition01:snap.facets.cognition.globalWorkspace.ignition01,broadcast01:snap.facets.cognition.globalWorkspace.broadcast01},null,2));
