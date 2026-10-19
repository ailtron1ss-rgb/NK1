import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory=new MemoryOS2({signalFusionProfile:'balanced'});
for(let i=0;i<80;i++) memory.encode({content:`project memory entity-${i%8} goal-${i%5} causal-${i%3}`,kind:i%7===0?'identity':'episodic',salience:(i%10)/10,emotionalWeight:.2,identityRelevance:i%7===0?1:.1,goalRelevance:(i%5)/5,socialRelevance:.1,predictionError:(i%6)/6,confidence:.8,epistemicStatus:'fact',source:'p2691',entities:[`entity-${i%8}`],semanticLinks:[],temporalLinks:[],causalLinks:[]});
let total=0;
for(let i=0;i<40;i++){ const rows=memory.retrieve(i%2?'entity-3 goal-2':'causal-1 project',8,.7,.5); if(!rows.length) throw new Error('no retrieval'); memory.observeRetrievalOutcome(i%3===0?.9:.2); total+=rows.length; }
const d=memory.adaptivePolicyDiagnostics();
if(!d.lastPolicy||Object.values(d.trials).reduce((a,b)=>a+b,0)!==40) throw new Error('policy feedback not persisted');
const state=memory.snapshot();
const restored=new MemoryOS2({signalFusionProfile:'balanced'}); restored.restore(state); const d2=restored.adaptivePolicyDiagnostics();
if(d2.lastPolicy!==d.lastPolicy) throw new Error('policy restore mismatch');
console.log(`P2691_ADAPTIVE_MEMORY_POLICY=PASS retrievals=${total} policy=${d.lastPolicy} trials=${JSON.stringify(d.trials)}`);
