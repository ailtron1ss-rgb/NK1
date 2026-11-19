import test from "node:test";
import assert from "node:assert/strict";
import { fingerprintAvatarModel } from "../src/components/avatar/avatarModelFingerprint.ts";

test("fingerprints exact model bytes deterministically with a SHA-256 content address", async () => {
  const bytes = new TextEncoder().encode("nk1-avatar-fixture");
  const first = await fingerprintAvatarModel(bytes);
  const second = await fingerprintAvatarModel(bytes.slice());
  assert.match(first ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test("different model bytes produce different fingerprints", async () => {
  const first = await fingerprintAvatarModel(new TextEncoder().encode("avatar-a"));
  const second = await fingerprintAvatarModel(new TextEncoder().encode("avatar-b"));
  assert.ok(first && second);
  assert.notEqual(first, second);
});

test("does not mutate caller-owned input bytes", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const before = Array.from(bytes);
  await fingerprintAvatarModel(bytes);
  assert.deepEqual(Array.from(bytes), before);
});
