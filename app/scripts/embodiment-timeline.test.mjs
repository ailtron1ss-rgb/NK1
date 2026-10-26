import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import { buildAvatarSpeechTimeline as buildRuntimeSpeechTimeline } from "../../runtime/neuro-kurisu/public/avatar-state.mjs";
import { deriveAvatarGaze } from "../src/components/avatar/avatarPresentation.ts";
import { listAllSprites, resolveSpritePath } from "../src/legacy/avatar/spriteEngine.ts";
import {
  buildVisemeTimeline,
  CLOSED_MOUTH,
  isEmbodimentIntentV1,
  appendVisemeClockAnchor,
  reanchorMonotonicAudioClock,
  sampleMonotonicAudioClock,
  sampleVisemeClock,
  sampleVisemeTimeline,
  smoothEmbodimentAffect,
  deriveEmbodimentPose,
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
    body: { headTilt: 0.02, headAngleX: 0.12, headAngleY: -0.05, bodyAngleX: 0.04, bodyAngleY: 0.03, bodyAngleZ: -0.02, breathIntensity: 0.7, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 17 },
    voiceEmphasis: 0.3,
    ...overrides,
  };
}

test("action and emotion produce bounded independent head/body pose channels", () => {
  const explore = deriveEmbodimentPose("explore", "curiosity", 0.7);
  const rest = deriveEmbodimentPose("rest", "sadness", 0.2);
  const stressed = deriveEmbodimentPose("verify", "anxiety", 0.9);
  assert.notEqual(explore.headAngleX, explore.bodyAngleX);
  assert.ok(stressed.breathIntensity > rest.breathIntensity);
  for (const pose of [explore, rest, stressed]) {
    for (const key of ["headAngleX", "headAngleY", "bodyAngleX", "bodyAngleY", "bodyAngleZ"]) assert.ok(pose[key] >= -1 && pose[key] <= 1, key + " must be bounded");
    assert.ok(pose.breathIntensity >= 0 && pose.breathIntensity <= 1);
  }
  assert.deepEqual(deriveEmbodimentPose("unknown", "unknown", Number.NaN), deriveEmbodimentPose("wait", "calm", 0.2));
});

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

test("manual legacy sprite selection is allowlisted and uses only bundled sprite paths", () => {
  const sprites = listAllSprites();
  assert.equal(sprites.length, 32);
  assert.equal(new Set(sprites.map((sprite) => sprite.id)).size, sprites.length);
  for (const sprite of sprites) {
    assert.equal(resolveSpritePath("happy", { spriteId: sprite.id }), sprite.path);
    assert.ok(sprite.label.length > 0);
    assert.ok(sprite.path.startsWith("/sprites/"));
  }
  for (const invalid of ["../viewer.html", "../../private", "constructor", "toString", "not-a-sprite"]) {
    const resolved = resolveSpritePath("neutral", { spriteId: invalid });
    assert.ok(sprites.some((sprite) => sprite.path === resolved),
      "untrusted saved values must fall back to a canonical bundled sprite");
  }
});

