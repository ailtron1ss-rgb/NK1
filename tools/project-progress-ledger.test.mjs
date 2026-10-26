import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateProjectProgressLedger, summarizeProjectProgressLedger } from './project-progress-ledger.mjs';

const ledgerUrl = new URL('../docs/PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json', import.meta.url);

async function loadLedger() {
  return JSON.parse(await readFile(ledgerUrl, 'utf8'));
}

test('weighted progress ledger has complete lanes and normalized weights', async () => {
  const ledger = await loadLedger();
  assert.deepEqual(validateProjectProgressLedger(ledger), []);
  assert.equal(ledger.lanes.length, 12);
  assert.equal(ledger.lanes.reduce((sum, lane) => sum + lane.weightPercent, 0), 100);
  const report = summarizeProjectProgressLedger(ledger);
  assert.equal(report.marker, 'NK1_PROJECT_PROGRESS_LEDGER=PASS');
  assert.equal(report.laneCount, 12);
  assert.equal(report.weightTotalPercent, 100);
  for (const dimension of [
    'implementationPercent', 'automatedValidationPercent',
    'fieldEvidencePercent', 'releaseReadinessPercent',
  ]) {
    assert.ok(Number.isFinite(report.dimensions[dimension]));
    assert.ok(report.dimensions[dimension] >= 0 && report.dimensions[dimension] <= 100);
  }
  assert.ok(report.dimensions.implementationPercent > report.dimensions.fieldEvidencePercent,
    'implementation progress must remain distinct from real-world evidence');
});

test('ledger rejects out-of-range scores instead of clamping them', async () => {
  const ledger = await loadLedger();
  ledger.lanes[0].implementationPercent = 101;
  assert.ok(validateProjectProgressLedger(ledger).includes('lane-0-implementationPercent-must-be-integer-0-100'));
});

test('ledger rejects weights that imply a hidden change in the aggregate formula', async () => {
  const ledger = await loadLedger();
  ledger.lanes[0].weightPercent += 1;
  assert.ok(validateProjectProgressLedger(ledger).some((issue) => issue.startsWith('lane-weights-must-sum-to-100:')));
});

test('ledger rejects duplicate domains and invalid current-check statuses', async () => {
  const ledger = await loadLedger();
  ledger.lanes[1].id = ledger.lanes[0].id;
  ledger.ciSnapshot.statuses[0].status = 'maybe-green';
  const issues = validateProjectProgressLedger(ledger);
  assert.ok(issues.includes('duplicate-lane-id:' + ledger.lanes[0].id));
  assert.ok(issues.includes('ci-check-0-status-invalid'));
});
