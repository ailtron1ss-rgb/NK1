import assert from 'node:assert/strict';
import { assessClaimAgainstExcerpt, aggregateClaimEvidence } from '../src/organism/system/ResearchClaimAssessment.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';

const claim='System is safe for deployment';
const source=(host,hash,snippet,at=Date.now())=>({
  url:`https://${host}/release-note`, finalUrl:`https://${host}/release-note`,
  sourceHost:host, independenceKey:'untrusted-caller-label', status:200,
  ok:true, verified:true, externalEvidence:true, contentType:'text/plain',
  title:`Release note ${host}`, contentHash:hash.repeat(64).slice(0,64), bytes:snippet.length,
  snippet, fetchedAt:at, trust01:.92, relevance01:.91, queryHash:'a'.repeat(64), claim,
});

const support=assessClaimAgainstExcerpt(claim,{
  url:'https://alpha.example/release-note',title:'Alpha release',documentKey:'https://alpha.example/release-note',contentHash:'b'.repeat(64),sourceKey:'alpha.example',fetchedAt:1,
  snippet:'The release review states: System is safe for deployment. Remaining caveats are documented separately.',claim,
});
assert.equal(support.verdict,'support');
assert.equal(support.scope,'textual-anchor-only');
assert.equal(support.calibratedProbability,null,'text anchor must not masquerade as calibrated probability');
assert.match(support.quotes[0].quote,/System is safe for deployment\./);
assert(support.quotes[0].start>=0&&support.quotes[0].end>support.quotes[0].start);

const refute=assessClaimAgainstExcerpt(claim,{
  url:'https://alpha.example/release-note',title:'Alpha release',documentKey:'https://alpha.example/release-note',contentHash:'c'.repeat(64),sourceKey:'alpha.example',fetchedAt:1,
  snippet:'System is not safe for deployment.',claim,
});
assert.equal(refute.verdict,'refute','polarity conflict must be visible');
const unknown=assessClaimAgainstExcerpt(claim,{
  url:'https://alpha.example/summary',title:'Alpha summary',documentKey:'https://alpha.example/summary',contentHash:'d'.repeat(64),sourceKey:'alpha.example',fetchedAt:1,
  snippet:'The rollout has fewer incidents and improved uptime.',claim,
});
assert.equal(unknown.verdict,'unknown','paraphrase is not falsely promoted by keyword overlap');
assert.equal(assessClaimAgainstExcerpt('Why is the system safe?',{snippet:'System is safe for deployment.'}).verdict,'unknown');
assert.equal(assessClaimAgainstExcerpt(undefined,{snippet:'System is safe for deployment.'}).verdict,'unknown');
assert.equal(assessClaimAgainstExcerpt(claim,{snippet:'The report cannot establish whether System is safe for deployment.'}).verdict,'unknown','uncertainty before the claim is not support');
assert.equal(assessClaimAgainstExcerpt(claim,{snippet:'The spokesperson said, “System is safe for deployment.”'}).verdict,'unknown','quoted claim with unclear evidential ownership stays unknown');
assert.equal(assessClaimAgainstExcerpt(claim,{snippet:'It is false that System is safe for deployment.'}).verdict,'refute','explicit denial is not misclassified as support');
assert.equal(assessClaimAgainstExcerpt(claim,{snippet:'System is safe for deployment, but the report later disputes that conclusion.'}).verdict,'unknown','an adversative clause prevents unqualified support');
const normalizedClaimId=assessClaimAgainstExcerpt('  SYSTEM   IS SAFE FOR DEPLOYMENT  ',{snippet:'System is safe for deployment.'}).claimId;
assert.equal(normalizedClaimId,support.claimId,'claim IDs are stable under case/whitespace normalization');
assert.match(support.claimId,/^claim:[a-f0-9]{32}$/,'claim identity uses 128 bits of a SHA-256 digest');
assert.notEqual(support.claimId,assessClaimAgainstExcerpt('System is unsafe for deployment',{snippet:'System is unsafe for deployment.'}).claimId);

const twoSources=aggregateClaimEvidence(claim,[
 {url:'https://alpha.example/a',title:'A',documentKey:'https://alpha.example/a',contentHash:'1'.repeat(64),sourceKey:'alpha.example',snippet:'System is safe for deployment.',fetchedAt:1,claim},
 {url:'https://beta.example/b',title:'B',documentKey:'https://beta.example/b',contentHash:'2'.repeat(64),sourceKey:'beta.example',snippet:'System is safe for deployment.',fetchedAt:2,claim},
]);
assert.equal(twoSources.verdict,'support');
assert.equal(twoSources.independentSupportSources,2);
const mixed=aggregateClaimEvidence(claim,[
 {url:'https://alpha.example/a',title:'A',documentKey:'https://alpha.example/a',contentHash:'1'.repeat(64),sourceKey:'alpha.example',snippet:'System is safe for deployment.',fetchedAt:1,claim},
 {url:'https://beta.example/b',title:'B',documentKey:'https://beta.example/b',contentHash:'2'.repeat(64),sourceKey:'beta.example',snippet:'System is not safe for deployment.',fetchedAt:2,claim},
]);
assert.equal(mixed.verdict,'mixed');
const normalizedClaimAggregation=aggregateClaimEvidence(claim,[
 {url:'https://alpha.example/a',title:'A',documentKey:'https://alpha.example/a',contentHash:'1'.repeat(64),sourceKey:'alpha.example',snippet:'System is safe for deployment.',fetchedAt:1,claim:' System is safe for deployment '},
 {url:'https://beta.example/b',title:'B',documentKey:'https://beta.example/b',contentHash:'2'.repeat(64),sourceKey:'beta.example',snippet:'System is safe for deployment.',fetchedAt:2,claim:' SYSTEM   IS SAFE FOR DEPLOYMENT '},
]);
assert.equal(normalizedClaimAggregation.verdict,'support','claim variants with case/whitespace differences share one canonical evidence thread');

const firewall=new EvidenceFirewallEngine();
const session=new ProjectResearchSession(firewall);
session.begin('project-1','project-1:explicit-claim');
const one=session.ingest(source('alpha.example','e','System is safe for deployment.'),'external-api');
assert.equal(one.promoted,false);
assert.equal(one.claimVerification.verdict,'unknown','one publisher is not enough for independent textual support');
assert.equal(one.results[0].claimAssessment.verdict,'support');
const two=session.ingest(source('beta.example','f','System is safe for deployment.',Date.now()+1000),'external-api');
assert.equal(two.claimVerification.verdict,'support');
assert.equal(two.claimVerification.independentSupportSources,2);
assert.equal(two.claimVerification.evidence.length,2);
const serialized=two;
const recovered=new ProjectResearchSession(new EvidenceFirewallEngine());
recovered.restore(serialized);
assert.equal(recovered.snapshot().claimVerification.verdict,'support');
assert.equal(recovered.snapshot().claimVerification.evidence.length,2,'restoration reconstructs evidence quotes from stored excerpts rather than trusting persisted verdicts');
console.log('RESEARCH_CLAIM_ASSESSMENT=PASS cases=20');
