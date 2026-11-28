import * as THREE from "three";
import type { AvatarNeuroAdaptiveFrame } from "./avatarNeuroAdaptiveDynamics.ts";
import { createAvatarBodySurfaceCollider, createAvatarSecondaryParticleState, projectPointOutsideBodySurface, stepAvatarSecondaryParticleState, type AvatarBodySurfaceCollider, type AvatarSecondaryParticleState } from "./avatarSecondaryParticleSolver.ts";

export type AvatarSecondaryVertexRole = "hair" | "garment";

export interface AvatarSecondaryVertexUniform {
  value: number;
}

export interface AvatarSecondaryVertexUniforms {
  nk1SecondaryTime: AvatarSecondaryVertexUniform;
  nk1SecondaryMotion: AvatarSecondaryVertexUniform;
  nk1SecondaryGait: AvatarSecondaryVertexUniform;
  nk1SecondaryBreath: AvatarSecondaryVertexUniform;
  nk1SecondaryYaw: AvatarSecondaryVertexUniform;
  nk1SecondaryMinY: AvatarSecondaryVertexUniform;
  nk1SecondaryInvHeight: AvatarSecondaryVertexUniform;
  nk1SecondaryAmplitude: AvatarSecondaryVertexUniform;
  nk1SecondaryPhase: AvatarSecondaryVertexUniform;
  nk1SecondarySide: AvatarSecondaryVertexUniform;
  nk1SecondaryHair: AvatarSecondaryVertexUniform;
}

export interface AvatarSecondaryVertexDrive {
  motion: number;
  gait: number;
  breath: number;
  yaw: number;
}

export interface AvatarSecondaryVertexBinding {
  mesh: any;
  originalMaterial: any;
  patchedMaterial: any;
  clonedMaterials: any[];
  uniforms: AvatarSecondaryVertexUniforms;
  role: AvatarSecondaryVertexRole;
  originalGeometry?: any;
  patchedGeometry?: any;
  originalFrustumCulled?: boolean;
  particleState?: AvatarSecondaryParticleState;
}

interface VertexProfile {
  role: AvatarSecondaryVertexRole;
  amplitudeWorld: number;
  side: -1 | 0 | 1;
  pinRatio: number;
}

interface ShaderLike {
  uniforms: Record<string, unknown>;
  vertexShader: string;
}

const QUALITY_SCALE = Object.freeze({ low: 0.35, balanced: 0.7, high: 1 });
const MAX_WORLD_AMPLITUDE = 0.012;
const MAX_LOCAL_AMPLITUDE = 0.02;
const SHADER_MARKER = "NK1_SECONDARY_VERTEX_MOTION_V1";
const REQUIRED_UNIFORMS = [
  "nk1SecondaryTime", "nk1SecondaryMotion", "nk1SecondaryGait", "nk1SecondaryBreath",
  "nk1SecondaryYaw", "nk1SecondaryMinY", "nk1SecondaryInvHeight", "nk1SecondaryAmplitude",
  "nk1SecondaryPhase", "nk1SecondarySide", "nk1SecondaryHair",
] as const;

const clamp = (value: unknown, min: number, max: number, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

const clamp01 = (value: unknown): number => clamp(value, 0, 1);
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function readChannel(frame: AvatarNeuroAdaptiveFrame, name: string): number {
  const value = frame.bodyChannels?.[name];
  return clamp(value, -1, 1);
}

function stablePhase(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 6283) / 1000;
}

/**
 * Only detached, separately authored pieces are eligible. The head mass,
 * crown, fringe silhouette, face, eyes, lapels and sleeves remain untouched.
 */
