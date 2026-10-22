#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2026-03-10';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 1000;
const DEFAULT_MAX_DETAIL_RUNS = 3000;
const DEFAULT_MAX_LOG_JOBS = 200;

function integerSetting(value, fallback, minimum = 1, maximum = 10000) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeRepo(value) {
  const repo = String(value ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('Repository must have owner/name form.');
  }
  return repo;
}

function redactSecrets(value) {
  return String(value ?? '')
    .replace(/\bgithub_pat_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:token|password|passwd|secret|authorization|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|sig|signature|se)\=)[^&\s]+/gi, '$1[REDACTED]');
}

export function classifyJob(job) {
  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const failedSteps = steps.filter(step => step?.conclusion === 'failure');
  const runnerAssigned = job?.runner_id != null || Boolean(job?.runner_name);
  if (job?.status === 'queued' || job?.status === 'waiting' || job?.status === 'in_progress') return 'not-completed';
  if (!runnerAssigned && steps.length === 0) return 'runner-or-step-metadata-unavailable';
  if (failedSteps.length) return 'step-failure';
  if (job?.conclusion === 'timed_out') return 'job-timeout';
  if (job?.conclusion === 'cancelled') return 'cancelled';
  if (job?.conclusion === 'failure') return 'job-failure-without-failed-step';
  return 'other';
}

export function extractDiagnosticLines(logText, limit = 80) {
  const pattern = /\berror\b|\berr_[a-z0-9_]+\b|npm ERR!|fatal:|syntaxerror|typeerror|referenceerror|cannot find module|module not found|not found|permission denied|timed? ?out|timeout|rate limit|resource not accessible|blobnotfound|no runner|runner.*(offline|unavailable|pick up)|process completed with exit code|node\.js 20|deprecated|error TS\d+/i;
  const seen = new Set();
  const result = [];
  for (const raw of String(logText ?? '').split(/\r?\n/)) {
    if (!pattern.test(raw)) continue;
    const line = redactSecrets(raw.trim()).slice(0, 360);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    result.push(line);
    if (result.length >= limit) break;
  }
  return result;
}

function makeApiUrl(apiBase, repo, suffix, params = {}) {
  const base = apiBase.replace(/\/+$/, '');
  const query = new URLSearchParams(params);
  return base + '/repos/' + repo + suffix + (query.size ? '?' + query.toString() : '');
}

async function requestJson(url, token, fetchImpl = fetch, retryCount = 3) {
  let lastError;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'NK1-actions-history-audit'
        }
      });
      if (response.ok) return await response.json();
      const body = await response.text();
      const rateLimited = response.status === 429 ||
        (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
      if (rateLimited) {
        throw new Error('GitHub API rate limit reached; stop rather than silently producing an incomplete history.');
      }
      if ((response.status >= 500 || response.status === 408) && attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, Math.min(8000, 500 * (2 ** attempt))));
        continue;
      }
      throw new Error('GitHub API returned ' + response.status + ' for ' + url + ': ' + redactSecrets(body.slice(0, 500)));
    } catch (error) {
      lastError = error;
      if (String(error?.message ?? error).includes('rate limit')) throw error;
      if (attempt < retryCount && !(error instanceof TypeError)) {
        await new Promise(resolve => setTimeout(resolve, Math.min(8000, 500 * (2 ** attempt))));
        continue;
      }
      if (attempt < retryCount && error instanceof TypeError) {
        await new Promise(resolve => setTimeout(resolve, Math.min(8000, 500 * (2 ** attempt))));
        continue;
      }
    }
  }
  throw lastError ?? new Error('GitHub API request failed.');
}

export async function collectRuns({
  repository,
  token,
  apiBase = 'https://api.github.com',
  perPage = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
  fetchImpl = fetch
}) {
  const unique = new Map();
  let reportedTotal = null;
  let pagesFetched = 0;
  let lastPageHadFullSize = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = makeApiUrl(apiBase, repository, '/actions/runs', { per_page: perPage, page });
    const payload = await requestJson(url, token, fetchImpl);
    const rows = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    pagesFetched += 1;
    if (Number.isFinite(payload?.total_count)) reportedTotal = payload.total_count;
    for (const run of rows) {
      if (run && run.id != null) unique.set(String(run.id), run);
    }
    lastPageHadFullSize = rows.length === perPage;
    if (rows.length < perPage) break;
    if (reportedTotal != null && unique.size >= reportedTotal) break;
  }
  const truncated = pagesFetched >= maxPages && lastPageHadFullSize &&
    (reportedTotal == null || unique.size < reportedTotal);
  return {
    runs: [...unique.values()],
    pagesFetched,
    reportedTotal,
    uniqueRuns: unique.size,
    truncated
  };
}

