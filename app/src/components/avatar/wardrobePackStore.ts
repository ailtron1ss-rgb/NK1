import {
  validateWardrobePackManifest,
  verifyWardrobePackPayload,
  type WardrobePackManifest,
} from "./wardrobePack.ts";
import type { WardrobeRenderer } from "./wardrobeSystem.ts";

export const MAX_STORED_WARDROBE_BYTES = 128 * 1024 * 1024;
const DATABASE = "nk1-wardrobe-pack-store";
const DATABASE_VERSION = 1;
const OBJECT_STORE = "verified-packs";

export interface StoredWardrobePack {
  bodyId: string;
  rigVersion: string;
  manifest: WardrobePackManifest;
  files: Map<string, Uint8Array>;
  selectedAssetIds: string[];
  rightsAttestedAt: number;
  savedAt: number;
}

interface StoredWardrobeRecord {
  schemaVersion: 1;
  key: string;
  bodyId: string;
  rigVersion: string;
  manifest: WardrobePackManifest;
  assets: Array<{ path: string; bytes: Uint8Array }>;
  selectedAssetIds: string[];
  rightsAttestedAt: number;
  savedAt: number;
}

export type StoredWardrobeLoadResult =
  | { status: "missing" }
  | { status: "restored"; value: StoredWardrobePack }
  | { status: "incompatible"; reason: string }
  | { status: "invalid"; reason: string };

export function wardrobeStorageKey(bodyId: string, rigVersion: string): string {
  if (!bodyId || !rigVersion || bodyId.length > 160 || rigVersion.length > 100) {
    throw new Error("wardrobe:invalid-storage-identity");
  }
  return `${bodyId}::${rigVersion}`;
}

/** Selected items must be real, unique VRM assets with at most one item per slot. */
export function validateStoredWardrobeSelection(
  manifest: WardrobePackManifest,
  selectedAssetIds: readonly string[],
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(selectedAssetIds) || selectedAssetIds.length === 0) {
    return ["wardrobe:stored-selection-empty"];
  }
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const ids = new Set<string>();
  const slots = new Set<string>();
  for (const id of selectedAssetIds) {
    if (typeof id !== "string" || !id) {
      errors.push("wardrobe:stored-selection-invalid-id");
      continue;
    }
    if (ids.has(id)) {
      errors.push(`wardrobe:stored-selection-duplicate-id:${id}`);
      continue;
    }
    ids.add(id);
    const asset = assets.get(id);
    if (!asset) {
      errors.push(`wardrobe:stored-selection-unknown-asset:${id}`);
      continue;
    }
    if (asset.renderer !== "vrm3d") {
      errors.push(`wardrobe:stored-selection-wrong-renderer:${id}`);
      continue;
    }
    if (slots.has(asset.slot)) errors.push(`wardrobe:stored-selection-duplicate-slot:${asset.slot}`);
    slots.add(asset.slot);
  }
  return [...new Set(errors)];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("wardrobe:indexeddb-unavailable"));
      return;
    }
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
        request.result.createObjectStore(OBJECT_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("wardrobe:storage-open-failed"));
    request.onblocked = () => reject(new Error("wardrobe:storage-upgrade-blocked"));
  });
}

async function readRecord(key: string): Promise<StoredWardrobeRecord | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(OBJECT_STORE, "readonly").objectStore(OBJECT_STORE).get(key);
      request.onsuccess = () => resolve((request.result as StoredWardrobeRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("wardrobe:storage-read-failed"));
    });
  } finally {
    db.close();
  }
}

async function writeRecord(record: StoredWardrobeRecord): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(OBJECT_STORE, "readwrite");
      transaction.objectStore(OBJECT_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("wardrobe:storage-write-failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("wardrobe:storage-write-aborted"));
    });
  } finally {
    db.close();
  }
}