function resolveProfile(rawName: unknown): VertexProfile | null {
  if (typeof rawName !== "string" || !rawName.trim()) return null;
  const name = normalize(rawName);
  const hair = /^hair(?:longlock|frontstrand)[lr]$/.test(name)
    || /^hairlayer[lr][012]$/.test(name);
  if (hair) {
    const side: -1 | 0 | 1 = /(?:longlock|frontstrand)l$/.test(name) || /^hairlayerl[012]$/.test(name)
      ? -1
      : /(?:longlock|frontstrand)r$/.test(name) || /^hairlayerr[012]$/.test(name) ? 1 : 0;
    const amplitudeWorld = name.startsWith("hairlonglock")
      ? 0.012
      : name.startsWith("hairfrontstrand") ? 0.007 : 0.0055;
    return { role: "hair", amplitudeWorld, side, pinRatio: name.startsWith("hairlonglock") ? 0.28 : 0.24 };
  }
  const garment = name === "clothskirt"
    || name === "clothtieblade"
    || name === "clothlabcoatmain";
  if (garment) {
    return {
      role: "garment",
      amplitudeWorld: name === "clothtieblade" ? 0.0045 : 0.007,
      side: 0,
      pinRatio: name === "clothskirt" ? 0.18 : name === "clothtieblade" ? 0.16 : 0.22,
    };
  }
  return null;
}

function makeUniforms(
  profile: VertexProfile,
  name: string,
  minY: number,
  height: number,
  rootScale: number,
): AvatarSecondaryVertexUniforms {
  const localAmplitude = Math.min(
    MAX_LOCAL_AMPLITUDE,
    clamp(profile.amplitudeWorld, 0, MAX_WORLD_AMPLITUDE)
      / Math.max(0.001, Math.min(rootScale, 1_000)),
  );
  return {
    nk1SecondaryTime: { value: 0 },
    nk1SecondaryMotion: { value: 0 },
    nk1SecondaryGait: { value: 0 },
    nk1SecondaryBreath: { value: 0 },
    nk1SecondaryYaw: { value: 0 },
    nk1SecondaryMinY: { value: minY },
    nk1SecondaryInvHeight: { value: 1 / height },
    nk1SecondaryAmplitude: { value: localAmplitude },
    nk1SecondaryPhase: { value: stablePhase(name) },
    nk1SecondarySide: { value: profile.side },
    nk1SecondaryHair: { value: profile.role === "hair" ? 1 : 0 },
  };
}

/**
 * Injects a small displacement after glTF skinning, so original skin weights,
 * blend shapes, bind poses and the primary humanoid motor stay authoritative.
 * No shader text is modified unless both expected Three.js anchors exist.
 */
