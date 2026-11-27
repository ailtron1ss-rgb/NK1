#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = String(process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const outputDir = path.resolve(process.argv[3] || ".artifacts/avatar-3d-webgl");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const report = {
  schemaVersion: 1,
  baseUrl,
  asset: "NeuroKurisu_3D_v5.glb",
  expectedGpuSwayMeshes: 11,
  viewport: { width: 390, height: 844 },
  webgl: null,
  diagnostics: "",
  pageErrors: [],
  consoleErrors: [],
  shaderErrors: [],
  failedRequests: [],
  failedResponses: [],
  screenshot: path.join(outputDir, "nk1-avatar-3d-webgl.png"),
  stageScreenshot: path.join(outputDir, "nk1-avatar-3d-stage.png"),
  canvasScreenshot: path.join(outputDir, "nk1-avatar-3d-canvas.png"),
  visualCompletionVerified: false,
  physicalDeviceAcceptance: false,
};

const page = await browser.newPage({
  viewport: report.viewport,
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const detail = message.text();
  report.consoleErrors.push(detail);
  if (/shader error|webglprogram|shader compilation|glsl|program link/i.test(detail)) {
    report.shaderErrors.push(detail);
  }
});
page.on("requestfailed", (request) => {
  const url = request.url();
  const failure = request.failure()?.errorText || "failed";
  const pathname = (() => { try { return new URL(url).pathname; } catch { return ""; } })();
  const expectedLive2dAbort = failure === "net::ERR_ABORTED" && pathname.startsWith("/live2d/");
  if (!expectedLive2dAbort && !/favicon\.ico(?:$|\?)/i.test(url)) {
    report.failedRequests.push({ url, failure });
  }
});
page.on("response", (response) => {
  const url = response.url();
  if (response.status() >= 400 && !/favicon\.ico(?:$|\?)/i.test(url)) {
    report.failedResponses.push({ url, status: response.status() });
  }
});

