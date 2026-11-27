import * as THREE from "three";
import { AVATAR_ARTICULATED_BODY_PARTICLE_COUNT, AVATAR_ARTICULATED_BODY_SEGMENT_COUNT } from "./articulatedBodyParticles";
import type { ArticulatedBodyParticle, ArticulatedBodyParticleId } from "./articulatedBodyParticles";

export type JointAxis = "x" | "y" | "z";
export type ArticulatedParticleFrame = Partial<Record<ArticulatedBodyParticleId, Pick<ArticulatedBodyParticle, "position" | "target">>>;
export type JointLimit = Readonly<Record<JointAxis, readonly [number, number]>>;
export type PlanarIkResult = {
  shoulder: number;
  elbowFlex: number;
  elbow: { x: number; y: number };
  endEffector: { x: number; y: number };
  reachable: boolean;
};

export type HumanoidPoseInput = {
  awake: boolean;
  action: string;
  emotion: string;
  arousal: number;
  energy: number;
  cognitiveLoad: number;
  gazeX: number;
  gazeY: number;
  headTilt: number;
  speaking: boolean;
  leftArmIntent: number;
  rightArmIntent: number;
  bodyChannels?: Record<string, number>;
  deltaSeconds?: number;
  timeSeconds?: number;
  particles?: ArticulatedParticleFrame;
};

export type ProceduralHumanoidRig = {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  bones: Record<string, THREE.Bone>;
  head: THREE.Bone;
  leftArm: THREE.Bone;
  rightArm: THREE.Bone;
  mouth: THREE.Mesh;
  eyeWhites: THREE.Mesh[];
  irises: THREE.Mesh[];
  brows: THREE.Mesh[];
  ringMat: THREE.MeshStandardMaterial;
  limits: Record<string, JointLimit>;
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  updatePose(input: HumanoidPoseInput): void;
  solveArmTarget(side: "left" | "right", target: THREE.Vector3, deltaSeconds?: number): PlanarIkResult;
  solveLegTarget(side: "left" | "right", target: THREE.Vector3, deltaSeconds?: number): PlanarIkResult;
  setJoint(name: string, axis: JointAxis, radians: number): number;
  resetPose(): void;
  dispose(): void;
};

const PI = Math.PI;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
const finite = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function clampJointAngle(
  name: string,
  axis: JointAxis,
  radians: number,
  limits: Record<string, JointLimit> = HUMANOID_JOINT_LIMITS,
): number {
  const range = limits[name]?.[axis];
  return range ? clamp(radians, range[0], range[1]) : clamp(radians, -PI, PI);
}

/** Two-link planar IK using the law of cosines. Lengths are metres in rig space. */
export function solveTwoBonePlanarIK(
  start: { x: number; y: number },
  target: { x: number; y: number },
  upperLength: number,
  lowerLength: number,
  bendSign: 1 | -1 = 1,
): PlanarIkResult {
  const l1 = Math.max(1e-5, Math.abs(upperLength));
  const l2 = Math.max(1e-5, Math.abs(lowerLength));
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const rawDistance = Math.hypot(dx, dy);
  const minReach = Math.abs(l1 - l2) + 1e-5;
  const maxReach = l1 + l2 - 1e-5;
  const distance = clamp(rawDistance, minReach, maxReach);
  const angleToTarget = Math.atan2(dy, dx);
  const shoulderCos = clamp((l1 * l1 + distance * distance - l2 * l2) / (2 * l1 * distance), -1, 1);
  const elbowCos = clamp((l1 * l1 + l2 * l2 - distance * distance) / (2 * l1 * l2), -1, 1);
  const shoulderOffset = Math.acos(shoulderCos);
  const interiorElbow = Math.acos(elbowCos);
  const shoulder = angleToTarget - bendSign * shoulderOffset;
  const elbowFlex = PI - interiorElbow;
  const elbow = {
    x: start.x + Math.cos(shoulder) * l1,
    y: start.y + Math.sin(shoulder) * l1,
  };
  const endEffector = {
    x: elbow.x + Math.cos(shoulder + bendSign * elbowFlex) * l2,
    y: elbow.y + Math.sin(shoulder + bendSign * elbowFlex) * l2,
  };
  return {
    shoulder,
    elbowFlex,
    elbow,
    endEffector,
    reachable: rawDistance >= minReach && rawDistance <= maxReach,
  };
}

