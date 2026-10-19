import assert from 'node:assert/strict';
import { CognitivePressureField } from '../src/organism/cognition/CognitivePressureField.ts';

const field = {
  arousal01:.5,valence01:.5,uncertainty01:.4,salience01:.5,conflict01:.2,socialPressure01:.4,taskPressure01:.4,
  fatigue01:.2,coherence01:.8,attentionDebt01:.3,unresolvedCount:2,
  pressures:[
    {id:'p1',type:'prediction-error',description:'world mismatch',level:.9,decayRate:.01,createdAt:1,lastActivatedAt:2,sourceIds:['pred']},
    {id:'p2',type:'contradiction',description:'conflicting evidence',level:.7,decayRate:.01,createdAt:1,lastActivatedAt:2,sourceIds:['e']},
  ],
};
const debt={version:1,records:[],openCount:0,agingCount:2,expiredCount:0,meanPriority01:.8,lastAt:0};
const f=new CognitivePressureField();
const out=f.compile({field,predictionDebt:debt,grounding:{uncertainty01:.8,confidence01:.3,conflict01:.4},goalPressure01:.55,novelty01:.5,predictionError01:.7,energy01:.8,thermal01:.2,ramPressure01:.2});
assert(out.total01>.5);
assert(out.domains.world>out.domains.memory);
assert(out.actionBias.verify>out.actionBias.respond);
assert(out.informationUrgency01>0.5);
console.log('BIG_PASS_55_COGNITIVE_PRESSURE=PASS', JSON.stringify({total01:out.total01,dominant:out.dominantType,verify:out.actionBias.verify,urgency:out.informationUrgency01}));
