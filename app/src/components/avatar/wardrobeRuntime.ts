import {
  createWardrobeSwitchPlan,
  verifyWardrobePackPayload,
  type WardrobePackManifest,
  type WardrobePackPayloadVerification,
  type WardrobeSwitchPlan,
  type WardrobeSwitchRequest,
} from "./wardrobePack.ts";
import type { WardrobeRenderer } from "./wardrobeSystem.ts";

export interface VerifiedWardrobeSwitchInput {
  manifest: WardrobePackManifest;
  files: ReadonlyMap<string, ArrayBuffer | Uint8Array>;
  request: Omit<WardrobeSwitchRequest, "packBodyId" | "packRigVersion" | "packValidated">;
  cryptoProvider?: Pick<Crypto, "subtle">;
}

export interface VerifiedWardrobeSwitchPreparation {
  ready: boolean;
  verification: WardrobePackPayloadVerification;
  plan: WardrobeSwitchPlan;
  errors: string[];
}

/**
 * Runtime boundary for wardrobe activation.
 *
 * Consumers cannot assert packValidated themselves here: the manifest and every
 * supplied byte payload are checked first, then renderer-specific asset IDs are
 * matched against that verified manifest before a switch plan can become ready.
 * License/provenance review remains a separate policy gate.
 */
export async function prepareVerifiedWardrobeSwitch(
  input: VerifiedWardrobeSwitchInput,
): Promise<VerifiedWardrobeSwitchPreparation> {
  const { manifest, request } = input;
  const verification = await verifyWardrobePackPayload(
    manifest,
    input.files,
    input.cryptoProvider,
  );
  const errors: string[] = [];
  const rendererAssets = new Set(
    manifest?.assets
      ?.filter((asset) => asset.renderer === request.renderer)
      .map((asset) => asset.id) ?? [],
  );
  const verified = new Set(verification.verifiedAssetIds);

  if (!verification.valid) errors.push(`switch:payload-${verification.reason}`);
  for (const id of request.expectedAssetIds ?? []) {
    if (!rendererAssets.has(id)) errors.push(`switch:asset-not-in-renderer-manifest:${id}`);
    else if (!verified.has(id)) errors.push(`switch:asset-not-byte-verified:${id}`);
  }

  const plan = createWardrobeSwitchPlan({
    ...request,
    packBodyId: manifest?.targetBodyId ?? "",
    packRigVersion: manifest?.targetRigVersion ?? "",
    packValidated: verification.valid && errors.length === 0,
  });
  errors.push(...plan.errors);
  return {
    ready: plan.status === "ready" && errors.length === 0,
    verification,
    plan: errors.length
      ? { ...plan, status: "blocked", errors: [...new Set([...plan.errors, ...errors])] }
      : plan,
    errors: [...new Set(errors)],
  };
}

/** Renderer acknowledgement remains the only operation that commits the outfit. */
export function isWardrobeRendererAcknowledgementComplete(
  plan: WardrobeSwitchPlan,
  acknowledgement: { requestId: string; success: boolean; loadedAssetIds: string[] },
): boolean {
  if (plan.status !== "ready" || !acknowledgement.success || acknowledgement.requestId !== plan.requestId) return false;
  const loadedAssetIds = acknowledgement.loadedAssetIds ?? [];
  if (loadedAssetIds.length !== plan.expectedAssetIds.length) return false;
  const loaded = new Set(loadedAssetIds);
  return loaded.size === plan.expectedAssetIds.length &&
    plan.expectedAssetIds.every((id) => loaded.has(id));
}