export function injectAvatarSecondaryVertexShader(
  shader: ShaderLike,
  uniforms: AvatarSecondaryVertexUniforms | Record<string, AvatarSecondaryVertexUniform>,
  particleDriven = false,
): boolean {
  if (!shader || typeof shader.vertexShader !== "string"
    || !shader.uniforms || typeof shader.uniforms !== "object") return false;
  const commonAnchor = "#include <common>";
  const skinningAnchor = "#include <skinning_vertex>";
  if (!uniforms || typeof uniforms !== "object" || Array.isArray(uniforms)) return false;
  const uniformRecord = uniforms as Record<string, AvatarSecondaryVertexUniform>;
  let uniformEntries: Array<[string, AvatarSecondaryVertexUniform]>;
  try {
    uniformEntries = Object.entries(uniformRecord) as Array<[string, AvatarSecondaryVertexUniform]>;
    // Validate every supplied uniform before touching the shader. Extra uniforms are
    // allowed, but malformed names/values must fail closed with no partial mutation.
    for (const [name, uniform] of uniformEntries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
        || !uniform || typeof uniform.value !== "number" || !Number.isFinite(uniform.value)) return false;
    }
    for (const name of REQUIRED_UNIFORMS) {
      if (!Object.prototype.hasOwnProperty.call(uniformRecord, name)) return false;
    }
  } catch {
    return false;
  }
  if (!shader.vertexShader.includes(commonAnchor) || !shader.vertexShader.includes(skinningAnchor)) return false;
  if (shader.vertexShader.includes(SHADER_MARKER)) {
    for (const [name, uniform] of uniformEntries) shader.uniforms[name] = uniform;
    return true;
  }

  const declarations = `
#define ${SHADER_MARKER}
${particleDriven ? "attribute vec3 nk1SecondaryOffset;\n" : ""}
uniform float nk1SecondaryTime;
uniform float nk1SecondaryMotion;
uniform float nk1SecondaryGait;
uniform float nk1SecondaryBreath;
uniform float nk1SecondaryYaw;
uniform float nk1SecondaryMinY;
uniform float nk1SecondaryInvHeight;
uniform float nk1SecondaryAmplitude;
uniform float nk1SecondaryPhase;
uniform float nk1SecondarySide;
uniform float nk1SecondaryHair;
`;
  const displacement = `
{
  float nk1SecondaryHeight01 = clamp((position.y - nk1SecondaryMinY) * nk1SecondaryInvHeight, 0.0, 1.0);
  float nk1SecondaryLoose = 1.0 - smoothstep(0.06, 0.82, nk1SecondaryHeight01);
  float nk1SecondaryPhaseNow = nk1SecondaryTime * 1.65
    + position.y * 2.8 + position.x * 1.1 + nk1SecondaryPhase;
  float nk1SecondaryWave = sin(nk1SecondaryPhaseNow) * nk1SecondaryMotion;
  float nk1SecondaryStep = sin(nk1SecondaryTime * 2.6 + nk1SecondaryPhaseNow * 0.73)
    * nk1SecondaryGait;
  float nk1SecondaryBreathWave = sin(nk1SecondaryTime * 1.15 + nk1SecondaryPhase * 0.4)
    * nk1SecondaryBreath;
  float nk1SecondaryHairScale = nk1SecondaryHair;
  float nk1SecondaryGarmentScale = 1.0 - nk1SecondaryHair;
  float nk1SecondaryHorizontal = nk1SecondaryWave * (0.82 * nk1SecondaryHairScale + 0.48 * nk1SecondaryGarmentScale)
    + nk1SecondaryYaw * (0.12 * nk1SecondaryHairScale + 0.08 * nk1SecondaryGarmentScale)
    + nk1SecondaryStep * nk1SecondarySide * 0.18 * nk1SecondaryGarmentScale;
  float nk1SecondaryDepth = cos(nk1SecondaryPhaseNow * 0.76) * nk1SecondaryMotion
    * (0.24 * nk1SecondaryHairScale + 0.12 * nk1SecondaryGarmentScale)
    + nk1SecondaryBreathWave * 0.08 * nk1SecondaryGarmentScale;
  transformed.x += nk1SecondaryHorizontal * nk1SecondaryAmplitude * nk1SecondaryLoose;
  transformed.z += nk1SecondaryDepth * nk1SecondaryAmplitude * nk1SecondaryLoose;
}
`;
  let vertexShader = shader.vertexShader.replace(commonAnchor, commonAnchor + declarations);
  if (particleDriven) vertexShader = vertexShader.replace(skinningAnchor, skinningAnchor + "\ntransformed += nk1SecondaryOffset;");
  vertexShader = vertexShader.replace(skinningAnchor, skinningAnchor + displacement);
  if (vertexShader === shader.vertexShader) return false;

  for (const [name, uniform] of uniformEntries) shader.uniforms[name] = uniform;
  shader.vertexShader = vertexShader;
  return true;
}

