import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import {
  buildVisemeTimeline,
  CLOSED_MOUTH,
  deriveEmbodimentPose,
  isEmbodimentIntentV1,
  appendVisemeClockAnchor,
  reanchorMonotonicAudioClock,
  sampleMonotonicAudioClock,
  sampleVisemeClock,
  sampleVisemeTimeline,
  timelineOffsetForCharIndex,
} from "../src/components/avatar/embodimentTimeline.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function intent(overrides = {}) {
  return {
    type: "kurisu_embodiment_intent",
    protocolVersion: 1,
    stateVersion: 1,
    sentAtEpochMs: 1_700_000_000_000,
    speechEventId: "speech-1",
    audioClockId: "clock-1",
    speechPhase: "speaking",
    audioTimeMs: 100,
    clockSource: "speech-synthesis-boundary-anchored-monotonic",
    priority: 70,
    cancellationToken: "cancel:speech-1",
    expression: "thinking",
    expressionIntensity: 0.5,
    mouth: { open: 0.3, form: 0.2, viseme: "wide" },
    gaze: { x: 0.1, y: -0.1, driven: true },
    body: { headTilt: 0.02, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 17 },
    voiceEmphasis: 0.3,
    ...overrides,
  };
}

test("builds grapheme-level viseme frames with UTF-16 offsets for SpeechSynthesis boundary events", () => {
  const text = "Курису 🙂 говорит!";
  const timeline = buildVisemeTimeline(text, 0.96, "ru-RU");
  assert.equal(timeline.length, Array.from(new Intl.Segmenter("ru-RU", { granularity: "grapheme" }).segment(text)).length);
  assert.equal(timeline[0].charIndex, 0);
  const emojiIndex = text.indexOf("🙂");
  const afterEmoji = timeline.find((frame) => frame.charIndex > emojiIndex);
  assert.ok(afterEmoji);
  assert.ok(afterEmoji.charIndex >= emojiIndex + "🙂".length, "character indices must follow DOM's UTF-16 offsets");
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(timeline[i].startMs >= timeline[i - 1].endMs - 0.001, "frames must be time ordered");
    assert.ok(timeline[i].charIndex > timeline[i - 1].charIndex, "character offsets must be ordered");
  }
  assert.ok(timeline.at(-1).endMs > 500, "non-empty phrases need a useful playback timeline");
});

test("combining marks, flags and joined emoji stay in one grapheme frame with UTF-16 boundary offsets", () => {
  const text = "a\u0308 🇳🇱 👩‍🔬";
  const timeline = buildVisemeTimeline(text, 1, "en-US");
  const expected = Array.from(new Intl.Segmenter("en-US", { granularity: "grapheme" }).segment(text));
  assert.equal(timeline.length, expected.length);
  assert.deepEqual(timeline.map((frame) => frame.charIndex), expected.map((part) => part.index));
  assert.equal(timeline[0].charIndex, 0);
  const flagIndex = text.indexOf("🇳🇱");
  const joinedEmojiIndex = text.indexOf("👩‍🔬");
  assert.equal(timeline.find((frame) => frame.charIndex === flagIndex)?.charIndex, flagIndex);
  assert.equal(timeline.find((frame) => frame.charIndex === joinedEmojiIndex)?.charIndex, joinedEmojiIndex);
  assert.equal(timeline.filter((frame) => frame.charIndex >= joinedEmojiIndex && frame.charIndex < joinedEmojiIndex + "👩‍🔬".length).length, 1);
  const base = timelineOffsetForCharIndex(timeline, 1);
  assert.equal(base, timeline[0].startMs, "an offset inside a combining grapheme maps to its own frame");
});

test("line breaks and tabs preserve original UTF-16 offsets for speech boundary events", () => {
  const text = "first\r\n\tsecond";
  const timeline = buildVisemeTimeline(text, 1, "en-US");
  const expected = Array.from(new Intl.Segmenter("en-US", { granularity: "grapheme" }).segment(text.replace(/[\r\n\t]/gu, " ")));
  assert.equal(timeline.length, expected.length);
  assert.deepEqual(timeline.map((frame) => frame.charIndex), expected.map((part) => part.index));
  assert.equal(timeline.find((frame) => frame.charIndex === text.indexOf("second"))?.charIndex, text.indexOf("second"));
});

test("Russian and English graphemes map to distinct mouth shapes", () => {
  const ru = buildVisemeTimeline("мама фокус уют", 1, "ru-RU");
  const poses = new Set(ru.map((frame) => frame.pose.viseme));
  assert.ok(poses.has("closed"));
  assert.ok(poses.has("teeth"));
  assert.ok(poses.has("round"));
  assert.ok(poses.has("open"));
  const en = buildVisemeTimeline("move with you", 1, "en-US");
  assert.ok(en.some((frame) => frame.pose.viseme === "wide"));
  assert.ok(en.some((frame) => frame.pose.viseme === "round"));
});

