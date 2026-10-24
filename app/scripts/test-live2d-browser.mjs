import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { hydrateCanonicalPublicAssets } from "./sync-canonical-public-assets.mjs";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(appRoot);
const publicRoot = path.join(appRoot, "public", "live2d");
await hydrateCanonicalPublicAssets(repoRoot);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".moc3", "application/octet-stream"],
]);

const harness = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>NK1 Live2D smoke test</title></head><body style=\"margin:0;background:#111\"><iframe id=\"viewer\" title=\"Live2D viewer\" style=\"width:760px;height:840px;border:0\"></iframe><script>window.__live2dMessages=[];window.addEventListener('message',function(event){var frame=document.getElementById('viewer');if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data&&typeof event.data.type==='string')window.__live2dMessages.push(event.data)});</script></body></html>";

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
    if (pathname === "/__test__") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(harness);
      return;
    }
    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const filePath = path.resolve(publicRoot, "." + pathname);
    const relative = path.relative(publicRoot, filePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    const bytes = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      "content-length": String(bytes.length),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert.ok(address && typeof address === "object", "test server must bind to a TCP port");
const origin = "http://127.0.0.1:" + address.port;

let browser;
const allFailures = [];
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });

  async function exerciseProfile(profile) {
    const page = await browser.newPage({ viewport: { width: 780, height: 880 }, deviceScaleFactor: 1 });
    const pageErrors = [];
    const badResponses = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) badResponses.push(response.status() + " " + response.url());
    });
    await page.goto(origin + "/__test__", { waitUntil: "domcontentloaded" });
    await page.locator("#viewer").evaluate((iframe, src) => { iframe.src = src; }, "/viewer.html?profile=" + profile);

    let outcome;
    try {
      const handle = await page.waitForFunction(() => {
        const messages = window.__live2dMessages || [];
        return messages.find((message) => message.type === "live2d_ready" || message.type === "live2d_error") || false;
      }, null, { timeout: 60000 });
      outcome = await handle.jsonValue();
    } catch (error) {
      const status = await page.locator("#viewer").contentFrame().locator("#status").textContent().catch(() => "unavailable");
      allFailures.push(profile + ": timed out waiting for viewer boot; status=" + status + "; " + String(error));
      await page.close();
      return;
    }

    assert.equal(outcome.type, "live2d_ready", profile + " viewer failed to boot: " + JSON.stringify(outcome));
    assert.equal(outcome.profile, profile, "viewer must report the selected resource profile");
    const frame = page.frames().find((candidate) => candidate.url().includes("/viewer.html"));
    assert.ok(frame, profile + ": viewer iframe must exist");
    await frame.waitForFunction(() => {
      const canvas = document.getElementById("canvas");
      return document.getElementById("status")?.textContent?.startsWith("ок ·") && canvas && canvas.width > 0 && canvas.height > 0;
    }, null, { timeout: 15000 });

    const render = await frame.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = document.getElementById("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return { width: canvas.width, height: canvas.height, hasWebGL: false, visiblePixels: 0 };
      gl.finish();
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let visiblePixels = 0;
      for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] > 12) visiblePixels++;
      return { width: canvas.width, height: canvas.height, hasWebGL: true, visiblePixels };
    });
    assert.ok(render.hasWebGL, profile + ": no WebGL context; " + JSON.stringify(render));
    assert.ok(render.width >= 500 && render.height >= 500, profile + ": canvas unexpectedly small; " + JSON.stringify(render));
    assert.ok(render.visiblePixels > 250, profile + ": model canvas appears empty; " + JSON.stringify(render));

    const sendIntent = async (stateVersion, expression, motionGroup, motionIndex) => {
      const intent = {
        type: "kurisu_embodiment_intent",
        protocolVersion: 1,
        stateVersion,
        sentAtEpochMs: Date.now(),
        speechEventId: null,
        audioClockId: null,
        speechPhase: "idle",
        audioTimeMs: 0,
        clockSource: "none",
        priority: 30,
        cancellationToken: null,
        expression,
        expressionIntensity: 0.72,
        mouth: { open: 0.24, form: 0.18, viseme: "wide" },
        gaze: { x: 0.18, y: -0.12, driven: true },
        body: { headTilt: 0.025, gesture: true, motionGroup, motionIndex, motionToken: stateVersion },
        voiceEmphasis: 0,
      };
      await page.locator("#viewer").evaluate((iframe, payload) => iframe.contentWindow.postMessage(payload, window.location.origin), intent);
    };
    await sendIntent(1, "angry", "TapHead", 0);
    await sendIntent(2, "happy", "Special", 1);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const finalStatus = await frame.locator("#status").textContent();
    assert.ok(finalStatus.startsWith("ок ·"), profile + ": viewer left ready state after expression/motion events");
    assert.deepEqual(pageErrors, [], profile + ": uncaught browser exceptions: " + pageErrors.join(" | "));
    assert.deepEqual(badResponses, [], profile + ": failed local asset requests: " + badResponses.join(" | "));
    console.log("NK1_LIVE2D_BROWSER_PROFILE=PASS profile=" + profile + " canvas=" + render.width + "x" + render.height + " visiblePixels=" + render.visiblePixels);
    await page.close();
  }

  await exerciseProfile("mobile");
  if (allFailures.length) throw new Error(allFailures.join("\n"));
  await exerciseProfile("quality");
  if (allFailures.length) throw new Error(allFailures.join("\n"));
} finally {
  if (browser) await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

console.log("NK1_LIVE2D_BROWSER_SMOKE=PASS profiles=mobile,quality");
