import assert from 'node:assert/strict';
import { resolveResearchSourceLineage, canonicalResearchDocumentKey } from '../src/organism/system/ResearchSourceLineage.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';

const claim = 'The system is safe for deployment';
const article = `The system is safe for deployment. The independent review examined the release configuration, dependency inventory, access policy, network boundaries, persistent state, failure recovery, audit logs, and user-facing workflow. Reviewers also inspected the rollback procedure, permission model, secret handling, and operational monitoring. The published report states that the release candidate passed its defined checks, while documenting specific limitations around long-running tests, model confidence, external provider availability, and recovery after a failed migration. Operators should preserve the original evidence, record the exact software version, and repeat the relevant steps when the deployed configuration changes. The report does not claim that the system is flawless or that every possible failure mode has been eliminated. It describes the tested environment and provides a bounded account of observed behaviour.`;
const syndicatedVariant = `Syndicated report — ${article} Additional publisher summary and contact details follow.`;
const hash = ch => ch.repeat(64).slice(0, 64);
const source = (host, contentHash, snippet, at = Date.now(), title = `Report from ${host}`) => ({
  url: `https://${host}/story/release?utm_source=feed`, finalUrl: `https://${host}/story/release?utm_source=feed`,
  sourceHost: host, independenceKey: 'caller-label-must-not-be-trusted', status: 200, ok: true, verified: true,
  externalEvidence: true, contentType: 'text/plain', title, contentHash, bytes: snippet.length, snippet,
  fetchedAt: at, trust01: .95, relevance01: .94, queryHash: hash('q'), claim,
});

const doc1 = canonicalResearchDocumentKey('https://www.alpha.example/story/release?utm_source=feed');
const doc2 = canonicalResearchDocumentKey('https://alpha.example/story/release?utm_medium=email');
assert.equal(doc1, doc2, 'tracking parameters and www alias do not create fake document identities');

const matched = resolveResearchSourceLineage({ url: 'https://beta.example/copy', contentHash: hash('b'), title: 'Wire story reprint', snippet: syndicatedVariant }, [
  { url: 'https://alpha.example/original', contentHash: hash('a'), title: 'Original wire story', snippet: article, sourceLineageKey: 'lineage:original' },
]);
assert.equal(matched.relation, 'near-duplicate', `expected syndication match, got ${matched.relation} similarity=${matched.similarity01}`);
assert.equal(matched.sourceLineageKey, 'lineage:original');
assert(matched.similarity01 >= .62);

const similarTopicButDifferent = resolveResearchSourceLineage({ url: 'https://gamma.example/analysis', contentHash: hash('c'), title: 'Deployment review', snippet: 'The system is safe for deployment. The independent reviewers evaluated a completely separate set of operational observations, including incident timelines, rollback latency, staffing coverage, production traffic, and network saturation. Their report mainly discussed deployment scheduling and did not reproduce the release configuration review, dependency inventory, access policy, persistent-state checks, or migration procedure. It provided a separate comparison of rollout windows across multiple teams and observed that the main sources of risk came from resource contention and inconsistent maintenance windows.' }, [
  { url: 'https://alpha.example/original', contentHash: hash('a'), title: 'Original wire story', snippet: article, sourceLineageKey: 'lineage:original' },
]);
assert.equal(similarTopicButDifferent.relation, 'distinct', 'topical overlap without article-level copying stays distinct');

const firewall = new EvidenceFirewallEngine();
const session = new ProjectResearchSession(firewall);
session.begin('lineage-copy', 'project:lineage-copy:claim');
const one = session.ingest(source('alpha.example', hash('a'), article, Date.now(), 'Original report'), 'external-api');
assert.equal(one.promoted, false);
const two = session.ingest(source('beta.example', hash('b'), syndicatedVariant, Date.now() + 1000, 'Reprinted report'), 'external-api');
assert.equal(two.results[0].lineageRelation, 'near-duplicate');
assert.equal(two.results[0].sourceLineageKey, two.results[1].sourceLineageKey);
assert.equal(two.claimVerification.independentSupportSources, 1, 'syndicated copies count as one evidence lineage');
assert.equal(two.claimVerification.verdict, 'unknown', 'two domains reprinting one story cannot corroborate a claim independently');
assert.equal(two.promoted, false, 'firewall must not promote one syndicated story under two domains');

const independentFirewall = new EvidenceFirewallEngine();
const independentSession = new ProjectResearchSession(independentFirewall);
independentSession.begin('lineage-independent', 'project:lineage-independent:claim');
independentSession.ingest(source('delta.example', hash('d'), article, Date.now(), 'Independent review A'), 'external-api');
const independent = independentSession.ingest(source('epsilon.example', hash('e'), similarTopicButDifferent.relation === 'distinct' ? 'The system is safe for deployment. The second publication records a separate set of tests and observations concerning different deployment scenarios, recovery timing, permission boundaries, service availability, incident response and dependency drift. Its authors used another environment and documented distinct measurements, release conditions, observed errors and mitigations. They did not reproduce the source article: the analysis compares a separate operational procedure and reaches its own report based on different records.' : article, Date.now() + 1000, 'Independent review B'), 'external-api');
assert.equal(independent.results[0].lineageRelation, 'distinct');
assert.equal(independent.claimVerification.independentSupportSources, 2);
assert.equal(independent.claimVerification.verdict, 'support');
assert.equal(independent.promoted, true, 'two different publishers and genuinely different story lineages may pass the existing diversity gate');

const restored = new ProjectResearchSession(new EvidenceFirewallEngine());
restored.restore(two);
const recovered = restored.snapshot();
assert.equal(recovered.results[0].sourceLineageKey, recovered.results[1].sourceLineageKey, 'restore reconstructs lineage from bounded source data instead of trusting a persisted label');
assert.equal(recovered.claimVerification.independentSupportSources, 1);
console.log('RESEARCH_SOURCE_LINEAGE=PASS cases=8');
