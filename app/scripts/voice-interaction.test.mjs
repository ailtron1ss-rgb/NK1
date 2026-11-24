import assert from "node:assert/strict";
import test from "node:test";
import { parseVoiceListenResponse, readRuntimeListening } from "../src/organism/voiceInteraction.ts";

test("accepts and trims an actual runtime transcript", () => {
  assert.deepEqual(parseVoiceListenResponse({ ok: true, text: "  turn left  " }), {
    text: "turn left",
    reason: null,
  });
});

test("rejects an empty transcript and surfaces the runtime provider reason", () => {
  assert.deepEqual(parseVoiceListenResponse({
    ok: true,
    text: null,
    voice: { state: { lastError: "stt-unavailable" } },
  }), { text: null, reason: "stt-unavailable" });
});

test("surfaces a safe server error when there is no transcript", () => {
  assert.deepEqual(parseVoiceListenResponse({ ok: false, error: "capture failed" }), {
    text: null,
    reason: "capture failed",
  });
});

test("does not stringify malformed objects into a transcript", () => {
  assert.deepEqual(parseVoiceListenResponse({ ok: true, text: { transcript: "fake" } }), {
    text: null,
    reason: "No speech was recognized. Check microphone permission and try again.",
  });
});

test("bounds transcript size and removes control NULs", () => {
  const result = parseVoiceListenResponse({ text: "a".repeat(4500) + "\u0000" });
  assert.equal(result.text?.length, 4000);
});

test("reports unknown listening state rather than inventing a boolean", () => {
  assert.equal(readRuntimeListening({ voice: { state: { listening: true } } }), true);
  assert.equal(readRuntimeListening({ voice: { state: { listening: false } } }), false);
  assert.equal(readRuntimeListening({ voice: {} }), null);
  assert.equal(readRuntimeListening(null), null);
});