export const HUMANOID_JOINT_LIMITS: Record<string, JointLimit> = {
  pelvis: { x: [-0.25, 0.25], y: [-0.45, 0.45], z: [-0.3, 0.3] },
  spineLower: { x: [-0.35, 0.35], y: [-0.3, 0.3], z: [-0.28, 0.28] },
  spineMid: { x: [-0.3, 0.3], y: [-0.25, 0.25], z: [-0.22, 0.22] },
  chest: { x: [-0.35, 0.35], y: [-0.35, 0.35], z: [-0.25, 0.25] },
  neck: { x: [-0.48, 0.48], y: [-0.72, 0.72], z: [-0.42, 0.42] },
  head: { x: [-0.52, 0.52], y: [-0.82, 0.82], z: [-0.48, 0.48] },
  leftClavicle: { x: [-0.45, 0.45], y: [-0.35, 0.35], z: [-0.5, 0.5] },
  rightClavicle: { x: [-0.45, 0.45], y: [-0.35, 0.35], z: [-0.5, 0.5] },
  leftUpperArm: { x: [-1.2, 1.2], y: [-1.55, 1.55], z: [-2.25, 2.25] },
  rightUpperArm: { x: [-1.2, 1.2], y: [-1.55, 1.55], z: [-2.25, 2.25] },
  leftForearm: { x: [-0.45, 0.45], y: [-0.45, 0.45], z: [-2.48, 0.12] },
  rightForearm: { x: [-0.45, 0.45], y: [-0.45, 0.45], z: [-0.12, 2.48] },
  leftWrist: { x: [-0.65, 0.65], y: [-0.55, 0.55], z: [-0.75, 0.75] },
  rightWrist: { x: [-0.65, 0.65], y: [-0.55, 0.55], z: [-0.75, 0.75] },
  leftHip: { x: [-0.65, 0.65], y: [-0.45, 0.45], z: [-0.75, 0.75] },
  rightHip: { x: [-0.65, 0.65], y: [-0.45, 0.45], z: [-0.75, 0.75] },
  leftKnee: { x: [-0.12, 0.12], y: [-0.12, 0.12], z: [-2.35, 0.08] },
  rightKnee: { x: [-0.12, 0.12], y: [-0.12, 0.12], z: [-0.08, 2.35] },
  leftAnkle: { x: [-0.55, 0.55], y: [-0.35, 0.35], z: [-0.55, 0.55] },
  rightAnkle: { x: [-0.55, 0.55], y: [-0.35, 0.35], z: [-0.55, 0.55] },
};

function makeMaterial(color: number, roughness = 0.78, metalness = 0.02): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeEllipsoid(
  parent: THREE.Object3D,
  geometry: THREE.SphereGeometry,
  material: THREE.Material,
  name: string,
  position: THREE.Vector3,
  scale: THREE.Vector3,
  rotation = new THREE.Euler(),
  meshes: THREE.Mesh[],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.rotation.copy(rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  meshes.push(mesh);
  return mesh;
}

function makeSegment(
  parent: THREE.Bone,
  geometry: THREE.SphereGeometry,
  material: THREE.Material,
  name: string,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: THREE.Vector3,
  meshes: THREE.Mesh[],
): THREE.Mesh {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.scale.set(radius.x, Math.max(radius.y, length * 0.56), radius.z);
  if (length > 1e-5) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  meshes.push(mesh);
  return mesh;
}

function addBone(
  parent: THREE.Bone,
  name: string,
  position: [number, number, number],
  bones: Record<string, THREE.Bone>,
  limits: Record<string, JointLimit>,
): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(position[0], position[1], position[2]);
  parent.add(bone);
  bones[name] = bone;
  if (!(name in limits)) limits[name] = { x: [-PI, PI], y: [-PI, PI], z: [-PI, PI] };
  return bone;
}

function smooth(current: number, target: number, deltaSeconds: number, speed = 12): number {
  return THREE.MathUtils.damp(current, target, speed, clamp(deltaSeconds, 0, 0.1));
}

