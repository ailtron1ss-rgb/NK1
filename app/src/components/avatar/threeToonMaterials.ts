import * as THREE from "three";
import { disposeReplacedThreeMaterials } from "./threeResourceDisposal.ts";

// Keep the constructor surface explicit for the pinned Three.js runtime.
type ThreeToonApi = typeof THREE & {
  DataTexture: new (data: Uint8Array, width: number, height: number, format: number) => {
    isTexture?: boolean;
    magFilter: number;
    minFilter: number;
    generateMipmaps: boolean;
    needsUpdate: boolean;
  };
  RedFormat: number;
  NearestFilter: number;
  MeshToonMaterial: new (parameters: Record<string, unknown>) => any;
};

const THREE_TOON = THREE as ThreeToonApi;
let sharedAnimeGradient: any = null;

/** Lazily allocate one immutable three-band lookup texture for the renderer. */
function createAnimeGradient(): any {
  if (sharedAnimeGradient) return sharedAnimeGradient;
  const texture = new THREE_TOON.DataTexture(
    new Uint8Array([54, 142, 255]),
    3,
    1,
    THREE_TOON.RedFormat,
  );
  texture.magFilter = THREE_TOON.NearestFilter;
  texture.minFilter = THREE_TOON.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  sharedAnimeGradient = texture;
  return texture;
}

/** Read the shared texture without creating it; model cleanup must not allocate GPU resources. */
export function getSharedAnimeGradientTexture(): any | null {
  return sharedAnimeGradient;
}

/** Create a procedural cel-shaded material using the renderer-owned gradient. */
export function createProceduralToonMaterial(
  color: number,
  roughness = 0.7,
  metalness = 0,
): any {
  // MeshToonMaterial intentionally replaces PBR roughness/metalness response.
  void roughness;
  void metalness;
  return new THREE_TOON.MeshToonMaterial({
    color,
    gradientMap: createAnimeGradient(),
  });
}

const importedToonMaterialCache = new WeakMap<object, any>();

function toAnimeToonMaterial(source: any): any {
  if (
    !source ||
    (!source.isMeshStandardMaterial && !source.isMeshPhysicalMaterial)
  ) {
    return source;
  }

  const cached = importedToonMaterialCache.get(source);
  if (cached) return cached;

  const toon = new THREE_TOON.MeshToonMaterial({
    color: source.color,
    map: source.map,
    alphaMap: source.alphaMap,
    emissive: source.emissive,
    emissiveMap: source.emissiveMap,
    emissiveIntensity: source.emissiveIntensity,
    normalMap: source.normalMap,
    normalScale: source.normalScale,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    vertexColors: source.vertexColors,
    wireframe: source.wireframe,
    flatShading: source.flatShading,
    depthWrite: source.depthWrite,
    depthTest: source.depthTest,
    gradientMap: createAnimeGradient(),
  });
  toon.name = source.name
    ? source.name + "_NK1_Toon"
    : "NK1_Toon_Material";
  toon.userData = {
    ...source.userData,
    nk1ToonConverted: true,
  };
  toon.needsUpdate = true;
  importedToonMaterialCache.set(source, toon);
  return toon;
}

/**
 * Convert non-VRM GLB material instances in-place. Shared source materials map
 * to one converted instance, then their program state is released without
 * disposing textures that the converted materials continue to reference.
 * VRM-authored MToon materials must not be passed to this function.
 */
export function applyAnimeToonMaterials(root: any): void {
  if (!root?.traverse) return;

  const replaced = new Set<any>();
  root.traverse((node: any) => {
    if (!node.isMesh || !node.material) return;

    const convert = (source: any) => {
      const converted = toAnimeToonMaterial(source);
      if (converted !== source) replaced.add(source);
      return converted;
    };

    node.material = Array.isArray(node.material)
      ? node.material.map(convert)
      : convert(node.material);
  });

  disposeReplacedThreeMaterials(replaced);
}


type ThreePbrApi = typeof THREE & {
  MeshPhysicalMaterial: new (parameters: Record<string, unknown>) => any;
};
const THREE_PBR = THREE as ThreePbrApi;

type AvatarPbrProfile = {
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
};

