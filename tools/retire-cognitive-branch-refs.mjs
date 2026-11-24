import { writeFile } from 'node:fs/promises';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const targetRef = process.env.GITHUB_REF;
const targetSha = process.env.GITHUB_SHA;
if (!repository || !token || !targetSha) throw new Error('missing GitHub workflow context');
if (targetRef !== 'refs/heads/workpass70-source') {
  console.log('SKIP: audit is restricted to workpass70-source; ref=' + targetRef);
  process.exit(0);
}
const apiRoot = 'https://api.github.com/repos/' + repository;
const headers = {
  authorization: 'Bearer ' + token,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
};
async function api(path) {
  const response = await fetch(apiRoot + path, { method: 'GET', headers });
  if (response.status === 404) return { notFound: true };
  if (response.status === 204) return null;
  const body = await response.text();
  if (!response.ok) throw new Error('GET ' + path + ' -> ' + response.status + ': ' + body.slice(0, 500));
  return body ? JSON.parse(body) : null;
}
const branchPath = name => '/branches/' + name.split('/').map(encodeURIComponent).join('/');
const candidates = [
  { name: 'aspect/code-assimilation-contracts-20261102', sha: '10996769598a39e2fc5df69c46627a97777003f5', kind: 'duplicate', keeper: 'aspect/code-assimilation-archive-extraction-20261104' },
  { name: 'integrate/consequence-calibration-lineage-followup-20261120', sha: 'f9621bf3e4411ce17bc809922a5f90126001f4fd', kind: 'duplicate', keeper: 'aspect/consequence-ecology-20261117' },
  { name: 'aspect/self-motivation-receipts-consent-rebased-20261123', sha: '54b9b0dcc62425c9d860c08fe78b91e557d4c800', kind: 'duplicate', keeper: 'aspect/self-motivation-receipts-consent-current-20261123' },
  { name: 'integrate/worldforge-to-sharedfuture-after-calibration-20261120', sha: '68a03799ca0c9f18e4c6e19399ed8018e0215e60', kind: 'duplicate', keeper: 'aspect/world-forge-integrated-20261117' },
  { name: 'nk1-all-branches-merge-2026-10-23', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'nk1-integration-workspace-2026-10-22', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'rebuild', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass79-cognitive-rebuild', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass116-seed-clustered-learning-eval', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass117-verified-replay-admission', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass118-multi-source-learning-integration', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass119-skill-retrieval-feedback-curriculum', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass120-verified-skill-revision-gate', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass121-ledger-bound-promotion-proposals', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass122-promotion-gate-coverage-hardening', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass123-authenticated-skill-lifecycle', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass124-learning-evidence-hardening', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass135-durable-shadow-run-registry', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass203-independent-candidate-evaluator', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'workpass313-actions-history-audit', sha: '82ea7a8b7c9b036e65c8b056acedd1176952dd8f', kind: 'duplicate', keeper: 'workpass206-runtime-evaluator-wiring' },
  { name: 'aspect/autonomous-cycle-cooperative-batching-20261122', sha: '125089e562e4e19feccb31ac3ee4317d9e3890fd', kind: 'ancestor' },
  { name: 'aspect/cognitive-resource-interrupt-routing-20261122', sha: '39a68683322644ac5121562c346be9898755288b', kind: 'ancestor' },
  { name: 'aspect/p34-evidence-lifecycle-integrity-20261122', sha: 'd6af3c472b18f2bb96c2eaaf55af7cfff76a9a88', kind: 'ancestor' },
  { name: 'aspect/active-information-outcome-closure-20261122', sha: 'a98c15e7d82f7db62caf3697b14b2283130cca80', kind: 'ancestor' },
  { name: 'aspect/metacognitive-episode-integrity-20261103-v3', sha: 'ca362f318c016e98a22c68a5cc61e3537d81e10e', kind: 'ancestor' },
  { name: 'aspect/active-information-experiment-threshold-20261123', sha: '2689ee6a5d402cf5aa9e99d16072197d6ceed1c4', kind: 'ancestor' },
  { name: 'aspect/cognitive-health-current-source-20261123', sha: 'dfc8d8b66a58ab60220c91055fd0349ef9f31e84', kind: 'ancestor' },
  { name: 'aspect/cognitive-network-bus-input-hardening-20261115', sha: 'bae3579cf8f1dcf36a9fcb3f70d92378cea3d01d', kind: 'ancestor' },
  { name: 'aspect/governed-autonomy-selfmodel-20261115', sha: '4ab175027647b05cb0428b7ed102975af6d067d0', kind: 'ancestor' },
];
const openPullRefs = new Set();
for (let page = 1; page <= 10; page++) {
  const items = await api('/pulls?state=open&per_page=100&page=' + page);
  if (!Array.isArray(items) || items.length === 0) break;
  for (const pr of items) {
    if (pr.head?.ref) openPullRefs.add(pr.head.ref);
    if (pr.base?.ref) openPullRefs.add(pr.base.ref);
  }
  if (items.length < 100) break;
}
const eligible = [];
const skipped = [];
for (const candidate of candidates) {
  try {
    if (candidate.name === 'main' || candidate.name === 'workpass70-source') {
      skipped.push([candidate.name, 'canonical branch']);
      continue;
    }
    if (openPullRefs.has(candidate.name)) {
      skipped.push([candidate.name, 'referenced by an open PR']);
      continue;
    }
    const branch = await api(branchPath(candidate.name));
    if (!branch || branch.notFound) {
      skipped.push([candidate.name, 'already absent']);
      continue;
    }
    if (branch.protected !== false) {
      skipped.push([candidate.name, 'branch is protected or protection state is unknown']);
      continue;
    }
    if (branch.commit?.sha !== candidate.sha) {
      skipped.push([candidate.name, 'tip SHA changed']);
      continue;
    }
    if (candidate.kind === 'duplicate') {
      const keeper = await api(branchPath(candidate.keeper));
      if (!keeper || keeper.notFound || keeper.commit?.sha !== candidate.sha) {
        skipped.push([candidate.name, 'same-SHA keeper is absent or changed']);
        continue;
      }
    } else if (candidate.kind === 'ancestor') {
      const comparison = await api('/compare/' + candidate.sha + '...' + targetSha);
      if (!comparison || comparison.behind_by !== 0 || !['ahead', 'identical'].includes(comparison.status)) {
        skipped.push([candidate.name, 'donor tip is not an ancestor of this canonical commit']);
        continue;
      }
    } else {
      skipped.push([candidate.name, 'unknown retirement class']);
      continue;
    }
    eligible.push([candidate.name, candidate.kind]);
    console.log('ELIGIBLE FOR HUMAN REVIEW (READ-ONLY) ' + candidate.name + ' (' + candidate.kind + ')');
  } catch (error) {
    skipped.push([candidate.name, 'API error: ' + String(error).slice(0, 220)]);
    console.error('SKIP ' + candidate.name + ': ' + String(error));
  }
}
const lines = [
  '# NK1 cognitive branch retirement candidate audit (READ-ONLY)',
  '',
  'Target canonical commit: ' + targetSha,
  'Candidate refs: ' + candidates.length,
  'Eligible for human review: ' + eligible.length,
  'Skipped: ' + skipped.length,
  'Deleted: 0 — this utility has no branch-write path.',
  '',
  '## Eligible candidates (no action taken)',
  ...(eligible.length ? eligible.map(([name, kind]) => '- `' + name + '` — ' + kind) : ['- None']),
  '',
  '## Skipped candidates',
  ...(skipped.length ? skipped.map(([name, reason]) => '- `' + name + '` — ' + reason) : ['- None']),
  '',
  'This report is advisory only. Branch deletion requires a separate explicit human action.',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, lines + '\n', 'utf8');
console.log(lines);
