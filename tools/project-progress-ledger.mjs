import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const LEDGER_URL = new URL('../docs/PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json', import.meta.url);
const DIMENSIONS = [
  'implementationPercent',
  'automatedValidationPercent',
  'fieldEvidencePercent',
  'releaseReadinessPercent',
];
const ALLOWED_CI_STATUS = new Set(['queued', 'pending', 'in_progress', 'success', 'failure', 'cancelled', 'unknown']);

export function validateProjectProgressLedger(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['ledger-must-be-an-object'];
  }
  if (value.schemaVersion !== 1) issues.push('schema-version-must-be-1');
  if (typeof value.snapshotDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.snapshotDate)) {
    issues.push('snapshot-date-must-be-iso-date');
  }
  if (!value.methodology || typeof value.methodology.note !== 'string' ||
      !value.methodology.note.trim()) issues.push('methodology-note-required');
  if (!Array.isArray(value.lanes) || value.lanes.length === 0) {
    issues.push('lanes-must-be-a-non-empty-array');
    return issues;
  }

  const seen = new Set();
  let weightTotal = 0;
  for (let index = 0; index < value.lanes.length; index += 1) {
    const lane = value.lanes[index];
    const prefix = 'lane-' + index + '-';
    if (!lane || typeof lane !== 'object' || Array.isArray(lane)) {
      issues.push(prefix + 'must-be-an-object');
      continue;
    }
    if (typeof lane.id !== 'string' || !lane.id.trim()) issues.push(prefix + 'id-required');
    else if (seen.has(lane.id)) issues.push('duplicate-lane-id:' + lane.id);
    else seen.add(lane.id);
    if (typeof lane.name !== 'string' || !lane.name.trim()) issues.push(prefix + 'name-required');
    if (typeof lane.weightPercent !== 'number' || !Number.isFinite(lane.weightPercent) ||
        lane.weightPercent <= 0 || lane.weightPercent > 100) {
      issues.push(prefix + 'weight-must-be-in-(0,100]');
    } else {
      weightTotal += lane.weightPercent;
    }
    for (const dimension of DIMENSIONS) {
      const score = lane[dimension];
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        issues.push(prefix + dimension + '-must-be-integer-0-100');
      }
    }
    if (!Array.isArray(lane.blockers) || lane.blockers.some((item) => typeof item !== 'string' || !item.trim())) {
      issues.push(prefix + 'blockers-must-be-string-array');
    }
    if (!Array.isArray(lane.evidence) || lane.evidence.some((item) => typeof item !== 'string' || !item.trim())) {
      issues.push(prefix + 'evidence-must-be-string-array');
    }
  }
  if (Math.abs(weightTotal - 100) > 1e-9) {
    issues.push('lane-weights-must-sum-to-100:' + weightTotal);
  }

  if (!value.ciSnapshot || typeof value.ciSnapshot !== 'object' ||
      !Array.isArray(value.ciSnapshot.statuses)) {
    issues.push('ci-snapshot-statuses-required');
  } else {
    if (typeof value.ciSnapshot.currentBaseHead !== 'string' ||
        !/^[a-f0-9]{40}$/i.test(value.ciSnapshot.currentBaseHead)) {
      issues.push('ci-snapshot-base-head-must-be-40-hex');
    }
    for (const [index, check] of value.ciSnapshot.statuses.entries()) {
      if (!check || typeof check.name !== 'string' || !check.name.trim()) {
        issues.push('ci-check-' + index + '-name-required');
        continue;
      }
      if (!ALLOWED_CI_STATUS.has(check.status)) issues.push('ci-check-' + index + '-status-invalid');
      if (typeof check.runUrl !== 'string' || !/^https:\/\/github\.com\//.test(check.runUrl)) {
        issues.push('ci-check-' + index + '-run-url-invalid');
      }
    }
  }
  return issues;
}

function roundedPercent(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10) / 10;
}

export function summarizeProjectProgressLedger(ledger) {
  const issues = validateProjectProgressLedger(ledger);
  if (issues.length) throw new Error('progress-ledger-invalid: ' + issues.join(', '));
  const totalWeight = ledger.lanes.reduce((sum, lane) => sum + lane.weightPercent, 0);
  const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [
    dimension,
    roundedPercent(ledger.lanes.reduce((sum, lane) => sum + lane.weightPercent * lane[dimension], 0), totalWeight),
  ]));
  const blockers = ledger.lanes.flatMap((lane) => lane.blockers.map((blocker) => ({
    laneId: lane.id,
    lane: lane.name,
    blocker,
  })));
  return {
    marker: 'NK1_PROJECT_PROGRESS_LEDGER=PASS',
    snapshotDate: ledger.snapshotDate,
    sourceBranchAtSnapshot: ledger.sourceBranchAtSnapshot,
    sourceHeadAtSnapshot: ledger.sourceHeadAtSnapshot,
    laneCount: ledger.lanes.length,
    weightTotalPercent: totalWeight,
    dimensions,
    lanes: ledger.lanes.map((lane) => ({
      id: lane.id,
      name: lane.name,
      weightPercent: lane.weightPercent,
      implementationPercent: lane.implementationPercent,
      automatedValidationPercent: lane.automatedValidationPercent,
      fieldEvidencePercent: lane.fieldEvidencePercent,
      releaseReadinessPercent: lane.releaseReadinessPercent,
      blockerCount: lane.blockers.length,
    })),
    blockerCount: blockers.length,
    blockers,
    ciSnapshot: ledger.ciSnapshot,
    interpretation: 'Engineering estimates and snapshot evidence only; not a measure of intelligence, consciousness, or production readiness.',
  };
}

async function main() {
  const raw = await readFile(LEDGER_URL, 'utf8');
  const ledger = JSON.parse(raw);
  const issues = validateProjectProgressLedger(ledger);
  if (issues.length) {
    process.stderr.write(JSON.stringify({ marker: 'NK1_PROJECT_PROGRESS_LEDGER=FAIL', issues }, null, 2) + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(JSON.stringify(summarizeProjectProgressLedger(ledger), null, 2) + '\\n');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write('NK1_PROJECT_PROGRESS_LEDGER=ERROR ' + String(error?.stack ?? error) + '\\n');
    process.exitCode = 1;
  });
}
