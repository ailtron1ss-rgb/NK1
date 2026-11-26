import assert from "node:assert/strict";
import test from "node:test";
import { draftAfterSend } from "../src/organism/chatDraft.ts";

test("restores the submitted draft after a failed send when the composer is still empty", () => {
  assert.equal(draftAfterSend("", "Please continue", false), "Please continue");
});

test("does not overwrite text typed while the failed request was in flight", () => {
  assert.equal(draftAfterSend("a newer draft", "the failed draft", false), "a newer draft");
});

test("does not restore a delivered message into the composer", () => {
  assert.equal(draftAfterSend("", "sent message", true), "");
});

test("preserves whitespace in a newer user draft rather than replacing it", () => {
  assert.equal(draftAfterSend("  new text  ", "old text", false), "  new text  ");
});
