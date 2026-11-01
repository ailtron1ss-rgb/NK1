import * as THREE from "three";
import { disposeReplacedThreeMaterials } from "./threeResourceDisposal";

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
