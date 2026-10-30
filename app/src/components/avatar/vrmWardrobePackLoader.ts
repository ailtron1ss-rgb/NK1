import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  prepareVerifiedWardrobeSwitch,
  isWardrobeRendererAcknowledgementComplete,
  type VerifiedWardrobeSwitchInput,
} from "./wardrobeRuntime.ts";
import { attachVerifiedVrmGarment, inspectVrmGarmentRig } from "./vrmWardrobeAdapter.ts";
import type { WardrobePackAsset } from "./wardrobePack.ts";

type AvatarRoot = Parameters<typeof attachVerifiedVrmGarment>[0]["avatarRoot"];
type ParsedScene = { scene?: AvatarRoot; animations?: unknown[] };
type GlbParser = (bytes: ArrayBuffer) => Promise<ParsedScene>;

export interface VrmWardrobePackApplyInput extends VerifiedWardrobeSwitchInput {
  avatarRoot: AvatarRoot;
  parseGlb?: GlbParser;
}
export interface VrmWardrobePackApplyResult {
  committed: boolean;
  preparation: Awaited<ReturnType<typeof prepareVerifiedWardrobeSwitch>> | null;
  loadedAssetIds: string[];
  errors: string[];
}

/** Reject malformed GLB containers and any URI that could make GLTFLoader fetch external content. */
export function inspectSelfContainedGlb(input: ArrayBuffer | Uint8Array): { valid: boolean; errors: string[] } {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    return { valid: false, errors: ["glb:invalid-header"] };
  }
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
    return { valid: false, errors: ["glb:invalid-version-or-length"] };
  }
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a || jsonLength < 2 || 20 + jsonLength > bytes.byteLength) {
    return { valid: false, errors: ["glb:missing-json-chunk"] };
  }
  try {
    const jsonText = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).replace(/[\u0000\u0020]+$/u, "");
    const document = JSON.parse(jsonText) as { asset?: { version?: string }; buffers?: Array<{ uri?: string }>; images?: Array<{ uri?: string }> };
    if (document.asset?.version !== "2.0") return { valid: false, errors: ["glb:unsupported-asset-version"] };
    const external = [...(document.buffers ?? []), ...(document.images ?? [])]
      .some((entry) => typeof entry.uri === "string" && !entry.uri.startsWith("data:"));
    if (external) return { valid: false, errors: ["glb:external-resource-uri-rejected"] };
    return { valid: true, errors: [] };
  } catch {
    return { valid: false, errors: ["glb:invalid-json-chunk"] };
  }
}

const defaultParseGlb: GlbParser = (bytes) => new Promise((resolve, reject) => {
  new GLTFLoader().parse(bytes, "", (gltf) => resolve(gltf as unknown as ParsedScene), reject);
});

function asArrayBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input.slice(0);
  return input.slice().buffer as ArrayBuffer;
}

function collectSlotNodes(root: AvatarRoot): Array<{ node: any; visible: boolean | undefined; userData: Record<string, unknown> }> {
  const nodes: Array<{ node: any; visible: boolean | undefined; userData: Record<string, unknown> }> = [];
  const visit = (node: any) => {
    if (node.userData?.nk1WardrobeSlot) {
      nodes.push({ node, visible: node.visible, userData: { ...node.userData } });
    }
  };
  if (typeof (root as any).traverse === "function") (root as any).traverse(visit);
  else visit(root);
  return nodes;
}

/**
 * Production orchestration: verify all bytes, parse only self-contained GLBs,
 * preflight every rig, then attach the complete requested set. If any attach
 * fails, remove additions and restore every previous slot's visibility/metadata.
 */
export async function applyVerifiedVrmWardrobePack(input: VrmWardrobePackApplyInput): Promise<VrmWardrobePackApplyResult> {
  if (input.request.renderer !== "vrm3d") {
    return { committed: false, preparation: null, loadedAssetIds: [], errors: ["wardrobe:renderer-must-be-vrm3d"] };
  }
  const preparation = await prepareVerifiedWardrobeSwitch(input);
  if (!preparation.ready) {
    return { committed: false, preparation, loadedAssetIds: [], errors: preparation.errors };
  }
  const assets = new Map(input.manifest.assets.map((asset) => [asset.id, asset]));
  const parse = input.parseGlb ?? defaultParseGlb;
  const prepared: Array<{ asset: WardrobePackAsset; scene: AvatarRoot }> = [];
  const errors: string[] = [];

  for (const assetId of preparation.plan.expectedAssetIds) {
    const asset = assets.get(assetId);
    if (!asset || asset.renderer !== "vrm3d" || asset.mime !== "model/gltf-binary" || !asset.path.toLowerCase().endsWith(".glb")) {
      errors.push(`wardrobe:unsupported-vrm-asset:${assetId}`);
      break;
    }
    const bytes = input.files.get(asset.path);
    if (!bytes) {
      errors.push(`wardrobe:missing-verified-bytes:${assetId}`);
      break;
    }
    const glbCheck = inspectSelfContainedGlb(bytes);
    if (!glbCheck.valid) {
      errors.push(...glbCheck.errors.map((error) => `${assetId}:${error}`));
      break;
    }
    try {
      const gltf = await parse(asArrayBuffer(bytes));
      if (!gltf.scene) throw new Error("glb:scene-missing");
      const rig = inspectVrmGarmentRig(gltf.scene, input.avatarRoot);
      if (!rig.compatible) throw new Error(rig.errors.join(","));
      prepared.push({ asset, scene: gltf.scene });
    } catch (error) {
      errors.push(`${assetId}:${error instanceof Error ? error.message : "glb:parse-failed"}`);
      break;
    }
  }
  if (errors.length || prepared.length !== preparation.plan.expectedAssetIds.length) {
    return { committed: false, preparation, loadedAssetIds: [], errors: errors.length ? errors : ["wardrobe:incomplete-preparation"] };
  }

  const previous = collectSlotNodes(input.avatarRoot);
  const added: AvatarRoot[] = [];
  for (const { asset, scene } of prepared) {
    const result = attachVerifiedVrmGarment({
      garmentRoot: scene,
      avatarRoot: input.avatarRoot,
      slot: asset.slot,
      assetId: asset.id,
      plan: preparation.plan,
    });
    if (!result.applied || !result.garmentRoot) {
      errors.push(...result.errors);
      break;
    }
    added.push(result.garmentRoot);
  }

  if (errors.length || added.length !== prepared.length) {
    for (const node of added) (input.avatarRoot as any).remove?.(node);
    for (const snapshot of previous) {
      snapshot.node.visible = snapshot.visible;
      snapshot.node.userData = { ...snapshot.userData };
    }
    return { committed: false, preparation, loadedAssetIds: [], errors: errors.length ? errors : ["wardrobe:attachment-incomplete"] };
  }

  const loadedAssetIds = prepared.map(({ asset }) => asset.id);
  const acknowledged = isWardrobeRendererAcknowledgementComplete(preparation.plan, {
    requestId: preparation.plan.requestId,
    success: true,
    loadedAssetIds,
  });
  if (!acknowledged) {
    for (const node of added) (input.avatarRoot as any).remove?.(node);
    for (const snapshot of previous) {
      snapshot.node.visible = snapshot.visible;
      snapshot.node.userData = { ...snapshot.userData };
    }
    return { committed: false, preparation, loadedAssetIds: [], errors: ["wardrobe:renderer-acknowledgement-rejected"] };
  }
  return { committed: true, preparation, loadedAssetIds, errors: [] };
}
