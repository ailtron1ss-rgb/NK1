import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../src/components/RuntimeHealthPanel.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const server = await readFile(new URL("../../runtime/neuro-kurisu/src/server/server.mjs", import.meta.url), "utf8");
const vite = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("RuntimeHealthPanel uses the canonical status-lite endpoint and existing proxy", () => {
  assert.ok(panel.includes('neuroApiUrl("/api/organism/status-lite")'));
  assert.ok(server.includes("url.pathname === '/api/organism/status-lite'"));
  assert.match(vite, /["']\/api\/organism["']:\s*\{\s*target:\s*["']http:\/\/127\.0\.0\.1:3310["']/);
  assert.ok(!panel.includes('"/api/health"'), "panel must not call the unproxied /api/health route");
});

test("the UI status fields are present in the canonical runtime payload", () => {
  for (const field of ["ok", "version", "organismCore", "schemaVersion", "tick", "lastAction", "memoryCount", "autonomyScore", "predictionError"]) {
    assert.ok(panel.includes(field), "UI contract missing " + field);
    assert.ok(server.includes(field + ":"), "runtime contract missing " + field);
  }
});

test("status polling is bounded and does not overlap", () => {
  assert.match(panel, /if \(disposed \|\| inFlight\) return/);
  assert.match(panel, /setTimeout\(\(\) => controller\?\.abort\(\), 5_000\)/);
  assert.match(panel, /setInterval\([\s\S]*?15_000\)/);
});

test("runtime dashboard keeps the Kurisu character heading under NeuroCore branding", () => {
  assert.match(route, /NeuroCore · digital organism/);
  assert.match(route, /<h1[^>]*>Kurisu<\/h1>/);
});
