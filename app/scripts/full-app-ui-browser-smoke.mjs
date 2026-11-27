import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = String(process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const outputDir = path.resolve(process.argv[3] || ".artifacts/full-app-ui");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  schemaVersion: 1,
  baseUrl,
  checks: [],
  profiles: [],
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
  failedResponses: [],
  visualCompletionVerified: false,
};

function check(name, ok, detail = "") {
  report.checks.push({ name, ok: Boolean(ok), detail: String(detail) });
  assert.ok(ok, name + (detail ? ": " + detail : ""));
}

async function waitForLive2DReady(page, profile, label = "initial") {
  const handle = await page.waitForFunction(() => {
    const iframe = [...document.querySelectorAll("iframe")].find((element) => {
      try { return new URL(element.src, window.location.href).pathname === "/live2d/viewer.html"; }
      catch { return false; }
    });
    const viewerDocument = iframe?.contentDocument;
    const viewerStatus = viewerDocument?.querySelector("#status")?.textContent?.trim() ?? "";
    if (!viewerStatus.startsWith("ок ·") && viewerStatus !== "fallback") return false;
    const canvas = viewerDocument?.querySelector("#canvas");
    const rect = canvas?.getBoundingClientRect();
    return {
      status: viewerStatus,
      modelPath: viewerStatus.startsWith("ок ·") ? viewerStatus.slice(4).trim() : null,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      cssWidth: Math.round(rect?.width ?? 0),
      cssHeight: Math.round(rect?.height ?? 0),
    };
  }, undefined, { timeout: 45_000 });
  const state = await handle.jsonValue();
  check(profile + ": Live2D " + label + " reaches model-ready state",
    state.status.startsWith("ок ·"), state.status);
  check(profile + ": Live2D " + label + " has a non-zero WebGL canvas",
    state.canvasWidth > 0 && state.canvasHeight > 0 && state.cssWidth > 0 && state.cssHeight > 0,
    JSON.stringify(state));
  return state;
}

