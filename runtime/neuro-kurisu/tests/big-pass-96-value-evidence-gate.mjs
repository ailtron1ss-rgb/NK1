import assert from 'node:assert/strict';
import { ValueEvolutionEngine } from '../src/organism/cognition/evolution/ValueEvolutionEngine.ts';

const values={version:1,curiosity:.8,truth:.92,autonomy:.84,evidence:.84,care:.65,responsibility:.86,social:.3,updatedAt:1,plasticityBudget:.1};
const engine=new ValueEvolutionEngine();
let internalRevision=null;
for(let i=0;i<8;i++){
  internalRevision=engine.observeExperience({values,success:.95,surprise:.85,projectOrigin:'learned',evidenceCount:8,independentSourceCount:0,value:'responsibility',direction:1,reference01:.55,attributionConfidence01:.95});
}
assert.equal(internalRevision,null,'internal repetition must not mutate canonical values');
assert.equal(engine.snapshot().revisions.length,0);
const state=engine.snapshot();
assert.ok((state.tentativePressure.responsibility??0)>0,'internal evidence may accumulate tentative pressure');
let verified=null;
for(let i=0;i<3 && !verified;i++){
  verified=engine.observeExperience({values,success:.95,surprise:.85,projectOrigin:'learned',evidenceCount:8,independentSourceCount:2,value:'responsibility',direction:1,reference01:.55,attributionConfidence01:.95});
}
assert.ok(verified,'independent corroboration should permit a bounded revision');
console.log(`BIG_PASS_96_VALUE_EVIDENCE_GATE=PASS internalRevisions=0 tentativePressure=${(state.tentativePressure.responsibility??0).toFixed(4)} verifiedDelta=${verified.delta.toFixed(4)}`);