export async function saveStoredWardrobePack(input: {
  bodyId: string;
  rigVersion: string;
  manifest: WardrobePackManifest;
  files: ReadonlyMap<string, ArrayBuffer | Uint8Array>;
  selectedAssetIds: readonly string[];
  rightsAttested: boolean;
  now?: number;
  cryptoProvider?: Pick<Crypto, "subtle">;
}): Promise<{ saved: true; storageKey: string; totalBytes: number }> {
  const key = wardrobeStorageKey(input.bodyId, input.rigVersion);
  if (!input.rightsAttested) throw new Error("wardrobe:rights-self-attestation-required");
  if (input.manifest.targetBodyId !== input.bodyId) throw new Error("wardrobe:storage-body-mismatch");
  if (input.manifest.targetRigVersion !== input.rigVersion) throw new Error("wardrobe:storage-rig-mismatch");
  const manifestCheck = validateWardrobePackManifest(input.manifest);
  if (!manifestCheck.valid) throw new Error(`wardrobe:manifest-invalid:${manifestCheck.errors.slice(0, 5).join(",")}`);
  if (manifestCheck.totalBytes > MAX_STORED_WARDROBE_BYTES) throw new Error("wardrobe:storage-pack-size-limit");
  const selectionErrors = validateStoredWardrobeSelection(input.manifest, input.selectedAssetIds);
  if (selectionErrors.length) throw new Error(selectionErrors.join(","));
  const verification = await verifyWardrobePackPayload(input.manifest, input.files, input.cryptoProvider);
  if (!verification.valid) throw new Error(`wardrobe:storage-payload-${verification.reason}`);
  const files = input.manifest.assets.map((asset) => {
    const source = input.files.get(asset.path)!;
    const bytes = source instanceof Uint8Array ? source.slice() : new Uint8Array(source.slice(0));
    return { path: asset.path, bytes };
  });
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  if (now <= 0) throw new Error("wardrobe:invalid-storage-timestamp");
  await writeRecord({
    schemaVersion: 1,
    key,
    bodyId: input.bodyId,
    rigVersion: input.rigVersion,
    manifest: input.manifest,
    assets: files,
    selectedAssetIds: [...input.selectedAssetIds],
    rightsAttestedAt: now,
    savedAt: now,
  });
  return { saved: true, storageKey: key, totalBytes: manifestCheck.totalBytes };
}

/** Restore only for an exact body/rig match, then re-verify all stored bytes. */
export async function loadStoredWardrobePack(
  bodyId: string,
  rigVersion: string,
  cryptoProvider?: Pick<Crypto, "subtle">,
): Promise<StoredWardrobeLoadResult> {
  let key: string;
  try {
    key = wardrobeStorageKey(bodyId, rigVersion);
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "wardrobe:invalid-storage-identity" };
  }
  let record: StoredWardrobeRecord | null;
  try {
    record = await readRecord(key);
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "wardrobe:storage-read-failed" };
  }
  if (!record) return { status: "missing" };
  if (record.schemaVersion !== 1 || record.key !== key) return { status: "invalid", reason: "wardrobe:stored-schema-invalid" };
  if (record.bodyId !== bodyId || record.rigVersion !== rigVersion) {
    return { status: "incompatible", reason: "wardrobe:stored-body-or-rig-mismatch" };
  }
  if (record.manifest?.targetBodyId !== bodyId || record.manifest?.targetRigVersion !== rigVersion) {
    return { status: "incompatible", reason: "wardrobe:stored-manifest-target-mismatch" };
  }
  if (!Number.isFinite(record.rightsAttestedAt) || record.rightsAttestedAt <= 0 || !Number.isFinite(record.savedAt) || record.savedAt <= 0) {
    return { status: "invalid", reason: "wardrobe:stored-attestation-or-time-invalid" };
  }
  const files = new Map<string, Uint8Array>();
  if (!Array.isArray(record.assets)) return { status: "invalid", reason: "wardrobe:stored-assets-invalid" };
  for (const entry of record.assets) {
    if (!entry || typeof entry.path !== "string" || !(entry.bytes instanceof Uint8Array) || files.has(entry.path)) {
      return { status: "invalid", reason: "wardrobe:stored-asset-record-invalid" };
    }
    files.set(entry.path, entry.bytes);
  }
  const manifestCheck = validateWardrobePackManifest(record.manifest);
  if (!manifestCheck.valid || manifestCheck.totalBytes > MAX_STORED_WARDROBE_BYTES) {
    return { status: "invalid", reason: "wardrobe:stored-manifest-invalid" };
  }
  const selectionErrors = validateStoredWardrobeSelection(record.manifest, record.selectedAssetIds);
  if (selectionErrors.length) return { status: "invalid", reason: selectionErrors.join(",") };
  const verification = await verifyWardrobePackPayload(record.manifest, files, cryptoProvider);
  if (!verification.valid) return { status: "invalid", reason: `wardrobe:stored-payload-${verification.reason}` };
  return {
    status: "restored",
    value: {
      bodyId,
      rigVersion,
      manifest: record.manifest,
      files,
      selectedAssetIds: [...record.selectedAssetIds],
      rightsAttestedAt: record.rightsAttestedAt,
      savedAt: record.savedAt,
    },
  };
}

export async function deleteStoredWardrobePack(bodyId: string, rigVersion: string): Promise<void> {
  const key = wardrobeStorageKey(bodyId, rigVersion);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(OBJECT_STORE, "readwrite");
      transaction.objectStore(OBJECT_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("wardrobe:storage-delete-failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("wardrobe:storage-delete-aborted"));
    });
  } finally {
    db.close();
  }
}
