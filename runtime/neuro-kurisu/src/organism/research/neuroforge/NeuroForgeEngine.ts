import { createHash } from 'node:crypto';
import type { NeuroForgeCapabilityId, NeuroForgeCapabilitySignal, NeuroForgeProjectManifest } from './NeuroForgeScanner.ts';

export interface NeuroForgeProposal {
  proposalId: string;
  donorId: string;
  capabilityId: NeuroForgeCapabilityId;
  gapClass: 'candidate-gap' | 'reinforcement-candidate' | 'overlap';
  recommendation: 'reproduce-and-benchmark' | 'benchmark-before-replacing' | 'do-not-duplicate';
  priorityScore: number;
  donorConfidence01: number;
  baselineConfidence01: number;
  copyAllowed: false;
  promotionStatus: 'blocked';
  blockingReasons: string[];
  evidence: { donorFiles: string[]; baselineFiles: string[]; donorSnapshotSha256: string; baselineSnapshotSha256: string };
}

export interface NeuroForgeAnalysisReport {
  schemaVersion: 1;
  generatedAt: number;
  mode: 'offline-donor-analysis';
  baseline: { projectId: string; snapshotSha256: string; files: number; sourceFiles: number };
  donors: Array<{ projectId: string; snapshotSha256: string; files: number; sourceFiles: number; licenseSpdx: string | null; securityFindings: number }>;
  proposals: NeuroForgeProposal[];
  codeCopied: false;
  donorCodeExecuted: false;
  promotionPolicy: 'human-reviewed-evidence-only';
}

export interface NeuroForgePromotionEvidence {
  sourceSnapshotReviewed: boolean;
  humanLicenseApproval: boolean;
  dependencyAuditPassed: boolean;
  securityReviewPassed: boolean;
  isolatedReproductionPassed: boolean;
  behavioralBenchmarkImproved: boolean;
  independentHoldoutNoRegression: boolean;
  exactHeadCiPassed: boolean;
  releaseParityVerified: boolean;
}

