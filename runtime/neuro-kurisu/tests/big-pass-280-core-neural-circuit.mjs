import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const c=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',checkpointMinIntervalMs:60000});
await c.init();
for(let i=0;i<6;i++){ await c.observe({text:i%2?'verify evidence':'explore a new signal',worldEvent:{type:'observation',payload:{signal:i%3,confidence:.72}}},'operational'); await c.feedback({success:.65,reward:.62,surprise:i%2?.2:.35,evidenceSource:'local'}); }
const d=c.b280MultiAreaNeuralDiagnostics(); assert.ok(d.cycles>0); assert.ok(d.learningUpdates>0);
const snap=c.snapshot(); const c2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',checkpointMinIntervalMs:60000}); await c2.init();
assert.deepEqual(c2.b280MultiAreaNeuralDiagnostics(),d);
console.log(JSON.stringify({ok:true,cycles:d.cycles,learningUpdates:d.learningUpdates,coherence:d.crossAreaCoherence01,eiBalance:d.excitationInhibitionBalance01,sparse:d.sparseActivity01,restored:true},null,2));