function patchMaterial(
  material: any,
  uniforms: AvatarSecondaryVertexUniforms,
  particleDriven = false,
): any | null {
  const isNk1Toon = material?.isMeshToonMaterial === true || material?.userData?.nk1ToonConverted === true;
  if (!material || (material.isMeshStandardMaterial !== true && material.isMeshPhysicalMaterial !== true && !isNk1Toon)
    || typeof material.clone !== "function") return null;
  let clone: any;
  try {
    clone = material.clone();
  } catch {
    return null;
  }
  if (!clone || clone === material) return null;

  const originalCompile = typeof clone.onBeforeCompile === "function"
    ? clone.onBeforeCompile
    : () => undefined;
  clone.onBeforeCompile = function (shader: ShaderLike, renderer: unknown) {
    originalCompile.call(this, shader, renderer);
    const patched = injectAvatarSecondaryVertexShader(shader, uniforms, particleDriven);
    if (!patched) {
      this.userData = { ...(this.userData ?? {}), nk1SecondaryVertexShaderUnsupported: true };
    }
  };
  const originalProgramKey = typeof clone.customProgramCacheKey === "function"
    ? clone.customProgramCacheKey.bind(clone)
    : () => "";
  clone.customProgramCacheKey = () => originalProgramKey() + "|" + SHADER_MARKER + (particleDriven ? "|XPBD_PARTICLE" : "|GPU_SWAY");
  clone.userData = {
    ...(clone.userData ?? {}),
    nk1SecondaryVertexDynamics: true,
    nk1SecondaryVertexShader: SHADER_MARKER,
  };
  clone.needsUpdate = true;
  return clone;
}

function resolveParticlePinMask(
  geometry: any,
  position: any,
  minY: number,
  height: number,
  profile: VertexProfile,
): Float32Array | null {
  const count = position?.count;
  if (!Number.isInteger(count) || count < 6 || count > 768) return null;
  const explicit = geometry.attributes?.nk1SecondaryPin ?? geometry.getAttribute?.("nk1SecondaryPin");
  const mask = new Float32Array(count);
  const explicitArray = explicit?.array;
  const useExplicit = explicit?.count === count && explicitArray && explicitArray.length >= count;
  for (let index = 0; index < count; index += 1) {
    if (useExplicit) {
      const value = Number(explicitArray[index]);
      if (!Number.isFinite(value)) return null;
      mask[index] = clamp01(value);
      continue;
    }
    const y = typeof position.getY === "function"
      ? Number(position.getY(index))
      : Number(position.array?.[index * 3 + 1]);
    if (!Number.isFinite(y)) return null;
    // The canonical v5 has detached semantic meshes but no authored pin groups.
    // Pin a narrow attachment band by vertical bounds; an exported pin attribute
    // takes precedence whenever the next authored asset provides one.
    const pinBandStart = minY + height * (1 - profile.pinRatio);
    const pinTransitionHeight = Math.max(1e-6, height * profile.pinRatio * 0.7);
    const pinBlend = clamp01((y - pinBandStart) / pinTransitionHeight);
    // Keep the distal row fixed, but soften the lower attachment boundary so
    // neighbouring vertices do not switch abruptly from free to immovable.
    mask[index] = pinBlend * pinBlend * (3 - 2 * pinBlend);
  }
  return mask;
}

/**
 * Resolve only the canonical skinned torso surface. Similar names, proxy
 * objects and static meshes are deliberately ignored.
 */
export function resolveAvatarSecondaryBodySurface(root: unknown): any | null {
  if (!root || typeof root !== "object" || typeof (root as any).traverse !== "function") return null;
  let surface: any = null;
  (root as any).traverse((node: any) => {
    if (surface || node?.isSkinnedMesh !== true
      || normalize(String(node.name ?? "")) !== "bodytorsocore"
      || typeof node.getVertexPosition !== "function") return;
    const geometry = node.geometry;
    const position = geometry?.attributes?.position ?? geometry?.getAttribute?.("position");
    if (!position || !Number.isInteger(position.count) || position.count < 4) return;
    surface = node;
  });
  return surface;
}

