import * as THREE from "three";
import {
  buildHumanoidRetargetProfile,
  retargetLocalRotations,
  retargetRootTranslation,
  type HumanoidRole,
  type HumanoidRetargetProfile,
  type HumanoidRigProfileInput,
} from "./humanoidRetarget";
import type { HumanoidBoneNode } from "./threeHumanoidRigSnapshot";

export interface ThreeHumanoidRetargetOptions {
  sampleRate?: number;
  maxSamples?: number;
  maxRotationRadians?: number;
  maxRootTranslation?: number;
}

export interface ThreeHumanoidRetargetResult {
  clip: THREE.AnimationClip;
  profile: HumanoidRetargetProfile;
  sampledFrames: number;
  transferredRoles: readonly HumanoidRole[];
  skippedUncalibratedRoles: readonly HumanoidRole[];
  missingTargetRoles: readonly HumanoidRole[];
}

/**
 * Bake a source GLTF clip into target-local quaternion tracks.
 * Source and target snapshots must have been captured in the same frameRoot,
 * before either rig has been animated. Do not pass Pixiv-compiled VRMA clips:
 * those are already compiled against their target VRM skeleton.
 */
export function retargetThreeHumanoidClip(
  sourceRoot: THREE.Object3D,
  sourceBones: readonly HumanoidBoneNode[],
  sourceRest: HumanoidRigProfileInput,
  targetRoot: THREE.Object3D,
  targetBones: readonly HumanoidBoneNode[],
  targetRest: HumanoidRigProfileInput,
  sourceClip: THREE.AnimationClip,
  options: ThreeHumanoidRetargetOptions = {},
): ThreeHumanoidRetargetResult {
  if (!sourceRoot || !targetRoot || !sourceClip || !Number.isFinite(sourceClip.duration) || sourceClip.duration <= 0) {
    throw new Error("Retarget requires source/target rigs and a non-empty animation clip.");
  }
  const sampleRate = Math.max(1, Math.min(60, Math.floor(options.sampleRate ?? 30)));
  const maxSamples = Math.max(2, Math.min(3600, Math.floor(options.maxSamples ?? 1800)));
  const duration = sourceClip.duration;
  const sampledFrames = Math.min(maxSamples, Math.max(2, Math.ceil(duration * sampleRate) + 1));
  const step = duration / (sampledFrames - 1);
  const sourceByRole = new Map(sourceBones.map((bone, index) => [bone.name, { ...bone, index }]));
  const targetByRole = new Map(targetBones.map((bone, index) => [bone.name, { ...bone, index }]));
  const profile = buildHumanoidRetargetProfile(sourceRest, targetRest);
  const calibratedRoles = profile.sharedRoles.filter((role) =>
    profile.sourceToTargetAxisBasis.has(role) && sourceByRole.has(role) && targetByRole.has(role),
  );
  if (!calibratedRoles.length) {
    throw new Error("No shared humanoid roles have valid source and target axis calibration.");
  }
  const strictProfile = {
    ...profile,
    sharedRoles: calibratedRoles,
  };
  const sourceMixer = new THREE.AnimationMixer(sourceRoot);
  const action = sourceMixer.clipAction(sourceClip);
  action.reset().play();
  const sourceInitial = new Map(sourceBones.map(({ node, name }) => [name, {
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  }]));
  const targetInitial = new Map(targetBones.map(({ node, name }) => [name, {
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
  }]));
  const sourceRootInitial = { position: sourceRoot.position.clone(), quaternion: sourceRoot.quaternion.clone(), scale: sourceRoot.scale.clone() };\n  const sourceHips = sourceByRole.get("hips")?.node;
  const targetHips = targetByRole.get("hips")?.node;
  const sourceHipsPosition = sourceHips?.position.clone();
  const targetHipsPosition = targetHips?.position.clone();
  const times = new Float32Array(sampledFrames);
  const quaternionValues = new Map<HumanoidRole, number[]>(
    calibratedRoles.map((role) => [role, []]),
  );
  const hipsPositions: number[] = [];
  const transferredRoles = new Set<HumanoidRole>();

  try {
    for (let frame = 0; frame < sampledFrames; frame += 1) {
      const time = frame === sampledFrames - 1 ? duration : frame * step;
      times[frame] = time;
      sourceMixer.setTime(time);
      sourceRoot.updateMatrixWorld(true);
      const pose = new Map<HumanoidRole, readonly [number, number, number, number]>();
      for (const role of calibratedRoles) {
        const node = sourceByRole.get(role)?.node;
        if (!node) continue;
        const q = node.quaternion;
        pose.set(role, [q.x, q.y, q.z, q.w]);
      }
      const retargeted = retargetLocalRotations(strictProfile, pose, {
        requireAxisCalibration: true,
        maxRotationRadians: options.maxRotationRadians ?? Math.PI,
      });
      for (const [role, quaternion] of retargeted) {
        const values = quaternionValues.get(role);
        if (!values) continue;
        values.push(...quaternion);
        transferredRoles.add(role);
      }
      if (sourceHips && targetHips && sourceHipsPosition && targetHipsPosition) {
        const delta = sourceHips.position.clone().sub(sourceHipsPosition);
        const scaled = retargetRootTranslation(
          [delta.x, delta.y, delta.z],
          profile,
          options.maxRootTranslation ?? 1,
        );
        hipsPositions.push(
          targetHipsPosition.x + scaled[0],
          targetHipsPosition.y + scaled[1],
          targetHipsPosition.z + scaled[2],
        );
      }
    }
  } finally {
    action.stop();
    sourceMixer.stopAllAction();
    for (const [role, initial] of sourceInitial) {
      const node = sourceByRole.get(role)?.node;
      if (!node) continue;
      node.position.copy(initial.position);
      node.quaternion.copy(initial.quaternion);
      node.scale.copy(initial.scale);
    }
    sourceRoot.updateMatrixWorld(true);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const role of calibratedRoles) {
    const node = targetByRole.get(role)?.node;
    const values = quaternionValues.get(role);
    if (!node || !values || values.length !== sampledFrames * 4) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${node.uuid}.quaternion`,
      times,
      new Float32Array(values),
    ));
  }
  if (targetHips && hipsPositions.length === sampledFrames * 3) {
    tracks.push(new THREE.VectorKeyframeTrack(
      `${targetHips.uuid}.position`,
      times,
      new Float32Array(hipsPositions),
    ));
  }
  if (!tracks.length) throw new Error("The source clip produced no transferable humanoid tracks.");
  const clip = new THREE.AnimationClip(
    `NK1_Retarget_${sourceClip.name || "motion"}`.slice(0, 120),
    duration,
    tracks,
  );
  // Target rest transforms are never modified during baking.
  for (const [role, initial] of targetInitial) {
    const node = targetByRole.get(role)?.node;
    if (!node) continue;
    node.position.copy(initial.position);
    node.quaternion.copy(initial.quaternion);
  }
  return {
    clip,
    profile,
    sampledFrames,
    transferredRoles: [...transferredRoles].sort(),
    skippedUncalibratedRoles: profile.uncalibratedAxisRoles,
    missingTargetRoles: profile.missingTargetRoles,
  };
}
