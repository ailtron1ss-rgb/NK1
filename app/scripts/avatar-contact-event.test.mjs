import assert from "node:assert/strict";
import test from "node:test";
import { neuroApi } from "../src/neuro-kurisu/api.ts";
import * as intentAdapter from "../src/components/avatar/embodimentIntentAdapter.ts";

const originalFetch = globalThis.fetch;

test("records avatar contact through the organism external-event perception route", async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, perception: { modality: "sensor", accepted: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await neuroApi.recordExternalEvent?.("Пользователь коснулся головы аватара Курису через экранный интерфейс.", 0.24, {
      protocolVersion: 1,
      kind: "avatar-contact",
      zone: "head",
    });
    assert.equal(captured?.url, "/api/organism/event", "contact must reach the canonical organism event route");
    assert.equal(captured?.init?.method, "POST");
    assert.equal(captured?.init?.headers?.["content-type"], "application/json");
    assert.deepEqual(JSON.parse(captured?.init?.body ?? "null"), {
      detail: "Пользователь коснулся головы аватара Курису через экранный интерфейс.",
      importance: 0.24,
      interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    });
    assert.deepEqual(result, { ok: true, perception: { modality: "sensor", accepted: true } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not report a contact as recorded when organism perception is unavailable", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: "organism-runtime-not-ready" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
  try {
    await assert.rejects(() => neuroApi.recordExternalEvent("contact", 0.24), /organism-runtime-not-ready/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("turns verified Live2D head and body taps into low-salience organism observations", async () => {
  let now = 20_000;
  const calls = [];
  const statuses = [];
  const createRecorder = intentAdapter.createLive2DTapRecorder;
  const recorder = typeof createRecorder === "function" ? createRecorder({
    now: () => now,
    recordExternalEvent: async (detail, importance, interaction) => {
      calls.push({ detail, importance, interaction });
      return { ok: true, perception: { modality: "sensor" } };
    },
    onStatus: (status) => statuses.push(status),
  }) : null;

  const headResult = recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "head", nx: 0.3, ny: 0.2 }) : "missing";
  now += 1_600;
  const bodyResult = recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "body", nx: 0.6, ny: 0.7 }) : "missing";

  assert.equal(headResult, "recorded");
  assert.equal(bodyResult, "recorded");
  assert.deepEqual(calls, [
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" } },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "body" } },
  ]);
  assert.deepEqual(statuses, ["recording", "recorded", "recording", "recorded"]);
});

test("rejects malformed taps and throttles rapid or overlapping contact posts", async () => {
  let now = 40_000;
  const calls = [];
  let finishRequest;
  const createRecorder = intentAdapter.createLive2DTapRecorder;
  const recorder = typeof createRecorder === "function" ? createRecorder({
    now: () => now,
    recordExternalEvent: (detail, importance) => {
      calls.push({ detail, importance });
      return new Promise((resolve) => { finishRequest = resolve; });
    },
    onStatus: () => {},
  }) : null;

  assert.equal(recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 2, zone: "head", nx: 0.3, ny: 0.2 }) : "missing", "invalid");
  assert.equal(recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "feet", nx: 0.3, ny: 0.2 }) : "missing", "invalid");
  assert.equal(recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "head", nx: 1.2, ny: 0.2 }) : "missing", "invalid");
  assert.equal(calls.length, 0, "invalid touch data must not reach the organism");

  const pending = recorder ? recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "head", nx: 0.3, ny: 0.2 }) : Promise.resolve("missing");
  assert.equal(recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "body", nx: 0.6, ny: 0.7 }) : "missing", "throttled");
  finishRequest?.({ ok: true });
  assert.equal(await pending, "recorded");

  now += 600;
  assert.equal(recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "body", nx: 0.6, ny: 0.7 }) : "missing", "throttled");
  assert.equal(calls.length, 1, "overlapping and burst taps must not flood the perception route");
});

test("marks rejected organism observations as errors instead of false success", async () => {
  const statuses = [];
  const createRecorder = intentAdapter.createLive2DTapRecorder;
  const recorder = typeof createRecorder === "function" ? createRecorder({
    now: () => 80_000,
    recordExternalEvent: async () => ({ ok: false, error: "not-ready" }),
    onStatus: (status) => statuses.push(status),
  }) : null;
  const result = recorder ? await recorder.record({ type: "live2d_tap", protocolVersion: 1, zone: "body", nx: 0.6, ny: 0.7 }) : "missing";
  assert.equal(result, "failed");
  assert.deepEqual(statuses, ["recording", "error"]);
});