function applyAvatarBodySurfaceCollisions(
  bindings: readonly AvatarSecondaryVertexBinding[],
  bodySurface: any,
): void {
  if (!bodySurface || typeof bodySurface.getVertexPosition !== "function") return;
  const geometry = bodySurface.geometry;
  const positionAttribute = geometry?.attributes?.position ?? geometry?.getAttribute?.("position");
  const vertexCount = positionAttribute?.count;
  if (!Number.isInteger(vertexCount) || vertexCount < 4) return;

  bodySurface.updateWorldMatrix?.(true, false);
  bodySurface.skeleton?.update?.();
  const surfacePositions = new Float32Array(vertexCount * 3);
  const surfaceVertex = new THREE.Vector3();
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    bodySurface.getVertexPosition(vertex, surfaceVertex);
    if (![surfaceVertex.x, surfaceVertex.y, surfaceVertex.z].every(Number.isFinite)) return;
    const offset = vertex * 3;
    surfacePositions[offset] = surfaceVertex.x;
    surfacePositions[offset + 1] = surfaceVertex.y;
    surfacePositions[offset + 2] = surfaceVertex.z;
  }

  const collider: AvatarBodySurfaceCollider | null = createAvatarBodySurfaceCollider({
    positions: surfacePositions,
    indices: geometry.index?.array ?? null,
  });
  if (!collider) return;

  const localVertex = new THREE.Vector3();
  const bodyLocalPoint = new THREE.Vector3();
  const correctedWorldPoint = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const minimumDistanceByRole = { hair: 0.008, garment: 0.01 } as const;

  for (const binding of bindings) {
    const state = binding?.particleState;
    const mesh = binding?.mesh;
    if (!state || !mesh || typeof mesh.getVertexPosition !== "function"
      || typeof mesh.localToWorld !== "function" || typeof mesh.worldToLocal !== "function") continue;
    mesh.updateWorldMatrix?.(true, false);
    state.bodyCollisionCount = 0;
    state.maxBodyCollisionCorrection = 0;
    const minimumDistance = minimumDistanceByRole[binding.role];

    for (let vertex = 0; vertex < state.vertexCount; vertex += 1) {
      if (state.inverseMass[vertex] <= 0) continue;
      mesh.getVertexPosition(vertex, localVertex);
      if (![localVertex.x, localVertex.y, localVertex.z].every(Number.isFinite)) continue;

      bodyLocalPoint.copy(localVertex);
      mesh.localToWorld(bodyLocalPoint);
      bodySurface.worldToLocal(bodyLocalPoint);
      const projection = projectPointOutsideBodySurface(bodyLocalPoint, collider, minimumDistance);
      if (!projection) continue;

      correctedWorldPoint.set(projection.position.x, projection.position.y, projection.position.z);
      bodySurface.localToWorld(correctedWorldPoint);
      mesh.worldToLocal(correctedWorldPoint);
      delta.copy(correctedWorldPoint).sub(localVertex);
      if (![delta.x, delta.y, delta.z].every(Number.isFinite)) continue;

      const offset = vertex * 3;
      let nextX = state.positions[offset] + delta.x;
      let nextY = state.positions[offset + 1] + delta.y;
      let nextZ = state.positions[offset + 2] + delta.z;
      let restX = nextX - state.rest[offset];
      let restY = nextY - state.rest[offset + 1];
      let restZ = nextZ - state.rest[offset + 2];
      const displacement = Math.hypot(restX, restY, restZ);
      if (!Number.isFinite(displacement)) continue;
      if (displacement > state.maxOffset && displacement > 1e-9) {
        const scale = state.maxOffset / displacement;
        restX *= scale; restY *= scale; restZ *= scale;
        nextX = state.rest[offset] + restX;
        nextY = state.rest[offset + 1] + restY;
        nextZ = state.rest[offset + 2] + restZ;
      }
      const appliedX = nextX - state.positions[offset];
      const appliedY = nextY - state.positions[offset + 1];
      const appliedZ = nextZ - state.positions[offset + 2];
      if (Math.hypot(appliedX, appliedY, appliedZ) <= 1e-9) continue;

      state.positions[offset] = nextX;
      state.positions[offset + 1] = nextY;
      state.positions[offset + 2] = nextZ;
      // Contact is a positional constraint, not an impulse; shift the Verlet
      // history by the same correction so the next tick does not invent speed.
      state.previous[offset] += appliedX;
      state.previous[offset + 1] += appliedY;
      state.previous[offset + 2] += appliedZ;
      state.offsets[offset] = restX;
      state.offsets[offset + 1] = restY;
      state.offsets[offset + 2] = restZ;
      state.bodyCollisionCount += 1;
      state.maxBodyCollisionCorrection = Math.max(
        state.maxBodyCollisionCorrection,
        projection.correction,
      );
    }
  }
}

