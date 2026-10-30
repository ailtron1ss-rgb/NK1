import assert from "node:assert/strict";
import test from "node:test";
import {
  selectActionMotionClip,
  selectAvatarMotionClip,
  selectIdleMotionClip,
} from "../src/components/avatar/avatarMotionClipSelector.ts";

const clip = (name) => ({ name });

test("prefers an action-specific VRMA clip over the embedded model clip", () => {
  const vrma = clip("Kurisu_respond");
  const embedded = clip("embedded_talk");
  assert.equal(selectAvatarMotionClip({
    action: "respond",
    vrmaClips: [vrma],
    modelClips: [embedded],
  }), vrma);
});

test("an unrelated VRMA idle does not mask a matching embedded action clip", () => {
  const idleSidecar = clip("motion_idle");
  const embeddedRespond = clip("embedded_respond");
  assert.equal(selectActionMotionClip([idleSidecar], "respond"), null);
  assert.equal(selectAvatarMotionClip({
    action: "respond",
    vrmaClips: [idleSidecar],
    modelClips: [embeddedRespond],
  }), embeddedRespond);
});

test("action-specific embedded clip wins before a sidecar default fallback", () => {
  const defaultSidecar = clip("generic_motion");
  const embeddedVerify = clip("embedded_inspect");
  assert.equal(selectAvatarMotionClip({
    action: "verify",
    vrmaClips: [],
    modelClips: [embeddedVerify],
    vrmaDefaultClip: defaultSidecar,
  }), embeddedVerify);
});

test("explicit VRMA default is used only after both sources fail semantic action matching", () => {
  const defaultSidecar = clip("generic_motion");
  const idleEmbedded = clip("embedded_idle");
  assert.equal(selectAvatarMotionClip({
    action: "respond",
    vrmaClips: [clip("walk_cycle")],
    modelClips: [idleEmbedded],
    vrmaDefaultClip: defaultSidecar,
  }), defaultSidecar);
});

test("idle fallback is considered after semantic matches and explicit default are absent", () => {
  const sidecarIdle = clip("kurisu_idle_breath");
  const modelIdle = clip("model_idle");
  assert.equal(selectAvatarMotionClip({
    action: "respond",
    vrmaClips: [sidecarIdle],
    modelClips: [modelIdle],
  }), sidecarIdle);
  assert.equal(selectIdleMotionClip([clip("nonmatching"), modelIdle]), modelIdle);
});

test("recognizes canonical organism action names as explicit motion tags", () => {
  assert.equal(selectActionMotionClip([clip("respond")], "respond")?.name, "respond");
  assert.equal(selectActionMotionClip([clip("explore")], "explore")?.name, "explore");
  assert.equal(selectActionMotionClip([clip("verify")], "verify")?.name, "verify");
  assert.equal(selectActionMotionClip([clip("reflect")], "reflect")?.name, "reflect");
  assert.equal(selectActionMotionClip([clip("wait")], "wait")?.name, "wait");
  assert.equal(selectActionMotionClip([clip("rest")], "rest")?.name, "rest");
});

test("returns null when no action, default, or idle clip exists", () => {
  assert.equal(selectAvatarMotionClip({
    action: "explore",
    vrmaClips: [clip("smile_expression")],
    modelClips: [clip("face_happy")],
  }), null);
});
