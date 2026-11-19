import test from "node:test";
import assert from "node:assert/strict";
import { resolveSemanticGestureIntent } from "../src/components/avatar/semanticGestureIntent.ts";

test("maps only explicit closed Russian stage directions to stable semantic cards", () => {
  assert.equal(resolveSemanticGestureIntent("(Курису уверенно кивает.)")?.programId, "nod");
  assert.equal(resolveSemanticGestureIntent("(отрицательно качает головой)")?.programId, "shake");
  assert.equal(resolveSemanticGestureIntent("(машет рукой в знак приветствия)")?.programId, "wave");
  assert.equal(resolveSemanticGestureIntent("(хлопает в ладоши)")?.programId, "clap");
  assert.equal(resolveSemanticGestureIntent("(Курису кланяется)")?.programId, "bow");
});

test("maps English stage directions without mining ordinary dialogue", () => {
  assert.equal(resolveSemanticGestureIntent("(she nods once)")?.programId, "nod");
  assert.equal(resolveSemanticGestureIntent("(shakes her head)")?.programId, "shake");
  assert.equal(resolveSemanticGestureIntent("(waves hello)")?.programId, "wave");
  assert.equal(resolveSemanticGestureIntent("(applauds)")?.programId, "clap");
  assert.equal(resolveSemanticGestureIntent("I agree and I nod."), null);
  assert.equal(resolveSemanticGestureIntent("Она машет рукой."), null);
});

test("negative, negated and unfinished directions fail closed", () => {
  assert.equal(resolveSemanticGestureIntent("(не кивает)"), null);
  assert.equal(resolveSemanticGestureIntent("(does not wave hello)"), null);
  assert.equal(resolveSemanticGestureIntent("(never applauds)"), null);
  assert.equal(resolveSemanticGestureIntent("(кивает"), null);
  assert.equal(resolveSemanticGestureIntent(""), null);
  assert.equal(resolveSemanticGestureIntent(null), null);
});

test("one highest-priority card wins for conflicting stage directions", () => {
  const result = resolveSemanticGestureIntent("(кивает и хлопает в ладоши)");
  assert.equal(result?.programId, "clap");
  assert.equal(result?.priority, 92);
  assert.equal(result?.source, "closed-stage-direction");
  assert.equal(result?.cardId, "nk1.semantic-gesture.clap.v1");
});

test("the resolver is bounded to the first three closed stage directions", () => {
  const directions = "(nods)(waves hello)(bows)(applauds)";
  assert.notEqual(resolveSemanticGestureIntent(directions)?.programId, "clap");
  assert.equal(resolveSemanticGestureIntent("x".repeat(8_000) + "(applauds)"), null);
});