export function createProceduralHumanoidRig(scene: THREE.Scene): ProceduralHumanoidRig {
  const root = new THREE.Group();
  root.name = "NeuroCore_ArticulatedHumanoid";
  root.userData.kind = "procedural-humanoid-rig";
  root.userData.rigVersion = 1;
  scene.add(root);

  const bones: Record<string, THREE.Bone> = {};
  const limits: Record<string, JointLimit> = { ...HUMANOID_JOINT_LIMITS };
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.Material[] = [];
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const sphereFine = new THREE.SphereGeometry(1, 28, 18);
  const material = (color: number, rough = 0.78, metal = 0.02) => {
    const value = makeMaterial(color, rough, metal);
    materials.push(value);
    return value;
  };

  const skin = material(0xf0cbbd);
  const skinShadow = material(0xd89f98);
  const muscle = material(0xe9b9aa);
  const muscleShadow = material(0xc98683);
  const coat = material(0xe5e9ef, 0.9);
  const coatShade = material(0xb4c0cf);
  const shirt = material(0x35465e);
  const tie = material(0xa72b48, 0.62);
  const skirt = material(0x303849);
  const tights = material(0x33313c);
  const shoes = material(0x171d2a, 0.45);
  const hair = material(0x7c3439, 0.66);
  const hairLight = material(0xa64c54, 0.62);
  const white = material(0xfff7ed, 0.35);
  const iris = material(0x7261ad, 0.34);
  const pupil = material(0x25213c, 0.25);
  const gold = material(0xd8ad61, 0.38, 0.35);
  const accent = material(0x67cbdc, 0.32, 0.3);

  const rootBone = new THREE.Bone();
  rootBone.name = "root";
  bones.root = rootBone;
  root.add(rootBone);

  // Axial skeleton: pelvis → spine → chest → neck → skull.
  const pelvis = addBone(rootBone, "pelvis", [0, 1.0, 0], bones, limits);
  const spineLower = addBone(pelvis, "spineLower", [0, 0.13, 0], bones, limits);
  const spineMid = addBone(spineLower, "spineMid", [0, 0.21, 0], bones, limits);
  const chest = addBone(spineMid, "chest", [0, 0.22, 0], bones, limits);
  const neck = addBone(chest, "neck", [0, 0.23, 0], bones, limits);
  const head = addBone(neck, "head", [0, 0.16, 0], bones, limits);

  // Upper limbs are fully jointed: clavicle, shoulder, elbow, wrist, palm and fingers.
  const armRoots: Record<"left" | "right", { clavicle: THREE.Bone; upper: THREE.Bone; forearm: THREE.Bone; hand: THREE.Bone }> = {} as any;
  const fingerNames = ["thumb", "index", "middle", "ring", "little"] as const;
  for (const side of [-1, 1] as const) {
    const key = side < 0 ? "left" : "right";
    const clavicle = addBone(chest, key + "Clavicle", [side * 0.24, 0.13, 0], bones, limits);
    const upper = addBone(clavicle, key + "UpperArm", [side * 0.13, -0.015, 0], bones, limits);
    const forearm = addBone(upper, key + "Forearm", [side * 0.34, 0, 0], bones, limits);
    const wrist = addBone(forearm, key + "Wrist", [side * 0.29, 0, 0], bones, limits);
    const hand = addBone(wrist, key + "Hand", [side * 0.075, 0, 0], bones, limits);
    armRoots[key] = { clavicle, upper, forearm, hand };

    makeSegment(upper, sphere, coat, key + "SleeveUpper", new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.34, 0, 0), new THREE.Vector3(0.11, 0.22, 0.125), meshes);
    makeEllipsoid(clavicle, sphereFine, coatShade, key + "Deltoid", new THREE.Vector3(side * 0.015, -0.01, 0.012), new THREE.Vector3(0.14, 0.145, 0.14), new THREE.Euler(0, 0, side * -0.18), meshes);
    makeSegment(forearm, sphere, coat, key + "SleeveForearm", new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.29, 0, 0), new THREE.Vector3(0.085, 0.18, 0.092), meshes);
    makeEllipsoid(hand, sphereFine, skin, key + "Palm", new THREE.Vector3(side * 0.045, 0, 0), new THREE.Vector3(0.092, 0.065, 0.035), new THREE.Euler(0, 0, side * 0.1), meshes);

    for (let finger = 0; finger < fingerNames.length; finger++) {
      const name = fingerNames[finger];
      const fan = (finger - 2) * 0.028;
      const isThumb = name === "thumb";
      const start = new THREE.Vector3(side * (isThumb ? 0.015 : 0.075), fan, isThumb ? 0.005 : 0);
      const base = addBone(hand, key + name[0].toUpperCase() + name.slice(1) + "1", [start.x, start.y, start.z], bones, limits);
      const middle = addBone(base, key + name[0].toUpperCase() + name.slice(1) + "2", [side * (isThumb ? 0.035 : 0.042), 0, 0], bones, limits);
      const tip = addBone(middle, key + name[0].toUpperCase() + name.slice(1) + "3", [side * (isThumb ? 0.028 : 0.032), 0, 0], bones, limits);
      makeSegment(base, sphere, skin, key + name + "Proximal", new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * (isThumb ? 0.035 : 0.042), 0, 0), new THREE.Vector3(0.017, 0.035, 0.018), meshes);
      makeSegment(middle, sphere, skin, key + name + "Middle", new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * (isThumb ? 0.028 : 0.032), 0, 0), new THREE.Vector3(0.014, 0.027, 0.015), meshes);
      makeEllipsoid(tip, sphere, skin, key + name + "Distal", new THREE.Vector3(side * 0.012, 0, 0), new THREE.Vector3(0.014, 0.019, 0.014), new THREE.Euler(), meshes);
    }
  }

  // Lower limbs: hip, knee and ankle joints, feet and toe joints.
  const legRoots: Record<"left" | "right", { thigh: THREE.Bone; calf: THREE.Bone; foot: THREE.Bone }> = {} as any;
  for (const side of [-1, 1] as const) {
    const key = side < 0 ? "left" : "right";
    const hip = addBone(pelvis, key + "Hip", [side * 0.155, -0.06, 0], bones, limits);
    const thigh = addBone(hip, key + "Thigh", [0, -0.025, 0], bones, limits);
    const knee = addBone(thigh, key + "Knee", [0, -0.48, 0], bones, limits);
    const calf = addBone(knee, key + "Calf", [0, -0.43, 0], bones, limits);
    const ankle = addBone(calf, key + "Ankle", [0, -0.075, 0], bones, limits);
    const foot = addBone(ankle, key + "Foot", [0, -0.035, 0.025], bones, limits);
    const toe = addBone(foot, key + "Toe", [0, -0.025, 0.15], bones, limits);
    legRoots[key] = { thigh, calf, foot };

    makeSegment(thigh, sphere, tights, key + "ThighVolume", new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.48, 0), new THREE.Vector3(0.135, 0.28, 0.145), meshes);
    makeEllipsoid(thigh, sphereFine, muscle, key + "Quadriceps", new THREE.Vector3(0, -0.23, 0.105), new THREE.Vector3(0.104, 0.24, 0.065), new THREE.Euler(), meshes);
    makeEllipsoid(thigh, sphereFine, muscleShadow, key + "Hamstrings", new THREE.Vector3(0, -0.25, -0.09), new THREE.Vector3(0.105, 0.22, 0.055), new THREE.Euler(), meshes);
    makeSegment(calf, sphere, tights, key + "CalfVolume", new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.43, 0), new THREE.Vector3(0.09, 0.25, 0.105), meshes);
    makeEllipsoid(calf, sphereFine, muscle, key + "Gastrocnemius", new THREE.Vector3(0, -0.16, -0.045), new THREE.Vector3(0.078, 0.17, 0.07), new THREE.Euler(), meshes);
    makeEllipsoid(foot, sphereFine, shoes, key + "FootVolume", new THREE.Vector3(0, -0.015, 0.105), new THREE.Vector3(0.095, 0.065, 0.17), new THREE.Euler(), meshes);
    makeEllipsoid(toe, sphere, shoes, key + "ToeCap", new THREE.Vector3(0, 0, 0.045), new THREE.Vector3(0.085, 0.045, 0.075), new THREE.Euler(), meshes);
  }

  // Torso, real axial segments, shoulder girdle and layered clothing.
  makeEllipsoid(pelvis, sphereFine, skirt, "PelvisClothing", new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.31, 0.22, 0.205), new THREE.Euler(), meshes);
  makeEllipsoid(spineLower, sphereFine, skin, "LowerAbdomen", new THREE.Vector3(0, 0.13, 0), new THREE.Vector3(0.22, 0.24, 0.145), new THREE.Euler(), meshes);
  makeEllipsoid(spineMid, sphereFine, shirt, "MidTorso", new THREE.Vector3(0, 0.115, -0.008), new THREE.Vector3(0.275, 0.245, 0.16), new THREE.Euler(), meshes);
  makeEllipsoid(chest, sphereFine, coat, "JacketTorso", new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(0.37, 0.36, 0.215), new THREE.Euler(), meshes);
  makeEllipsoid(chest, sphereFine, shirt, "CollarShirt", new THREE.Vector3(0, 0.145, 0.17), new THREE.Vector3(0.19, 0.22, 0.035), new THREE.Euler(), meshes);
  makeEllipsoid(chest, sphereFine, tie, "NecktieKnot", new THREE.Vector3(0, 0.19, 0.205), new THREE.Vector3(0.045, 0.055, 0.022), new THREE.Euler(), meshes);
  makeEllipsoid(chest, sphereFine, tie, "Necktie", new THREE.Vector3(0, 0.015, 0.211), new THREE.Vector3(0.042, 0.16, 0.02), new THREE.Euler(), meshes);
  for (const side of [-1, 1] as const) {
    makeEllipsoid(chest, sphere, coatShade, side < 0 ? "LeftCoatLapel" : "RightCoatLapel",
      new THREE.Vector3(side * 0.105, 0.16, 0.195), new THREE.Vector3(0.085, 0.24, 0.025),
      new THREE.Euler(0, 0, side * -0.22), meshes);
    makeEllipsoid(chest, sphere, coatShade, side < 0 ? "LeftCoatPocket" : "RightCoatPocket",
      new THREE.Vector3(side * 0.25, -0.12, 0.18), new THREE.Vector3(0.075, 0.09, 0.018), new THREE.Euler(), meshes);
  }

  // Neck and face are separate deformable sections, not one static silhouette.
  makeEllipsoid(neck, sphere, skin, "NeckVolume", new THREE.Vector3(0, 0.035, 0), new THREE.Vector3(0.095, 0.18, 0.095), new THREE.Euler(), meshes);
  makeEllipsoid(head, sphereFine, hair, "HairBack", new THREE.Vector3(0, 0.03, -0.08), new THREE.Vector3(0.34, 0.43, 0.29), new THREE.Euler(), meshes);
  makeEllipsoid(head, sphereFine, skin, "Face", new THREE.Vector3(0, 0.02, 0.035), new THREE.Vector3(0.29, 0.38, 0.245), new THREE.Euler(), meshes);
  makeEllipsoid(head, sphereFine, hair, "HairCap", new THREE.Vector3(0, 0.25, 0.005), new THREE.Vector3(0.34, 0.22, 0.27), new THREE.Euler(), meshes);
  makeEllipsoid(head, sphere, hairLight, "BangsLeft", new THREE.Vector3(-0.12, 0.19, 0.238), new THREE.Vector3(0.15, 0.14, 0.075), new THREE.Euler(0, 0, -0.16), meshes);
  makeEllipsoid(head, sphere, hair, "BangsCenter", new THREE.Vector3(0.015, 0.21, 0.248), new THREE.Vector3(0.14, 0.16, 0.065), new THREE.Euler(0, 0, 0.04), meshes);
  makeEllipsoid(head, sphere, hairLight, "BangsRight", new THREE.Vector3(0.15, 0.18, 0.22), new THREE.Vector3(0.13, 0.16, 0.07), new THREE.Euler(0, 0, 0.2), meshes);
  makeEllipsoid(head, sphere, hair, "LongHairLeft", new THREE.Vector3(-0.29, -0.17, -0.04), new THREE.Vector3(0.085, 0.36, 0.105), new THREE.Euler(0, 0, -0.07), meshes);
  makeEllipsoid(head, sphere, hairLight, "LongHairRight", new THREE.Vector3(0.29, -0.17, -0.03), new THREE.Vector3(0.085, 0.36, 0.105), new THREE.Euler(0, 0, 0.07), meshes);

  const eyeWhites: THREE.Mesh[] = [];
  const irises: THREE.Mesh[] = [];
  const brows: THREE.Mesh[] = [];
  const eyelids: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    eyeWhites.push(makeEllipsoid(head, sphere, white, side < 0 ? "EyeWhiteLeft" : "EyeWhiteRight",
      new THREE.Vector3(side * 0.112, 0.02, 0.258), new THREE.Vector3(0.064, 0.082, 0.027), new THREE.Euler(), meshes));
    irises.push(makeEllipsoid(head, sphere, iris, side < 0 ? "IrisLeft" : "IrisRight",
      new THREE.Vector3(side * 0.112, 0.015, 0.283), new THREE.Vector3(0.037, 0.06, 0.021), new THREE.Euler(), meshes));
    makeEllipsoid(head, sphere, pupil, side < 0 ? "PupilLeft" : "PupilRight",
      new THREE.Vector3(side * 0.112, 0.018, 0.301), new THREE.Vector3(0.018, 0.04, 0.012), new THREE.Euler(), meshes);
    makeEllipsoid(head, sphere, gold, side < 0 ? "EyeSparkLeft" : "EyeSparkRight",
      new THREE.Vector3(side * 0.125, 0.045, 0.31), new THREE.Vector3(0.01, 0.014, 0.008), new THREE.Euler(), meshes);
    brows.push(makeEllipsoid(head, sphere, hair, side < 0 ? "BrowLeft" : "BrowRight",
      new THREE.Vector3(side * 0.115, 0.13, 0.26), new THREE.Vector3(0.067, 0.012, 0.014), new THREE.Euler(0, 0, side * -0.08), meshes));
    eyelids.push(makeEllipsoid(head, sphere, skinShadow, side < 0 ? "EyeLidLeft" : "EyeLidRight",
      new THREE.Vector3(side * 0.112, 0.102, 0.258), new THREE.Vector3(0.068, 0.012, 0.025), new THREE.Euler(), meshes));
  }
  const mouth = makeEllipsoid(head, sphere, muscleShadow, "MouthViseme",
    new THREE.Vector3(0, -0.13, 0.266), new THREE.Vector3(0.045, 0.012, 0.012), new THREE.Euler(), meshes);
  makeEllipsoid(head, sphere, skinShadow, "Nose", new THREE.Vector3(0, -0.06, 0.272), new THREE.Vector3(0.018, 0.027, 0.018), new THREE.Euler(), meshes);
  for (const side of [-1, 1] as const) {
    makeEllipsoid(head, sphere, skinShadow, side < 0 ? "EarLeft" : "EarRight",
      new THREE.Vector3(side * 0.285, -0.045, 0.005), new THREE.Vector3(0.045, 0.065, 0.04), new THREE.Euler(), meshes);
  }
  makeEllipsoid(head, sphere, tie, "HairClip", new THREE.Vector3(0.235, 0.24, 0.205),
    new THREE.Vector3(0.085, 0.018, 0.025), new THREE.Euler(0, 0, -0.24), meshes);
  makeEllipsoid(head, sphere, accent, "HairClipAccent", new THREE.Vector3(0.235, 0.24, 0.23),
    new THREE.Vector3(0.045, 0.006, 0.006), new THREE.Euler(0, 0, -0.24), meshes);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0x287c91, roughness: 0.42, metalness: 0.35, transparent: true, opacity: 0.5 });
  materials.push(ringMat);
  const platform = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.009, 8, 64), ringMat);
  platform.name = "BodyGroundRing";
  platform.rotation.x = PI / 2;
  platform.position.y = 0.035;
  root.add(platform);
  meshes.push(platform);

  const skeleton = new THREE.Skeleton(Object.values(bones));
  const restJointPositions = Object.fromEntries(Object.entries(bones).map(([name, bone]) => [name, bone.position.clone()])) as Record<string, THREE.Vector3>;
  rootBone.updateMatrixWorld(true);
  skeleton.calculateInverses();
  root.userData.rigStats = {
    boneCount: skeleton.bones.length,
    jointCount: Object.keys(limits).length,
    meshCount: meshes.length,
    particleCount: AVATAR_ARTICULATED_BODY_PARTICLE_COUNT,
    constraintCount: AVATAR_ARTICULATED_BODY_SEGMENT_COUNT,
  };

  const rig: ProceduralHumanoidRig = {
    root,
    skeleton,
    bones,
    head,
    leftArm: armRoots.left.upper,
    rightArm: armRoots.right.upper,
    mouth,
    eyeWhites,
    irises,
    brows,
    ringMat,
    limits,
    meshes,
    materials,
    updatePose(input) {
      const delta = clamp(finite(input.deltaSeconds, 1 / 60), 0, 0.1);
      const channels = input.bodyChannels ?? {};
      const channel = (name: string, fallback = 0) => clamp(finite(channels[name], fallback), -1, 1);
      const intensity = input.awake ? 1 : 0.28;
      const curiosity = input.emotion === "curiosity" ? 1 : 0;
      const smile = input.emotion === "joy" ? 1 : input.emotion === "calm" ? 0.22 : 0;
      const stress = input.emotion === "anxiety" || input.emotion === "frustration" || input.emotion === "anger" ? 1 : 0;
      const sleep = input.awake ? 0 : 1;

      const targets: Record<string, Partial<Record<JointAxis, number>>> = {
        pelvis: { x: channel("pelvisPitch", 0), z: channel("pelvisRoll", 0) },
        spineLower: { x: channel("spineLowerPitch", -0.015 * stress), z: channel("spineLowerRoll", 0) },
        spineMid: { x: channel("spineMidPitch", -0.02 * stress), z: channel("spineMidRoll", 0) },
        chest: {
          x: channel("torsoPitch", channel("chestPitch", input.action === "explain" ? -0.035 : 0)) * 0.34,
          y: channel("torsoYaw", 0) * 0.34,
          z: channel("chestRoll", 0) * 0.28,
        },
        neck: { x: -clamp(input.gazeY, -1, 1) * 0.08, y: clamp(input.gazeX, -1, 1) * 0.12 },
        head: {
          x: -clamp(input.gazeY, -1, 1) * 0.16 + channel("headPitch", 0) * 0.36 + sleep * 0.12,
          y: clamp(input.gazeX, -1, 1) * 0.25 + channel("headYaw", 0) * 0.42,
          z: clamp(input.headTilt, -0.8, 0.8) + channel("headRoll", 0) * 0.3,
        },
      };

      for (const key of ["left", "right"] as const) {
        const side = key === "left" ? -1 : 1;
        const armIntent = key === "left" ? input.leftArmIntent : input.rightArmIntent;
        const elbowFallback = input.action === "comfort" ? 0.34 : input.action === "respond" || input.action === "explain" ? 0.18 : 0.06;
        const hasShoulderMotor = Number.isFinite(Number(channels[key + "Shoulder"]));
        const hasElbowMotor = Number.isFinite(Number(channels[key + "Elbow"]));
        const shoulder = clamp(hasShoulderMotor ? channel(key + "Shoulder") * 0.72 : finite(armIntent), -1.5, 1.5);
        const elbow = hasElbowMotor ? channel(key + "Elbow") * 0.78 : elbowFallback;
        targets[key + "Clavicle"] = { z: side * (0.06 + shoulder * 0.12) + channel(key + "ClavicleRoll", 0) };
        targets[key + "UpperArm"] = {
          z: side * (shoulder + (input.speaking ? 0.06 : 0)),
          x: channel(key + "ShoulderPitch", 0),
          y: channel(key + "ShoulderYaw", side * -0.08),
        };
        targets[key + "Forearm"] = { z: side * elbow + channel(key + "ForearmTwist", 0) };
        targets[key + "Wrist"] = { z: channel(key + "Wrist", 0) * 0.65, x: channel(key + "WristPitch", 0) * 0.55 };
        const fist = clamp(channel(key + "Fingers", channel(key + "Hand", input.action === "inspect" ? 0.12 : 0)), 0, 1);
        for (const finger of fingerNames) {
          const name = finger[0].toUpperCase() + finger.slice(1);
          const thumbFlex = finger === "thumb" ? 0.45 : 1;
          const channelName = key + name + "Curl";
          const curl = clamp(channel(channelName, fist), 0, 1);
          for (let joint = 1; joint <= 3; joint++) {
            const boneName = key + name + joint;
            targets[boneName] = { z: side * curl * 0.38 * thumbFlex * (joint === 1 ? 0.75 : 1) };
          }
        }
      }

      for (const key of ["left", "right"] as const) {
        const side = key === "left" ? -1 : 1;
        const stride = input.awake && (input.action === "explore" || input.action === "inspect") ? 0.1 : 0;
        targets[key + "Hip"] = { z: side * channel(key + "Hip", 0) * 0.58, x: channel(key + "HipPitch", stride) };
        targets[key + "Knee"] = { z: side * channel(key + "Knee", stride > 0 ? 0.16 : 0.025) * 0.72 };
        targets[key + "Ankle"] = { x: channel(key + "Ankle", -0.025) * 0.18 + channel(key + "AnklePitch", 0) * 0.55, z: channel(key + "AnkleRoll", 0) * 0.55 };
        targets[key + "Foot"] = { x: channel(key + "FootPitch", 0) };
        targets[key + "Toe"] = { x: channel(key + "ToeCurl", 0) };
      }

      for (const [name, axes] of Object.entries(targets)) {
        const bone = bones[name];
        if (!bone) continue;
        for (const axis of ["x", "y", "z"] as const) {
          const target = axes[axis];
          if (target === undefined) continue;
          const bounded = clampJointAngle(name, axis, target, limits);
          bone.rotation[axis] = smooth(bone.rotation[axis], bounded, delta, 16);
        }
      }

      // The particle solver feeds residual displacement into the same articulated rig.
      // Targets are reset to immutable bind-pose positions each frame; residuals never accumulate.
      const particleBindings: readonly [ArticulatedBodyParticleId, string][] = [
        ["chest", "chest"], ["neck", "neck"], ["head", "head"],
        ["leftShoulderPoint", "leftClavicle"], ["leftElbowPoint", "leftForearm"],
        ["leftWristPoint", "leftWrist"], ["leftHandPoint", "leftHand"],
        ["rightShoulderPoint", "rightClavicle"], ["rightElbowPoint", "rightForearm"],
        ["rightWristPoint", "rightWrist"], ["rightHandPoint", "rightHand"],
        ["leftHipPoint", "leftHip"], ["leftKneePoint", "leftKnee"], ["leftAnklePoint", "leftAnkle"],
        ["rightHipPoint", "rightHip"], ["rightKneePoint", "rightKnee"], ["rightAnklePoint", "rightAnkle"],
      ];
      root.rotation.y = smooth(root.rotation.y, channel("rootYaw", 0) * 0.34, delta, 10);
      root.updateMatrixWorld(true);
      const rootYawCos = Math.cos(root.rotation.y);
      const rootYawSin = Math.sin(root.rotation.y);
      const localParticleOffset = (sample: ArticulatedParticleFrame[ArticulatedBodyParticleId]) => {
        const dx = sample.position.x - sample.target.x;
        const dy = sample.position.y - sample.target.y;
        const dz = sample.position.z - sample.target.z;
        return new THREE.Vector3(
          dx * rootYawCos - dz * rootYawSin,
          dy,
          dx * rootYawSin + dz * rootYawCos,
        );
      };
      let particleBindingsApplied = 0;
      const particleTargetWorld = (sample: ArticulatedParticleFrame[ArticulatedBodyParticleId] | undefined) => {
        if (!sample) return null;
        const pelvisHeight = bones.pelvis.position.y;
        const x = sample.position.x * rootYawCos - sample.position.z * rootYawSin;
        const z = sample.position.x * rootYawSin + sample.position.z * rootYawCos;
        return root.localToWorld(new THREE.Vector3(x, pelvisHeight + sample.position.y, z));
      };
      for (const [particleId, boneName] of particleBindings) {
        const sample = input.particles?.[particleId];
        const bone = bones[boneName];
        const rest = restJointPositions[boneName];
        if (!sample || !bone || !rest) continue;
        const rawResidual = localParticleOffset(sample);
        const residual = new THREE.Vector3(
          clamp(rawResidual.x, -0.055, 0.055),
          clamp(rawResidual.y, -0.055, 0.055),
          clamp(rawResidual.z, -0.055, 0.055),
        );
        bone.position.copy(rest).add(residual);
        particleBindingsApplied++;
      }

      // Solved wrist and ankle particles become end-effector targets. The IK solver
      // calculates the intermediate shoulder/elbow and hip/knee joints; joint limits
      // are applied before smoothing, so physics cannot teleport a limb outside its range.
      const leftWristTarget = particleTargetWorld(input.particles?.leftWristPoint);
      const rightWristTarget = particleTargetWorld(input.particles?.rightWristPoint);
      const leftAnkleTarget = particleTargetWorld(input.particles?.leftAnklePoint);
      const rightAnkleTarget = particleTargetWorld(input.particles?.rightAnklePoint);
      if (leftWristTarget) rig.solveArmTarget("left", leftWristTarget, delta);
      if (rightWristTarget) rig.solveArmTarget("right", rightWristTarget, delta);
      if (leftAnkleTarget) rig.solveLegTarget("left", leftAnkleTarget, delta);
      if (rightAnkleTarget) rig.solveLegTarget("right", rightAnkleTarget, delta);

      // Face is also driven by the organism's affect, gaze and speech envelope.
      const eyeOpen = clamp(1 - sleep * 0.68 - stress * 0.13 + curiosity * 0.08, 0.18, 1.16);
      eyeWhites.forEach((eye) => { eye.scale.y = 0.082 * eyeOpen; });
      eyelids.forEach((lid) => { lid.position.y = 0.102 - eyeOpen * 0.025; });
      irises.forEach((irisMesh) => {
        irisMesh.position.x = (irisMesh.name.endsWith("Left") ? -1 : 1) * 0.112 + clamp(input.gazeX, -1, 1) * 0.018;
        irisMesh.position.y = 0.015 - clamp(input.gazeY, -1, 1) * 0.016;
      });
      brows.forEach((brow) => {
        const side = brow.name.endsWith("Left") ? -1 : 1;
        brow.rotation.z = side * (stress * 0.15 - smile * 0.08 + curiosity * 0.06);
      });
      mouth.scale.y = 0.012 + (input.speaking ? 0.045 * clamp(input.arousal + 0.2, 0.1, 1) : smile * 0.006);
      mouth.scale.x = 0.045 + smile * 0.008;
      const chestParticle = input.particles?.chest;
      const chestParticleOffset = chestParticle ? localParticleOffset(chestParticle) : null;
      const chestParticleOffsetZ = chestParticleOffset ? clamp(chestParticleOffset.z, -0.055, 0.055) : 0;
      chest.position.z = restJointPositions.chest.z + chestParticleOffsetZ + channel("breath", 0) * 0.018;
      root.userData.poseState = { awake: input.awake, action: input.action, emotion: input.emotion, particleBindingsApplied, updatedAt: finite(input.timeSeconds) };
      root.updateMatrixWorld(true);
    },
    solveArmTarget(side, target, deltaSeconds = 1 / 60) {
      const arm = armRoots[side];
      root.updateMatrixWorld(true);
      const shoulderWorld = arm.upper.getWorldPosition(new THREE.Vector3());
      const localTarget = root.worldToLocal(target.clone());
      const localStart = root.worldToLocal(shoulderWorld.clone());
      const outward = side === "left" ? -1 : 1;
      const result = solveTwoBonePlanarIK(
        { x: outward * localStart.x, y: localStart.y },
        { x: outward * localTarget.x, y: localTarget.y },
        0.34,
        0.29,
        1,
      );
      const shoulderName = side + "UpperArm";
      const elbowName = side + "Forearm";
      const shoulderValue = clampJointAngle(shoulderName, "z", outward * result.shoulder, limits);
      const elbowValue = clampJointAngle(elbowName, "z", outward * result.elbowFlex, limits);
      arm.upper.rotation.z = smooth(arm.upper.rotation.z, shoulderValue, deltaSeconds, 18);
      arm.forearm.rotation.z = smooth(arm.forearm.rotation.z, elbowValue, deltaSeconds, 18);
      root.updateMatrixWorld(true);
      return {
        ...result,
        elbow: { x: outward * result.elbow.x, y: result.elbow.y },
        endEffector: { x: outward * result.endEffector.x, y: result.endEffector.y },
      };
    },
    solveLegTarget(side, target, deltaSeconds = 1 / 60) {
      root.updateMatrixWorld(true);
      const hipBone = bones[side + "Hip"];
      const hipWorld = hipBone.getWorldPosition(new THREE.Vector3());
      const localTarget = root.worldToLocal(target.clone());
      const localStart = root.worldToLocal(hipWorld.clone());
      const result = solveTwoBonePlanarIK(
        { x: localStart.x, y: localStart.y },
        { x: localTarget.x, y: localTarget.y },
        0.48,
        0.43,
        side === "left" ? -1 : 1,
      );
      const hipValue = clampJointAngle(side + "Hip", "z", result.shoulder + PI / 2, limits);
      const kneeSign = side === "left" ? -1 : 1;
      const kneeValue = clampJointAngle(side + "Knee", "z", kneeSign * result.elbowFlex, limits);
      hipBone.rotation.z = smooth(hipBone.rotation.z, hipValue, deltaSeconds, 18);
      bones[side + "Knee"].rotation.z = smooth(bones[side + "Knee"].rotation.z, kneeValue, deltaSeconds, 18);
      root.updateMatrixWorld(true);
      return result;
    },
    setJoint(name, axis, radians) {
      const bone = bones[name];
      if (!bone) throw new Error("Unknown humanoid joint: " + name);
      const value = clampJointAngle(name, axis, radians, limits);
      bone.rotation[axis] = value;
      root.updateMatrixWorld(true);
      return value;
    },
    resetPose() {
      for (const [name, bone] of Object.entries(bones)) {
        bone.rotation.set(0, 0, 0);
      }
      root.userData.poseState = null;
      root.updateMatrixWorld(true);
    },
    dispose() {
      root.removeFromParent();
      const geometries = new Set(meshes.map((mesh) => mesh.geometry));
      for (const geometry of geometries) geometry.dispose();
      for (const item of materials) item.dispose();
    },
  };

  return rig;
}

export function updateProceduralHumanoidRig(rig: ProceduralHumanoidRig, input: HumanoidPoseInput): void {
  rig.updatePose(input);
}
