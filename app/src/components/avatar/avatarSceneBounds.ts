import { Box3, Vector3 } from "three";

type AvatarSceneAttribute = {
  count: number;
  getX?(index: number): number;
};

type AvatarSceneGeometry = {
  attributes?: { position?: AvatarSceneAttribute };
  index?: AvatarSceneAttribute | null;
  drawRange?: { start: number; count: number };
};

type AvatarSceneMesh = {
  name: string;
  isMesh?: boolean;
  visible?: boolean;
  userData?: Record<string, unknown>;
  parent?: AvatarSceneMesh | null;
  geometry?: AvatarSceneGeometry;
  matrixWorld?: unknown;
  getVertexPosition?: (index: number, target: any) => void;
};

type AvatarSceneRoot = {
  updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void;
  traverse(callback: (node: AvatarSceneMesh) => void): void;
};

const createEmptyBounds = () => new Box3();
type AvatarBounds = ReturnType<typeof createEmptyBounds>;

/**
 * Studio/environment meshes are export helpers, not part of the avatar.
 * A large ENV_floor must never determine the character's normalization scale.
 */
export function isAvatarEnvironmentMesh(node: AvatarSceneMesh): boolean {
  if (node.isMesh !== true) return false;
  return node.userData?.nk1ExcludeFromAvatarBounds === true
    || /^ENV_/i.test(node.name.trim());
}

function isEffectivelyVisible(node: AvatarSceneMesh): boolean {
  let current: AvatarSceneMesh | null | undefined = node;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

/**
 * Visit each unique vertex referenced by the geometry's active draw range.
 * Position-buffer entries outside the index buffer are not drawn and must not
 * affect camera fitting or normalization.
 */
export function forEachAvatarRenderedVertexIndex(
  mesh: AvatarSceneMesh,
  visit: (vertexIndex: number) => void,
): number {
  if (mesh.isMesh !== true) return 0;
  const geometry = mesh.geometry;
  const positions = geometry?.attributes?.position;
  if (!positions || !Number.isInteger(positions.count) || positions.count <= 0) return 0;

  const index = geometry?.index ?? null;
  const elementCount = index?.count ?? positions.count;
  const rangeStart = Math.max(0, Math.floor(geometry?.drawRange?.start ?? 0));
  const requestedCount = geometry?.drawRange?.count ?? Number.POSITIVE_INFINITY;
  const rangeEnd = Math.min(
    elementCount,
    Number.isFinite(requestedCount)
      ? rangeStart + Math.max(0, Math.floor(requestedCount))
      : elementCount,
  );
  const seen = new Set<number>();
  let visited = 0;

  for (let offset = rangeStart; offset < rangeEnd; offset += 1) {
    const vertexIndex = index ? index.getX?.(offset) : offset;
    if (!Number.isInteger(vertexIndex) || vertexIndex! < 0 || vertexIndex! >= positions.count) continue;
    if (seen.has(vertexIndex!)) continue;
    seen.add(vertexIndex!);
    visit(vertexIndex!);
    visited += 1;
  }

  return visited;
}

export interface AvatarSceneBoundsResult {
  bounds: AvatarBounds;
  excludedEnvironmentMeshes: string[];
  includedVertexCount: number;
}

/**
 * Hide environment-only mesh helpers and calculate a world-space bounding box
 * from the actual rendered surface. For SkinnedMesh/Mesh nodes,
 * getVertexPosition() includes active morph targets and bone deformation.
 */
export function resolveAvatarSceneBounds(root: AvatarSceneRoot): AvatarSceneBoundsResult {
  root.updateWorldMatrix(true, true);
  const bounds = createEmptyBounds();
  const point = new Vector3();
  const excludedEnvironmentMeshes: string[] = [];
  let includedVertexCount = 0;

  root.traverse((node) => {
    if (isAvatarEnvironmentMesh(node)) {
      node.visible = false;
      excludedEnvironmentMeshes.push(node.name.trim() || "(unnamed environment mesh)");
      return;
    }
    if (node.isMesh !== true || !isEffectivelyVisible(node) || !node.matrixWorld) return;

    includedVertexCount += forEachAvatarRenderedVertexIndex(node, (vertexIndex) => {
      if (typeof node.getVertexPosition === "function") {
        node.getVertexPosition(vertexIndex, point);
      } else {
        const position = node.geometry?.attributes?.position;
        if (position) point.set(0, 0, 0).fromBufferAttribute(position as any, vertexIndex);
      }
      point.applyMatrix4(node.matrixWorld as any);
      bounds.expandByPoint(point);
    });
  });

  return { bounds, excludedEnvironmentMeshes, includedVertexCount };
}


/** Character framing bounds; the implementation is intentionally pending the outlier contract. */
export function resolveAvatarFramingBounds(root: AvatarSceneRoot) {
  const scene = resolveAvatarSceneBounds(root);
  return {
    bounds: scene.bounds,
    includedVertexCount: scene.includedVertexCount,
    excludedOutlierMeshes: [] as Array<{ name: string; vertexCount: number; extentRatio: number }>,
  };
}