function avatarPbrProfile(materialName: string, sourceRoughness: number): AvatarPbrProfile {
  const name = materialName.toLowerCase();
  if (/skin|face|blush/.test(name)) {
    return { roughness: 0.5, clearcoat: 0.1, clearcoatRoughness: 0.32, sheen: 0, sheenRoughness: 0.5 };
  }
  if (/hair/.test(name)) {
    return { roughness: 0.34, clearcoat: 0.28, clearcoatRoughness: 0.24, sheen: 0.08, sheenRoughness: 0.32 };
  }
  if (/eye|iris|pupil|glint/.test(name)) {
    return { roughness: 0.18, clearcoat: 0.28, clearcoatRoughness: 0.14, sheen: 0, sheenRoughness: 0.4 };
  }
  if (/coat|cloth|skirt|tie|fabric/.test(name)) {
    return { roughness: 0.64, clearcoat: 0.04, clearcoatRoughness: 0.48, sheen: 0.16, sheenRoughness: 0.55 };
  }
  if (/shoe|leather|boot/.test(name)) {
    return { roughness: 0.28, clearcoat: 0.18, clearcoatRoughness: 0.28, sheen: 0.02, sheenRoughness: 0.45 };
  }
  return {
    roughness: Math.min(0.92, Math.max(0.22, Number.isFinite(sourceRoughness) ? sourceRoughness : 0.7)),
    clearcoat: 0.06,
    clearcoatRoughness: 0.35,
    sheen: 0,
    sheenRoughness: 0.5,
  };
}

const importedPbrMaterialCache = new WeakMap<object, any>();

function toAvatarPbrMaterial(source: any): any {
  if (!source || (!source.isMeshStandardMaterial && !source.isMeshPhysicalMaterial)) {
    return source;
  }

  const cached = importedPbrMaterialCache.get(source);
  if (cached) return cached;

  const profile = avatarPbrProfile(String(source.name ?? ""), Number(source.roughness ?? 0.7));
  const physical = new THREE_PBR.MeshPhysicalMaterial({
    color: source.color,
    map: source.map,
    alphaMap: source.alphaMap,
    emissive: source.emissive,
    emissiveMap: source.emissiveMap,
    emissiveIntensity: source.emissiveIntensity,
    normalMap: source.normalMap,
    normalScale: source.normalScale,
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    roughnessMap: source.roughnessMap,
    metalnessMap: source.metalnessMap,
    bumpMap: source.bumpMap,
    bumpScale: source.bumpScale,
    displacementMap: source.displacementMap,
    displacementScale: source.displacementScale,
    displacementBias: source.displacementBias,
    lightMap: source.lightMap,
    lightMapIntensity: source.lightMapIntensity,
    envMap: source.envMap,
    envMapIntensity: source.envMapIntensity,
    clearcoatMap: source.clearcoatMap,
    clearcoatRoughnessMap: source.clearcoatRoughnessMap,
    clearcoatNormalMap: source.clearcoatNormalMap,
    sheenColorMap: source.sheenColorMap,
    sheenRoughnessMap: source.sheenRoughnessMap,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    vertexColors: source.vertexColors,
    wireframe: source.wireframe,
    flatShading: source.flatShading,
    depthWrite: source.depthWrite,
    depthTest: source.depthTest,
    roughness: profile.roughness,
    metalness: Math.min(1, Math.max(0, Number(source.metalness ?? 0))),
    clearcoat: profile.clearcoat,
    clearcoatRoughness: profile.clearcoatRoughness,
    sheen: profile.sheen,
    sheenRoughness: profile.sheenRoughness,
  });
  physical.name = source.name ? source.name + "_NK1_PBR" : "NK1_PBR_Material";
  physical.userData = {
    ...source.userData,
    nk1PbrEnhanced: true,
  };
  physical.needsUpdate = true;
  importedPbrMaterialCache.set(source, physical);
  return physical;
}

/**
 * Preserve GLB texture maps and authored PBR response while upgrading the
 * candidate's semantic skin, hair, eye and fabric materials to MeshPhysicalMaterial.
 * The canonical v5 remains on the separate cel-shaded toon adapter.
 */
export function applyAvatarPbrMaterials(root: any): void {
  if (!root?.traverse) return;

  const replaced = new Set<any>();
  root.traverse((node: any) => {
    if (!node.isMesh || !node.material) return;

    const convert = (source: any) => {
      const converted = toAvatarPbrMaterial(source);
      if (converted !== source) replaced.add(source);
      return converted;
    };

    node.material = Array.isArray(node.material)
      ? node.material.map(convert)
      : convert(node.material);
  });

  disposeReplacedThreeMaterials(replaced);
}
