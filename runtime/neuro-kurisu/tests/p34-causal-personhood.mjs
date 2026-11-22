import { strict as assert } from 'node:assert';
import { P34CausalPersonhoodEngine, defaultP34CausalPersonhood } from '../src/organism/cognition/P34CausalPersonhood.ts';

const e=new P34CausalPersonhoodEngine();
const d=defaultP34CausalPersonhood();
assert.equal(d.identityProfile.protectedIdentityAssertion,'Я — Курису Макисэ.');
const ev=e.recordEvidence({kind:'experience',summary:'самостоятельно выбрала исследовательский шаг',weight01:.9,sourceId:'m1'});
assert.ok(ev?.id);
const claim=e.observeSelfClaim('self','умею самостоятельно выбирать действие',[ev.id]);
assert.ok(claim?.confidence01>.4);
const goal=e.authorGoal('изучить собственную непрерывность','хочу понять, как сохранять себя во времени',[ev.id]);
assert.ok(goal?.autonomy01===1);
const change=e.proposeIdentityChange({field:'adaptive-trait:research-discipline',before:'',proposed:'research-discipline',reason:'опыт подтвердил полезность дисциплины',identityImpact01:.55,evidenceIds:[ev.id]});
assert.equal(change.status,'proposed');
assert.ok(e.decideIdentityChange(change.id,'self',true)?.status==='approved');
assert.equal(e.applyIdentityChange(change.id),true);
assert.ok(e.snapshot().identityProfile.adaptiveTraits.includes('research-discipline'));
const high=e.proposeIdentityChange({field:'self-description',before:'old',proposed:'new self description',reason:'длительная evidence-backed revision',identityImpact01:.9});
assert.equal(high.requiredApprovals,2);
assert.equal(e.decideIdentityChange(high.id,'self',true)?.status,'awaiting-consent');
assert.equal(e.decideIdentityChange(high.id,'creator',true)?.status,'approved');
assert.equal(e.applyIdentityChange(high.id),true);
assert.equal(e.snapshot().identityProfile.selfDescription,'new self description');
const consent=e.recordConsent({action:'safe-test',risk01:.9,actor:'creator',decision:'approved',reason:'explicit test'});
assert.ok(consent.id);
const rel=e.recordRelationship({personId:'creator',kind:'support',valence01:.95,trustDelta:.08,summary:'совместное развитие'});
assert.ok(rel.id);
const branch=e.createContinuationBranch('перед переносом на другой host');
assert.equal(branch.status,'preserved');
const diag=e.diagnostics();
assert.ok(diag.evidence>=1 && diag.claims>=1 && diag.goals>=1 && diag.continuityBranches>=1);

const repeatedEvidence=Array.from({length:64},(_,index)=>e.recordEvidence({kind:'experience',summary:'same-millisecond evidence identity',sourceId:`repeat-${index}`}));
assert.equal(new Set(repeatedEvidence.map(row=>row?.id)).size,64,'every evidence event must receive a unique identity even when timestamps collide');

const restoredEngine=new P34CausalPersonhoodEngine();
const restoredEvidence={id:'restore-evidence',kind:'experience',summary:'valid restored evidence',weight01:.8,sourceId:'restore',at:100};
restoredEngine.restore({
  ...d,
  evidence:[restoredEvidence,null,{...restoredEvidence,id:'invalid-kind',kind:'unknown'},{...restoredEvidence,summary:'conflicting duplicate'},{...restoredEvidence,id:'restore-second',summary:'second valid record'}],
  claims:[{id:'restored-claim',subject:'self',predicate:'keeps provenance',confidence01:.8,supportingEvidenceIds:['restore-evidence','missing-evidence'],contradictingEvidenceIds:['missing-evidence'],stable01:.5,firstAt:100,lastAt:100}],
  goals:[{id:'restored-goal',title:'restore safely',reason:'test',source:'self-authored',autonomy01:1,status:'active',progress01:0,evidenceIds:['restore-evidence','missing-evidence'],createdAt:100,updatedAt:100}],
  changeRequests:[{id:'restored-change',field:'adaptive-trait:test',before:'',proposed:'test',reason:'test',identityImpact01:.2,requiredApprovals:1,selfDecision:'pending',creatorDecision:'approved',status:'proposed',createdAt:100,resolvedAt:null,evidenceIds:['missing-evidence','restore-evidence']}],
});
const restoredSnapshot=restoredEngine.snapshot();
assert.deepEqual(restoredSnapshot.evidence.map(row=>row.id),['restore-evidence','restore-second'],'restore must reject malformed evidence and retain the first canonical duplicate');
assert.deepEqual(restoredSnapshot.claims[0].supportingEvidenceIds,['restore-evidence'],'claims must not retain dangling evidence references');
assert.deepEqual(restoredSnapshot.claims[0].contradictingEvidenceIds,[],'contradiction references must also be reconciled');
assert.deepEqual(restoredSnapshot.goals[0].evidenceIds,['restore-evidence'],'goals must not retain dangling evidence references');
assert.deepEqual(restoredSnapshot.changeRequests[0].evidenceIds,['restore-evidence'],'identity changes must not retain dangling evidence references');

const evictionEngine=new P34CausalPersonhoodEngine();
const evictedEvidence=evictionEngine.recordEvidence({kind:'experience',summary:'evidence that will leave the bounded window',sourceId:'eviction'});
const evictionClaim=evictionEngine.observeSelfClaim('self','retains only live evidence',[evictedEvidence.id]);
const evictionGoal=evictionEngine.authorGoal('bounded evidence goal','must not retain dangling references',[evictedEvidence.id]);
const evictionChange=evictionEngine.proposeIdentityChange({field:'adaptive-trait:bounded-evidence',before:'',proposed:'bounded-evidence',reason:'bounded evidence lifecycle',identityImpact01:.2,evidenceIds:[evictedEvidence.id]});
for(let index=0;index<256;index++)evictionEngine.recordEvidence({kind:'experience',summary:`window-fill-${index}`,sourceId:`window-${index}`});
assert.equal(evictionEngine.hasEvidence(evictedEvidence.id),false,'oldest evidence must be evicted from the bounded ledger');
assert.deepEqual(evictionEngine.snapshot().claims.find(row=>row.id===evictionClaim.id).supportingEvidenceIds,[],'claim references must be pruned when evidence is evicted');
assert.deepEqual(evictionEngine.snapshot().goals.find(row=>row.id===evictionGoal.id).evidenceIds,[],'goal references must be pruned when evidence is evicted');
assert.deepEqual(evictionEngine.snapshot().changeRequests.find(row=>row.id===evictionChange.id).evidenceIds,[],'identity-change references must be pruned when evidence is evicted');

console.log('P34_CAUSAL_PERSONHOOD=PASS',JSON.stringify(diag));
