/** Compute a content-addressed fingerprint of the exact uploaded VRM/GLB bytes. */
export async function fingerprintAvatarModel(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const copy = new Uint8Array(view.byteLength);
    copy.set(view);
    const digest = await subtle.digest("SHA-256", copy.buffer);
    const hex = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
    return `sha256:${hex}`;
  } catch {
    return null;
  }
}