/**
 * Attaches reversible GPU vertex sway to existing modular skinned meshes.
 * Geometry, skin indices/weights, morph targets and source materials are not
 * rewritten. Unsupported meshes/materials simply remain unchanged.
 */
export function attachAvatarSecondaryVertexDynamics(
  root: unknown,
  rootScale = 1,
): AvatarSecondaryVertexBinding[] {
  if (!root || typeof root !== "object" || typeof (root as any).traverse !== "function") return [];
  const bindings: AvatarSecondaryVertexBinding[] = [];
  (root as any).traverse((node: any) => {
    if (!node || node.isSkinnedMesh !== true) return;
    const profile = resolveProfile(node.name);
    if (!profile) return;

    const geometry = node.geometry;
    if (!geometry || typeof geometry !== "object") return;
    const position = geometry.attributes?.position ?? geometry.getAttribute?.("position");
    if (!position || !Number.isInteger(position.count) || position.count < 3) return;
    if (!geometry.boundingBox && typeof geometry.computeBoundingBox === "function") {
      try {
        geometry.computeBoundingBox();
      } catch {
        return;
      }
    }
    const minY = geometry.boundingBox?.min?.y;
    const maxY = geometry.boundingBox?.max?.y;
    const height = typeof minY === "number" && typeof maxY === "number" ? maxY - minY : 0;
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !Number.isFinite(height) || height < 0.0001) return;

    const originalMaterial = node.material;
    const originalMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
    if (!originalMaterials.length) return;
    const uniforms = makeUniforms(profile, String(node.name), minY, height, rootScale);
    const particlePins = resolveParticlePinMask(geometry, position, minY, height, profile);
    const particleState = particlePins ? createAvatarSecondaryParticleState({
      positions: position.array ?? Array.from({ length: position.count * 3 }, (_, index) => {
        const vertex = Math.floor(index / 3);
        const axis = index % 3;
        return typeof position.getX === "function"
          ? axis === 0 ? position.getX(vertex) : axis === 1 ? position.getY(vertex) : position.getZ(vertex)
          : 0;
      }),
      indices: geometry.index?.array ?? null,
      pinnedMask: particlePins,
      role: profile.role,
    }) : null;
    let patchedGeometry: any = null;
    if (particleState && typeof geometry.clone === "function") {
      try {
        patchedGeometry = geometry.clone();
        if (!patchedGeometry || patchedGeometry === geometry || typeof patchedGeometry.setAttribute !== "function") patchedGeometry = null;
        else patchedGeometry.setAttribute("nk1SecondaryOffset", new THREE.BufferAttribute(particleState.offsets, 3));
      } catch {
        patchedGeometry?.dispose?.();
        patchedGeometry = null;
      }
    }
    const activeParticleState = patchedGeometry && particleState ? particleState : undefined;
    const clonedMaterials: any[] = [];
    const patchedMaterials = originalMaterials.map((material: any) => {
      const patched = patchMaterial(material, uniforms, !!activeParticleState);
      if (patched) clonedMaterials.push(patched);
      return patched ?? material;
    });
    if (clonedMaterials.length === 0) {
      patchedGeometry?.dispose?.();
      return;
    }

    const patchedMaterial = Array.isArray(originalMaterial) ? patchedMaterials : patchedMaterials[0];
    const originalFrustumCulled = node.frustumCulled;
    if (activeParticleState && patchedGeometry) {
      node.geometry = patchedGeometry;
      node.frustumCulled = false;
    }
    node.material = patchedMaterial;
    bindings.push({
      mesh: node, originalMaterial, patchedMaterial, clonedMaterials, uniforms, role: profile.role,
      originalGeometry: activeParticleState ? geometry : undefined,
      patchedGeometry: activeParticleState ? patchedGeometry : undefined,
      originalFrustumCulled: activeParticleState ? originalFrustumCulled : undefined,
      particleState: activeParticleState,
    });
  });
  return bindings;
}

