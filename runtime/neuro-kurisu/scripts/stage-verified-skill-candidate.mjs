import { createPublicKey } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';

const MAX_BUNDLE_BYTES = 10 * 1024 * 1024;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

function readPromotionFamilyPolicy(raw, skillId, manifest) {
  const missingPolicy = 'NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON is required as a JSON object keyed by skill ID';
  if (!nonEmpty(raw)) throw new Error(missingPolicy);
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON must be valid JSON'); }
  if (!isRecord(parsed) || Object.keys(parsed).length === 0 || Object.keys(parsed).length > 256) {
    throw new Error('NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON must map 1 to 256 skill IDs to family-gain policies');
  }
  for (const [configuredSkillId, configuredPolicy] of Object.entries(parsed)) {
    if (!configuredSkillId || configuredSkillId !== configuredSkillId.trim() ||
        configuredSkillId.length > 128 || !isRecord(configuredPolicy)) {
      throw new Error('trusted skill promotion family policy contains an invalid skill entry');
    }
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, skillId)) {
    throw new Error(`trusted promotion policy is missing for skill: ${skillId}`);
  }
  const skillPolicy = parsed[skillId];
  const allowedPolicyKeys = new Set(['minimumFamilyGainByFamily', 'minimumFamilyTasksByFamily']);
  if (!isRecord(skillPolicy) || Object.keys(skillPolicy).some(key => !allowedPolicyKeys.has(key)) ||
      !isRecord(skillPolicy.minimumFamilyGainByFamily) || !isRecord(skillPolicy.minimumFamilyTasksByFamily)) {
    throw new Error('trusted skill policy must contain minimumFamilyGainByFamily and minimumFamilyTasksByFamily maps only');
  }
  const gainEntries = Object.entries(skillPolicy.minimumFamilyGainByFamily).sort(([a], [b]) => a.localeCompare(b));
  const taskEntries = Object.entries(skillPolicy.minimumFamilyTasksByFamily).sort(([a], [b]) => a.localeCompare(b));
  if (gainEntries.length === 0 || gainEntries.length !== taskEntries.length ||
      gainEntries.some(([family], index) => family !== taskEntries[index]?.[0])) {
    throw new Error('trusted policy must specify a task-count floor for every required family-gain floor');
  }
  const holdoutFamilies = new Set(manifest
    .filter(task => isRecord(task) && task.split === 'holdout' && nonEmpty(task.family))
    .map(task => task.family));
  const normalizedGains = [];
  const normalizedTasks = [];
  for (const [family, gain] of gainEntries) {
    const hasControlCharacter = Array.from(family).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    });
    if (!family || family !== family.trim() || family.length > 128 || hasControlCharacter) {
      throw new Error('trusted promotion policy contains an invalid task-family name');
    }
    if (!holdoutFamilies.has(family)) {
      throw new Error(`promotion policy family is not represented in holdout manifest: ${family}`);
    }
    if (typeof gain !== 'number' || !Number.isFinite(gain) || gain <= 0 || gain > 1) {
      throw new Error('promotion family gain thresholds must be finite numbers in (0, 1]');
    }
    const minimumTasks = skillPolicy.minimumFamilyTasksByFamily[family];
    if (typeof minimumTasks !== 'number' || !Number.isSafeInteger(minimumTasks) || minimumTasks < 2 || minimumTasks > 10000) {
      throw new Error(`promotion family task-count thresholds must be integers in [2, 10000]: ${family}`);
    }
    normalizedGains.push([family, gain]);
    normalizedTasks.push([family, minimumTasks]);
  }
  return {
    minimumFamilyGainByFamily: Object.fromEntries(normalizedGains),
    minimumFamilyTasksByFamily: Object.fromEntries(normalizedTasks),
  };
}

function readTrustedVerifierKeys(raw) {
  if (!nonEmpty(raw)) throw new Error('NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON is required to stage a verified candidate');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON must be valid JSON'); }
  if (!isRecord(parsed)) throw new Error('trusted verifier keys must be an object keyed by verifier ID');
  const keys = new Map();
  for (const [id, pem] of Object.entries(parsed)) {
    if (!nonEmpty(id) || typeof pem !== 'string') throw new Error('trusted verifier key entry is malformed');
    let key;
    try { key = createPublicKey(pem); }
    catch { throw new Error(`trusted verifier key ${id} is not valid PEM`); }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error(`trusted verifier key ${id} must be Ed25519`);
    keys.set(id, pem);
  }
  if (keys.size === 0) throw new Error('at least one trusted verifier key is required');
  return keys;
}

function validateBundle(bundle) {
  if (!isRecord(bundle) || bundle.schemaVersion !== 1) {
    throw new Error('candidate bundle must be a schemaVersion 1 JSON object');
  }
  const allowed = new Set(['schemaVersion', 'manifest', 'baselineMethod', 'candidateMethod', 'skill', 'artifacts']);
  if (Object.keys(bundle).some(key => !allowed.has(key))) throw new Error('candidate bundle contains unknown top-level fields');
  if (!Array.isArray(bundle.manifest) || bundle.manifest.length < 2 || !Array.isArray(bundle.artifacts) || bundle.artifacts.length < 1) {
    throw new Error('candidate bundle requires a manifest and signed outcome artifacts');
  }
  if (!nonEmpty(bundle.baselineMethod) || !nonEmpty(bundle.candidateMethod) || bundle.baselineMethod === bundle.candidateMethod) {
    throw new Error('baselineMethod and candidateMethod must be distinct non-empty strings');
  }
  const skill = bundle.skill;
  const ratio01 = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const safeCount = value => Number.isSafeInteger(value) && value >= 0;
  if (!isRecord(skill) || !nonEmpty(skill.id) || !nonEmpty(skill.contextKey) ||
      !['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'].includes(skill.action) ||
      skill.status !== 'candidate' ||
      !safeCount(skill.totalUses) || !safeCount(skill.trainUses) || !safeCount(skill.validationUses) ||
      skill.trainUses + skill.validationUses > skill.totalUses ||
      !ratio01(skill.trainSuccess01) || !ratio01(skill.validationSuccess01) || !ratio01(skill.confidence01) ||
      !Number.isFinite(skill.createdAt) || skill.createdAt <= 0 ||
      !Number.isFinite(skill.updatedAt) || skill.updatedAt < skill.createdAt ||
      !safeCount(skill.validationWindowStartTick) || !safeCount(skill.validationWindowEndTick) ||
      skill.validationWindowEndTick < skill.validationWindowStartTick) {
    throw new Error('skill payload does not satisfy canonical P23 policy-skill bounds');
  }
  return skill;
}