async function collectJobsForRun({ repository, runId, token, apiBase, fetchImpl }) {
  const allJobs = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = makeApiUrl(apiBase, repository, '/actions/runs/' + encodeURIComponent(String(runId)) + '/jobs', {
      filter: 'latest',
      per_page: 100,
      page
    });
    const payload = await requestJson(url, token, fetchImpl);
    const rows = Array.isArray(payload?.jobs) ? payload.jobs : [];
    allJobs.push(...rows);
    if (rows.length < 100) break;
  }
  return allJobs;
}

async function fetchLogArchive({ repository, jobId, token, apiBase, fetchImpl }) {
  const url = makeApiUrl(apiBase, repository, '/actions/jobs/' + encodeURIComponent(String(jobId)) + '/logs');
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'NK1-actions-history-audit'
    }
  });
  if (!response.ok) {
    return { available: false, status: response.status, diagnostics: [] };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) {
    return { available: false, status: response.status, diagnostics: extractDiagnosticLines(bytes.toString('utf8'), 20) };
  }

  let directory;
  try {
    directory = await mkdtemp(path.join(os.tmpdir(), 'nk1-actions-log-'));
    const archive = path.join(directory, 'job.zip');
    await writeFile(archive, bytes);
    const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 })
      .split(/\r?\n/)
      .filter(name => name && /\.txt$/i.test(name) && !name.startsWith('/') && !name.split('/').includes('..'));
    const diagnostics = [];
    for (const name of names) {
      let text = '';
      try {
        text = execFileSync('unzip', ['-p', archive, name], { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        continue;
      }
      diagnostics.push(...extractDiagnosticLines(text, 30));
      if (diagnostics.length >= 120) break;
    }
    return { available: true, status: response.status, diagnostics: [...new Set(diagnostics)].slice(0, 120) };
  } catch (error) {
    return { available: false, status: response.status, diagnostics: [], error: redactSecrets(error?.message ?? error) };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

async function mapPool(items, concurrency, worker) {
  const output = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        output[index] = { ok: true, value: await worker(items[index], index) };
      } catch (error) {
        output[index] = { ok: false, error: redactSecrets(error?.message ?? error) };
      }
    }
  });
  await Promise.all(workers);
  return output;
}

export function summarizeRunHistory(runs) {
  const conclusions = {};
  const statuses = {};
  const workflows = new Map();
  const branches = new Map();
  const suspicious = runs.filter(run =>
    run?.status !== 'completed' ||
    (run?.conclusion != null && run.conclusion !== 'success' && run.conclusion !== 'skipped' && run.conclusion !== 'neutral')
  );
  for (const run of runs) {
    const conclusion = run?.conclusion ?? 'none';
    const status = run?.status ?? 'unknown';
    conclusions[conclusion] = (conclusions[conclusion] ?? 0) + 1;
    statuses[status] = (statuses[status] ?? 0) + 1;
    const workflow = String(run?.name ?? run?.workflow_id ?? 'unknown');
    const branch = String(run?.head_branch ?? 'unknown');
    workflows.set(workflow, (workflows.get(workflow) ?? 0) + 1);
    branches.set(branch, (branches.get(branch) ?? 0) + 1);
  }
  const asTop = map => [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    totalRuns: runs.length,
    conclusionCounts: conclusions,
    statusCounts: statuses,
    suspiciousRuns: suspicious.length,
    workflows: asTop(workflows).slice(0, 50),
    branches: asTop(branches).slice(0, 50)
  };
}

function runLink(repository, run) {
  if (run?.html_url) return run.html_url;
  return 'https://github.com/' + repository + '/actions/runs/' + run.id;
}