async function smokeProfile(profile) {
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 1 });
  if (profile.name === "desktop") {
    await context.addInitScript(() => {
      localStorage.setItem("kurisu-avatar-mode", "original");
      localStorage.setItem("kurisu-avatar-voice-enabled", "false");
    });
  }
  const page = await context.newPage();
  // Desktop restores Original2D; mobile begins in Live2D. Only aborts for
  // Live2D-owned assets after switching away from that renderer are expected.
  let selectedRenderer = profile.name === "desktop" ? "original" : "live2d";
  const errors = { page: [], console: [], requests: [], responses: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.console.push(message.text()); });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || "failed";
    let pathname = "";
    try { pathname = new URL(url).pathname; } catch {}
    const expectedRendererUnload = failure === "net::ERR_ABORTED"
      && selectedRenderer !== "live2d"
      && pathname.startsWith("/live2d/");
    if (!/favicon\.ico(?:$|\?)/i.test(url) && !expectedRendererUnload) {
      errors.requests.push({ url, failure });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:$|\?)/i.test(response.url())) errors.responses.push({ url: response.url(), status: response.status() });
  });
  const snapshotResponsePromise = page.waitForResponse((response) => {
    try { return new URL(response.url()).pathname === "/api/organism/ui-snapshot"; } catch { return false; }
  }, { timeout: 45_000 }).catch(() => null);

  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "NeuroCore", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const snapshotResponse = await snapshotResponsePromise;
  check(profile.name + ": live organism snapshot", Boolean(snapshotResponse && snapshotResponse.status() === 200), snapshotResponse ? "HTTP " + snapshotResponse.status() : "ui-snapshot request missing or timed out");

  await page.getByRole("toolbar", { name: "Управление аватаром" }).waitFor({ state: "visible" });
  await page.getByRole("group", { name: "Режим отображения персонажа" }).waitFor({ state: "visible" });
  const live2d = page.getByRole("button", { name: /Выбрать Live2D/ });
  const legacy = page.getByRole("button", { name: /Выбрать Legacy/ });
  const original = page.getByRole("button", { name: /Выбрать NK1 Original/ });
  const threeD = page.getByRole("button", { name: /Выбрать 3D/ });
  for (const [name, control] of [["Live2D", live2d], ["Legacy", legacy], ["Original 2D", original], ["3D preview", threeD]]) {
    check(profile.name + ": visible " + name + " selector", await control.isVisible());
  }
  if (profile.name === "desktop") {
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('[role="group"][aria-label="Режим отображения персонажа"] button')]
        .find((element) => (element.getAttribute("aria-label") || "").startsWith("Выбрать NK1 Original"));
      return button?.getAttribute("aria-pressed") === "true";
    }, undefined, { timeout: 8_000 });
    check("desktop: saved Original2D preference restores after hydration", (await original.getAttribute("aria-pressed")) === "true");
    selectedRenderer = "live2d";
    await live2d.click();
    check("desktop: Live2D can be selected after preference restore", (await live2d.getAttribute("aria-pressed")) === "true");
    await waitForLive2DReady(page, profile.name, "first selection");
  } else {
    check("mobile: Live2D default is deterministic without saved preference", (await live2d.getAttribute("aria-pressed")) === "true");
    await waitForLive2DReady(page, profile.name, "default selection");
  }
  check(profile.name + ": 3D is explicitly preview-only", /предпросмотр/i.test(await threeD.getAttribute("aria-label") || ""));

  await page.getByRole("heading", { name: "Cognitive cycle" }).waitFor({ state: "visible" });
  const messageInput = page.getByPlaceholder("Write to Kurisu…");
  await messageInput.waitFor({ state: "visible" });
  const chatForm = messageInput.locator("xpath=ancestor::form");
  const send = chatForm.getByRole("button", { name: "Send", exact: true });
  check(profile.name + ": Send is disabled before input", await send.isDisabled());
  await messageInput.fill("UI smoke only — message is not submitted");
  check(profile.name + ": Send enables for non-empty input", !(await send.isDisabled()));
  await messageInput.fill("");

  if (profile.name === "desktop") {
    for (const label of ["Needs", "Identity", "Workspace", "Policy"]) {
      check("desktop: MindHud panel " + label, await page.getByText(label, { exact: true }).isVisible());
    }
  } else {
    const compactStatus = page.locator("main div.grid.grid-cols-2.gap-2").filter({
      has: page.getByText("emotion", { exact: true }),
    });
    await compactStatus.waitFor({ state: "visible" });
    for (const label of ["emotion", "option", "energy", "PE"]) {
      check("mobile: compact status " + label, await compactStatus.getByText(label, { exact: true }).isVisible());
    }
  }

  const status = page.getByRole("status", { name: "Тип выбранного тела и подтверждение кадра" });
  await status.waitFor({ state: "visible" });
  check(profile.name + ": truthful frame status visible", (await status.innerText()).length > 10);

  if (profile.name === "desktop") {
    await page.screenshot({ path: path.join(outputDir, "full-app-desktop.png"), fullPage: true });
    selectedRenderer = "original";
    await original.click();
    check("desktop: Original2D becomes selected", (await original.getAttribute("aria-pressed")) === "true");
    await page.waitForFunction(() => document.querySelector('[role="status"][aria-label="Тип выбранного тела и подтверждение кадра"]')?.textContent?.includes("SVG DOM сформирован"), undefined, { timeout: 8_000 }).catch(() => null);
    const originalStatus = await status.innerText();
    check("desktop: Original2D DOM-commit receipt is exposed", originalStatus.includes("SVG DOM сформирован"), originalStatus);
    selectedRenderer = "legacy";
    await legacy.click();
    check("desktop: Legacy fallback becomes selected", (await legacy.getAttribute("aria-pressed")) === "true");
    check("desktop: Legacy status is honest", (await status.innerText()).includes("статичный fallback"));
    selectedRenderer = "live2d";
    await live2d.click();
    check("desktop: Live2D recovery selector works", (await live2d.getAttribute("aria-pressed")) === "true");
    await waitForLive2DReady(page, profile.name, "recovery");
  } else {
    await page.screenshot({ path: path.join(outputDir, "full-app-mobile.png"), fullPage: true });
    selectedRenderer = "original";
    await original.click();
    check("mobile: Original2D selector works", (await original.getAttribute("aria-pressed")) === "true");
    selectedRenderer = "legacy";
    await legacy.click();
    check("mobile: Legacy selector works", (await legacy.getAttribute("aria-pressed")) === "true");
    selectedRenderer = "live2d";
    await live2d.click();
    check("mobile: Live2D recovery selector works", (await live2d.getAttribute("aria-pressed")) === "true");
    await waitForLive2DReady(page, profile.name, "recovery");
  }

  const layout = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders = [...document.querySelectorAll("body *")].map((node) => {
      const element = node;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: style.overflowX,
      };
    }).filter((item) => item.right > viewportWidth + 2 || item.scrollWidth > item.clientWidth + 2)
      .sort((a, b) => Math.max(b.right - viewportWidth, b.scrollWidth - b.clientWidth) - Math.max(a.right - viewportWidth, a.scrollWidth - a.clientWidth))
      .slice(0, 30);
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
      tickText: [...document.querySelectorAll("header span")].map((node) => node.textContent?.trim()).filter(Boolean),
      overflowOffenders: offenders,
    };
  });
  check(profile.name + ": no page-level horizontal overflow", layout.documentWidth <= layout.viewportWidth + 1, JSON.stringify(layout));
  const visibleRuntimeErrors = await page.locator("div").filter({ hasText: /^Runtime:/ }).count();
  check(profile.name + ": no visible runtime error banner", visibleRuntimeErrors === 0, "runtime error banners=" + visibleRuntimeErrors);

  report.profiles.push({ name: profile.name, viewport: profile.viewport, layout, errors });
  report.pageErrors.push(...errors.page.map((message) => ({ profile: profile.name, message })));
  report.consoleErrors.push(...errors.console.map((message) => ({ profile: profile.name, message })));
  report.failedRequests.push(...errors.requests.map((item) => ({ profile: profile.name, ...item })));
  report.failedResponses.push(...errors.responses.map((item) => ({ profile: profile.name, ...item })));
  await context.close();
}