test("one bounded action/valence gaze signal can drive Live2D and NK1 Original", async () => {
  const actions = ["respond", "explore", "verify", "rest", "reflect", "wait"];
  for (const action of actions) {
    for (const valence of [0, 0.5, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const gaze = deriveAvatarGaze(action, valence);
      assert.ok(Number.isFinite(gaze.x) && gaze.x >= -0.4 && gaze.x <= 0.4);
      assert.ok(Number.isFinite(gaze.y) && gaze.y >= -0.4 && gaze.y <= 0.4);
    }
  }
  assert.ok(deriveAvatarGaze("explore", 0.5).x > deriveAvatarGaze("reflect", 0.5).x,
    "exploration looks outward while reflection turns gaze inward");
  assert.deepEqual(deriveAvatarGaze("explore", Number.NaN), deriveAvatarGaze("explore", 0.5),
    "invalid emotional valence must fall back to neutral gaze influence");

  const stage = await readFile(join(root, "src/components/AvatarStage.tsx"), "utf8");
  const original = await readFile(join(root, "src/components/KurisuOriginalStage.tsx"), "utf8");
  assert.ok(stage.includes("deriveAvatarGaze(snap.lastOption, snap.emotion.valence)"));
  assert.ok(stage.includes("gazeX={originalGaze.x} gazeY={originalGaze.y}"));
  assert.ok(original.includes("translate(${pupilOffsetX} ${pupilOffsetY})"),
    "SVG pupils must visibly track the shared gaze vector");
  assert.ok(original.includes("nk-blink") && original.includes("nk-eye-left"),
    "the original face should blink without a remote sprite dependency");
});

test("the intent envelope requires a speech identity and audio clock while speaking", () => {
  assert.equal(isEmbodimentIntentV1(intent()), true);
  assert.equal(isEmbodimentIntentV1(intent({ stateVersion: 0 })), false);
  assert.equal(isEmbodimentIntentV1(intent({ speechPhase: "speaking", speechEventId: null })), false);
  assert.equal(isEmbodimentIntentV1(intent({ audioTimeMs: Number.NaN })), false);
  assert.equal(isEmbodimentIntentV1(intent({ mouth: { open: 2, form: 0, viseme: "wide" } })), false, "the shared protocol rejects out-of-range values before rendering");
  assert.equal(isEmbodimentIntentV1(intent({ body: { ...intent().body, bodyAngleY: 1.01 } })), false, "normalized torso channels reject out-of-range values");
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
  assert.ok(viewer.includes("setCore('ParamBodyAngleX'"));
  assert.ok(viewer.includes("setCore('ParamBreath'"));
  assert.ok(viewer.includes("headAngleX"));

  assert.match(viewer, /intent\.stateVersion/);
  assert.doesNotMatch(viewer, /d\.type==='kurisu_lipsync'|d\.type==='kurisu_embodiment'|d\.type==='kurisu_expression'/, "viewer must accept the unified control contract, not competing writers");
});

test("avatar UI switches to the persistent NK1 Original design and exposes real appearance controls", async () => {
  const stage = await readFile(join(root, "src/components/AvatarStage.tsx"), "utf8");
  const original = await readFile(join(root, "src/components/KurisuOriginalStage.tsx"), "utf8");
  assert.ok(stage.includes('type ViewMode = "live2d" | "legacy" | "original"'));
  assert.ok(stage.includes('setMode("original")'));
  assert.ok(stage.includes('<KurisuOriginalStage emotion={snap.emotion.label}'));
  assert.ok(stage.includes('saved === "legacy" || saved === "original"'), "the selected variant can be restored after a reload");
  assert.ok(original.includes('data-testid="kurisu-original-stage"'));
  for (const persistedSetting of [
    "kurisu-original-outfit", "kurisu-original-eyes", "kurisu-original-hair",
    "kurisu-original-accent", "kurisu-original-motion", "kurisu-original-pose", "kurisu-original-scale",
  ]) assert.ok(original.includes(persistedSetting), `missing persisted visual setting: ${persistedSetting}`);
  for (const control of ["Лаборатория", "Город", "Ночной режим", "Аметист", "Морская волна", "Красное дерево", "Выразительное", "Скрестить руки", "Думать", "Объяснять", "Масштаб персонажа"]) {
    assert.ok(original.includes(control), `missing original avatar appearance control: ${control}`);
  }
  assert.ok(original.includes("scale(\${scale})"), "scale slider must affect the actual SVG");
  assert.ok(original.includes("prefers-reduced-motion"), "decorative animation must respect reduced-motion preference");
  assert.ok(original.includes("mouthPose.open"), "mouth animation must use the shared speech-timed viseme pose");
});

test("AvatarStage exposes an explicit retry path after a Live2D viewer failure", async () => {
  const source = await readFile(join(root, "src/components/AvatarStage.tsx"), "utf8");
  assert.match(source, /const \[viewerAttempt, setViewerAttempt\] = useState\(0\)/);
  assert.match(source, /if \(!live\) setViewerAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(source, /<iframe key=\{viewerAttempt\} ref=\{frame\} title="Kurisu Live2D"/);
  assert.match(source, /setLive\(false\)/, "viewer errors must expose the retry path");
});

test("smooths low-frequency avatar affect without rewinding or overshooting", () => {
  const start = smoothEmbodimentAffect(null, {
    expressionIntensity: 0, gazeX: 0, gazeY: 0, headTilt: 0, voiceEmphasis: 0,
  }, 100);
  const halfway = smoothEmbodimentAffect(start, {
    expressionIntensity: 1, gazeX: 1, gazeY: -1, headTilt: .15, voiceEmphasis: 1,
  }, 190, 180);
  assert.ok(halfway.expressionIntensity > 0 && halfway.expressionIntensity < 1);
  assert.ok(halfway.gazeX > 0 && halfway.gazeX < 1);
  assert.ok(halfway.gazeY < 0 && halfway.gazeY > -1);
  assert.ok(halfway.headTilt > 0 && halfway.headTilt < .15);
  assert.ok(halfway.voiceEmphasis > 0 && halfway.voiceEmphasis < 1);

  const rewound = smoothEmbodimentAffect(halfway, {
    expressionIntensity: 0, gazeX: -1, gazeY: 1, headTilt: -.15, voiceEmphasis: 0,
  }, 189);
  assert.deepEqual(rewound, halfway, "late affect snapshots cannot rewind the visual state clock");

  const bounded = smoothEmbodimentAffect(halfway, {
    expressionIntensity: 5, gazeX: 8, gazeY: -4, headTilt: 7, voiceEmphasis: -2,
  }, 280, 0);
  assert.ok(bounded.expressionIntensity >= 0 && bounded.expressionIntensity <= 1);
  assert.ok(bounded.gazeX >= -1 && bounded.gazeX <= 1);
  assert.ok(bounded.gazeY >= -1 && bounded.gazeY <= 1);
  assert.ok(bounded.headTilt >= -.15 && bounded.headTilt <= .15);
  assert.ok(bounded.voiceEmphasis >= 0 && bounded.voiceEmphasis <= 1);
});

test("AvatarStage applies the shared affect smoothing to expression, gaze, pose and voice", async () => {
  const source = await readFile(join(root, "src/components/AvatarStage.tsx"), "utf8");
  assert.match(source, /smoothEmbodimentAffect\(affectSmoothingRef\.current/);
  assert.match(source, /expressionIntensity: affectState\.expressionIntensity/);
  assert.match(source, /gaze: \{ x: affectState\.gazeX, y: affectState\.gazeY/);
  assert.match(source, /headTilt: affectState\.headTilt/);
  assert.match(source, /deriveEmbodimentPose\(snap\.lastOption/);
  assert.match(source, /\.\.\.bodyPose/);
  assert.match(source, /voiceEmphasis: affectState\.voiceEmphasis/);
  assert.match(source, /mouth: activeUtterance \? mouthPose : CLOSED_MOUTH/,
    "mouth pose remains driven by audio-boundary timing rather than affect smoothing");
});

// Check that the committed contract schema matches the versioned control envelope.
test("versioned EmbodimentIntent JSON schema is present and pins all synchronized channels", async () => {
  const schema = JSON.parse(await readFile(join(root, "../contracts/embodiment-intent.v1.schema.json"), "utf8"));
  assert.equal(schema.properties.protocolVersion.const, 1);
  assert.ok(schema.properties.clockSource.enum.includes("runtime-tts-start-anchored-monotonic"));
  assert.equal(schema.properties.body.properties.bodyAngleX.minimum, -1);
  assert.equal(schema.properties.body.properties.breathIntensity.maximum, 1);
  assert.equal(isEmbodimentIntentV1(intent({ clockSource: "runtime-tts-start-anchored-monotonic" })), true,
    "runtime TTS start-clock intents must satisfy the same v1 envelope");
  for (const key of ["stateVersion", "speechEventId", "audioClockId", "speechPhase", "audioTimeMs", "priority", "cancellationToken", "expression", "mouth", "gaze", "body", "voiceEmphasis"]) {
    assert.ok(schema.required.includes(key), `schema must require ${key}`);
  }
});


test("Live2D profile presets have enforceable frame budgets in both shipped viewers", async () => {
  const viewers = [
    { name: "app", path: join(root, "public/live2d/viewer.html") },
    { name: "runtime", path: join(root, "../runtime/neuro-kurisu/public/live2d/viewer.html") },
  ];
  const serializedPolicies = [];
  for (const viewer of viewers) {
    const html = await readFile(viewer.path, "utf8");
    const policy = html.match(/const PROFILE_POLICY=Object\.freeze\([\s\S]*?\);/u)?.[0];
    const chooseProfile = html.match(/function chooseProfile\(\)\{[\s\S]*?\n  \}/u)?.[0];
    const modelForProfile = html.match(/function modelForProfile\(profile\)\{[\s\S]*?\n  \}/u)?.[0];
    const tickerBudget = html.match(/function updateTickerBudget\(\)\{[^\n]*\}/u)?.[0];
    assert.ok(policy, `${viewer.name}: profile policy catalog must exist`);
    assert.ok(chooseProfile, `${viewer.name}: profile selector must exist`);
    assert.ok(modelForProfile, `${viewer.name}: model selection must use the catalog`);
    assert.ok(tickerBudget, `${viewer.name}: frame budget must use the selected profile`);
    assert.match(html, /powerPreference:PROFILE_POLICY\[assetProfile\]\.powerPreference/u,
      `${viewer.name}: renderer power preference must match selected profile`);
    const sandbox = {
      URLSearchParams,
      location: { search: "?profile=quality" },
      navigator: { deviceMemory: 8, maxTouchPoints: 0 },
      innerWidth: 1200,
      innerHeight: 800,
      assetProfile: "quality",
      bodySignal: { speaking: true },
      app: { ticker: { maxFPS: 0 } },
      visualStateIsActive(signal = {}) {
        return Boolean(signal?.speaking || signal?.gesture || signal?.expressionIntensity > 0.5);
      },
    };
    const api = vm.runInNewContext(
      [policy, chooseProfile, modelForProfile, tickerBudget,
        "({ PROFILE_POLICY, chooseProfile, modelForProfile, updateTickerBudget })"].join("\n"),
      sandbox,
      { filename: `${viewer.name}-live2d-profile-policy.js`, timeout: 1000 },
    );
    const normalizedPolicy = JSON.parse(JSON.stringify(api.PROFILE_POLICY));
    assert.deepEqual(Object.keys(normalizedPolicy).sort(), ["balanced", "mobile", "quality"]);
    assert.equal(api.chooseProfile(), "quality");
    assert.equal(api.modelForProfile("mobile"), "./Kurisu.mobile/Kurisu-mobile.model3.json");
    assert.equal(api.modelForProfile("balanced"), "./Kurisu/Kurisu.model3.json");
    assert.equal(api.modelForProfile("quality"), "./Kurisu/Kurisu.model3.json");
    assert.deepEqual(normalizedPolicy.mobile, {
      modelPath: "./Kurisu.mobile/Kurisu-mobile.model3.json", activeFps: 24, idleFps: 10, powerPreference: "low-power",
    });
    assert.deepEqual(normalizedPolicy.balanced, {
      modelPath: "./Kurisu/Kurisu.model3.json", activeFps: 30, idleFps: 14, powerPreference: "low-power",
    });
    assert.deepEqual(normalizedPolicy.quality, {
      modelPath: "./Kurisu/Kurisu.model3.json", activeFps: 60, idleFps: 24, powerPreference: "high-performance",
    });
    for (const [profile, activeFps, idleFps] of [
      ["mobile", 24, 10], ["balanced", 30, 14], ["quality", 60, 24],
    ]) {
      sandbox.assetProfile = profile;
      sandbox.bodySignal = { speaking: true };
      api.updateTickerBudget();
      assert.equal(sandbox.app.ticker.maxFPS, activeFps, `${viewer.name}: ${profile} active budget`);
      sandbox.bodySignal = {};
      api.updateTickerBudget();
      assert.equal(sandbox.app.ticker.maxFPS, idleFps, `${viewer.name}: ${profile} idle budget`);
    }
    sandbox.location.search = "?profile=unsupported";
    sandbox.navigator.deviceMemory = 4;
    assert.equal(api.chooseProfile(), "mobile", `${viewer.name}: unknown profile falls back to device policy`);
    serializedPolicies.push(JSON.stringify(normalizedPolicy));
  }
  assert.equal(serializedPolicies[0], serializedPolicies[1],
    "app and standalone runtime must ship the same model and frame-budget profiles");
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
    "applyEmbodiment(intent);\n    window.__w70AppliedCount=(window.__w70AppliedCount||0)+1;\n    window.__w70LastApplied={stateVersion:intent.stateVersion,speechEventId:intent.speechEventId,audioClockId:intent.audioClockId,speechPhase:intent.speechPhase,audioTimeMs:intent.audioTimeMs,speaking:intent.speaking,mouthOpen:lipTarget,mouthForm:lipFormTarget,headAngleX:intent.headAngleX,bodyAngleX:intent.bodyAngleX,bodyAngleY:intent.bodyAngleY,breathIntensity:intent.breathIntensity};\n  });\n  boot();"
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
  const documentListeners = new Map();
  const fakeDocument = {
    hidden: false,
    addEventListener(type, listener) { documentListeners.set(type, listener); },
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
    body: { headTilt: .02, headAngleX: .14, headAngleY: -.06, bodyAngleX: .18, bodyAngleY: .07, bodyAngleZ: -.03, breathIntensity: .75, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 1 }, voiceEmphasis: .3,
    ...overrides,
  });
  dispatch(message());
  assert.equal(fakeWindow.__w70AppliedCount, 1);
  assert.equal(fakeWindow.__w70LastApplied.mouthOpen, .72);
  assert.equal(fakeWindow.__w70LastApplied.headAngleX, .14);
  assert.equal(fakeWindow.__w70LastApplied.bodyAngleX, .18);
  assert.equal(fakeWindow.__w70LastApplied.bodyAngleY, .07);
  assert.equal(fakeWindow.__w70LastApplied.breathIntensity, .75);
  dispatch(message({ stateVersion: 2, body: { ...message().body, bodyAngleY: 1.01 } }));
  assert.equal(fakeWindow.__w70AppliedCount, 1, "out-of-range full-body channels must be rejected before stateVersion advances");
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

test("React and standalone runtime import one canonical viseme algorithm", async () => {
  const appTimelineSource = await readFile(join(root, "src/components/avatar/embodimentTimeline.ts"), "utf8");
  const runtimeMapperSource = await readFile(join(root, "../runtime/neuro-kurisu/public/avatar-state.mjs"), "utf8");
  const sharedCore = await readFile(join(root, "../runtime/neuro-kurisu/public/speech-viseme-core.mjs"), "utf8");
  assert.ok(appTimelineSource.includes("runtime/neuro-kurisu/public/speech-viseme-core.mjs"));
  assert.ok(runtimeMapperSource.includes("from './speech-viseme-core.mjs'"));
  assert.ok(sharedCore.includes("export function buildVisemeTimeline"));
  assert.ok(sharedCore.includes("export function poseForGrapheme"));
  assert.ok(!appTimelineSource.includes("function segmentGraphemes"), "React wrapper must not keep a second segmenter");
  assert.ok(!runtimeMapperSource.includes("function speechWeight"), "runtime wrapper must not keep duplicate viseme weights");

  for (const source of ["мама, мир", "Ку\u0301рису 🙂", "а🙂‍↔️б\n", "🇳🇱 Курису"]) {
    const shared = buildVisemeTimeline(source, 0.96, "ru-RU");
    const runtime = buildRuntimeSpeechTimeline(source, 0.96, "ru-RU");
    assert.deepEqual(
      runtime.map(({ startMs, endMs, pose, grapheme }) => ({ startMs, endMs, pose, grapheme })),
      shared.map(frame => ({
        startMs: frame.startMs, endMs: frame.endMs, pose: frame.pose,
        grapheme: source.slice(frame.charIndex, frame.endCharIndex),
      })),
      "runtime output must match the React timeline for Unicode graphemes and UTF-16 offsets",
    );
  }
});
