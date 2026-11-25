import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const SERVER_ENTRY = fileURLToPath(new URL("../src/server/server.mjs", import.meta.url));
const WAIT_MS = 90_000;

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, HOST, resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("unable-to-allocate-loopback-port");
  const { port } = address;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(port, stateDir) {
  const child = spawn(process.execPath, ["--experimental-strip-types", SERVER_ENTRY], {
    env: {
      ...process.env,
      HOST,
      PORT: String(port),
      STATE_DIR: stateDir,
      NEURO_API_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  const base = `http://${HOST}:${port}`;
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`server-exited-before-ready: ${logs.slice(-6000)}`);
    }
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2_000), cache: "no-store" });
      const health = await response.json();
      if (response.ok && health.ready === true) return { child, base, logs: () => logs };
    } catch {
      // Startup readiness is polled until the canonical Runtime has initialized.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill("SIGKILL");
  throw new Error(`server-readiness-timeout: ${logs.slice(-6000)}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const result = await Promise.race([
    exited.then(() => "exited"),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 12_000)),
  ]);
  if (result === "timeout" && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function call(base, endpoint, method = "GET", body) {
  const response = await fetch(base + endpoint, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

const stateDir = await mkdtemp(path.join(os.tmpdir(), "nk1-proactive-delivery-e2e-"));
const port = await freePort();
let first;
let second;
try {
  first = await startServer(port, stateDir);

  const invalidConsent = await call(first.base, "/api/organism/proactive-consent", "POST", null);
  assert.equal(invalidConsent.status, 400,
    "null consent bodies must be rejected as client errors, not server exceptions");

  const consent = await call(first.base, "/api/organism/proactive-consent", "POST", { consentGranted: true });
  assert.equal(consent.status, 200);
  assert.equal(consent.data.policy.consentGranted, true);

  const invalidHours = await call(first.base, "/api/organism/proactive-quiet-hours", "POST", {
    enabled: true, startHourUtc: 22, endHourUtc: 24,
  });
  assert.equal(invalidHours.status, 400,
    "the HTTP boundary must reject invalid UTC hour values");

  const quietHours = await call(first.base, "/api/organism/proactive-quiet-hours", "POST", {
    enabled: true, startHourUtc: 22, endHourUtc: 8,
  });
  assert.equal(quietHours.status, 200);
  assert.equal(quietHours.data.policy.quietHoursEnabled, true);
  assert.equal(quietHours.data.policy.quietStartHourUtc, 22);
  assert.equal(quietHours.data.policy.quietEndHourUtc, 8);

  const policy = await call(first.base, "/api/organism/proactive-consent");
  assert.equal(policy.status, 200);
  assert.equal(policy.data.policy.consentGranted, true);
  assert.equal(policy.data.policy.quietHoursEnabled, true);

  const claim = await call(first.base, "/api/organism/proactive-message/claim", "POST", {});
  assert.equal(claim.status, 200);
  assert.equal(claim.data.ok, true);
  assert.ok(claim.data.initiative === null || typeof claim.data.initiative === "object",
    "the canonical POST claim route must return either no ready message or a typed initiative");

  const invalidAck = await call(first.base, "/api/organism/proactive-message/ack", "POST", {
    id: " invalid-id ",
    deliveryToken: "not-a-valid-token",
  });
  assert.equal(invalidAck.status, 400,
    "malformed IDs must be rejected before the token registry or Core is touched");

  await stopServer(first.child);
  second = await startServer(port, stateDir);
  const restoredPolicy = await call(second.base, "/api/organism/proactive-consent");
  assert.equal(restoredPolicy.status, 200);
  assert.equal(restoredPolicy.data.policy.consentGranted, true,
    "explicit consent must survive a real server restart");
  assert.equal(restoredPolicy.data.policy.quietHoursEnabled, true,
    "quiet-hours policy must survive a real server restart");
  assert.equal(restoredPolicy.data.policy.quietStartHourUtc, 22);
  assert.equal(restoredPolicy.data.policy.quietEndHourUtc, 8);
  console.log("PROACTIVE_DELIVERY_HTTP_E2E=PASS");
} catch (error) {
  const logs = [first?.logs?.(), second?.logs?.()].filter(Boolean).join("\n");
  throw new Error(`PROACTIVE_DELIVERY_HTTP_E2E=FAIL: ${error instanceof Error ? error.stack : String(error)}\n${logs.slice(-10000)}`);
} finally {
  if (first?.child) await stopServer(first.child);
  if (second?.child) await stopServer(second.child);
  await rm(stateDir, { recursive: true, force: true });
}
