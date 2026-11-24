import assert from 'node:assert/strict';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';
import { CognitiveDependencyGraph } from '../src/organism/core/CognitiveDependencyGraph.ts';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';

const state=()=>({tick:1,at:1000,predictionError:.7,attentionBudget:.8,selfPredictionError:.2,autonomyScore:.7,
 needs:{energy:.7,cognitiveLoad:.2,uncertainty:.6,novelty:.7,goalPressure:.6,socialNeed:.4,identityCoherence:.85}});
const trace=(id='t91',s=state())=>({id,tick:s.tick,createdAt:s.at,candidates:[],selected:{action:'explore',goalId:'task-91',predictedUtility:.7,confidence:.8,predictedCost:.2,reasons:[]},stateBefore:s,reasoningSignals:{},userRequestedAction:null,autonomousOverride:true,predictedOutcomes:[]});

const c=new CausalExperienceStream(16);
const tr=trace(); c.observe(tr);
const r=c.recordOutcome(tr,{...state(),tick:2,at:1100,needs:{...state().needs,energy:.45,uncertainty:.35}},{reward01:.9,success01:.9,surprise01:.8,novelty01:.8});
assert.ok(r);
const before=c.snapshot().records.length;
const tr2=trace('t92',state()); c.observe(tr2);
assert.equal(c.snapshot().records.length,before,'observe must never evict existing records');
assert.equal(c.recordOutcome(tr,tr.stateBefore,{reward01:.9,success01:.9,surprise01:.8,novelty01:.8}),null);

const u=new UnifiedLearningSubstrate();
u.beginCycle();
const signal=u.ingest(tr,{...state(),tick:2,at:1100,needs:{...state().needs,energy:.45,uncertainty:.35} },r,c.learningPacket(8));
assert.ok(signal.learningOpportunity01>0);
assert.equal(u.snapshot().samples,1);
assert.equal(u.consolidate(8).length,0,'one-shot patterns are not enough for consolidation');
u.ingest({...tr,id:'t93',tick:3},{...state(),tick:3,at:1200,needs:{...state().needs,energy:.5,uncertainty:.32} },{...r,id:'r93',traceId:'t93',tick:3,at:1200},{...c.learningPacket(8),records:[{...r,id:'r93',traceId:'t93',tick:3,at:1200}]});
assert.ok(u.consolidate(8).length>=1,'repeated causal pattern should consolidate');
const restored=new UnifiedLearningSubstrate(); restored.restore(u.snapshot()); assert.deepEqual(restored.snapshot().patterns,u.snapshot().patterns);

const g=new CognitiveDependencyGraph(); const frame=buildCognitiveFrame(state(),{text:'hello'}); const resolved=g.resolve(frame); assert.ok(resolved.dirtyCount>0); assert.ok(g.shouldWake('memory')); assert.ok(g.snapshot().wakeMask>0);
console.log('BIG_PASS_91_UNIFIED_LEARNING=PASS');
