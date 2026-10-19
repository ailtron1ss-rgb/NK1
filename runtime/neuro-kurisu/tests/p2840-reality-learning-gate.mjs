import assert from 'node:assert/strict';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';

const gate=new RealityLearningGate();
const sim=gate.decide({source:'simulation',evidence01:.18,verified01:0,independent01:0,consequence01:.18,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8});
const externalWeak=gate.decide({source:'external',evidence01:.44,verified01:0,independent01:1,consequence01:.08,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:true,resource01:.8});
const externalStrong=gate.decide({source:'external',evidence01:.96,verified01:1,independent01:1,consequence01:.9,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8});
assert(sim.learningScale01 < externalWeak.learningScale01);
assert(externalWeak.learningScale01 < externalStrong.learningScale01);
assert(externalWeak.identityUpdateScale01 < .4);
assert(externalStrong.identityUpdateScale01 > .5);
console.log(JSON.stringify({ok:true,sim,externalWeak,externalStrong,diagnostics:gate.diagnostics()}));
