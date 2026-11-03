import type { P36VerifiedOutcomeLedgerEvaluatorConfig } from './P36VerifiedOutcomeLedgerEvaluator.ts';

export interface P36PatchOutcomeEvidenceAuthorityConfig
  extends Omit<P36VerifiedOutcomeLedgerEvaluatorConfig, 'treatmentMethod'> {
  baseSha: string;
}

export interface P36PatchOutcomeEvidenceRequest {
  candidateId: string;
  baseSha: string;
  patchSha256: string;
}

export interface P36PatchOutcomeEvidence {
  candidateId: string;
  baseSha: string;
  patchSha256: string;
  treatmentMethod: string;
  manifestFingerprint: string;
  taskFamily: string;
  baselineMethod: string;
  pairedSeedCount: number;
  baselinePassRate: number;
  candidatePassRate: number;
  absoluteGain: number;
  evidenceFingerprint: string;
  evidenceRefs: string[];
  delayMs: 0;
  evidenceScope: 'point-in-time-holdout-only';
}

/** Deterministic treatment identity; verifier artifacts must sign this exact method label. */
export function patchTreatmentMethod(patchSha256: string): string {
  return 'nk1-patch-sha256:' + patchSha256;
}

/** Fail-closed placeholder; the RED regression must fail on missing authenticated measurement. */
export function measureP36PatchOutcomeEvidence(
  _request: P36PatchOutcomeEvidenceRequest,
  _hostConfig: P36PatchOutcomeEvidenceAuthorityConfig,
): P36PatchOutcomeEvidence | null {
  return null;
}
