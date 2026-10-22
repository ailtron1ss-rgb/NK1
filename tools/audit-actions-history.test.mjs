import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyJob,
  collectRuns,
  extractDiagnosticLines,
  summarizeRunHistory
} from './audit-actions-history.mjs';

test('collectRuns paginates fully and de-duplicates run IDs', async () => {
  const urls = [];
  const pages = {
    1: { total_count: 3, workflow_runs: [{ id: 10 }, { id: 11 }] },
    2: { total_count: 3, workflow_runs: [{ id: 11 }, { id: 12 }] },
    3: { total_count: 3, workflow_runs: [] }
  };
  const fakeFetch = async url => {
    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get('page'));
    urls.push(page);
    return new Response(JSON.stringify(pages[page]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await collectRuns({
    repository: 'owner/repo',
    token: 'fake-token',
    apiBase: 'https://api.github.test',
    perPage: 2,
    maxPages: 10,
    fetchImpl: fakeFetch
  });

  assert.deepEqual(urls, [1, 2]);
  assert.deepEqual(result.runs.map(run => run.id), [10, 11, 12]);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.uniqueRuns, 3);
  assert.equal(result.reportedTotal, 3);
  assert.equal(result.truncated, false);
});

test('collectRuns marks a full last page at the configured limit as partial', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    total_count: 5,
    workflow_runs: [{ id: 1 }, { id: 2 }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const result = await collectRuns({
    repository: 'owner/repo',
    token: 'fake-token',
    apiBase: 'https://api.github.test',
    perPage: 2,
    maxPages: 1,
    fetchImpl: fakeFetch
  });

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.truncated, true);
});

test('classifyJob separates missing runner metadata from actionable step failures', () => {
  assert.equal(classifyJob({ conclusion: 'failure', runner_id: null, runner_name: null, steps: null }), 'runner-or-step-metadata-unavailable');
  assert.equal(classifyJob({
    conclusion: 'failure',
    runner_id: 42,
    steps: [{ name: 'checkout', conclusion: 'success' }, { name: 'typecheck', conclusion: 'failure' }]
  }), 'step-failure');
  assert.equal(classifyJob({ conclusion: 'timed_out', runner_id: 42, steps: [] }), 'job-timeout');
  assert.equal(classifyJob({ status: 'queued', conclusion: null, runner_id: null, steps: [] }), 'not-completed');
  assert.equal(classifyJob({ status: 'in_progress', conclusion: null, runner_id: null, steps: [] }), 'not-completed');
});

test('history summary counts conclusions and identifies non-success runs', () => {
  const summary = summarizeRunHistory([
    { id: 1, name: 'runtime', status: 'completed', conclusion: 'success', head_branch: 'main' },
    { id: 2, name: 'runtime', status: 'completed', conclusion: 'failure', head_branch: 'rebuild' },
    { id: 3, name: 'runtime', status: 'queued', conclusion: null, head_branch: 'rebuild' }
  ]);
  assert.equal(summary.totalRuns, 3);
  assert.equal(summary.suspiciousRuns, 2);
  assert.equal(summary.conclusionCounts.success, 1);
  assert.equal(summary.conclusionCounts.failure, 1);
  assert.equal(summary.conclusionCounts.none, 1);
  assert.equal(summary.workflows[0].name, 'runtime');
  assert.equal(summary.workflows[0].count, 3);
});

test('diagnostic extraction redacts common GitHub tokens', () => {
  const lines = extractDiagnosticLines([
    'Error: request failed with token=ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    'TypeError: cannot find module ./missing.mjs',
    'normal informational output'
  ].join('\n'));
  assert.equal(lines.length, 2);
  assert.ok(!lines.some(line => line.includes('ghp_abcdefghijklmnopqrstuvwxyz0123456789')));
  assert.ok(lines[0].includes('[REDACTED_GITHUB_TOKEN]'));
});


test('collectRuns does not burn retry budget on permanent API errors', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: 'Bad credentials' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  };

  await assert.rejects(() => collectRuns({
    repository: 'owner/repo',
    token: 'fake-token',
    apiBase: 'https://api.github.test',
    perPage: 2,
    maxPages: 1,
    fetchImpl: fakeFetch
  }), /GitHub API returned 401/);
  assert.equal(calls, 1, 'a permanent 4xx response must fail immediately');
});

test('collectRuns retries a transient 5xx response before succeeding', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) return new Response('temporarily unavailable', { status: 503 });
    return new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const result = await collectRuns({
    repository: 'owner/repo',
    token: 'fake-token',
    apiBase: 'https://api.github.test',
    perPage: 2,
    maxPages: 1,
    fetchImpl: fakeFetch
  });
  assert.equal(calls, 2);
  assert.equal(result.uniqueRuns, 0);
  assert.equal(result.truncated, false);
});
