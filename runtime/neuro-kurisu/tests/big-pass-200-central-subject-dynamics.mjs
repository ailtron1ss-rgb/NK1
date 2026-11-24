import assert from 'node:assert/strict';
import { CentralSubjectDynamics, defaultCentralSubjectDynamics } from '../src/organism/cognition/CentralSubjectDynamics.ts';
const a=new CentralSubjectDynamics(); a.restore(defaultCentralSubjectDynamics());
for(let i=0;i<240;i++){
 const drift=i<120?0:i<180?.02:-.01;
 a.observe({tick:i+1,at:1700000000000+i*1000,identity01:.84+drift,autobiographical01:.78,causalSelf01:.76,workspace01:.72,metacognitive01:.74,grounding01:.66,interoception01:.78,agency01:.73,socialBinding01:.61,continuity01:.82,predictionAccuracy01:.79,realityAlignment01:.75,developmental01:.65,resource01:.8,externalInput:i%3===0});
 if(i%24===0)a.recordOutcome(.8);
}
a.recordPerturbation({id:'workspace-lesion',at:1700000400000,target:'workspace',baseline01:.74,perturbed01:.59,recovery01:.76});
a.recordPerturbation({id:'self-lesion',at:1700000500000,target:'causal-self',baseline01:.77,perturbed01:.67,recovery01:.72});
const cert=a.certification(200); assert.equal(cert.status,'verified'); assert.equal(cert.criteria.samples,true); assert.equal(cert.criteria.perturbationEvidence,true);
const snap=a.snapshot(); const b=new CentralSubjectDynamics(); b.restore(snap); assert.deepEqual(b.snapshot(),snap,'deterministic restore');
console.log('BIG_PASS_200_CENTRAL_SUBJECT=PASS',JSON.stringify({samples:snap.samples,outcomes:snap.outcomes,perturbations:snap.perturbations,phase:snap.phase,coherence:cert.coherence01,coupling:cert.coupling01,stability:cert.stability01,status:cert.status,restore:'PASS'}));
