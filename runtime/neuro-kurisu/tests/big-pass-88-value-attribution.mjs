import assert from 'node:assert/strict';
import { ValueEvolutionEngine } from '../src/organism/cognition/evolution/ValueEvolutionEngine.ts';

const engine=new ValueEvolutionEngine();
const verify=engine.attributeExperience({action:'verify',goalTitle:'Проверить неизвестное',goalSource:'learned'});
const explore=engine.attributeExperience({action:'explore',goalTitle:'Исследовать новую возможность',goalSource:'intrinsic'});
const respond=engine.attributeExperience({action:'respond',goalTitle:'Поддержать социальную связь',goalSource:'learned'});
assert.ok(verify.confidence01>.55 && explore.confidence01>.55 && respond.confidence01>.55);
assert.ok(['truth','evidence'].includes(verify.value));
assert.ok(['curiosity','autonomy'].includes(explore.value));
assert.ok(['care','social','responsibility'].includes(respond.value));
const low=new ValueEvolutionEngine();
const values={curiosity:.9,truth:.98,autonomy:.94,evidence:.95,care:.78,responsibility:.9,social:.6,updatedAt:1,plasticityBudget:.08};
let revision=low.observeExperience({values,success:.82,surprise:.81,projectOrigin:'learned',evidenceCount:5,independentSourceCount:2,value:'truth',direction:1,reference01:.62,attributionConfidence01:.92});
assert.equal(revision,null);
for(let i=0;i<3;i++){ const next=low.observeExperience({values,success:.82,surprise:.81,projectOrigin:'learned',evidenceCount:5,independentSourceCount:2,value:'truth',direction:1,reference01:.62,attributionConfidence01:.92}); if(next) revision=next; }
assert.ok(revision,'relative-to-expectation evidence should produce a revision after corroboration');
assert.ok(revision.after>revision.before);
console.log(`BIG_PASS_88_ATTRIBUTION=PASS verify=${verify.value} explore=${explore.value} respond=${respond.value} revisionDelta=${revision.delta.toFixed(4)}`);
