import { sha256Stable } from '../core/StableSerialization.ts';
import {
  measureP36VerifiedOutcomeLedger,
  type P36VerifiedOutcomeLedgerEvaluatorConfig,
  type P36VerifiedOutcomeLedgerMeasurement,
} from './P36VerifiedOutcomeLedgerEvaluator.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from './VerifiedOutcomeLedger.ts';

export interface P36PatchOutcomeEvidenceAuthorityConfig
  extends Omit<P36VerifiedOutcomeLedgerEvaluatorConfig, 'treatmentMethod'> {
  /** Exact source revision accepted by the host-owned patch signer. */
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
  sourceEvidenceFingerprint: string;
  evidenceRefs: string[];
  delayMs: 0;
  evidenceScope: 'point-in-time-holdout-only';
}

/** Process-local host authority injected into the candidate pool constructor. */
export interface HostOwnedP36PatchOutcomeAuthority {
  measure(request: P36PatchOutcomeEvidenceRequest): P36PatchOutcomeEvidence | null;
}

const SHA1 = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch { return false; }
}
function ownData(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
      descriptor.get === undefined && descriptor.set === undefined
      ? descriptor.value : undefined;
  } catch { return undefined; }
}
function validIdentity(value: unknown, maxLength = 180): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength &&
    value === value.normalize('NFKC').trim() &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

/**
 * The treatment method is a deterministic, host-defined name for the exact patch
 * bytes. Signed verifier artifacts must have been produced by executing this patch
 * under this method identity; a candidate cannot choose a different method label.
 */
export function patchTreatmentMethod(baseSha: string, patchSha256: string): string {
  if (typeof baseSha !== 'string' || !SHA1.test(baseSha)) {
    throw new TypeError('p36-patch-outcome-base-sha-invalid');
  }
  if (typeof patchSha256 !== 'string' || !SHA256.test(patchSha256)) {
    throw new TypeError('p36-patch-outcome-patch-sha256-invalid');
  }
  return 'nk1-source-sha1:' + baseSha.toLowerCase() + ':patch-sha256:' + patchSha256.toLowerCase();
}

/**
 * Measure one patch against the host-pinned baseline using only P36's authenticated
 * signed holdout ledger. No observation, score, treatment method, manifest, key or
 * verifier identity is accepted from candidate input.
 *
 * The host must provision signed P36 outcome artifacts whose treatment method is
 * patchTreatmentMethod(exactPatchSha256). P36 rechecks the artifact receipts,
 * fixed manifest, holdout split, task family and paired seed coverage.
 */
export function measureP36PatchOutcomeEvidence(
  request: P36PatchOutcomeEvidenceRequest,
  hostConfig: P36PatchOutcomeEvidenceAuthorityConfig,
): P36PatchOutcomeEvidence | null {
  if (!isPlainRecord(request)) return null;
  const candidateId = ownData(request, 'candidateId');
  const requestedBaseSha = ownData(request, 'baseSha');
  const patchSha256 = ownData(request, 'patchSha256');
  if (!validIdentity(candidateId, 128) ||
      typeof requestedBaseSha !== 'string' || !SHA1.test(requestedBaseSha) ||
      typeof patchSha256 !== 'string' || !SHA256.test(patchSha256)) return null;

  if (!isPlainRecord(hostConfig)) throw new TypeError('p36-patch-outcome-host-config-invalid');
  const baseSha = ownData(hostConfig, 'baseSha');
  const ledger = ownData(hostConfig, 'ledger');
  const manifest = ownData(hostConfig, 'manifest');
  const evaluatorVersion = ownData(hostConfig, 'evaluatorVersion');
  const baselineMethod = ownData(hostConfig, 'baselineMethod');
  const taskFamily = ownData(hostConfig, 'taskFamily');
  const sourceId = ownData(hostConfig, 'sourceId');
  const independenceKey = ownData(hostConfig, 'independenceKey');
  const minimumPairedSeeds = ownData(hostConfig, 'minimumPairedSeeds');

  if (typeof baseSha !== 'string' || !SHA1.test(baseSha) ||
      requestedBaseSha.toLowerCase() !== baseSha.toLowerCase()) return null;
  if (!(ledger instanceof VerifiedOutcomeLedger) || !Array.isArray(manifest) ||
      !validIdentity(evaluatorVersion, 64) || !validIdentity(baselineMethod, 180) ||
      !validIdentity(taskFamily, 96) || !validIdentity(sourceId, 80) ||
      !validIdentity(independenceKey, 120)) {
    throw new TypeError('p36-patch-outcome-host-config-invalid');
  }
  if (minimumPairedSeeds !== undefined &&
      (!Number.isSafeInteger(minimumPairedSeeds) || (minimumPairedSeeds as number) < 4 || (minimumPairedSeeds as number) > 128)) {
    throw new RangeError('p36-verified-outcome-ledger-minimum-paired-seeds-invalid');
  }

  const normalizedPatchSha = patchSha256.toLowerCase();
  const treatmentMethod = patchTreatmentMethod(baseSha.toLowerCase(), normalizedPatchSha);
  const typedManifest = manifest as TaskManifestEntry[];
  const manifestFingerprint = ledger.manifestFingerprint();
  const config: P36VerifiedOutcomeLedgerEvaluatorConfig = {
    ledger,
    manifest: typedManifest,
    evaluatorVersion,
    baselineMethod,
    treatmentMethod,
    taskFamily,
    sourceId,
    independenceKey,
    ...(minimumPairedSeeds === undefined ? {} : { minimumPairedSeeds: minimumPairedSeeds as number }),
  };

  const measurement: P36VerifiedOutcomeLedgerMeasurement | null = measureP36VerifiedOutcomeLedger({
    hypothesisId: 'nk1-patch-' + normalizedPatchSha.slice(0, 48),
    contextKey: taskFamily,
    holdout: true,
    delayMs: 0,
    evaluatorVersion,
    evidenceSource: 'external-evaluator',
    protocolId: manifestFingerprint,
    baselineMethod,
    treatmentMethod,
    taskFamily,
    manifestFingerprint,
  }, config);
  if (!measurement) return null;

  const absoluteGain = measurement.treatment01 - measurement.control01;
  const evidenceFingerprint = sha256Stable({
    schemaVersion: 1,
    candidateId,
    baseSha: baseSha.toLowerCase(),
    patchSha256: normalizedPatchSha,
    sourceEvidenceFingerprint: measurement.evidenceFingerprint,
    evidenceRefs: measurement.evidenceRefs,
    pairedSeedCount: measurement.pairedSeedCount,
  });
  return Object.freeze({
    candidateId,
    baseSha: baseSha.toLowerCase(),
    patchSha256: normalizedPatchSha,
    treatmentMethod,
    manifestFingerprint: measurement.manifestFingerprint,
    taskFamily: measurement.taskFamily,
    baselineMethod: measurement.baselineMethod,
    pairedSeedCount: measurement.pairedSeedCount,
    baselinePassRate: measurement.control01,
    candidatePassRate: measurement.treatment01,
    absoluteGain,
    evidenceFingerprint,
    sourceEvidenceFingerprint: measurement.evidenceFingerprint,
    evidenceRefs: Object.freeze([...measurement.evidenceRefs]) as unknown as string[],
    delayMs: 0,
    evidenceScope: 'point-in-time-holdout-only',
  });
}

