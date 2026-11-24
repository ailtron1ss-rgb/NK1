#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { inflateSync } from "node:zlib";

const origin = new URL(process.argv[2] || "http://127.0.0.1:8081/").origin;
const outputDir = path.resolve(process.argv[3] || "artifacts/nk1-live2d");
const timeoutMs = Math.min(120000, Math.max(10000, Number(process.env.LIVE2D_BROWSER_TIMEOUT_MS) || 60000));
await mkdir(outputDir, { recursive: true });

const report = {
  origin,
  startedAt: new Date().toISOString(),
  profiles: [],
  intent: {},
  disposal: {},
  pageErrors: [],
  failedRequests: [],
  failedResponses: [],
  consoleErrors: [],
};
const harness = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#slot{margin:0;width:100%;height:100%;overflow:hidden;background:#040912}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><div id="slot"></div><script>window.__nk1Live2dEvents=[];window.addEventListener("message",event=>{const data=event.data;if(data&&typeof data.type==="string"&&data.type.startsWith("live2d_"))window.__nk1Live2dEvents.push(data)});</script></body></html>';

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});

function makeIntent(version, phase, expression, token) {
  const speechEventId = "nk1-browser-acceptance-speech";
  return {
    type: "kurisu_embodiment_intent",
    protocolVersion: 1,
    stateVersion: version,
    sentAtEpochMs: Date.now(),
    speechEventId,
    audioClockId: "nk1-browser-acceptance-clock",
    speechPhase: phase,
    audioTimeMs: phase === "speaking" ? 180 + version * 40 : 260,
    clockSource: "speech-synthesis-boundary-anchored-monotonic",
    priority: 50,
    cancellationToken: phase === "cancelled" ? "cancel:" + speechEventId : null,
    mouth: { open: phase === "speaking" ? 0.72 : 0.015, form: 0.25, viseme: "open" },
    expression,
    expressionIntensity: 0.82,
    gaze: { x: 0.2, y: -0.1, driven: true },
    body: { headTilt: 0.06, gesture: false, motionGroup: "Idle", motionIndex: 0, motionToken: token },
    voiceEmphasis: 0.35,
  };
}

function countBrightCenterPixels(png) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "screenshot must be a PNG");
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    offset += 12 + length;
  }
  assert.equal(bitDepth, 8, "browser screenshot must use 8-bit PNG");
  assert.ok(colorType === 6 || colorType === 2, "browser screenshot must be RGB/RGBA");
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  const previous = new Uint8Array(rowBytes);
  const row = new Uint8Array(rowBytes);
  const leftBound = Math.floor(width * 0.2), rightBound = Math.ceil(width * 0.8);
  const topBound = Math.floor(height * 0.08), bottomBound = Math.ceil(height * 0.96);
  let brightPixels = 0;
  let cursor = 0;
  function paeth(a, b, c) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    for (let i = 0; i < rowBytes; i += 1) {
      const value = raw[cursor++];
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upperLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error("unsupported PNG filter " + filter);
      row[i] = (value + predictor) & 255;
    }
    if (y >= topBound && y < bottomBound) {
      for (let x = leftBound; x < rightBound; x += 1) {
        const i = x * bytesPerPixel;
        const alpha = colorType === 6 ? row[i + 3] : 255;
        const luminance = row[i] * 0.2126 + row[i + 1] * 0.7152 + row[i + 2] * 0.0722;
        if (alpha > 160 && luminance > 105) brightPixels += 1;
      }
    }
    previous.set(row);
  }
  return { width, height, centerBrightPixels: brightPixels, bytes: png.length };
}

async function mountProfile(page, profile, screenshotPath) {
  await page.evaluate((selected) => {
    const iframe = document.createElement("iframe");
    iframe.id = "avatar";
    iframe.title = "NK1 Live2D acceptance viewer";
    iframe.src = "/live2d/viewer.html?profile=" + selected;
    document.getElementById("slot").appendChild(iframe);
  }, profile);

  await page.waitForFunction((selected) => {
    const events = window.__nk1Live2dEvents || [];
    return events.some((item) => item.type === "live2d_error") ||
      events.some((item) => item.type === "live2d_ready" && item.profile === selected);
  }, profile, { timeout: timeoutMs });

  const ready = await page.evaluate((selected) => {
    const events = window.__nk1Live2dEvents || [];
    return events.find((item) => item.type === "live2d_error") ||
      events.find((item) => item.type === "live2d_ready" && item.profile === selected) || null;
  }, profile);
  assert.equal(ready && ready.type, "live2d_ready", "Live2D boot failed: " + JSON.stringify(ready));

  const frame = page.frames().find((item) => item.url().includes("/live2d/viewer.html"));
  assert.ok(frame, "Live2D iframe must be present");
  await page.waitForTimeout(500);
  const screenshot = await page.screenshot({ path: screenshotPath });
  const screenshotPixels = countBrightCenterPixels(screenshot);
  assert.ok(screenshotPixels.centerBrightPixels > 100, "captured frame has no visible character pixels: " + JSON.stringify(screenshotPixels));

  const render = await frame.evaluate(() => {
    const canvas = document.querySelector("#canvas");
    const status = document.querySelector("#status")?.textContent || "";
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    let visiblePixels = 0;
    if (gl && canvas) {
      gl.finish();
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 8) visiblePixels += 1;
    }
    return {
      status,
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      hasWebGL: Boolean(gl),
      hasPixiLive2D: Boolean(window.PIXI?.live2d?.Live2DModel),
      visiblePixels,
    };
  });
  render.screenshotPixels = screenshotPixels;
  assert.ok(render.status.startsWith("ок"), "model has not reached the loaded status: " + render.status);
  assert.ok(render.width > 0 && render.height > 0, "WebGL drawing buffer is empty");
  assert.ok(render.hasWebGL && render.hasPixiLive2D, "Pixi Live2D/WebGL did not initialize");
  // WebGL readPixels can be empty when preserveDrawingBuffer is false; the compositor PNG above is the authoritative visual sample.
  return { ready, frame, render };
}

