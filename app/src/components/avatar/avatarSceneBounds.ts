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
  isBone?: boolean;
  visible?: boolean;
  userData?: Record<string, unknown>;
  parent?: AvatarSceneMesh | null;
  geometry?: AvatarSceneGeometry;
  matrixWorld?: unknown;
  getVertexPosition?: (index: number, target: any) => void;
  getWorldPosition?: (target: any) => any;
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


export interface AvatarFramingOutlierMesh {
  name: string;
  vertexCount: number;
  extentRatio: number;
  size: { x: number; y: number; z: number };
}

export interface AvatarFramingBoundsResult {
  bounds: AvatarBounds;
  includedVertexCount: number;
  totalVertexCount: number;
  skeletonReferenceHeight: number | null;
  excludedOutlierMeshes: AvatarFramingOutlierMesh[];
}

const MAX_SKELETON_OUTLIER_EXTENT_RATIO = 2.5;
const MAX_SKELETON_OUTLIER_VERTEX_FRACTION = 0.05;

/**
 * Compute camera/normalization bounds while protecting the avatar from a tiny
 * malformed mesh that spans many times the humanoid skeleton height.
 *
 * The source scene bounds remain untouched and should still be kept for asset
 * diagnostics. This function excludes only the outlier's influence on framing;
 * it never hides, deletes or rewrites the source mesh.
 */
export function resolveAvatarFramingBounds(root: AvatarSceneRoot): AvatarFramingBoundsResult {
  root.updateWorldMatrix(true, true);

  const skeletonBounds = createEmptyBounds();
  const bonePosition = new Vector3();
  let boneCount = 0;
  root.traverse((node) => {
    if (node.isBone !== true || typeof node.getWorldPosition !== "function") return;
    node.getWorldPosition(bonePosition);
    if (![bonePosition.x, bonePosition.y, bonePosition.z].every(Number.isFinite)) return;
    skeletonBounds.expandByPoint(bonePosition);
    boneCount += 1;
  });
  const skeletonSize = skeletonBounds.getSize(new Vector3());
  const skeletonReferenceHeight = boneCount >= 2 && Number.isFinite(skeletonSize.y) && skeletonSize.y > 0.05
    ? skeletonSize.y
    : null;

  const candidates: Array<{
    name: string;
    bounds: AvatarBounds;
    vertexCount: number;
    size: { x: number; y: number; z: number };
    maxExtent: number;
  }> = [];
  let totalVertexCount = 0;
  root.traverse((node) => {
    if (isAvatarEnvironmentMesh(node)
      || node.isMesh !== true
      || !isEffectivelyVisible(node)
      || !node.matrixWorld) return;

    const meshBounds = createEmptyBounds();
    const point = new Vector3();
    const vertexCount = forEachAvatarRenderedVertexIndex(node, (vertexIndex) => {
      if (typeof node.getVertexPosition === "function") {
        node.getVertexPosition(vertexIndex, point);
      } else {
        const position = node.geometry?.attributes?.position as any;
        if (position) point.fromBufferAttribute(position, vertexIndex);
      }
      point.applyMatrix4(node.matrixWorld as any);
      if ([point.x, point.y, point.z].every(Number.isFinite)) meshBounds.expandByPoint(point);
    });
    if (vertexCount <= 0 || meshBounds.isEmpty()) return;

    totalVertexCount += vertexCount;
    const size = meshBounds.getSize(new Vector3());
    candidates.push({
      name: node.name.trim() || "(unnamed mesh)",
      bounds: meshBounds,
      vertexCount,
      size: { x: size.x, y: size.y, z: size.z },
      maxExtent: Math.max(size.x, size.y, size.z),
    });
  });

  const excludedOutlierMeshes: AvatarFramingOutlierMesh[] = [];
  const bounds = createEmptyBounds();
  let includedVertexCount = 0;
  for (const candidate of candidates) {
    const extentRatio = skeletonReferenceHeight === null
      ? 0
      : candidate.maxExtent / skeletonReferenceHeight;
    const vertexFraction = totalVertexCount > 0
      ? candidate.vertexCount / totalVertexCount
      : 1;
    const isTinySkeletonOutlier = skeletonReferenceHeight !== null
      && extentRatio > MAX_SKELETON_OUTLIER_EXTENT_RATIO
      && vertexFraction <= MAX_SKELETON_OUTLIER_VERTEX_FRACTION;

    if (isTinySkeletonOutlier) {
      excludedOutlierMeshes.push({
        name: candidate.name,
        vertexCount: candidate.vertexCount,
        extentRatio,
        size: candidate.size,
      });
      continue;
    }

    bounds.union(candidate.bounds);
    includedVertexCount += candidate.vertexCount;
  }

  // Fail safe: never return an empty framing box solely because every mesh was
  // classified as an outlier. In that case retain the complete visible scene.
  if (bounds.isEmpty()) {
    for (const candidate of candidates) bounds.union(candidate.bounds);
    includedVertexCount = totalVertexCount;
    excludedOutlierMeshes.length = 0;
  }

  return {
    bounds,
    includedVertexCount,
    totalVertexCount,
    skeletonReferenceHeight,
    excludedOutlierMeshes,
  };
}
