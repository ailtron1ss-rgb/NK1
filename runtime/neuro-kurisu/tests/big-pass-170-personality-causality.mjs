import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileStateStore} from '../src/organism/persistence/FileStateStore.ts';
import {OrganismCore} from '../src/organism/core/OrganismCore.ts';

async function make(file){ const c=new OrganismCore(new FileStateStore(file),{enableSelfPrediction:true,enableWorldModel:true}); await c.init(); return c; }
const root=await mkdtemp(join(tmpdir(),'nk170-')); const aFile=join(root,'a.json'); const bFile=join(root,'b.json');
const a=await make(aFile), b=await make(bFile);
const obs={text:'explore and verify an unfamiliar signal',worldContext:{location:'lab',facts:['signal changing'],objects:[{id:'signal',label:'signal',location:'lab',value:.8,visible:true,collected:false}],events:['signal']},embodiment:{bodyEnergy01:.9,cognitiveCapacity01:.9,thermalStrain01:.12,sensoryFreshness01:.95,awake:true,battery01:.9,cpuLoad01:.15,ramPressure01:.2}};
for(let i=0;i<4;i++){ await a.observe({...obs, text:'explore new signal and investigate evidence'}); await a.feedback({success:.9,reward:.9,surprise:.18,evidenceSource:'oracle'}); }
for(let i=0;i<4;i++){ await b.observe({...obs, text:'explore new signal and investigate evidence'}); await b.feedback({success:.25,reward:.2,surprise:.72,evidenceSource:'oracle'}); }
const sa=a.personalitySnapshot?.() ?? a.snapshot().facets?.advanced?.multiHypothesisPersonality;
const sb=b.personalitySnapshot?.() ?? b.snapshot().facets?.advanced?.multiHypothesisPersonality;
assert(sa && sb);
const candidateTraits=['curiosity','truth-seeking','caution','self-reflection','care','social-attunement','self-preservation'];
const observedTrait=candidateTraits.find(t=>sa.hypotheses.some(h=>h.context==='life'&&h.trait===t)&&sb.hypotheses.some(h=>h.context==='life'&&h.trait===t));
assert(observedTrait, 'no common causal personality trait observed');
const ca=sa.hypotheses.find(h=>h.context==='life'&&h.trait===observedTrait);
const cb=sb.hypotheses.find(h=>h.context==='life'&&h.trait===observedTrait);
assert(Math.abs(ca.probability-cb.probability)>.01,'history did not create personality probability divergence');
const futureA=await a.observe({...obs,text:'same future stimulus'}); const futureB=await b.observe({...obs,text:'same future stimulus'});
assert(futureA.decision && futureB.decision);
const relevantAction = ['care','social-attunement'].includes(observedTrait)?'respond':observedTrait==='curiosity'?'explore':['truth-seeking','caution'].includes(observedTrait)?'verify':observedTrait==='self-reflection'?'reflect':'rest';
const ua=futureA.decision.candidates?.find(x=>x.action===relevantAction)?.score ?? 0;
const ub=futureB.decision.candidates?.find(x=>x.action===relevantAction)?.score ?? 0;
assert(Math.abs(ua-ub)>.0005,'personality did not influence future policy');
await a.endTemporalSession('big-pass-170-a',true); await b.endTemporalSession('big-pass-170-b',true);
const ar=await make(aFile), br=await make(bFile); const sar=ar.personalitySnapshot?.() ?? ar.snapshot().facets?.advanced?.multiHypothesisPersonality; const sbr=br.personalitySnapshot?.() ?? br.snapshot().facets?.advanced?.multiHypothesisPersonality;
assert.equal(sar.causalUpdates,sa.causalUpdates); assert.equal(sbr.causalUpdates,sb.causalUpdates); assert(Math.abs(sar.hypotheses.find(h=>h.trait===observedTrait).probability-sbr.hypotheses.find(h=>h.trait===observedTrait).probability)>.01);
await ar.endTemporalSession('big-pass-170-restart-a',true); await br.endTemporalSession('big-pass-170-restart-b',true); await rm(root,{recursive:true,force:true});
console.log(JSON.stringify({ok:true,trait:observedTrait,traitA:ca.probability,traitB:cb.probability,probabilityDivergence:Math.abs(ca.probability-cb.probability),relevantAction,policyScoreA:ua,policyScoreB:ub,policyDivergence:Math.abs(ua-ub),restart:true,causalUpdatesA:sa.causalUpdates,causalUpdatesB:sb.causalUpdates}));