export function resolveAvatarSecondaryVertexDrive(
  frame: AvatarNeuroAdaptiveFrame,
): AvatarSecondaryVertexDrive {
  const quality = frame?.quality === "low" || frame?.quality === "high" ? frame.quality : "balanced";
  const qualityScale = QUALITY_SCALE[quality];
  const awakeScale = frame?.awake === true ? 1 : 0.06;
  const activity = clamp01(
    0.06
      + clamp01(frame?.energy) * 0.18
      + clamp01(frame?.arousal) * 0.14
      + clamp01(frame?.cognitiveLoad) * 0.05
      + clamp01(frame?.uncertainty) * 0.07
      + clamp01(frame?.curiosity) * 0.16
      + clamp01(frame?.novelty) * 0.15
      + clamp01(frame?.predictionError) * 0.13,
  );
  const gait = clamp01((
    Math.abs(readChannel(frame, "leftAnkle"))
      + Math.abs(readChannel(frame, "rightAnkle"))
      + Math.abs(readChannel(frame, "leftKnee"))
      + Math.abs(readChannel(frame, "rightKnee"))
  ) * 0.25);
  const breath = Math.max(0, readChannel(frame, "breath"));
  const yaw = clamp(
    readChannel(frame, "headYaw") * 0.3
      + readChannel(frame, "torsoYaw") * 0.5
      + readChannel(frame, "rootYaw") * 0.2,
    -1,
    1,
  );
  const scale = qualityScale * awakeScale;
  return {
    motion: clamp01(activity * scale),
    gait: clamp01(gait * scale),
    breath: clamp01(breath * scale),
    yaw: clamp(yaw * scale, -1, 1),
  };
}

export function updateAvatarSecondaryVertexDynamics(
  bindings: readonly AvatarSecondaryVertexBinding[],
  frame: AvatarNeuroAdaptiveFrame,
  timeSeconds: number,
  bodySurface?: any,
): void {
  if (!Array.isArray(bindings) || !frame || typeof frame !== "object") return;
  const drive = resolveAvatarSecondaryVertexDrive(frame);
  const time = clamp(timeSeconds, 0, 1_000_000);
  if (bodySurface) applyAvatarBodySurfaceCollisions(bindings, bodySurface);
  for (const binding of bindings) {
    if (!binding?.uniforms) continue;
    binding.uniforms.nk1SecondaryTime.value = time;
    binding.uniforms.nk1SecondaryMotion.value = drive.motion;
    binding.uniforms.nk1SecondaryGait.value = drive.gait;
    binding.uniforms.nk1SecondaryBreath.value = drive.breath;
    binding.uniforms.nk1SecondaryYaw.value = drive.yaw;
    if (binding.particleState && binding.patchedGeometry) {
      stepAvatarSecondaryParticleState(binding.particleState, frame);
      const offsetAttribute = binding.patchedGeometry.attributes?.nk1SecondaryOffset;
      if (offsetAttribute) offsetAttribute.needsUpdate = true;
    }
  }
}

/** Restore original materials and dispose the private clones on replacement/reset. */
export function disposeAvatarSecondaryVertexDynamics(
  bindings: readonly AvatarSecondaryVertexBinding[],
): void {
  if (!Array.isArray(bindings)) return;
  for (const binding of bindings) {
    if (!binding) continue;
    if (binding.mesh?.material === binding.patchedMaterial) {
      binding.mesh.material = binding.originalMaterial;
    }
    if (binding.patchedGeometry && binding.mesh?.geometry === binding.patchedGeometry) {
      binding.mesh.geometry = binding.originalGeometry;
    }
    if (binding.particleState) {
      binding.mesh.frustumCulled = binding.originalFrustumCulled;
    }
    binding.patchedGeometry?.dispose?.();
    for (const material of binding.clonedMaterials ?? []) {
      if (material && typeof material.dispose === "function") material.dispose();
    }
  }
}