/**
 * Stage a candidate only after re-verifying every outcome artifact against the
 * configured trusted Ed25519 keys and the exact supplied manifest. The issued
 * proposal stays in-process: there is no JSON-shaped proposal trust bypass.
 */
export async function stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }) {
  if (!nonEmpty(bundlePath) || !nonEmpty(stateFile)) throw new Error('bundlePath and stateFile are required');
  const absoluteBundlePath = path.resolve(bundlePath);
  const bundleStat = await lstat(absoluteBundlePath);
  if (bundleStat.isSymbolicLink() || !bundleStat.isFile() || bundleStat.size > MAX_BUNDLE_BYTES) {
    throw new Error('candidate bundle must be a regular file no larger than 10 MiB');
  }
  let bundle;
  try { bundle = JSON.parse(await readFile(absoluteBundlePath, 'utf8')); }
  catch (error) { throw new Error(`candidate bundle JSON could not be read: ${String(error?.message || error)}`); }
  const skill = validateBundle(bundle);
  const promotionFamilyPolicy = readPromotionFamilyPolicy(
    process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON,
    skill.id,
    bundle.manifest,
  );
  const trustedKeys = readTrustedVerifierKeys(process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON);
  const ledger = new VerifiedOutcomeLedger(bundle.manifest);
  for (let i = 0; i < bundle.artifacts.length; i++) {
    const result = ingestSignedOutcomeArtifact(ledger, bundle.manifest, bundle.artifacts[i], trustedKeys);
    if (!result.accepted) {
      throw new Error(`signed outcome artifact ${i} was rejected: ${result.rejection || 'unknown-reason'}`);
    }
  }
  const proposal = proposeVerifiedSkillPromotion(ledger, bundle.baselineMethod, bundle.candidateMethod, {
    minPairedTasks: 8,
    minAbsoluteGain: 0.1,
    minCompleteSeeds: 3,
    minimumFamilyGainByFamily: promotionFamilyPolicy.minimumFamilyGainByFamily,
    minimumFamilyTasksByFamily: promotionFamilyPolicy.minimumFamilyTasksByFamily,
  });
  if (!proposal.gate.accepted || proposal.authenticatedEvidenceRows < 1 || proposal.unauthenticatedEvidenceRows !== 0) {
    throw new Error(`verified promotion proposal did not pass the evidence gate: ${proposal.gate.reason || 'rejected'}`);
  }

  // Do not call core.init()/flush here: staging updates only the separately locked
  // candidate-store file and must not rehydrate or race the live organism state file.
  const core = new OrganismCore(new FileStateStore(path.resolve(stateFile)));
  // stageVerifiedSkillCandidate rechecks the exact module-issued proposal object.
  const candidate = core.stageVerifiedSkillCandidate(proposal, skill);
  const lifecycle = core.verifiedSkillCandidateSnapshot();
  if (!lifecycle || !lifecycle.candidates.some(item => item.candidateId === candidate.candidateId && item.status === 'staged')) {
    throw new Error('candidate stage was not durably visible in the canonical lifecycle store');
  }
  return {
    schemaVersion: 1,
    status: candidate.status,
    candidateId: candidate.candidateId,
    skillId: candidate.skillId,
    candidateVersion: candidate.version,
    proposalId: candidate.proposalId,
    proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint,
    manifestFingerprint: proposal.manifestFingerprint,
    authenticatedEvidenceRows: proposal.authenticatedEvidenceRows,
    pairedTaskSeedN: proposal.pairedTaskSeedN,
    completePairedSeeds: proposal.completePairedSeeds,
    evaluationPolicy: proposal.evaluationPolicy,
    familyTaskCoverage: proposal.familyTaskCoverage,
    familyEvaluation: proposal.familyEvaluation.map(item => ({
      family: item.family,
      pairedN: item.pairedN,
      absoluteGain: item.absoluteGain,
    })),
    canActivateAutomatically: false,
    note: 'candidate staged only; shadow observation and authenticated human/authority approval are separate steps',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const [, , bundlePath, stateFile] = process.argv;
  if (!bundlePath || !stateFile) {
    console.error('Usage: NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON=\'<Ed25519 public keys JSON>\' NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON=\'{"<skill-id>":{"minimumFamilyGainByFamily":{"memory":0.05},"minimumFamilyTasksByFamily":{"memory":2}}}\' node --experimental-strip-types scripts/stage-verified-skill-candidate.mjs <signed-bundle.json> <organism-state-file.json>');
    process.exitCode = 2;
  } else {
    try {
      const result = await stageVerifiedSkillCandidateBundle({ bundlePath, stateFile });
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`verified candidate staging failed: ${String(error?.message || error)}`);
      process.exitCode = 1;
    }
  }
}