try {
  await page.addInitScript(() => {
    localStorage.setItem("kurisu-avatar-mode", "3d");
    localStorage.setItem("kurisu-avatar-voice-enabled", "false");
  });
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Kurisu", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("toolbar", { name: "Управление аватаром" }).waitFor({ state: "visible", timeout: 15_000 });

  const threeD = page.getByRole("button", { name: /Выбрать 3D/ });
  await threeD.waitFor({ state: "visible", timeout: 15_000 });
  if ((await threeD.getAttribute("aria-pressed")) !== "true") await threeD.click();
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('[role="group"][aria-label="Режим отображения персонажа"] button')]
      .find((element) => (element.getAttribute("aria-label") || "").startsWith("Выбрать 3D"));
    return button?.getAttribute("aria-pressed") === "true";
  }, undefined, { timeout: 10_000 });

  const stage = page.locator('section[aria-label="3D-тело Neuro-Kurisu"]');
  await stage.waitFor({ state: "visible", timeout: 15_000 });
  const canvas = stage.locator('canvas[aria-label="3D-модель Курису, потяните для поворота"]');
  await canvas.waitFor({ state: "visible", timeout: 20_000 });

  await page.getByText("NeuroKurisu_3D_v5.glb", { exact: true }).waitFor({ state: "visible", timeout: 75_000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('canvas[aria-label="3D-модель Курису, потяните для поворота"]');
    return element?.dataset.avatarModelMeshCount && Number(element.dataset.avatarVisibleMeshCount) > 0
      && Number(element.dataset.avatarSkinnedMeshCount) > 0;
  }, undefined, { timeout: 15_000 });
  const audit = stage.locator('details[aria-label="Диагностика вторичной физики аватара"]');
  await audit.waitFor({ state: "visible", timeout: 10_000 });
  if (!(await audit.getAttribute("open"))) await audit.locator("summary").click();
  await audit.getByText("GPU vertex sway: 11 mesh", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  report.diagnostics = await audit.innerText();

  report.modelRuntime = await canvas.evaluate((element) => ({
    meshCount: Number(element.dataset.avatarModelMeshCount || 0),
    visibleMeshCount: Number(element.dataset.avatarVisibleMeshCount || 0),
    skinnedMeshCount: Number(element.dataset.avatarSkinnedMeshCount || 0),
    cameraDistance: Number(element.dataset.avatarCameraDistance || 0),
    projectedCenterX: Number(element.dataset.avatarProjectedCenterX || Number.NaN),
    projectedCenterY: Number(element.dataset.avatarProjectedCenterY || Number.NaN),
    renderCalls: Number(element.dataset.avatarRenderCalls || 0),
    renderedTriangles: Number(element.dataset.avatarRenderedTriangles || 0),
  }));
  assert.ok(report.modelRuntime.visibleMeshCount > 0, "loaded model must have visible meshes");
  assert.ok(report.modelRuntime.skinnedMeshCount > 0, "loaded model must have skinned meshes");
  assert.ok(report.modelRuntime.cameraDistance > 0, "camera must be fitted to normalized model bounds");
  assert.ok(Math.abs(report.modelRuntime.projectedCenterX) < 0.25 && Math.abs(report.modelRuntime.projectedCenterY) < 0.25,
    "model center must be projected near the center of the viewport");
  assert.ok(report.modelRuntime.renderCalls > 0 && report.modelRuntime.renderedTriangles > 0,
    "WebGL must draw the loaded model, not only an empty background");
  report.webgl = await canvas.evaluate((element) => {
    const gl = element.getContext("webgl2") || element.getContext("webgl");
    if (!gl) return { available: false, version: null, renderer: null, width: element.width, height: element.height };
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      available: true,
      version: gl.getParameter(gl.VERSION),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      width: element.width,
      height: element.height,
      drawingBufferWidth: gl.drawingBufferWidth,
      drawingBufferHeight: gl.drawingBufferHeight,
    };
  });
  assert.equal(report.webgl.available, true, "Three.js canvas must expose an active WebGL context");
  assert.ok(report.webgl.drawingBufferWidth > 0 && report.webgl.drawingBufferHeight > 0, "WebGL drawing buffer must be non-empty");
  assert.match(report.diagnostics, /GPU vertex sway: 11 mesh/, "all allowlisted v5 meshes must be attached");
  await page.waitForTimeout(1_500);
  assert.deepEqual(report.pageErrors, [], "3D avatar emitted an uncaught browser exception");
  assert.deepEqual(report.shaderErrors, [], "3D avatar emitted a WebGL shader/program compilation error");
  const glbFailures = [...report.failedRequests, ...report.failedResponses].filter((item) => /\.glb(?:$|\?)/i.test(item.url));
  assert.deepEqual(glbFailures, [], "canonical GLB request must succeed: " + JSON.stringify(glbFailures));
  if (await audit.evaluate((element) => element.open)) await audit.locator("summary").click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('details[aria-label="Диагностика вторичной физики аватара"]');
    return panel instanceof HTMLDetailsElement && panel.open === false;
  }, undefined, { timeout: 5_000 });
  // Hide only overlay DOM inside the screenshot fixture; do not mutate the app or canvas.
  await stage.evaluate((element) => {
    const canvasElement = element.querySelector('canvas[aria-label="3D-модель Курису, потяните для поворота"]');
    if (!canvasElement) throw new Error("3D canvas disappeared before clean capture");
    const keep = new Set([canvasElement]);
    let parent = canvasElement.parentElement;
    while (parent && parent !== element) {
      keep.add(parent);
      parent = parent.parentElement;
    }
    if (parent !== element) throw new Error("3D canvas is not contained by the avatar stage");
    for (const child of Array.from(element.querySelectorAll("*"))) {
      if (!keep.has(child) && !child.contains(canvasElement)) {
        child.style.setProperty("display", "none", "important");
      }
    }
    if (getComputedStyle(canvasElement).display === "none" || canvasElement.getBoundingClientRect().width <= 0) {
      throw new Error("3D canvas became hidden during overlay cleanup");
    }
  });
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: report.canvasScreenshot });
  await stage.screenshot({ path: report.stageScreenshot });
  await page.screenshot({ path: report.screenshot, fullPage: true });
  report.ok = true;
  report.boundary = "Real v5 model loaded in Chromium SwiftShader; selected mesh bindings and WebGL context were observed. This does not establish native GPU performance or visual acceptance on the user's physical Android device.";
  await writeFile(path.join(outputDir, "avatar-3d-webgl-smoke.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("NK1_AVATAR_3D_WEBGL_SMOKE=PASS");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.ok = false;
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(outputDir, "avatar-3d-webgl-smoke.json"), JSON.stringify(report, null, 2) + "\n");
  console.error("NK1_AVATAR_3D_WEBGL_SMOKE=FAIL");
  console.error(report.error);
  throw error;
} finally {
  await browser.close();
}
