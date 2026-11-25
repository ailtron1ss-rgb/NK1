import assert from "node:assert/strict";
import test from "node:test";
import { parseVoiceListenResponse, readRuntimeListening, resolveVoiceStop } from "../src/organism/voiceInteraction.ts";

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


test("only an explicit runtime false confirms microphone stop", () => {
  assert.deepEqual(resolveVoiceStop(false, true), { confirmed: true, status: "idle", reason: null });
  assert.deepEqual(resolveVoiceStop(true, true), {
    confirmed: false, status: "stop-unconfirmed",
    reason: "Stop requested, but microphone release is not confirmed by the runtime.",
  });
  assert.equal(resolveVoiceStop(null, true).status, "stop-unconfirmed");
});

test("stop verification errors keep the microphone locked", () => {
  const result = resolveVoiceStop(null, true, "voice status endpoint offline");
  assert.equal(result.confirmed, false);
  assert.equal(result.status, "stop-unconfirmed");
  assert.match(result.reason, /offline/);
});
