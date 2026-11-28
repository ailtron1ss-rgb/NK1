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
  expectedSecondaryParticleMeshes: 13,
  expectedSecondaryBodyCollisionSurface: "BODY_torso_core",
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
  await page.waitForFunction(() => {
    const panel = document.querySelector('details[aria-label="Диагностика вторичной физики аватара"]');
    return panel instanceof HTMLDetailsElement && panel.textContent?.includes("All secondary meshes:");
  }, undefined, { timeout: 10_000 });
  report.diagnostics = await audit.innerText();
  const allSecondaryMatch = report.diagnostics.match(/All secondary meshes:[ ]*([0-9]+)/);
  const xpbdMatch = report.diagnostics.match(/XPBD surface particles:[ ]*([0-9]+)[ ]+mesh/);
  report.secondaryRuntimeCounts = {
    allSecondary: allSecondaryMatch ? Number(allSecondaryMatch[1]) : null,
    xpbdParticles: xpbdMatch ? Number(xpbdMatch[1]) : null,
    canvasXpbdParticles: await canvas.evaluate((element) => Number(element.dataset.avatarSecondaryParticleMeshCount || 0)),
    bodyCollisionSurface: await canvas.evaluate((element) => element.dataset.avatarSecondaryBodyCollisionSurface || "none"),
    bodyCollisionReady: await canvas.evaluate((element) => element.dataset.avatarSecondaryBodyCollisionReady === "true"),
    bodyCollisionVertices: await canvas.evaluate((element) => Number(element.dataset.avatarSecondaryBodyCollisionCount || 0)),
    bodyCollisionBuild: await canvas.evaluate((element) => { try { return JSON.parse(element.dataset.avatarSecondaryBodyCollisionBuild || "{}"); } catch { return { reason: "invalid-diagnostic-json" }; } }),
    expected: report.expectedSecondaryParticleMeshes,
  };
  assert.equal(report.secondaryRuntimeCounts.allSecondary, 13,
    "canonical v5 must expose 12 attached secondary meshes; actual diagnostics: " + report.diagnostics);
  assert.equal(report.secondaryRuntimeCounts.xpbdParticles, 13,
    "canonical v5 must activate XPBD on all 12 selected surfaces; actual diagnostics: " + report.diagnostics);
  assert.equal(report.secondaryRuntimeCounts.canvasXpbdParticles, 13,
    "canvas runtime diagnostic must agree with the visible XPBD particle count");
  assert.equal(report.secondaryRuntimeCounts.bodyCollisionSurface, report.expectedSecondaryBodyCollisionSurface,
    "canonical v5 must resolve its exact skinned BODY_torso_core collision surface");
  assert.equal(report.secondaryRuntimeCounts.bodyCollisionReady, true,
    "canonical v5 torso triangle data must build a usable bounded collision grid: " + JSON.stringify(report.secondaryRuntimeCounts.bodyCollisionBuild));
  assert.match(report.diagnostics, /(?:GPU sway|XPBD-симуляция частиц поверхности)/,
    "canonical v5 must expose an active secondary deformation path");

  report.modelAxisDiagnostics = await canvas.evaluate((element) => {
    const raw = element.dataset.avatarModelAxisDiagnostics;
    return raw ? JSON.parse(raw) : null;
  });
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
  report.morphInitialization = await canvas.evaluate((element) => {
    const raw = element.dataset.avatarMorphInitialization;
    return raw ? JSON.parse(raw) : null;
  });
  assert.ok(report.morphInitialization && report.morphInitialization.meshCount > 0,
    "the generic GLB loader must expose its pre-bounds facial morph initialization report");
  assert.ok(report.morphInitialization.managedTargetCount > 0,
    "the canonical GLB must expose NK1-managed facial morph targets");
  assert.ok(report.morphInitialization.resetTargetCount > 0,
    "the canonical GLB must prove that non-neutral imported facial weights were reset before the first render");
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
  await page.waitForTimeout(1_500);

  // Request a one-frame GPU readback from this exact canvas instance. The full
  // responsive page may mount both desktop and mobile avatar stages; a global
  // querySelector can select a different canvas from the one we just requested.
  await canvas.scrollIntoViewIfNeeded();
  const pixelAuditCanvas = await canvas.elementHandle();
  assert.ok(pixelAuditCanvas, "the selected 3D canvas must have a stable DOM element");
  await canvas.evaluate((element) => {
    delete element.dataset.avatarPixelAudit;
    delete element.dataset.avatarPixelAuditPng;
    element.dataset.avatarPixelAuditRequested = "true";
    // Wake one render frame explicitly when the visibility scheduler has paused this canvas.
    element.dispatchEvent(new Event("nk1:avatar-pixel-audit-request"));
  });
  await page.waitForFunction((element) => {
    return element instanceof HTMLCanvasElement
      && typeof element.dataset.avatarPixelAudit === "string";
  }, pixelAuditCanvas, { timeout: 10_000 });
  report.modelPixelAudit = await canvas.evaluate((element) => JSON.parse(element.dataset.avatarPixelAudit || "null"));
  const pixelPng = await canvas.evaluate((element) => element.dataset.avatarPixelAuditPng || "");
  if (pixelPng.startsWith("data:image/png;base64,")) {
    await writeFile(path.join(outputDir, "avatar-3d-framebuffer-readback.png"),
      Buffer.from(pixelPng.slice("data:image/png;base64,".length), "base64"));
    report.modelPixelReadbackImage = "avatar-3d-framebuffer-readback.png";
  }
  assert.ok(report.modelPixelAudit && report.modelPixelAudit.opaquePixelCount > 250,
    "the model must contribute opaque pixels to the real WebGL framebuffer");
  assert.ok(report.modelPixelAudit.bounds
    && report.modelPixelAudit.bounds.width > report.modelPixelAudit.width * 0.2
    && report.modelPixelAudit.bounds.height > report.modelPixelAudit.height * 0.2,
  "the rendered avatar must occupy a meaningful part of the 3D canvas");

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