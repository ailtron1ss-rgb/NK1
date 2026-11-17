import assert from 'node:assert/strict';
import { MechanismSerendipityEngine } from '../src/organism/research/MechanismSerendipityEngine.ts';
import { IntrinsicExperimentGenerator } from '../src/organism/cognition/IntrinsicExperimentGenerator.ts';
const problem={
 id:'nk1-context-pressure',title:'Context retrieval pressure in a cognitive runtime',domain:'cognitive-runtime',
 actors:[{id:'p1',role:'producer',label:'Memory requester'},{id:'p2',role:'queue',label:'Context buffer'},{id:'p3',role:'consumer',label:'Cognitive executor'},{id:'p4',role:'controller',label:'Attention allocator'}],
 flows:[{id:'pf1',fromRole:'producer',toRole:'queue',kind:'request'},{id:'pf2',fromRole:'queue',toRole:'consumer',kind:'request'},{id:'pf3',fromRole:'consumer',toRole:'controller',kind:'signal'},{id:'pf4',fromRole:'controller',toRole:'producer',kind:'control'}],
 constraints:[{id:'pc1',kind:'capacity',onRole:'queue'},{id:'pc2',kind:'latency',onRole:'queue'},{id:'pc3',kind:'irreversibility',onRole:'controller'}],
 feedbackLoops:[{id:'pb1',sourceRole:'consumer',targetRole:'controller',polarity:'negative'},{id:'pb2',sourceRole:'controller',targetRole:'producer',polarity:'negative'}],
 resources:[{id:'pr1',kind:'compute'},{id:'pr2',kind:'memory'},{id:'pr3',kind:'time'}],
 dynamics:{regimes:['saturation','recovery'],timescale:'fast'},
};
const engine=new MechanismSerendipityEngine(),result=engine.analyze(problem);
assert.equal(result.status,'matched');
assert.ok(result.evaluatedN>=4);
assert.ok(result.discoveries.length>0&&result.discoveries.length<=3);
const best=result.discoveries[0];
assert.equal(best.referenceMechanismId,'distributed-backpressure');
assert.equal(best.sourceDomain,'distributed-systems');
assert.equal(best.targetDomain,'cognitive-runtime');
assert.ok(best.similarity01>=.8&&best.transferability01>=.3);
assert.ok(best.correspondences.some(x=>x.aspect==='actor'));
assert.ok(best.correspondences.some(x=>x.aspect==='flow'));
assert.ok(best.correspondences.some(x=>x.aspect==='feedback'));
assert.ok(best.breakpoints.some(x=>x.kind==='constraint-kind-mismatch'));
assert.equal(best.status,'candidate');
assert.equal(best.epistemicStatus,'hypothesis');
assert.ok(best.verificationPlan.includes('holdout'));
assert.ok(best.falsifier.includes('Отвергнуть'));

const controlledEngine=new MechanismSerendipityEngine([{...problem,id:'controlled-reference',domain:'reference-domain'}]);
const exactTransfer=controlledEngine.analyze(problem).discoveries[0]?.transferability01 ?? 0;
const reversed=structuredClone(problem);
reversed.flows[0]={...reversed.flows[0],fromRole:'queue',toRole:'producer'};
const reversedDiscovery=controlledEngine.analyze(reversed).discoveries[0];
assert.ok(reversedDiscovery?.breakpoints.some(x=>x.kind==='flow-direction-reversal'),
  'reversed causal flow must be surfaced as a transfer breakpoint');
assert.ok(reversedDiscovery.transferability01<exactTransfer,
  'a direction-reversed mechanism must receive lower transferability than an exact structural control');

const renamed=structuredClone(problem);renamed.title='violet comet / silent orchard';
renamed.actors.forEach((x,i)=>{x.label='opaque-token-'+i;});
const again=engine.analyze(renamed);
assert.equal(again.discoveries[0]?.referenceMechanismId,best.referenceMechanismId);
assert.equal(again.discoveries[0]?.similarity01,best.similarity01,'word relabeling must not alter structural score');
assert.equal(new MechanismSerendipityEngine([{...problem,id:'same-domain-copy'}]).analyze(problem).status,'no-match');
const sparse=new MechanismSerendipityEngine().analyze({id:'sparse',title:'Sparse',domain:'cognitive-runtime',actors:[{id:'a',role:'producer'},{id:'b',role:'consumer'}],flows:[{id:'f',fromRole:'producer',toRole:'consumer',kind:'signal'}],constraints:[],feedbackLoops:[],resources:[],dynamics:{regimes:[],timescale:'mixed'}});
assert.equal(sparse.status,'insufficient-structure');
assert.equal(engine.analyze({id:'bad',title:'Invalid',domain:'test',actors:[],flows:[]}).status,'insufficient-structure');
let now=1800000000123;const generator=new IntrinsicExperimentGenerator(()=>now,()=>'idea10');
const experiment=generator.fromMechanismDiscovery({
 id:best.id,title:best.referenceTitle,sourceDomain:best.sourceDomain,targetDomain:best.targetDomain,
 flowEvidenceClass:best.flowEvidenceClass,
 confidence01:best.confidence01,transferability01:best.transferability01,status:best.status,epistemicStatus:best.epistemicStatus,
 hypothesis:best.hypothesis,verificationPlan:best.verificationPlan,
 correspondences:best.correspondences.map(x=>x.aspect+':'+x.structuralFeature),
 breakpoints:best.breakpoints.map(x=>x.kind+':'+x.consequence),
},[]);
assert.ok(experiment);
assert.equal(experiment.source,'mechanism-serendipity');
assert.equal(experiment.action,'verify');
assert.equal(experiment.status,'candidate');
assert.equal(experiment.epistemicStatus,'hypothesis');
assert.equal(experiment.verificationRequired,true);
assert.equal(experiment.mechanismDiscoveryId,best.id);
assert.equal(experiment.mechanismFlowEvidenceClass,best.flowEvidenceClass);
assert.equal(experiment.createdAt,now);
assert.ok(experiment.verificationPlan.includes('holdout'));
assert.ok(experiment.hypothesis.includes('Unverified cross-domain mechanism hypothesis only'));
assert.equal(generator.fromMechanismDiscovery({id:best.id,title:best.referenceTitle,sourceDomain:best.sourceDomain,targetDomain:best.targetDomain,flowEvidenceClass:best.flowEvidenceClass,confidence01:.1,transferability01:.2,status:'candidate',epistemicStatus:'hypothesis',hypothesis:'weak',verificationPlan:'test',correspondences:['one','two'],breakpoints:[]},[]),null);
assert.equal(generator.fromMechanismDiscovery({id:best.id,title:best.referenceTitle,sourceDomain:best.sourceDomain,targetDomain:best.sourceDomain,flowEvidenceClass:best.flowEvidenceClass,confidence01:.9,transferability01:.9,status:'candidate',epistemicStatus:'hypothesis',hypothesis:'same domain',verificationPlan:'test',correspondences:['one','two'],breakpoints:[]},[]),null);
console.log('IDEA10_MECHANISM_SERENDIPITY=PASS',JSON.stringify({evaluated:result.evaluatedN,emitted:result.emittedN,best:best.referenceMechanismId,similarity01:best.similarity01,transferability01:best.transferability01,correspondences:best.correspondences.length,breakpoints:best.breakpoints.length,experiment:experiment.id}));
