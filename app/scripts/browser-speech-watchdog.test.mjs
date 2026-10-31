import assert from "node:assert/strict";
import { test } from "node:test";
import { browserSpeechWatchdogMs } from "../src/components/avatar/browserSpeechWatchdog.ts";

test("queued browser speech has a fixed upper bound", () => {
  assert.equal(browserSpeechWatchdogMs("hello", 1, "queued"), 20_000);
  assert.equal(browserSpeechWatchdogMs("", 1, "queued"), 20_000);
});

test("speaking watchdog scales with utterance length and inverse rate", () => {
  const short = browserSpeechWatchdogMs("hi", 1, "speaking");
  const long = browserSpeechWatchdogMs("Kurisu ".repeat(100), 1, "speaking");
  const slow = browserSpeechWatchdogMs("Kurisu ".repeat(100), 0.5, "speaking");
  assert.ok(short >= 30_000);
  assert.ok(long > short);
  assert.ok(slow > long);
});

test("speaking watchdog clamps invalid rates and has a hard ceiling", () => {
  assert.equal(browserSpeechWatchdogMs("hello", Number.NaN, "speaking"), browserSpeechWatchdogMs("hello", 1, "speaking"));
  assert.equal(browserSpeechWatchdogMs("x".repeat(100_000), 0.01, "speaking"), 600_000);
  assert.equal(browserSpeechWatchdogMs("x".repeat(100_000), 10, "speaking"), 600_000);
});