/**
 * Capture the host-owned P36 configuration once and expose only a narrow measure()
 * capability to the admission pool. The manifest is cloned/frozen, the task-family,
 * baseline, verifier provenance and source SHA are fixed, and the ledger reference
 * remains inside this closure. Candidate payloads can never supply or mutate them.
 */
export function createP36PatchOutcomeEvidenceAuthority(
  input: unknown,
): Readonly<HostOwnedP36PatchOutcomeAuthority> {
  const refuse = (): never => { throw new TypeError('p36-patch-outcome-host-config-invalid'); };
  if (!isPlainRecord(input)) return refuse();
  const baseSha = ownData(input, 'baseSha');
  const ledger = ownData(input, 'ledger');
  const rawManifest = ownData(input, 'manifest');
  const evaluatorVersion = ownData(input, 'evaluatorVersion');
  const baselineMethod = ownData(input, 'baselineMethod');
  const taskFamily = ownData(input, 'taskFamily');
  const sourceId = ownData(input, 'sourceId');
  const independenceKey = ownData(input, 'independenceKey');
  const minimumPairedSeeds = ownData(input, 'minimumPairedSeeds');
  if (typeof baseSha !== 'string' || !SHA1.test(baseSha) ||
      !(ledger instanceof VerifiedOutcomeLedger) || !Array.isArray(rawManifest) ||
      !validIdentity(evaluatorVersion, 64) || !validIdentity(baselineMethod, 180) ||
      !validIdentity(taskFamily, 96) || !validIdentity(sourceId, 80) ||
      !validIdentity(independenceKey, 120) ||
      (minimumPairedSeeds !== undefined &&
        (!Number.isSafeInteger(minimumPairedSeeds) || (minimumPairedSeeds as number) < 4 || (minimumPairedSeeds as number) > 128))) {
    return refuse();
  }

  let manifest: TaskManifestEntry[];
  try {
    manifest = structuredClone(rawManifest) as TaskManifestEntry[];
  } catch {
    return refuse();
  }
  let manifestFingerprint: string;
  try {
    manifestFingerprint = new VerifiedOutcomeLedger(manifest).manifestFingerprint();
    if (ledger.manifestFingerprint() !== manifestFingerprint) return refuse();
  } catch {
    return refuse();
  }
  const frozenManifest = Object.freeze(manifest.map(task => Object.freeze({ ...task }))) as unknown as readonly TaskManifestEntry[];
  const snapshot: P36PatchOutcomeEvidenceAuthorityConfig = Object.freeze({
    baseSha: baseSha.toLowerCase(),
    ledger,
    manifest: frozenManifest,
    evaluatorVersion,
    baselineMethod,
    taskFamily,
    sourceId,
    independenceKey,
    ...(minimumPairedSeeds === undefined ? {} : { minimumPairedSeeds: minimumPairedSeeds as number }),
  });

  return Object.freeze({
    measure(request: P36PatchOutcomeEvidenceRequest): P36PatchOutcomeEvidence | null {
      return measureP36PatchOutcomeEvidence(request, snapshot);
    },
  });
}

