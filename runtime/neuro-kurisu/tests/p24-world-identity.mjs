import assert from 'node:assert/strict';
import { P24WorldIdentityEngine } from '../src/organism/developmental/P24WorldIdentityEngine.ts';

const engine = new P24WorldIdentityEngine();
engine.observeBody({telemetry:{battery01:.72,thermalPressure01:.2,cpuLoad01:.25,ramPressure01:.3,networkOnline:true,screenInteractive:true,charging:false},bodyEnergy01:.71,cognitiveCapacity01:.78},1000);
engine.observeBody({telemetry:{battery01:.70,thermalPressure01:.28,cpuLoad01:.35,ramPressure01:.32,networkOnline:true,screenInteractive:true,charging:false},bodyEnergy01:.67,cognitiveCapacity01:.72},61000);
const body=engine.bodyWorld.predict(10);
assert(body.battery01 < .70,'body model should project battery drain');
assert(body.resourceRisk01 >= 0,'body model should expose risk');

const a=engine.fuseSituation([
 {modality:'text',at:1,summary:'user asks for verification',confidence:.9,salience:.8,evidence:[],contentHash:'a'},
 {modality:'vision',at:1,summary:'scene appears ambiguous',confidence:.3,salience:.7,evidence:[],contentHash:'b'},
]);
assert(a.modalities.length===2);
assert(a.conflict01>0,'confidence disagreement should become explicit conflict');

for(let i=0;i<8;i++) engine.observeBoredom({novelty01:.1,predictionError01:.1,informationGain01:.05,externalStimulus:false});
const state=engine.snapshot();
assert(state.boredom.boredom01>.2);
const mode=engine.selectBehavior({novelty01:.1,uncertainty01:.2,socialNeed01:.1,energy01:.8,thermal01:.15,predictionError01:.1,informationDeficit01:.8});
assert.equal(typeof mode,'string');
assert(engine.behaviorBias('explore') !== 0,'behavioral state must affect action bias');
engine.observeOutcome(.9);
engine.identityObserve({action:'explore',goal:'investigate',confidence01:.8});
const capsule=engine.compressMemory(Array.from({length:12},(_,i)=>({at:i+1,action:i%2?'explore':'verify',summary:`event-${i}`,predictionError:i/20})),'daily');
assert(capsule);
assert(engine.snapshot().memoryCompression.capsulesCreated===1);

const trial=engine.modelSwitchBenchmark.compare({requestId:'p24-test',backendA:'A',backendB:'B',responseA:'verify facts before action',responseB:'verify facts before action',latencyAms:100,latencyBms:120,qualityA01:.8,qualityB01:.81,identityAnchor:'verify facts',constraints:['verify']});
assert(trial.identityConsistency01>.5);

console.log('P24_WORLD_IDENTITY=PASS', JSON.stringify({mode,capsules:engine.snapshot().memoryCompression.capsulesCreated,boredom:state.boredom.boredom01.toFixed(3),risk:body.resourceRisk01.toFixed(3)}));