test("actual character boundary recalibrates an estimate that ran too far ahead", () => {
  const timeline = buildVisemeTimeline("Первое слово, второе слово", 0.96, "ru-RU");
  const boundaryMs = timelineOffsetForCharIndex(timeline, 7);
  assert.ok(boundaryMs > 0);
  let anchors = [{ charIndex: 0, audioTimeMs: 0, timelineTimeMs: 0 }];
  anchors = appendVisemeClockAnchor(anchors, { charIndex: 7, audioTimeMs: 700, timelineTimeMs: boundaryMs });
  assert.equal(sampleVisemeClock(anchors, 700), boundaryMs, "the observed boundary, not the earlier estimate, anchors the current character");
  assert.ok(sampleVisemeClock(anchors, 760) >= boundaryMs, "future timeline samples advance from the boundary anchor");
  assert.equal(timelineOffsetForCharIndex(timeline, 99_999), timeline.at(-1).endMs);
});

test("one monotonic audio clock maps to visemes and rejects stale boundary anchors", () => {
  let anchors = [{ charIndex: 0, audioTimeMs: 0, timelineTimeMs: 0 }];
  anchors = appendVisemeClockAnchor(anchors, { charIndex: 4, audioTimeMs: 250, timelineTimeMs: 300 });
  const atBoundary = sampleVisemeClock(anchors, 250);
  assert.equal(atBoundary, 300);
  assert.ok(sampleVisemeClock(anchors, 300) >= atBoundary);
  const stale = appendVisemeClockAnchor(anchors, { charIndex: 2, audioTimeMs: 310, timelineTimeMs: 160 });
  assert.equal(stale, anchors, "out-of-order character events must not replace a newer observed boundary");
  const timeline = buildVisemeTimeline("а", 1, "ru-RU");
  assert.deepEqual(sampleVisemeTimeline(timeline, timeline.at(-1).endMs + 20), CLOSED_MOUTH);
});

test("a late SpeechSynthesis elapsedTime cannot rewind the published audio clock", () => {
  // The main clock was advanced by monotonic performance time to 700 ms. A later
  // boundary event reports only 520 ms; state must retain 700 and continue forward.
  const current = sampleMonotonicAudioClock(0, 300, 1000, 1400);
  assert.equal(current, 700);
  const anchored = reanchorMonotonicAudioClock(
    current, 300, 1000, 1400, 520,
  );
  assert.equal(anchored.highWaterMs, 700);
  assert.equal(anchored.anchorElapsedMs, 700);
  assert.equal(sampleMonotonicAudioClock(anchored.highWaterMs, anchored.anchorElapsedMs, anchored.anchorPerformanceAtMs, 1450), 750);
});

test("the intent envelope requires a speech identity and audio clock while speaking", () => {
  assert.equal(isEmbodimentIntentV1(intent()), true);
  assert.equal(isEmbodimentIntentV1(intent({ stateVersion: 0 })), false);
  assert.equal(isEmbodimentIntentV1(intent({ speechPhase: "speaking", speechEventId: null })), false);
  assert.equal(isEmbodimentIntentV1(intent({ audioTimeMs: Number.NaN })), false);
  assert.equal(isEmbodimentIntentV1(intent({ mouth: { open: 2, form: 0, viseme: "wide" } })), false, "the shared protocol rejects out-of-range values before rendering");
});

test("AvatarStage publishes one versioned embodiment intent and rejects stale utterance callbacks", async () => {
  const source = await readFile(join(root, "src/components/AvatarStage.tsx"), "utf8");
  const viewer = await readFile(join(root, "public/live2d/viewer.html"), "utf8");
  assert.match(source, /type: "kurisu_embodiment_intent"/);
  assert.match(source, /stateVersion: \+\+intentStateVersionRef\.current/);
  assert.match(source, /activeSpeechSessionRef\.current !== session/);
  assert.match(source, /timelineOffsetForCharIndex/);
  assert.doesNotMatch(source, /type: "kurisu_lipsync"|type: "kurisu_embodiment"|type: "kurisu_expression"/, "the app must not split one state over legacy control messages");
  assert.match(viewer, /d\.type!=='kurisu_embodiment_intent'/);
  assert.match(viewer, /intent\.stateVersion/);
  assert.doesNotMatch(viewer, /d\.type==='kurisu_lipsync'|d\.type==='kurisu_embodiment'|d\.type==='kurisu_expression'/, "viewer must accept the unified control contract, not competing writers");
});

