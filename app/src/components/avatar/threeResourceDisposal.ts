/**
 * Releases Three.js resources owned by one object tree.
 *
 * glTF assets routinely share geometries, materials, textures and skeletons
 * across meshes. Dispose each owned resource once, and preserve renderer-owned
 * textures that are intentionally shared outside the imported asset.
 */
export function disposeThreeObjectTree(
  root: any,
  preservedTextures: Iterable<any> = [],
): void {
  if (!root?.traverse) return;

  const geometries = new Set<any>();
  const materials = new Set<any>();
  const textures = new Set<any>();
  const skeletons = new Set<any>();
  const preserved = new Set(preservedTextures);

  const collectTexture = (value: any): void => {
    if (Array.isArray(value)) {
      value.forEach(collectTexture);
      return;
    }
    if (value && typeof value === "object" && value.isTexture) {
      textures.add(value);
    }
  };

  root.traverse((node: any) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton && typeof node.skeleton.dispose === "function") {
      skeletons.add(node.skeleton);
    }

    const nodeMaterials = Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : [];

    for (const material of nodeMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) collectTexture(value);

      // ShaderMaterial uniforms may own textures that are not direct material
      // properties; arrays of textures are supported as well.
      const uniforms = (material as any).uniforms;
      if (uniforms && typeof uniforms === "object") {
        for (const uniform of Object.values(uniforms) as any[]) {
          collectTexture(uniform?.value);
        }
      }
    }
  });

  for (const geometry of geometries) geometry.dispose?.();
  for (const skeleton of skeletons) skeleton.dispose();
  for (const texture of textures) {
    if (!preserved.has(texture)) texture.dispose?.();
  }
  for (const material of materials) material.dispose?.();
}