try {
  await smokeProfile({ name: "desktop", viewport: { width: 1440, height: 1000 } });
  await smokeProfile({ name: "mobile", viewport: { width: 390, height: 844 } });
  check("no uncaught browser page errors", report.pageErrors.length === 0, JSON.stringify(report.pageErrors));
  check("no browser console errors", report.consoleErrors.length === 0, JSON.stringify(report.consoleErrors));
  check("no failed network requests", report.failedRequests.length === 0, JSON.stringify(report.failedRequests));
  check("no HTTP error responses", report.failedResponses.length === 0, JSON.stringify(report.failedResponses));
  report.visualCompletionVerified = false;
  report.boundary = "Full React UI rendered in Chromium and controls are interactive. This smoke does not prove GPU/display presentation, OS audio playback or physical-device acceptance.";
  await writeFile(path.join(outputDir, "full-app-ui-smoke.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("NK1_FULL_APP_UI_BROWSER_SMOKE=PASS");
  console.log(JSON.stringify({ checks: report.checks.length, profiles: report.profiles, visualCompletionVerified: false }));
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(outputDir, "full-app-ui-smoke.json"), JSON.stringify(report, null, 2) + "\n");
  console.error("NK1_FULL_APP_UI_BROWSER_SMOKE=FAIL");
  console.error(error);
  throw error;
} finally {
  await browser.close();
}