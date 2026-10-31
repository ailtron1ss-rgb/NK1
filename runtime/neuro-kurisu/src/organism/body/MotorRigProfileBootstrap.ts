import {
  compileMotorJointDefinitions,
  validateMotorRigProfile,
  type MotorRigProfileV1,
} from '../system/MotorRigProfile.ts';
import type { JointDefinition } from '../system/EmbodiedMotorController.ts';

export const MAX_MOTOR_RIG_PROFILE_CONFIG_BYTES = 512 * 1024;
export const MAX_MOTOR_RIG_PROFILES = 16;
export type MotorRigProfileConfigResult =
  | { accepted: true; profiles: MotorRigProfileV1[] }
  | { accepted: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sameCanonicalSkeleton(a: readonly JointDefinition[], b: readonly JointDefinition[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((joint) => [joint.id, joint]));
  return b.every((joint) => {
    const current = byId.get(joint.id);
    return Boolean(current && current.parentId === joint.parentId
      && current.minAngleRad === joint.minAngleRad && current.maxAngleRad === joint.maxAngleRad
      && current.restAngleRad === joint.restAngleRad && current.maxSpeedRadPerSec === joint.maxSpeedRadPerSec
      && current.maxAccelerationRadPerSec2 === joint.maxAccelerationRadPerSec2
      && current.maxJerkRadPerSec3 === joint.maxJerkRadPerSec3);
  });
}

/** Validate a host-owned profile set before atomic registration; never synthesize calibration. */
export function parseMotorRigProfileConfigJson(json: string): MotorRigProfileConfigResult {
  const reject = (reason: string): MotorRigProfileConfigResult => ({ accepted: false, reason });
  if (typeof json !== 'string' || json.length < 2
    || Buffer.byteLength(json, 'utf8') > MAX_MOTOR_RIG_PROFILE_CONFIG_BYTES) return reject('motor-rig-profile-config-size-invalid');
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return reject('motor-rig-profile-config-json-invalid'); }
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.profiles)
    || raw.profiles.length < 1 || raw.profiles.length > MAX_MOTOR_RIG_PROFILES) return reject('motor-rig-profile-config-schema-invalid');
  const profiles: MotorRigProfileV1[] = [];
  const profileIds = new Set<string>(), rendererModels = new Set<string>();
  let canonical: JointDefinition[] | null = null;
  for (const candidate of raw.profiles) {
    const validation = validateMotorRigProfile(candidate);
    if (!validation.ok) return reject('motor-rig-profile-invalid:' + validation.reason);
    const profile = candidate as MotorRigProfileV1;
    if (profile.calibration.status !== 'calibrated') return reject('motor-rig-profile-not-production-calibrated');
    if (profileIds.has(profile.profileId)) return reject('motor-rig-profile-id-duplicate');
    const modelKey = profile.renderer + ':' + profile.modelId;
    if (rendererModels.has(modelKey)) return reject('motor-rig-renderer-model-duplicate');
    profileIds.add(profile.profileId); rendererModels.add(modelKey);
    let definitions: JointDefinition[];
    try { definitions = compileMotorJointDefinitions(profile); }
    catch { return reject('motor-rig-profile-compile-failed'); }
    if (canonical && !sameCanonicalSkeleton(canonical, definitions)) return reject('motor-rig-profile-canonical-skeleton-mismatch');
    canonical ??= definitions;
    profiles.push(structuredClone(profile));
  }
  return { accepted: true, profiles };
}
