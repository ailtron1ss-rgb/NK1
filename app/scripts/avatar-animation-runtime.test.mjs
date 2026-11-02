import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAvatarAnimationFrame,
  resolveAvatarAnimationClip,
} from "../src/components/avatar/avatarAnimationRuntime.ts";

const v7Clips = [
  { name: "idle_breathing" },
  { name: "talk_gesture" },
  { name: "thinking_pose" },
  { name: "explore_turn" },
];

function actionSpy(name) {
  return {
    name,
    calls: [],
    reset() { this.calls.push(["reset"]); return this; },
    play() { this.calls.push(["play"]); return this; },
    fadeIn(seconds) { this.calls.push(["fadeIn", seconds]); return this; },
    crossFadeTo(next, seconds, warp) { this.calls.push(["crossFadeTo", next.name, seconds, warp]); return this; },
    setEffectiveTimeScale(scale) { this.calls.push(["timeScale", scale]); return this; },
    setEffectiveWeight(weight) { this.calls.push(["weight", weight]); return this; },
  };
}

function mixerSpy() {
  return {
    created: [],
    clipAction(clip) {
      const next = actionSpy(clip.name);
      this.created.push(next);
      return next;
    },
  };
}

test("maps every NK1 action to the verified v7 clip without inventing aliases", () => {
  const expected = new Map([
    ["respond", "talk_gesture"],
    ["explore", "explore_turn"],
    ["verify", "thinking_pose"],
    ["reflect", "thinking_pose"],
    ["rest", "idle_breathing"],
    ["wait", "idle_breathing"],
  ]);
  for (const [action, clipName] of expected) {
    const result = resolveAvatarAnimationClip(v7Clips, action);
    assert.equal(result.clipName, clipName, action);
    assert.equal(result.matchedBy, "preferred-name", action);
  }
});

test("preferred matching is case and separator insensitive", () => {
  const result = resolveAvatarAnimationClip([{ name: "Talk-Gesture" }], "respond");
  assert.equal(result.clipName, "Talk-Gesture");
  assert.equal(result.matchedBy, "preferred-name");
});

test("semantic fallback is selected only from a matching action family", () => {
  const result = resolveAvatarAnimationClip([{ name: "curious_explanation" }, { name: "idle_breathing" }], "respond");
  assert.equal(result.clipName, "curious_explanation");
  assert.equal(result.matchedBy, "semantic-name");
});

test("unknown actions use a deterministic idle fallback, never the first arbitrary clip", () => {
  const clips = [{ name: "angry_attack" }, { name: "idle_breathing" }];
  const result = resolveAvatarAnimationClip(clips, "unknown-action");
  assert.equal(result.clipName, "idle_breathing");
  assert.equal(result.matchedBy, "idle-fallback");
});

test("no compatible clip is reported without replacing the currently active action", () => {
  const previous = actionSpy("previous");
  const result = applyAvatarAnimationFrame({
    mixer: mixerSpy(),
    clips: [{ name: "angry_attack" }],
    action: "respond",
    previousAction: previous,
    previousClipName: "previous",
    awake: true,
    energy: 0.8,
  });
  assert.equal(result.changed, false);
  assert.equal(result.activeAction, previous);
  assert.equal(result.clipName, "previous");
  assert.equal(result.resolved.matchedBy, "none");
});

test("first clip fades in and starts once", () => {
  const mixer = mixerSpy();
  const result = applyAvatarAnimationFrame({
    mixer,
    clips: v7Clips,
    action: "rest",
    previousAction: null,
    previousClipName: "",
    awake: true,
    energy: 0.5,
  });
  assert.equal(result.changed, true);
  assert.equal(result.clipName, "idle_breathing");
  assert.ok(result.activeAction.calls.some((call) => call[0] === "fadeIn"));
  assert.deepEqual(result.activeAction.calls.filter((call) => call[0] === "play"), [["play"]]);
});

test("semantic action change cross-fades from the previous clip rather than stopping the mixer", () => {
  const mixer = mixerSpy();
  const previous = actionSpy("idle_breathing");
  const result = applyAvatarAnimationFrame({
    mixer,
    clips: v7Clips,
    action: "respond",
    previousAction: previous,
    previousClipName: "idle_breathing",
    awake: true,
    energy: 0.7,
  });
  assert.equal(result.changed, true);
  assert.equal(result.clipName, "talk_gesture");
  assert.ok(previous.calls.some((call) => call[0] === "crossFadeTo" && call[1] === "talk_gesture"));
  assert.ok(result.activeAction.calls.some((call) => call[0] === "play"));
});

test("repeated ticks for one clip preserve its phase and only update time scale", () => {
  const mixer = mixerSpy();
  const current = actionSpy("idle_breathing");
  const result = applyAvatarAnimationFrame({
    mixer,
    clips: v7Clips,
    action: "rest",
    previousAction: current,
    previousClipName: "idle_breathing",
    awake: true,
    energy: 1,
  });
  assert.equal(result.changed, false);
  assert.equal(result.activeAction, current);
  assert.equal(mixer.created.length, 0);
  assert.ok(current.calls.some((call) => call[0] === "timeScale" && call[1] > 1));
  assert.equal(current.calls.some((call) => call[0] === "reset"), false);
});

test("sleep forces idle and lowers animation speed even when the last action was response", () => {
  const mixer = mixerSpy();
  const result = applyAvatarAnimationFrame({
    mixer,
    clips: v7Clips,
    action: "respond",
    previousAction: null,
    previousClipName: "",
    awake: false,
    energy: 1,
  });
  assert.equal(result.clipName, "idle_breathing");
  assert.ok(result.timeScale < 0.5);
  assert.equal(result.resolved.requestedAction, "rest");
});

test("fade duration is bounded for hostile or accidental caller values", () => {
  const mixer = mixerSpy();
  const tooLong = applyAvatarAnimationFrame({
    mixer,
    clips: v7Clips,
    action: "respond",
    previousAction: null,
    previousClipName: "",
    awake: true,
    energy: 0.5,
    fadeSeconds: 5,
  });
  assert.ok(tooLong.activeAction.calls.some((call) => call[0] === "fadeIn" && call[1] === 0.8));
});