// Check that the committed contract schema matches the versioned control envelope.
test("versioned EmbodimentIntent JSON schema is present and pins all synchronized channels", async () => {
  const schema = JSON.parse(await readFile(join(root, "../contracts/embodiment-intent.v1.schema.json"), "utf8"));
  assert.equal(schema.properties.protocolVersion.const, 1);
  for (const key of ["stateVersion", "speechEventId", "audioClockId", "speechPhase", "audioTimeMs", "priority", "cancellationToken", "expression", "mouth", "gaze", "body", "voiceEmphasis"]) {
    assert.ok(schema.required.includes(key), `schema must require ${key}`);
  }
});


test("actual Live2D viewer message handler accepts current state and rejects duplicate, rewound and wrong-cancel messages", async () => {
  const html = await readFile(join(root, "public/live2d/viewer.html"), "utf8");
  const match = html.match(/<script>\s*([\s\S]*?)<\/script>/u);
  assert.ok(match, "viewer inline script must exist");
  let script = match[1];
  // Add telemetry only to this in-memory test copy, after the exact production handler
  // has sanitized and applied an intent. The shipped viewer file is not rewritten.
  script = script.replace(
    "const intent=sanitizeIntent(d);\n    if(!intent)return;",
    "const intent=sanitizeIntent(d);\n    if(!intent){window.__w70RejectedCount=(window.__w70RejectedCount||0)+1;return;}"
  );
  script = script.replace(
    "applyEmbodiment(intent);\n  });\n  boot();",
    "applyEmbodiment(intent);\n    window.__w70AppliedCount=(window.__w70AppliedCount||0)+1;\n    window.__w70LastApplied={stateVersion:intent.stateVersion,speechEventId:intent.speechEventId,audioClockId:intent.audioClockId,speechPhase:intent.speechPhase,audioTimeMs:intent.audioTimeMs,speaking:intent.speaking,mouthOpen:lipTarget,mouthForm:lipFormTarget,bodyAngleX:bodySignal.bodyAngleX,bodyAngleY:bodySignal.bodyAngleY,bodyAngleZ:bodySignal.bodyAngleZ,breathIntensity:bodySignal.breathIntensity};\n  });\n  boot();"
  );
  const listeners = new Map();
  const parent = { postMessage() {} };
  const location = { origin: "http://kurisu.test", search: "?profile=balanced" };
  const canvas = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  const status = { textContent: "" };
  const fakeWindow = {
    parent, location,
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage() {},
  };
  const fakeDocument = {
    getElementById(id) { return id === "canvas" ? canvas : status; },
    createElement() { return {}; },
    head: { appendChild() {} },
  };
  const context = {
    window: fakeWindow, document: fakeDocument, location, navigator: { deviceMemory: 8, maxTouchPoints: 0 },
    performance: { now: () => 1000 }, innerWidth: 960, innerHeight: 720,
    console: { warn() {}, error() {}, log() {} },
  };
  vm.runInNewContext(script, context, { filename: "viewer.html.inline.js", timeout: 1000 });
  const dispatch = (data, origin = location.origin, source = parent) => listeners.get("message")({ data, origin, source });
  const message = (overrides = {}) => ({
    type: "kurisu_embodiment_intent", protocolVersion: 1, stateVersion: 1, sentAtEpochMs: 1_700_000_000_000,
    speechEventId: "speech-real-handler", audioClockId: "clock-real-handler", speechPhase: "speaking", audioTimeMs: 100,
    clockSource: "speech-synthesis-boundary-anchored-monotonic", priority: 70, cancellationToken: "cancel:speech-real-handler",
    expression: "thinking", expressionIntensity: .5, mouth: { open: .72, form: .2, viseme: "open" },
    gaze: { x: .1, y: -.1, driven: true },
    body: { headTilt: .02, headAngleX: .2, headAngleY: -.1, bodyAngleX: .3, bodyAngleY: -.2, bodyAngleZ: .1, breathIntensity: .7, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 1 }, voiceEmphasis: .3,
    ...overrides,
  });
  dispatch(message());
  assert.equal(fakeWindow.__w70AppliedCount, 1);
  assert.equal(fakeWindow.__w70LastApplied.mouthOpen, .72);
  assert.equal(fakeWindow.__w70LastApplied.bodyAngleX, .3);
  assert.equal(fakeWindow.__w70LastApplied.bodyAngleY, -.2);
  assert.equal(fakeWindow.__w70LastApplied.bodyAngleZ, .1);
  assert.equal(fakeWindow.__w70LastApplied.breathIntensity, .7);
  dispatch(message({ mouth: { open: .1, form: 0, viseme: "closed" } }));
  assert.equal(fakeWindow.__w70AppliedCount, 1, "duplicate stateVersion must be rejected");
  dispatch(message({ stateVersion: 2, audioTimeMs: 140 }));
  assert.equal(fakeWindow.__w70AppliedCount, 2);
  dispatch(message({ stateVersion: 3, audioTimeMs: 120 }));
  assert.equal(fakeWindow.__w70AppliedCount, 2, "backward audio clock on the same utterance must be rejected");
  dispatch(message({ stateVersion: 3, speechPhase: "cancelled", audioTimeMs: 150, mouth: { open: .9, form: .6, viseme: "open" } }));
  assert.equal(fakeWindow.__w70AppliedCount, 3);
  assert.equal(fakeWindow.__w70LastApplied.mouthOpen, .015, "cancelled speech forces the Live2D mouth closed");
  assert.equal(fakeWindow.__w70LastApplied.speaking, false);
  dispatch(message({ stateVersion: 4, speechPhase: "cancelled", audioTimeMs: 151, cancellationToken: "cancel:wrong-id" }));
  assert.equal(fakeWindow.__w70AppliedCount, 3, "cancellation must be bound to the exact speech event");
  dispatch(message({ stateVersion: 4, audioTimeMs: 160 }), "http://attacker.test");
  assert.equal(fakeWindow.__w70AppliedCount, 3, "foreign origins are rejected");
  dispatch(message({ stateVersion: 4, audioTimeMs: 160 }), location.origin, {});
  assert.equal(fakeWindow.__w70AppliedCount, 3, "foreign message sources are rejected");
});