function renderMarkdown(report) {
  const lines = [
    '# NK1 GitHub Actions history audit',
    '',
    '- Generated: ' + report.generatedAt,
    '- Repository: ' + report.repository,
    '- Scan status: **' + report.status + '**',
    '- Pages fetched: ' + report.scan.pagesFetched,
    '- Unique runs collected: ' + report.scan.uniqueRuns,
    '- API total_count: ' + String(report.scan.reportedTotal ?? 'not supplied'),
    '- Truncated by page limit: ' + String(report.scan.truncated),
    '- Failed/non-success runs: ' + report.summary.suspiciousRuns,
    '- Runs with detailed job inspection: ' + report.scan.runDetailsFetched,
    '- Runs omitted from job inspection due to budget: ' + report.scan.runDetailsSkipped,
    '- Jobs with log archives examined: ' + report.scan.logsDownloaded,
    '- Job log fetch errors/unavailable archives: ' + report.scan.logsUnavailable,
    '',
    '## Run conclusions',
    '',
    '| Conclusion | Count |',
    '|---|---:|'
  ];
  for (const entry of Object.entries(report.summary.conclusionCounts).sort((a, b) => b[1] - a[1])) {
    lines.push('| ' + entry[0] + ' | ' + entry[1] + ' |');
  }
  lines.push('', '## Most common workflows', '', '| Workflow | Runs |', '|---|---:|');
  for (const item of report.summary.workflows.slice(0, 20)) lines.push('| ' + item.name.replace(/\|/g, '\\|') + ' | ' + item.count + ' |');
  lines.push('', '## Non-success run diagnostics', '');
  if (!report.issues.length) lines.push('No non-success or incomplete runs were found in the scanned history.');
  for (const issue of report.issues.slice(0, 250)) {
    lines.push('### [' + issue.conclusion + '] ' + issue.name + ' #' + issue.runNumber);
    lines.push('- Run: ' + runLink(report.repository, issue));
    lines.push('- Branch/event: ' + issue.branch + ' / ' + issue.event);
    lines.push('- SHA: ' + String(issue.headSha ?? 'unknown'));
    if (issue.detailError) lines.push('- Job inspection error: ' + issue.detailError);
    if (issue.jobs.length === 0 && !issue.detailError) lines.push('- No job rows returned by the API.');
    for (const job of issue.jobs) {
      lines.push('- Job ' + job.name + ' (' + job.conclusion + '): ' + job.classification +
        '; runner=' + String(job.runnerName ?? job.runnerId ?? 'unavailable') +
        '; steps=' + String(job.stepCount) +
        '; failed steps=' + job.failedSteps.map(step => step.name).join(', '));
      if (job.logStatus != null) lines.push('  - Log archive HTTP status: ' + job.logStatus);
      for (const diagnostic of job.diagnostics.slice(0, 15)) lines.push('  - ' + diagnostic);
    }
    lines.push('');
  }
  lines.push(
    '## Interpretation rules',
    '',
    '- A failed run with no runner identity and no step rows is classified as runner-or-step-metadata-unavailable; this is not proof of a source-code defect.',
    '- Step-level failures are linked to sanitized diagnostic lines where a log archive was available.',
    '- Secret-like values are redacted. Full raw logs and environment dumps are never written to the report.',
    '- Only the latest job attempt is inspected for each run. A run-page scan can still be complete if some job/log details are unavailable.',
    '- A COMPLETE result describes API history coverage, not test success or production readiness.'
  );
  return lines.join('\n') + '\n';
}

