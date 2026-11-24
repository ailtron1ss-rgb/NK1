import assert from 'node:assert/strict';
import { P37EmbodiedSensoriumEngine } from '../src/organism/body/P37EmbodiedSensorium.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';

const sensor=new P37EmbodiedSensoriumEngine();
sensor.ingest({vision:{objects:[{label:'cup',kind:'object',confidence01:.8}]},at:1000});
sensor.ingest({vision:{objects:[{label:'cup',kind:'object',confidence01:.9}]},at:1200});
const ss=sensor.semanticSummary();
const cup=ss.entities.find(e=>e.label==='cup');
assert.ok(cup && cup.seenCount>=2 && cup.presenceStatus==='visible' && cup.persistence01>.12);

const world=new GroundedWorldState();
world.restore();
world.integrate({at:1200,base:{tick:1,location:'desk',energy:.8,attention:.7,uncertainty:.3,facts:[],objects:[{id:'cup',label:'cup',location:'desk',value:.9,visible:true}],events:[]},perception:null,evidence:null});
const ws=world.snapshot();
assert.equal(ws.entities[0]?.observationCount,1); assert.equal(ws.entities[0]?.presenceStatus,'visible');
world.integrate({at:1300,base:{tick:2,location:'desk',energy:.8,attention:.7,uncertainty:.3,facts:[],objects:[{id:'cup',label:'cup',location:'desk',value:.95,visible:true}],events:[]},perception:null,evidence:null});
assert.ok(world.snapshot().entities[0]?.observationCount>=2); assert.ok(world.summary().objectPermanence01>.1);

const mem=new MemoryOS2();
const base={content:'important cup experiment',kind:'episodic',salience:.8,emotionalWeight:.7,identityRelevance:.6,goalRelevance:.7,socialRelevance:.2,predictionError:.5,confidence:.8,epistemicStatus:'belief',source:'test',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[]};
const m=mem.encode(base); assert.ok(m.temperature01>.4); const hot=mem.temperatureSummary(4); assert.ok(hot.length===1 && hot[0].temperature01===m.temperature01);

const stream=new CausalExperienceStream(64);
for(let i=0;i<4;i++) stream.recordExternalLearningEvent({tick:i+1,taskId:'same',action:i<2?'rest':'verify',reward01:.7,success01:.8,surprise01:.2,novelty01:.3,uncertainty01:.4,causalStrength01:.7,stateGrounded:true});
const cs=stream.summary(); assert.ok(cs.behavioralContextSamples>=1); assert.ok(cs.behavioralDivergence01>.1); assert.ok(cs.behavioralImpact01>0);

const state={version:122,tick:0,at:Date.now(),needs:{energy:.8,cognitiveLoad:.3,uncertainty:.4,socialNeed:.2,novelty:.2,identityCoherence:.8,goalPressure:.3},predictionError:.95,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.4,selfPredictionError:.2,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1};
const frame=buildCognitiveFrame(state,{text:'check'});
assert.ok(frame.interrupt?.active && frame.interrupt.type==='prediction-error');
const planner=new CognitiveExecutionPlanner();
const spine={mode:'active',reason:'test',run:{research:false,
'world-rollout':false,shadow:false,project:false}};
const plan=planner.compile(frame,spine,.9);
assert.equal(typeof plan.run.perception,'boolean');

console.log('BIG_PASS_114_REALITY_MEMORY_SELF=PASS',JSON.stringify({entityPermanence:Number(cup.persistence01.toFixed(3)),worldPermanence:Number(world.summary().objectPermanence01.toFixed(3)),memoryTemperature:Number(m.temperature01.toFixed(3)),behavioralDivergence:Number(cs.behavioralDivergence01.toFixed(3)),interrupt:frame.interrupt,forced:plan.forced}));