test("organism action and affect derive a deterministic bounded continuous body pose", () => {
  const curious = deriveEmbodimentPose("explore", "curiosity", 0.7);
  const resting = deriveEmbodimentPose("rest", "calm", 0.15);
  assert.deepEqual(Object.keys(curious).sort(), [
    "bodyAngleX", "bodyAngleY", "bodyAngleZ", "breathIntensity", "headAngleX", "headAngleY",
  ]);
  for (const pose of [curious, resting, deriveEmbodimentPose("unknown", "unrecognised", Number.NaN)]) {
    for (const key of ["headAngleX", "headAngleY", "bodyAngleX", "bodyAngleY", "bodyAngleZ"]) {
      assert.ok(Number.isFinite(pose[key]) && pose[key] >= -1 && pose[key] <= 1, `${key} must remain a bounded finite normalized intent`);
    }
    assert.ok(Number.isFinite(pose.breathIntensity) && pose.breathIntensity >= 0 && pose.breathIntensity <= 1);
  }
  assert.notDeepEqual(curious, resting, "different action/affect states should change the continuous pose");
  assert.deepEqual(deriveEmbodimentPose("unknown", "unrecognised", Number.NaN), deriveEmbodimentPose("wait", "calm", 0.25),
    "unknown inputs and non-finite arousal use a stable neutral-safe fallback");
});

test("optional continuous body channels preserve v1 compatibility and reject out-of-range values", () => {
  assert.equal(isEmbodimentIntentV1(intent()), true, "older v1 payloads may omit new optional channels");
  const bodyBase = { headTilt: 0.02, gesture: false, motionGroup: "Idle", motionIndex: 0, motionToken: 0 };
  assert.equal(isEmbodimentIntentV1(intent({ body: { ...bodyBase, bodyAngleX: 0.4, breathIntensity: 0.7 } })), true);
  assert.equal(isEmbodimentIntentV1(intent({ body: { ...bodyBase, bodyAngleZ: 1.01 } })), false);
  assert.equal(isEmbodimentIntentV1(intent({ body: { ...bodyBase, breathIntensity: -0.01 } })), false);
});

test("both Live2D viewers map shared continuous body intent to model parameters", async () => {
  const appViewer = await readFile(join(root, "public/live2d/viewer.html"), "utf8");
  const runtimeViewer = await readFile(join(root, "../runtime/neuro-kurisu/public/live2d/viewer.html"), "utf8");
  for (const [name, viewer] of [["app", appViewer], ["runtime", runtimeViewer]]) {
    assert.match(viewer, /ParamBodyAngleX/);
    assert.match(viewer, /ParamBodyAngleY/);
    assert.match(viewer, /ParamBodyAngleZ/);
    assert.match(viewer, /ParamBreath/);
    assert.match(viewer, /bodyAngleX/);
    assert.match(viewer, /breathIntensity/);
    assert.match(viewer, /kurisu_embodiment_intent/);
    assert.ok(viewer.length > 5000, `${name} viewer remains a real runtime, not a placeholder`);
  }
});