async function main() {
  const repository = normalizeRepo(process.env.AUDIT_REPOSITORY || process.env.GITHUB_REPOSITORY);
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN with Actions: read permission.');
  const apiBase = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
  const maxPages = integerSetting(process.env.AUDIT_MAX_PAGES, DEFAULT_MAX_PAGES, 1, 10000);
  const maxDetailRuns = integerSetting(process.env.AUDIT_MAX_DETAIL_RUNS, DEFAULT_MAX_DETAIL_RUNS, 1, 10000);
  const maxLogJobs = integerSetting(process.env.AUDIT_MAX_LOG_JOBS, DEFAULT_MAX_LOG_JOBS, 0, 10000);
  const outputDir = path.resolve(process.env.AUDIT_OUTPUT_DIR || 'artifacts/actions-history-audit');
  const fetchImpl = fetch;

  const collected = await collectRuns({
    repository, token, apiBase, perPage: DEFAULT_PAGE_SIZE, maxPages, fetchImpl
  });
  const history = collected.runs;
  const summary = summarizeRunHistory(history);
  const suspicious = history.filter(run =>
    run?.status !== 'completed' ||
    (run?.conclusion != null && run.conclusion !== 'success' && run.conclusion !== 'skipped' && run.conclusion !== 'neutral')
  );
  const detailTargets = suspicious.slice(0, maxDetailRuns);
  const details = await mapPool(detailTargets, 6, async run => ({
    run,
    jobs: await collectJobsForRun({ repository, runId: run.id, token, apiBase, fetchImpl })
  }));
  const issueDrafts = [];
  let detailFetchErrors = 0;
  let logsDownloaded = 0;
  let logsUnavailable = 0;
  const logTargets = [];

  for (let index = 0; index < details.length; index += 1) {
    const record = details[index];
    const run = detailTargets[index];
    if (!record?.ok) {
      detailFetchErrors += 1;
      issueDrafts.push({
        id: run.id, name: run.name ?? 'unknown', runNumber: run.run_number ?? '?',
        conclusion: run.conclusion ?? run.status ?? 'unknown', branch: run.head_branch ?? 'unknown',
        event: run.event ?? 'unknown', headSha: run.head_sha ?? null,
        url: run.html_url, detailError: record?.error ?? 'Unknown job inspection error', jobs: []
      });
      continue;
    }
    const jobs = record.value.jobs.map(job => {
      const steps = Array.isArray(job.steps) ? job.steps : [];
      const failedSteps = steps.filter(step => step?.conclusion === 'failure').map(step => ({
        name: redactSecrets(step.name ?? 'unnamed step'),
        number: step.number ?? null,
        conclusion: step.conclusion
      }));
      const mapped = {
        id: job.id, name: redactSecrets(job.name ?? 'unnamed job'),
        status: job.status ?? 'unknown', conclusion: job.conclusion ?? 'none',
        runnerId: job.runner_id ?? null, runnerName: job.runner_name ?? null,
        stepCount: steps.length, failedSteps, classification: classifyJob(job),
        logStatus: null, diagnostics: []
      };
      if (job.conclusion === 'failure' && (failedSteps.length || (job.runner_id != null && steps.length > 0))) {
        logTargets.push({ run, job, mapped });
      }
      return mapped;
    });
    issueDrafts.push({
      id: run.id, name: run.name ?? 'unknown', runNumber: run.run_number ?? '?',
      conclusion: run.conclusion ?? run.status ?? 'unknown', branch: run.head_branch ?? 'unknown',
      event: run.event ?? 'unknown', headSha: run.head_sha ?? null,
      url: run.html_url, detailError: null, jobs
    });
  }

  const selectedLogs = logTargets.slice(0, maxLogJobs);
  const logResults = await mapPool(selectedLogs, 3, item =>
    fetchLogArchive({ repository, jobId: item.job.id, token, apiBase, fetchImpl })
  );
  for (let index = 0; index < selectedLogs.length; index += 1) {
    const target = selectedLogs[index];
    const result = logResults[index];
    if (!result?.ok) {
      logsUnavailable += 1;
      target.mapped.diagnostics.push('Log retrieval error: ' + (result?.error ?? 'unknown error'));
      continue;
    }
    target.mapped.logStatus = result.value.status;
    target.mapped.diagnostics = result.value.diagnostics;
    if (result.value.available) logsDownloaded += 1;
    else logsUnavailable += 1;
  }

  const issues = issueDrafts.sort((a, b) => {
    const left = Date.parse(a.created_at ?? '') || 0;
    const right = Date.parse(b.created_at ?? '') || 0;
    return right - left || String(b.id).localeCompare(String(a.id));
  });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository,
    status: collected.truncated ? 'PARTIAL' : (detailFetchErrors ? 'DEGRADED' : 'COMPLETE'),
    scan: {
      pagesFetched: collected.pagesFetched,
      uniqueRuns: collected.uniqueRuns,
      reportedTotal: collected.reportedTotal,
      truncated: collected.truncated,
      maxPages,
      suspiciousRunCount: suspicious.length,
      runDetailsFetched: details.filter(item => item?.ok).length,
      runDetailsSkipped: Math.max(0, suspicious.length - detailTargets.length),
      detailFetchErrors,
      logsRequested: selectedLogs.length,
      logsDownloaded,
      logsUnavailable,
      maxLogJobs
    },
    summary,
    issues
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'actions-history-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(path.join(outputDir, 'actions-history-report.md'), renderMarkdown(report), 'utf8');
  console.log(JSON.stringify({
    status: report.status, repository, pagesFetched: report.scan.pagesFetched,
    uniqueRuns: report.scan.uniqueRuns, reportedTotal: report.scan.reportedTotal,
    suspiciousRuns: report.summary.suspiciousRuns, runDetailsFetched: report.scan.runDetailsFetched,
    runDetailsSkipped: report.scan.runDetailsSkipped, detailFetchErrors,
    logsDownloaded, logsUnavailable, outputDir
  }, null, 2));
  if (report.status === 'PARTIAL') process.exitCode = 2;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('ACTIONS_HISTORY_AUDIT_FAILED: ' + redactSecrets(error?.stack ?? error?.message ?? error));
    process.exitCode = 1;
  });
}
