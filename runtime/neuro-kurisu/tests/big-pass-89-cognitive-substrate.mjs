import assert from 'node:assert/strict';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';
import { normalizeWorldContext } from '../src/organism/core/WorldContextNormalizer.ts';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { CognitiveSpineScheduler } from '../src/organism/system/CognitiveSpineScheduler.ts';

const state={tick:10,at:1000,predictionError:0.05,needs:{novelty:.1,uncertainty:.1,goalPressure:.08,energy:.9,cognitiveLoad:.1,identityCoherence:.9}};
const normalized=normalizeWorldContext({location:'lab',uncertainty:undefined, facts:undefined, objects:undefined, events:undefined},{tick:11});
assert.ok(normalized);
assert.deepEqual(normalized.objects,[]);
assert.deepEqual(normalized.facts,[]);
assert.equal(normalized.location,'lab');

const frame=buildCognitiveFrame(state,{text:'hello'});
assert.equal(frame.dirtyDomains.memory,true);
assert.equal(frame.dirtyDomains.embodiment,false);
assert.ok(frame.attentionBudget01>0 && frame.attentionBudget01<=1);
assert.ok(frame.deepDemand01>=0 && frame.deepDemand01<=1);

const spine=new CognitiveSpineScheduler();
const decision=spine.decide({tick:frame.tick,surprise01:frame.surprise01,predictionError01:frame.predictionError01,novelty01:frame.novelty01,goalPressure01:frame.goalPressure01,budgetMode:'balanced',remainingBudget01:.85,externalInput:true,awake:true});
const planner=new CognitiveExecutionPlanner();
const plan=planner.compile(frame,decision,.85,undefined,[]);
assert.ok(plan.expectedValue01['world-rollout']>=0);
assert.equal(plan.run.research,false,'low-demand user text must not force expensive research');
assert.equal(plan.run.shadow,false,'low-demand user text must not force shadow cognition');
assert.equal(plan.run.project,false,'low-demand user text must not force project cognition');
console.log('BIG_PASS_89_COGNITIVE_SUBSTRATE=PASS',JSON.stringify({attention:frame.attentionBudget01,deepDemand:frame.deepDemand01,worldEvc:plan.expectedValue01['world-rollout'],runs:Object.entries(plan.run).filter(([,v])=>v).map(([k])=>k)}));
