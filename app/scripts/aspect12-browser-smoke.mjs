#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(appRoot);
const baseUrl = process.env.ASPECT12_BASE_URL || "http://127.0.0.1:8080/";
const reportPath = path.resolve(repoRoot, process.env.ASPECT12_REPORT_PATH || "artifacts/aspect12-browser-smoke.json");
const sourceSha = process.env.GITHUB_SHA || process.env.SOURCE_SHA || "local-unbound";
const startupTimeoutMs = Number(process.env.ASPECT12_STARTUP_TIMEOUT_MS || 90000);

export function collectBrowserFailures(viewports) {
  const failures = [];
  for (const sample of viewports) {
    if (sample.httpStatus !== 200) failures.push(`${sample.viewport}: HTTP ${sample.httpStatus}`);
    if (!sample.title) failures.push(`${sample.viewport}: missing document title`);
    if (sample.bodyTextLength < 20) failures.push(`${sample.viewport}: rendered body is unexpectedly empty`);
    if (sample.horizontalOverflow) failures.push(`${sample.viewport}: horizontal overflow`);
    if (sample.consoleErrors.length) failures.push(`${sample.viewport}: ${sample.consoleErrors.length} console error(s)`);
    if (sample.pageErrors.length) failures.push(`${sample.viewport}: ${sample.pageErrors.length} uncaught page error(s)`);
    if (sample.failedRequests.length) failures.push(`${sample.viewport}: ${sample.failedRequests.length} failed request(s)`);
  }
  return failures;
}

export function summarizeBrowserSample(sample) {
  const entries = Array.isArray(sample?.samples) ? sample.samples : [];
  const sorted = entries.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null;
  return {
    count: sorted.length,
    min: sorted.length ? sorted[0] : null,
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

async function waitForServer(child) {
  const started = Date.now();
  let lastError = "not attempted";
  while (Date.now() - started < startupTimeoutMs) {
    if (child.exitCode !== null) throw new Error(`Vite exited before becoming ready (code ${child.exitCode})`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return { startupMs: Date.now() - started, status: response.status };
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`App server did not become ready within ${startupTimeoutMs}ms: ${lastError}`);
}

async function inspectViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: name === "mobile" ? 2 : 1, isMobile: name === "mobile" });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500)); });
  page.on("pageerror", error => pageErrors.push(String(error).slice(0, 500)));
  page.on("requestfailed", request => failedRequests.push({ url: request.url().slice(0, 300), error: request.failure()?.errorText ?? "unknown" }));
  const started = Date.now();
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(900);
  const browserMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType("resource");
    return {
      title: document.title,
      bodyTextLength: (document.body?.innerText ?? "").trim().length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      documentHeight: document.documentElement.scrollHeight,
      domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
      loadEventMs: nav?.loadEventEnd ?? null,
      firstContentfulPaintMs: paints.find(x => x.name === "first-contentful-paint")?.startTime ?? null,
      resourceCount: resources.length,
      transferSizeBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
      jsResourceCount: resources.filter(item => /\.m?js(?:\?|$)/i.test(item.name)).length,
      // Diagnose both visible off-canvas boxes and clipped scroll containers.
      // scrollWidth can exceed the viewport even when every element's border box
      // remains inside it (for example, a transformed child or pseudo-element).
      overflowCandidates: [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const before = getComputedStyle(element, "::before");
          const after = getComputedStyle(element, "::after");
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className: typeof element.className === "string" ? element.className.slice(0, 160) : null,
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            scrollDelta: element.scrollWidth - element.clientWidth,
            minWidth: style.minWidth,
            maxWidth: style.maxWidth,
            computedWidth: style.width,
            transform: style.transform,
            gridTemplateColumns: style.gridTemplateColumns,
            flex: style.flex,
            position: style.position,
            overflowX: style.overflowX,
            whiteSpace: style.whiteSpace,
            beforeContent: before.content,
            beforeWidth: before.width,
            beforeTransform: before.transform,
            afterContent: after.content,
            afterWidth: after.width,
            afterTransform: after.transform,
            text: (element.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 80),
          };
        })
        .filter((item) => item.width > 0 && (item.right > window.innerWidth + 1 || item.left < -1))
        .sort((a, b) => b.right - a.right)
        .slice(0, 12),
      scrollContainers: [document.documentElement, document.body, ...document.querySelectorAll("body *")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className: typeof element.className === "string" ? element.className.slice(0, 160) : null,
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            scrollDelta: element.scrollWidth - element.clientWidth,
            minWidth: style.minWidth,
            computedWidth: style.width,
            transform: style.transform,
            overflowX: style.overflowX,
            gridTemplateColumns: style.gridTemplateColumns,
            flex: style.flex,
          };
        })
        .sort((a, b) => b.scrollDelta - a.scrollDelta)
        .slice(0, 20),
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content ?? null,
      rootMetrics: {
        innerWidth: window.innerWidth,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
    };
  });
  const result = {
    viewport: name, httpStatus: response?.status() ?? null, navigationWallMs: Date.now() - started,
    ...browserMetrics, horizontalOverflow: browserMetrics.scrollWidth > browserMetrics.clientWidth + 2,
    consoleErrors, pageErrors, failedRequests,
  };
  await context.close();
  return result;
}

async function main() {
  // This script is launched with plain Node, not through npm, so app/.bin is
  // not injected into PATH. Resolve Vite from the locked app installation and
  // run it through Node while retaining with-app-env's canonical hydration.
  const viteCli = path.join(appRoot, "node_modules", "vite", "bin", "vite.js");
  const server = spawn(process.execPath, [
    "scripts/with-app-env.mjs", process.execPath, viteCli, "dev",
    "--host", "127.0.0.1", "--port", "8080", "--strictPort",
  ], { cwd: appRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let serverOutput = "";
  server.stdout.on("data", chunk => { serverOutput = (serverOutput + chunk.toString()).slice(-6000); });
  server.stderr.on("data", chunk => { serverOutput = (serverOutput + chunk.toString()).slice(-6000); });
  let browser;
  let report;
  try {
    const startup = await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const viewports = [
      await inspectViewport(browser, "desktop", { width: 1365, height: 900 }),
      await inspectViewport(browser, "mobile", { width: 390, height: 844 }),
    ];
    const failures = collectBrowserFailures(viewports);
    report = {
      schemaVersion: 1, aspect: 12, sourceSha, generatedAt: new Date().toISOString(),
      baseUrl, startup, status: failures.length ? "FAIL" : "PASS",
      performance: {
        navigationWallMs: summarizeBrowserSample({ samples: viewports.map(x => x.navigationWallMs) }),
        domContentLoadedMs: summarizeBrowserSample({ samples: viewports.map(x => x.domContentLoadedMs).filter(Number.isFinite) }),
        firstContentfulPaintMs: summarizeBrowserSample({ samples: viewports.map(x => x.firstContentfulPaintMs).filter(Number.isFinite) }),
        transferSizeBytes: viewports.map(x => ({ viewport: x.viewport, bytes: x.transferSizeBytes })),
      },
      viewports, failures, serverOutput,
      limitations: ["This is a basic browser boot/render smoke, not full login/chat/avatar/voice E2E.", "Chromium measurements are CI baselines, not physical Android performance measurements."],
    };
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    if (failures.length) process.exitCode = 1;
  } catch (error) {
    report = { schemaVersion: 1, aspect: 12, sourceSha, generatedAt: new Date().toISOString(), status: "ERROR", error: error instanceof Error ? error.message : String(error), serverOutput };
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
      if (server.exitCode === null) server.kill("SIGKILL");
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
