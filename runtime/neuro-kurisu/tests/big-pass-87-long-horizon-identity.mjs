import assert from 'node:assert/strict';
import { FutureSelfModel } from '../src/organism/cognition/evolution/FutureSelfModel.ts';
const makeState=(tick)=>({version:111,tick,at:1000+tick,needs:{energy:.76,cognitiveLoad:.24,uncertainty:.66,socialNeed:.2,novelty:.72,identityCoherence:.82,goalPressure:.58},predictionError:.34,attentionBudget:.82,lastAction:'wait',lastActionSuccess:null,autonomyScore:.7,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.6,worldContextVersion:1});
const goals=[{id:'g1',title:'Проверить неизвестное',source:'learned',status:'active',importance:.72,urgency:.62,confidence:.84,progress:.1,createdAt:1,updatedAt:1}];
const valuesA={curiosity:.94,truth:.99,autonomy:.95,evidence:.99,care:.58,responsibility:.72,social:.25};
const valuesB={curiosity:.62,truth:.86,autonomy:.72,evidence:.82,care:.95,responsibility:.96,social:.85};
const fa=new FutureSelfModel(), fb=new FutureSelfModel();
const actions=['verify','explore','respond','reflect','rest'];
let divergence=0;
for(let i=0;i<actions.length;i++){
  const action=actions[i];
  const ba=fa.developmentalBias({action,state:makeState(i),goals,values:valuesA,identityContinuity01:.9,identityPressure01:.12});
  const bb=fb.developmentalBias({action,state:makeState(i),goals,values:valuesB,identityContinuity01:.9,identityPressure01:.12});
  if(Math.abs(ba-bb)>.004) divergence++;
}
assert.ok(divergence>=2,'matched-history value profiles must create multiple action-family differences');
const snapA=fa.snapshot(), snapB=fb.snapshot();
assert.ok(snapA.developmentalBias01!==snapB.developmentalBias01);
console.log(`BIG_PASS_87_LONG_HORIZON=PASS divergentActionFamilies=${divergence}/5 biasA=${snapA.developmentalBias01.toFixed(4)} biasB=${snapB.developmentalBias01.toFixed(4)}`);