export function evaluateNeuroForgePromotionGate(evidence: NeuroForgePromotionEvidence): {
  readyForHumanPromotion: boolean;
  codeReuseAuthorized: false;
  blockingReasons: string[];
} {
  const checks: Array<[keyof NeuroForgePromotionEvidence, string]> = [
    ['sourceSnapshotReviewed', 'source-snapshot-review-required'],
    ['humanLicenseApproval', 'human-license-review-required'],
    ['dependencyAuditPassed', 'dependency-audit-required'],
    ['securityReviewPassed', 'security-review-required'],
    ['isolatedReproductionPassed', 'isolated-reproduction-required'],
    ['behavioralBenchmarkImproved', 'behavioral-benchmark-improvement-required'],
    ['independentHoldoutNoRegression', 'independent-holdout-required'],
    ['exactHeadCiPassed', 'exact-head-ci-required'],
    ['releaseParityVerified', 'release-parity-verification-required'],
  ];
  const blockingReasons = checks.filter(([key]) => evidence[key] !== true).map(([, reason]) => reason);
  return {
    readyForHumanPromotion: blockingReasons.length === 0,
    codeReuseAuthorized: false,
    blockingReasons,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function stableProposalId(snapshot: string, capabilityId: string): string {
  return createHash('sha256').update(snapshot + ':' + capabilityId).digest('hex').slice(0, 24);
}

function capabilityMap(rows: NeuroForgeCapabilitySignal[]): Map<string, NeuroForgeCapabilitySignal> {
  return new Map(rows.map(row => [row.capabilityId, row]));
}

function blockingReasons(donor: NeuroForgeProjectManifest): string[] {
  const reasons = [
    'human-license-review-required',
    'dependency-audit-required',
    'security-review-required',
    'isolated-reproduction-required',
    'behavioral-evaluation-required',
    'independent-holdout-required',
    'exact-head-ci-required',
    'release-parity-required',
  ];
  if (donor.rootLicense.status !== 'identified') reasons.push('license-evidence-missing-or-incomplete');
  if (!donor.upstreamRevision) reasons.push('upstream-revision-not-pinned');
  if (donor.securityFindings.length) reasons.push('credential-or-secret-findings-review-required');
  if (donor.stats.skippedFiles) reasons.push('inventory-incomplete-files-skipped');
  return reasons;
}

export function analyzeNeuroForge(input: {
  baseline: NeuroForgeProjectManifest;
  donors: NeuroForgeProjectManifest[];
}): NeuroForgeAnalysisReport {
  const baselineCapabilities = capabilityMap(input.baseline.capabilitySignals);
  const proposals: NeuroForgeProposal[] = [];

  for (const donor of input.donors) {
    for (const donorSignal of donor.capabilitySignals) {
      if (donorSignal.confidence01 < 0.18) continue;
      const baselineSignal = baselineCapabilities.get(donorSignal.capabilityId);
      const baselineConfidence01 = baselineSignal?.confidence01 ?? 0;
      let gapClass: NeuroForgeProposal['gapClass'];
      if (baselineConfidence01 < 0.22) gapClass = 'candidate-gap';
      else if (donorSignal.confidence01 >= baselineConfidence01 + 0.16) gapClass = 'reinforcement-candidate';
      else gapClass = 'overlap';

      const recommendation: NeuroForgeProposal['recommendation'] =
        gapClass === 'candidate-gap' ? 'reproduce-and-benchmark' :
        gapClass === 'reinforcement-candidate' ? 'benchmark-before-replacing' : 'do-not-duplicate';
      const dependencyPenalty = Math.min(0.12, donor.dependencies.length * 0.004);
      const securityPenalty = Math.min(0.30, donor.securityFindings.length * 0.10);
      const overlapPenalty = gapClass === 'overlap' ? 0.16 : 0;
      const priorityScore = Math.round(100 * clamp(
        donorSignal.confidence01 * 0.72 +
        (donor.stats.testFiles > 0 ? 0.10 : 0) +
        (donor.rootLicense.status === 'identified' ? 0.05 : 0) -
        dependencyPenalty - securityPenalty - overlapPenalty,
      ));

      proposals.push({
        proposalId: stableProposalId(donor.snapshotSha256, donorSignal.capabilityId),
        donorId: donor.projectId,
        capabilityId: donorSignal.capabilityId,
        gapClass,
        recommendation,
        priorityScore,
        donorConfidence01: donorSignal.confidence01,
        baselineConfidence01,
        copyAllowed: false,
        promotionStatus: 'blocked',
        blockingReasons: blockingReasons(donor),
        evidence: {
          donorFiles: donorSignal.evidenceFiles,
          baselineFiles: baselineSignal?.evidenceFiles ?? [],
          donorSnapshotSha256: donor.snapshotSha256,
          baselineSnapshotSha256: input.baseline.snapshotSha256,
        },
      });
    }
  }

  proposals.sort((a, b) =>
    Number(a.gapClass !== 'candidate-gap') - Number(b.gapClass !== 'candidate-gap') ||
    b.priorityScore - a.priorityScore ||
    a.donorId.localeCompare(b.donorId) ||
    a.capabilityId.localeCompare(b.capabilityId),
  );

  return {
    schemaVersion: 1,
    generatedAt: Date.now(),
    mode: 'offline-donor-analysis',
    baseline: {
      projectId: input.baseline.projectId,
      snapshotSha256: input.baseline.snapshotSha256,
      files: input.baseline.stats.files,
      sourceFiles: input.baseline.stats.sourceFiles,
    },
    donors: input.donors.map(donor => ({
      projectId: donor.projectId,
      snapshotSha256: donor.snapshotSha256,
      files: donor.stats.files,
      sourceFiles: donor.stats.sourceFiles,
      licenseSpdx: donor.rootLicense.spdxId,
      securityFindings: donor.securityFindings.length,
    })),
    proposals,
    codeCopied: false,
    donorCodeExecuted: false,
    promotionPolicy: 'human-reviewed-evidence-only',
  };
}

export function renderNeuroForgeSummary(report: NeuroForgeAnalysisReport): string {
  const lines = [
    '# NeuroForge donor analysis',
    '',
    '- Mode: offline source analysis only',
    '- Baseline: ' + report.baseline.projectId + ' (' + report.baseline.files + ' files)',
    '- Donors scanned: ' + report.donors.length,
    '- Capability proposals: ' + report.proposals.length,
    '- Code copied: no',
    '- Donor code executed: no',
    '',
    '| Donor | Capability | Gap | Priority | Recommendation |',
    '|---|---|---|---:|---|',
  ];
  for (const row of report.proposals) {
    lines.push('| ' + row.donorId + ' | ' + row.capabilityId + ' | ' + row.gapClass + ' | ' + row.priorityScore + ' | ' + row.recommendation + ' |');
  }
  lines.push('', '## Promotion policy', '', 'Every proposal remains blocked until source provenance, human legal review, dependency and security review, isolated reproduction, behavioral evaluation, independent holdout, exact-head CI and release parity are verified.');
  lines.push('', '## Interpretation', '', 'Capability signals are deterministic heuristics over file paths and bounded text samples. They are hypotheses for investigation, not proof that a donor works better than NK1 or that a capability is runtime-wired.');
  return lines.join('\n') + '\n';
}

export function renderNeuroForgeProposal(proposal: NeuroForgeProposal): string {
  const lines = [
    '# NeuroForge proposal: ' + proposal.donorId + ' / ' + proposal.capabilityId,
    '',
    '- Proposal: ' + proposal.proposalId,
    '- Gap class: ' + proposal.gapClass,
    '- Recommendation: ' + proposal.recommendation,
    '- Priority heuristic: ' + proposal.priorityScore + '/100',
    '- Promotion: blocked',
    '- Code reuse allowed: no',
    '',
    '## Donor evidence',
    '',
    ...proposal.evidence.donorFiles.map(file => '- ' + file),
    '',
    '## Existing NK1 evidence',
    '',
    ...(proposal.evidence.baselineFiles.length ? proposal.evidence.baselineFiles.map(file => '- ' + file) : ['- No matching source signal detected in the scanned baseline.']),
    '',
    '## Required gates',
    '',
    ...proposal.blockingReasons.map(reason => '- [ ] ' + reason),
    '',
    'No files are copied and no donor code is executed by NeuroForge.',
  ];
  return lines.join('\n') + '\n';
}
