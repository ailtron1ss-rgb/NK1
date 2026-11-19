import assert from "node:assert/strict";
import test from "node:test";
import { neuroApi } from "./api.ts";

/** @type {import("./api.ts").DyadicCollaborationMutation} */
const payload = {
  action: "record",
  kind: "task",
  title: "Retry the same committed task",
  confirmed: true,
};

/** @param {number} status @param {unknown} body */
const response = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

test("Dyadic API retries a dropped response once with the exact same idempotency key and body", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  /** @type {Array<{ url: string; init: RequestInit }>} */
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) throw new TypeError("simulated connection reset after server commit");
    return response(200, {
      ok: true,
      action: "record",
      replayed: true,
      item: {
        id: "dyad-item-00000001", kind: "task", title: payload.title, detail: "",
        author: "human", status: "accepted", progress: "not-started",
        createdAtTick: 10, updatedAtTick: 10, updatedBy: "human",
      },
      summary: {
        total: 1, accepted: 1, proposals: 0, rejected: 0,
        tasksInProgress: 0, tasksBlocked: 0, tasksCompleted: 0,
      },
      note: "replayed",
    });
  };

  const result = await neuroApi.dyadicCollaborationMutation(payload, "retry-key-001");

  assert.equal(calls.length, 2);
  const [firstCall, secondCall] = calls;
  assert.ok(firstCall && secondCall, "both the original request and its retry must be captured");
  assert.equal(firstCall.url, "/api/organism/dyadic-collaboration");
  assert.equal(secondCall.url, firstCall.url);
  assert.equal(firstCall.init.method, "POST");
  assert.equal(secondCall.init.method, "POST");
  assert.equal(new Headers(firstCall.init.headers).get("idempotency-key"), "retry-key-001");
  assert.equal(new Headers(secondCall.init.headers).get("idempotency-key"), "retry-key-001");
  assert.equal(secondCall.init.body, firstCall.init.body);
  assert.equal(result.replayed, true);
});

test("Dyadic API does not retry deterministic 409 idempotency conflicts", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  /** @type {RequestInit[]} */
  const calls = [];
  globalThis.fetch = async (_url, init = {}) => {
    calls.push(init);
    return response(409, { ok: false, error: "idempotency-key-conflict" });
  };

  await assert.rejects(
    () => neuroApi.dyadicCollaborationMutation(payload, "retry-key-conflict"),
    error => error instanceof Error && "status" in error && (/** @type {Error & { status?: number }} */ (error)).status === 409 && error.message === "idempotency-key-conflict",
  );
  assert.equal(calls.length, 1);
});

test("Dyadic API does not retry a mutation when no idempotency key was supplied", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new TypeError("network unavailable");
  };

  await assert.rejects(
    () => neuroApi.dyadicCollaborationMutation(payload),
    /network unavailable/,
  );
  assert.equal(calls, 1);
});
