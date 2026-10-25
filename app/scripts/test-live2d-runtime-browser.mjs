import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(appRoot);
const publicRoot = path.join(repoRoot, "runtime", "neuro-kurisu", "public");
const live2dRoot = path.join(publicRoot, "live2d");
const snapshot = {
  ok: true, version: "runtime-smoke", tick: 987, awake: true,
  state: { lastAction: "respond", needs: { energy: 0.7, cognitiveLoad: 0.2, uncertainty: 0.1 } },
  emotion: { label: "joy", valence: 0.85, arousal: 0.6 },
  voice: { speaking: true, listening: false, ttsAvailable: true, sttAvailable: false },
};
let avatarSpeechStartedAt = null;

const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".mjs", "application/javascript; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".png", "image/png"], [".moc3", "application/octet-stream"],
]);

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function brightPngPixels(png) {
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), "canvas screenshot must be PNG");
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset); offset += 4;
    const type = png.toString("ascii", offset, offset + 4); offset += 4;
    const data = png.subarray(offset, offset + length); offset += length + 4;
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  assert.equal(bitDepth, 8); assert.ok(colorType === 2 || colorType === 6); assert.equal(interlace, 0);
  const channels = colorType === 6 ? 4 : 3, stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat)), decoded = Buffer.alloc(stride * height);
  let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[input++], row = y * stride, prior = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[input++], left = x >= channels ? decoded[row + x - channels] : 0;
      const up = y > 0 ? decoded[prior + x] : 0, upLeft = y > 0 && x >= channels ? decoded[prior + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error("unsupported PNG filter " + filter);
      decoded[row + x] = (value + predictor) & 255;
    }
  }
  let bright = 0;
  for (let p = 0; p < width * height; p++) if (Math.max(decoded[p * channels], decoded[p * channels + 1], decoded[p * channels + 2]) > 64) bright++;
  return { width, height, bright };
}