async function sendIntent(page, payload) {
  await page.evaluate((intent) => {
    const iframe = document.getElementById("avatar");
    if (!iframe?.contentWindow) throw new Error("Live2D iframe is unavailable");
    iframe.contentWindow.postMessage(intent, window.location.origin);
  }, payload);
  await page.waitForFunction((version) =>
    (window.__nk1Live2dEvents || []).some((item) => item.type === "live2d_intent_ack" && item.stateVersion === version),
    payload.stateVersion,
    { timeout: timeoutMs }
  );
  return page.evaluate((version) =>
    (window.__nk1Live2dEvents || []).find((item) => item.type === "live2d_intent_ack" && item.stateVersion === version),
    payload.stateVersion
  );
}

async function unmountAndVerifyDisposal(page) {
  const before = await page.evaluate(() =>
    (window.__nk1Live2dEvents || []).filter((item) => item.type === "live2d_disposed").length
  );
  await page.evaluate(() => document.getElementById("avatar")?.remove());
  await page.waitForFunction((count) =>
    document.getElementById("avatar") === null &&
    (window.__nk1Live2dEvents || []).filter((item) => item.type === "live2d_disposed").length > count,
    before,
    { timeout: 10000 }
  );
  return page.evaluate(() =>
    (window.__nk1Live2dEvents || []).filter((item) => item.type === "live2d_disposed").slice(-1)[0]
  );
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error?.message || error)));
  page.on("requestfailed", (request) => report.failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || "failed",
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) report.failedResponses.push({ url: response.url(), status: response.status(), statusText: response.statusText() });
  });
  await page.route("**/__nk1_live2d_acceptance_harness", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: harness })
  );
  await page.goto(origin + "/__nk1_live2d_acceptance_harness", { waitUntil: "domcontentloaded", timeout: timeoutMs });

  const quality = await mountProfile(page, "quality", path.join(outputDir, "live2d-quality-desktop.png"));
  assert.ok(quality.ready.modelPath.includes("Kurisu/Kurisu.model3.json"), "quality profile must select the canonical 4096 model");
  report.profiles.push({ profile: "quality", modelPath: quality.ready.modelPath, expressionManagerAvailable: quality.ready.expressionManagerAvailable, expressionNames: quality.ready.expressionNames || [], render: quality.render });

  const firstAck = await sendIntent(page, makeIntent(1, "speaking", "happy", 1));
  assert.ok(["parameters-observed", "accepted-unverified"].includes(firstAck.status));
  assert.equal(firstAck.expressionStatus, "started", "Live2D expression did not resolve");
  assert.equal(firstAck.motionStatus, "started", "Live2D motion did not resolve");
  report.intent.started = {
    status: firstAck.status,
    expressionStatus: firstAck.expressionStatus,
    motionStatus: firstAck.motionStatus,
    observedParameters: firstAck.observedParameters || {},
    complete: firstAck.complete,
    visualCompletionVerified: firstAck.visualCompletionVerified,
  };

  const ackCount = await page.evaluate(() =>
    (window.__nk1Live2dEvents || []).filter((item) => item.type === "live2d_intent_ack").length
  );
  await page.evaluate((payload) =>
    document.getElementById("avatar").contentWindow.postMessage(payload, window.location.origin),
    makeIntent(1, "speaking", "angry", 2)
  );
  await page.waitForTimeout(250);
  const staleAckCount = await page.evaluate(() =>
    (window.__nk1Live2dEvents || []).filter((item) => item.type === "live2d_intent_ack").length
  );
  assert.equal(staleAckCount, ackCount, "duplicate stale stateVersion was not rejected");

  const cancelledAck = await sendIntent(page, makeIntent(2, "cancelled", "thinking", 2));
  assert.equal(cancelledAck.expressionStatus, "started");
  report.intent.cancelled = {
    status: cancelledAck.status,
    staleIntentRejected: true,
  };

  const disposed = await unmountAndVerifyDisposal(page);
  assert.equal(disposed.profile, "quality");
  assert.ok(disposed.modelPath.includes("Kurisu/Kurisu.model3.json"));
  report.disposal.quality = disposed;

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await mountProfile(page, "mobile", path.join(outputDir, "live2d-mobile.png"));
  assert.ok(mobile.ready.modelPath.includes("Kurisu.mobile/Kurisu-mobile.model3.json"), "mobile profile must select the 2048 model");
  report.profiles.push({ profile: "mobile", modelPath: mobile.ready.modelPath, render: mobile.render });

  const mobileAck = await sendIntent(page, makeIntent(1, "speaking", "happy", 1));
  assert.equal(mobileAck.expressionStatus, "started");
  assert.equal(mobileAck.motionStatus, "started");
  const mobileDisposed = await unmountAndVerifyDisposal(page);
  assert.equal(mobileDisposed.profile, "mobile");
  report.disposal.mobile = mobileDisposed;

  assert.deepEqual(report.failedRequests, [], "canonical Live2D asset request failed");
  assert.deepEqual(report.pageErrors, [], "browser runtime emitted a page error");
  report.finishedAt = new Date().toISOString();
  report.ok = true;
  await writeFile(path.join(outputDir, "live2d-browser-acceptance.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.finishedAt = new Date().toISOString();
  report.ok = false;
  report.error = String(error?.stack || error);
  await writeFile(path.join(outputDir, "live2d-browser-acceptance.json"), JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
