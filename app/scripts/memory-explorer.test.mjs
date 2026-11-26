import assert from "node:assert/strict";
import test from "node:test";
import { parseMemoryExplorerResponse } from "../src/organism/memoryExplorer.ts";

test("projects canonical memory rows with available provenance and confidence", () => {
  const result = parseMemoryExplorerResponse({
    ok: true,
    query: "project",
    temporalMode: "current",
    note: "read only",
    memories: [{
      id: "m-1",
      kind: "episodic",
      summary: "A verified conversation event",
      confidence: 0.91,
      salience: 0.74,
      createdAt: 1_700_000_000_000,
      source: "episode-store",
      provenance: { eventId: "event-4", source: "chat" },
    }],
  });
  assert.equal(result.memories.length, 1);
  assert.equal(result.memories[0].id, "m-1");
  assert.equal(result.memories[0].text, "A verified conversation event");
  assert.equal(result.memories[0].confidence, 0.91);
  assert.equal(result.memories[0].provenance, "chat · event-4");
  assert.equal(result.note, "read only");
});

test("supports known legacy row fields without inventing provenance", () => {
  const result = parseMemoryExplorerResponse({
    memories: [{ key: "legacy-1", content: "Historical item", type: "semantic", confidence01: 0.8 }],
  });
  assert.equal(result.memories[0].id, "legacy-1");
  assert.equal(result.memories[0].kind, "semantic");
  assert.equal(result.memories[0].text, "Historical item");
  assert.equal(result.memories[0].source, null);
  assert.equal(result.memories[0].provenance, null);
});

test("filters malformed rows and rows with no readable content", () => {
  const result = parseMemoryExplorerResponse({ memories: [null, 7, {}, { id: "empty", summary: " " }] });
  assert.deepEqual(result.memories, []);
});

test("does not throw on a malformed top-level response", () => {
  assert.deepEqual(parseMemoryExplorerResponse(null).memories, []);
  assert.deepEqual(parseMemoryExplorerResponse("not json").memories, []);
});

test("bounds output to the canonical inspector limit and truncates long fields", () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({ id: String(index), text: "x".repeat(5000) }));
  const result = parseMemoryExplorerResponse({ memories: rows });
  assert.equal(result.memories.length, 32);
  assert.equal(result.memories[0].text.length, 4000);
});