const harness = '<!doctype html><html><body style="margin:0;background:#111"><iframe id="viewer" style="width:760px;height:840px;border:0"></iframe><script>window.__msgs=[];addEventListener("message",e=>{const f=document.getElementById("viewer");if(e.origin===location.origin&&e.source===f.contentWindow)window.__msgs.push(e.data)});</script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || "/", "http://127.0.0.1").pathname);
    if (pathname === "/__test__") { res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}); res.end(harness); return; }
    if (pathname === "/api/organism/ui-snapshot") { res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}); res.end(JSON.stringify(snapshot)); return; }
    if (pathname === "/api/organism/avatar-speech") {
      if (avatarSpeechStartedAt === null) avatarSpeechStartedAt = Date.now() - 20;
      res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
      res.end(JSON.stringify({ok:true,speaking:true,speechEventId:"runtime-smoke-speech",text:"мама, а!",startedAt:avatarSpeechStartedAt,rate:1,updatedAt:Date.now()}));
      return;
    }
    if (pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const filePath = path.resolve(publicRoot, "." + pathname);
    const relative = path.relative(publicRoot, filePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403); res.end("forbidden"); return; }
    let bytes = await readFile(filePath);
    if (pathname === "/live2d/viewer.html") {
      let source = bytes.toString("utf8");
      const expressionAnchor = "try{model.expression(expressionName);lastAppliedExpression=expressionName}catch{}";
      const motionAnchor = "try{model.motion(String(bodySignal.motionGroup),Number(bodySignal.motionIndex||0));lastMotionKey=k}catch{}";
      const embodimentAnchor = "const signal=sanitizeEmbodiment(d);\n      if(signal)applyEmbodiment(signal);";
      const lipsyncAnchor = "lipTarget=clamp(d.value,0,1);";
      for (const anchor of [expressionAnchor,motionAnchor,embodimentAnchor,lipsyncAnchor]) {
        if (!source.includes(anchor)) throw new Error("runtime viewer smoke instrumentation anchor missing: " + anchor);
      }
      source = source.replace(expressionAnchor,
        "try{model.expression(expressionName);lastAppliedExpression=expressionName;window.__nk1RuntimeExpression=expressionName}catch{}");
      source = source.replace(motionAnchor,
        "try{model.motion(String(bodySignal.motionGroup),Number(bodySignal.motionIndex||0));lastMotionKey=k;window.__nk1RuntimeMotion={group:String(bodySignal.motionGroup),index:Number(bodySignal.motionIndex||0)}}catch{}");
      source = source.replace(embodimentAnchor,
        "const signal=sanitizeEmbodiment(d);\n      if(signal){applyEmbodiment(signal);window.__nk1RuntimeLastEmbodiment={...signal,mouthViseme:d.mouthViseme};}");
      source = source.replace(lipsyncAnchor, "lipTarget=clamp(d.value,0,1);window.__nk1RuntimeLipTarget=lipTarget;");
      bytes = Buffer.from(source, "utf8");
    }
    res.writeHead(200,{"content-type":mime.get(path.extname(filePath)) || "application/octet-stream","content-length":String(bytes.length),"cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end(bytes);
  } catch (error) {
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"}); res.end("not found");
  }
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
const address=server.address();
assert.ok(address && typeof address === "object");
const origin="http://127.0.0.1:"+address.port;
let browser;
try {
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--enable-webgl","--ignore-gpu-blocklist","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  for (const profile of ["mobile","quality"]) {
    const page=await browser.newPage({viewport:{width:780,height:880},deviceScaleFactor:1});
    const errors=[], bad=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("response",r=>{if(r.status()>=400)bad.push(r.status()+" "+r.url());});
    await page.goto(origin+"/__test__",{waitUntil:"domcontentloaded"});
    await page.locator("#viewer").evaluate((f,src)=>{f.src=src;}, "/live2d/viewer.html?profile="+profile);
    await page.waitForFunction(()=>window.__msgs?.some(m=>m?.type==="live2d_ready"||m?.type==="live2d_error"),null,{timeout:60000});
    const ready=await page.evaluate(()=>window.__msgs.find(m=>m?.type==="live2d_ready"||m?.type==="live2d_error"));
    assert.equal(ready.type,"live2d_ready",profile+": runtime viewer boot failed: "+JSON.stringify(ready));
    assert.equal(ready.profile,profile);
    const frame=page.frames().find(f=>f.url().includes("/live2d/viewer.html"));
    await frame.waitForFunction(()=>document.getElementById("status")?.textContent?.startsWith("ок ·"));
    const canvas=await frame.evaluate(()=>{const c=document.getElementById("canvas"),gl=c.getContext("webgl2")||c.getContext("webgl")||c.getContext("experimental-webgl");return {width:c.width,height:c.height,webgl:Boolean(gl)};});
    assert.equal(canvas.webgl,true);
    const pixels=brightPngPixels(await frame.locator("#canvas").screenshot());
    assert.ok(pixels.bright>250,profile+": runtime canvas appears empty "+JSON.stringify(pixels));
    await page.locator("#viewer").evaluate((f)=>f.contentWindow.postMessage({type:"kurisu_expression",expression:"thinking"},location.origin));
    await page.locator("#viewer").evaluate((f)=>f.contentWindow.postMessage({type:"kurisu_embodiment",gazeX:0.2,gazeY:-0.1,gazeDriven:true,headTilt:-0.045,expressionIntensity:0.7,speaking:true,gesture:true,motionGroup:"TapBody",motionIndex:0,voiceEmphasis:0.7},location.origin));
    await page.locator("#viewer").evaluate((f)=>f.contentWindow.postMessage({type:"kurisu_lipsync",value:0.5},location.origin));
    await frame.waitForFunction(()=>window.__nk1RuntimeExpression==="Stanby Scared"&&window.__nk1RuntimeMotion?.group==="TapBody"&&window.__nk1RuntimeLastEmbodiment?.speaking===true&&window.__nk1RuntimeLipTarget===0.5,null,{timeout:5000});
    assert.deepEqual(errors,[],profile+": runtime viewer uncaught errors");
    assert.deepEqual(bad,[],profile+": runtime viewer failed local resources");
    console.log("NK1_LIVE2D_RUNTIME_PROFILE=PASS profile="+profile+" canvas="+canvas.width+"x"+canvas.height+" brightPixels="+pixels.bright);
    await page.close();
  }

  const page=await browser.newPage({viewport:{width:780,height:880},deviceScaleFactor:1});
  const errors=[],bad=[];
  page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400)bad.push(r.status()+" "+r.url());});
  await page.goto(origin+"/avatar.html",{waitUntil:"domcontentloaded"});
  const frame=page.frames().find(f=>f.url().includes("/live2d/viewer.html"));
  assert.ok(frame,"avatar.html must mount the runtime viewer");
  await frame.waitForFunction(()=>window.__nk1RuntimeExpression==="Stanby Smile"&&window.__nk1RuntimeLastEmbodiment?.motionGroup==="Special"&&window.__nk1RuntimeLastEmbodiment?.mouthOpen>0.3&&window.__nk1RuntimeLipTarget>0&&window.__nk1RuntimeLastEmbodiment?.mouthViseme==="open",null,{timeout:15000});
  // The smoke text starts with a closed consonant, then opens on the vowel; an unchanging jaw cannot satisfy this assertion.
  assert.equal(await page.locator("#tick").textContent(),"tick 987");
  assert.equal(await page.locator("#state").textContent(),"awake · respond · joy");
  assert.equal((await frame.evaluate(()=>window.__nk1RuntimeLastEmbodiment?.speaking)),true);
  assert.deepEqual(errors,[],"avatar page uncaught errors");
  assert.deepEqual(bad,[],"avatar page failed local resources");
  console.log("NK1_LIVE2D_RUNTIME_AVATAR_WIRING=PASS snapshot->emotion->motion->lipsync");
  await page.close();
} finally {
  if(browser) await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
console.log("NK1_LIVE2D_RUNTIME_BROWSER_SMOKE=PASS profiles=mobile,quality avatar-wiring=1");
