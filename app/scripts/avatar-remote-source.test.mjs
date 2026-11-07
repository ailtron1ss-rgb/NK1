import assert from "node:assert/strict";
import test from "node:test";
import { MAX_AVATAR_MODEL_BYTES } from "../src/components/avatar/avatarModelLimits.ts";
import {
  fetchRemoteAvatarModel,
  validateRemoteAvatarUrl,
} from "../src/components/avatar/remoteAvatarSource.ts";
import { preflightAvatarModel } from "../src/components/avatar/avatarModelPreflight.ts";

function makeGlb() {
  const document = {
    asset: { version: "2.0", generator: "NK1 remote import test" },
    buffers: [{ byteLength: 4 }],
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const bin = new Uint8Array([1, 2, 3, 4]);
  const total = 12 + 8 + jsonLength + 8 + 4;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(json, 20);
  const binOffset = 20 + jsonLength;
  view.setUint32(binOffset, 4, true);
  view.setUint32(binOffset + 4, 0x004e4942, true);
  bytes.set(bin, binOffset + 8);
  return bytes;
}

test("accepts public HTTPS URLs and extracts a sanitized VRM/GLB filename", () => {
  const source = validateRemoteAvatarUrl("https://cdn.example/models/Kurisu%20Lab.vrm?version=5");
  assert.equal(source.href, "https://cdn.example/models/Kurisu%20Lab.vrm?version=5");
  assert.equal(source.filename, "Kurisu_Lab.vrm");
});

test("rejects insecure, credentialed, local, private and service-network URLs", () => {
  const invalid = [
    "http://cdn.example/kurisu.vrm",
    "ftp://cdn.example/kurisu.vrm",
    "https://user:secret@cdn.example/kurisu.vrm",
    "https://localhost/kurisu.vrm",
    "https://avatar.local/kurisu.vrm",
    "https://metadata.internal/kurisu.vrm",
    "https://127.0.0.1/kurisu.vrm",
    "https://10.0.0.4/kurisu.vrm",
    "https://172.16.4.2/kurisu.vrm",
    "https://192.168.1.5/kurisu.vrm",
    "https://169.254.169.254/kurisu.vrm",
    "https://[::1]/kurisu.vrm",
    "https://[fd00::1]/kurisu.vrm",
    "https://[::ffff:7f00:1]/kurisu.vrm",
    "https://[fec0::1]/kurisu.vrm",
  ];
  for (const value of invalid) assert.throws(() => validateRemoteAvatarUrl(value), undefined, value);
});

test("rejects URLs that do not identify a VRM or GLB file", () => {
  assert.throws(() => validateRemoteAvatarUrl("https://cdn.example/models/latest"), /расширением/);
  assert.throws(() => validateRemoteAvatarUrl("https://cdn.example/models/avatar.zip"), /расширением/);
});

test("downloads bounded bytes without credentials, cookies, redirects or referrer leakage", async () => {
  const bytes = makeGlb();
  let receivedUrl = "";
  let receivedInit = null;
  const result = await fetchRemoteAvatarModel(
    "https://cdn.example/models/kurisu.glb",
    {
      fetchImpl: async (url, init) => {
        receivedUrl = String(url);
        receivedInit = init;
        return new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } });
      },
    },
  );

  assert.equal(receivedUrl, "https://cdn.example/models/kurisu.glb");
  assert.equal(receivedInit.credentials, "omit");
  assert.equal(receivedInit.mode, "cors");
  assert.equal(receivedInit.redirect, "error");
  assert.equal(receivedInit.referrerPolicy, "no-referrer");
  assert.equal(receivedInit.cache, "no-store");
  assert.equal(result.filename, "kurisu.glb");
  assert.equal(result.byteLength, bytes.byteLength);
  const downloaded = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual(downloaded, bytes);
  assert.equal(preflightAvatarModel(downloaded, result.filename).format, "glb");
});

test("rejects an oversized declared response before reading the body", async () => {
  let bodyRead = false;
  const bytes = makeGlb();
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      maxBytes: 20,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "100000" }),
        body: {
          getReader() {
            bodyRead = true;
            return {
              read: async () => ({ done: true, value: undefined }),
              cancel: async () => undefined,
              releaseLock: () => undefined,
            };
          },
        },
      }),
    }),
    /превышает лимит/,
  );
  assert.equal(bodyRead, false);
});

test("enforces the byte ceiling while streaming when Content-Length is absent", async () => {
  const tooLarge = new Uint8Array(80);
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      maxBytes: 40,
      fetchImpl: async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(tooLarge.subarray(0, 32));
          controller.enqueue(tooLarge.subarray(32));
          controller.close();
        },
      })),
    }),
    /превышает лимит/,
  );
});

test("rejects HTTP failures and invalid length headers, then leaves binary integrity to GLB preflight", async () => {
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      fetchImpl: async () => new Response("missing", { status: 404 }),
    }),
    /HTTP 404/,
  );
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "many" }),
        body: new Response(makeGlb()).body,
      }),
    }),
    /некорректный Content-Length/,
  );

  const bytes = makeGlb();
  const truncated = bytes.subarray(0, bytes.byteLength - 1);
  const downloaded = await fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
    fetchImpl: async () => new Response(truncated, {
      headers: { "content-length": String(bytes.byteLength) },
    }),
  });
  assert.equal(downloaded.byteLength, truncated.byteLength);
  const data = new Uint8Array(await downloaded.blob.arrayBuffer());
  assert.throws(() => preflightAvatarModel(data, downloaded.filename), /glb-length-mismatch/);
});

test("enforces a bounded timeout and honors caller cancellation", async () => {
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      timeoutMs: 5,
      fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    }),
    /Время загрузки модели истекло/,
  );

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      signal: controller.signal,
      fetchImpl: async () => { throw new Error("fetch should not run"); },
    }),
    /Загрузка модели отменена/,
  );
});

test("rejects invalid policy overrides instead of permitting a larger download", async () => {
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      maxBytes: MAX_AVATAR_MODEL_BYTES + 1,
      fetchImpl: async () => new Response(makeGlb()),
    }),
    /допустимом диапазоне/,
  );
  await assert.rejects(
    fetchRemoteAvatarModel("https://cdn.example/kurisu.glb", {
      timeoutMs: 120_001,
      fetchImpl: async () => new Response(makeGlb()),
    }),
    /Тайм-аут/,
  );
});

test("preserves byte order across multiple streamed chunks", async () => {
  const bytes = makeGlb();
  const cuts = [1, 7, 19, bytes.byteLength - 2, bytes.byteLength];
  const stream = new ReadableStream({
    start(controller) {
      let offset = 0;
      for (const end of cuts) {
        controller.enqueue(bytes.slice(offset, end));
        offset = end;
      }
      controller.close();
    },
  });

  const result = await fetchRemoteAvatarModel(
    "https://cdn.example/models/multichunk.glb",
    { fetchImpl: async () => new Response(stream) },
  );

  assert.equal(result.byteLength, bytes.byteLength);
  const downloaded = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual(downloaded, bytes);
  assert.equal(preflightAvatarModel(downloaded, result.filename).format, "glb");
});
