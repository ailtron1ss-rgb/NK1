import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
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


function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function countBrightPngPixels(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.subarray(0, 8).equals(signature), "Chromium screenshot must be a PNG");
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const compressed = [];
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset); offset += 4;
    const type = png.toString("ascii", offset, offset + 4); offset += 4;
    const data = png.subarray(offset, offset + length);
    offset += length + 4; // chunk body plus CRC
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") compressed.push(data);
    else if (type === "IEND") break;
  }
  assert.equal(bitDepth, 8, "PNG decoder expects 8-bit Chromium screenshots");
  assert.ok(colorType === 2 || colorType === 6, "PNG decoder supports RGB/RGBA screenshots");
  assert.equal(interlace, 0, "interlaced screenshot PNGs are unsupported");
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(compressed));
  const decoded = Buffer.alloc(stride * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inputOffset++];
    const row = y * stride;
    const priorRow = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[inputOffset++];
      const left = x >= channels ? decoded[row + x - channels] : 0;
      const up = y > 0 ? decoded[priorRow + x] : 0;
      const upLeft = y > 0 && x >= channels ? decoded[priorRow + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error("unsupported PNG filter " + filter);
      decoded[row + x] = (value + predictor) & 255;
    }
  }
  let brightPixels = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    const offset = pixel * channels;
    if (Math.max(decoded[offset], decoded[offset + 1], decoded[offset + 2]) > 64) brightPixels++;
  }
  return { width, height, brightPixels };
}

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
    let bytes = await readFile(filePath);
    if (pathname === "/viewer.html") {
      // Add test-only observability to the response in memory. The repository's
      // production viewer file remains unchanged.
      let source = bytes.toString("utf8");
      const expressionAnchor = "try{model.expression(expressionName);lastAppliedExpression=expressionName}catch{}";
      const motionAnchor = "try{model.motion(String(bodySignal.motionGroup),Number(bodySignal.motionIndex||0));lastMotionKey=k}catch{}";
      const intentAnchor = "applyEmbodiment(intent);\n  });\n  boot();";
      if (!source.includes(expressionAnchor) || !source.includes(motionAnchor) || !source.includes(intentAnchor)) {
        throw new Error("Live2D browser smoke instrumentation anchors missing");
      }
      source = source.replace(expressionAnchor,
        "try{model.expression(expressionName);lastAppliedExpression=expressionName;window.__nk1LastExpression=expressionName}catch{}");
      source = source.replace(motionAnchor,
        "try{model.motion(String(bodySignal.motionGroup),Number(bodySignal.motionIndex||0));lastMotionKey=k;window.__nk1LastMotion={group:String(bodySignal.motionGroup),index:Number(bodySignal.motionIndex||0),token}}catch{}");
      source = source.replace(intentAnchor,
        "applyEmbodiment(intent);\n    window.__nk1LastAcceptedIntent={stateVersion:intent.stateVersion,expression:intent.expression,motionGroup:intent.motionGroup,motionIndex:intent.motionIndex,motionToken:intent.motionToken,speaking:intent.speaking};\n  });\n  boot();");
      bytes = Buffer.from(source, "utf8");
    }
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

    const render = await frame.evaluate(() => {
      const canvas = document.getElementById("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      return { width: canvas.width, height: canvas.height, hasWebGL: Boolean(gl) };
    });
    assert.ok(render.hasWebGL, profile + ": no WebGL context; " + JSON.stringify(render));
    assert.ok(render.width >= 500 && render.height >= 500, profile + ": canvas unexpectedly small; " + JSON.stringify(render));
    // Read Chromium's composed screenshot rather than a WebGL drawing buffer that
    // browsers may discard after presentation when preserveDrawingBuffer=false.
    const screenshot = await frame.locator("#canvas").screenshot();
    const imageStats = countBrightPngPixels(screenshot);
    assert.ok(imageStats.brightPixels > 250, profile + ": rendered canvas appears empty; " + JSON.stringify(imageStats));

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
    await frame.waitForFunction(() => window.__nk1LastAcceptedIntent?.stateVersion === 2, null, { timeout: 5000 });

    // Invalid nested values must not be silently coerced to zero or advance the
    // accepted state version. The probes run through the production viewer handler.
    const postProbe = async (payload) => page.locator("#viewer").evaluate(
      (iframe, value) => iframe.contentWindow.postMessage(value, window.location.origin), payload,
    );
    const baseIntent = {
      type: "kurisu_embodiment_intent", protocolVersion: 1, stateVersion: 3,
      sentAtEpochMs: Date.now(), speechEventId: null, audioClockId: null,
      speechPhase: "idle", audioTimeMs: 0, clockSource: "none", priority: 30,
      cancellationToken: null, expression: "happy", expressionIntensity: 0.72,
      mouth: { open: 0.24, form: 0.18, viseme: "wide" },
      gaze: { x: 0.18, y: -0.12, driven: true },
      body: { headTilt: 0.025, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 3 },
      voiceEmphasis: 0,
    };
    await postProbe({ ...baseIntent, expressionIntensity: Number.NaN });
    await page.waitForTimeout(80);
    let observedVersion = await frame.evaluate(() => window.__nk1LastAcceptedIntent?.stateVersion);
    assert.equal(observedVersion, 2, profile + ": non-finite affect values must be rejected without advancing state");

    await postProbe({
      ...baseIntent, speechPhase: "speaking", speechEventId: "smoke-speech",
      audioClockId: "smoke-clock", clockSource: "none", audioTimeMs: 10,
    });
    await page.waitForTimeout(80);
    observedVersion = await frame.evaluate(() => window.__nk1LastAcceptedIntent?.stateVersion);
    assert.equal(observedVersion, 2, profile + ": speaking requires an explicit monotonic audio clock source");

    await frame.waitForFunction(() => window.__nk1LastExpression === "Stanby Smile", null, { timeout: 5000 });
    await frame.waitForFunction(() => window.__nk1LastMotion?.group === "Special" && window.__nk1LastMotion?.index === 1 && window.__nk1LastMotion?.token === 2, null, { timeout: 5000 });
    const appliedIntent = await frame.evaluate(() => ({
      ...window.__nk1LastAcceptedIntent,
      appliedExpression: window.__nk1LastExpression,
      appliedMotion: window.__nk1LastMotion,
    }));
    assert.equal(appliedIntent.stateVersion, 2, profile + ": viewer must accept the latest intent");
    assert.equal(appliedIntent.expression, "happy", profile + ": latest affect state was not accepted");
    assert.equal(appliedIntent.motionGroup, "Special", profile + ": motion group was not accepted");
    assert.equal(appliedIntent.appliedExpression, "Stanby Smile", profile + ": model expression API was not invoked");
    assert.deepEqual(appliedIntent.appliedMotion, { group: "Special", index: 1, token: 2 },
      profile + ": model motion API was not invoked for the latest intent");
    const finalStatus = await frame.locator("#status").textContent();
    assert.ok(finalStatus.startsWith("ок ·"), profile + ": viewer left ready state after expression/motion events");
    assert.deepEqual(pageErrors, [], profile + ": uncaught browser exceptions: " + pageErrors.join(" | "));
    assert.deepEqual(badResponses, [], profile + ": failed local asset requests: " + badResponses.join(" | "));
    console.log("NK1_LIVE2D_BROWSER_PROFILE=PASS profile=" + profile + " canvas=" + render.width + "x" + render.height + " brightPixels=" + imageStats.brightPixels);
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
