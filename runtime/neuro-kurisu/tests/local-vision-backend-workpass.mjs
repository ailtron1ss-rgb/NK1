import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalOpenAICompatibleVisionBackend } from '../src/organism/body/LocalOpenAICompatibleVisionBackend.ts';

const directory = await mkdtemp(path.join(os.tmpdir(), 'nk1-local-vision-'));
const imagePath = path.join(directory, 'scene.png');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5Z8AAAAASUVORK5CYII=', 'base64');
await writeFile(imagePath, png);

try {
  assert.throws(
    () => new LocalOpenAICompatibleVisionBackend({ baseUrl: 'https://example.com/v1' }),
    /loopback-http/,
    'remote vision endpoints must fail closed',
  );
  assert.throws(
    () => new LocalOpenAICompatibleVisionBackend({ baseUrl: 'http://example.com/v1' }),
    /loopback-http/,
    'non-loopback HTTP endpoints must fail closed',
  );
  assert.throws(
    () => new LocalOpenAICompatibleVisionBackend({ baseUrl: 'http://user:password@127.0.0.1:8080/v1' }),
    /loopback-http/,
    'URL credentials must be rejected',
  );

  let requestUrl = '';
  let requestBody;
  let calls = 0;
  const objects = Array.from({ length: 60 }, (_, i) => ({
    label: `object-${i}`,
    kind: i === 0 ? 'unknown-kind' : 'object',
    confidence01: i / 60,
    x: i / 60,
    y: 1.2,
    z: -0.2,
  }));
  const validResult = {
    sceneLabel: 'desk and notebook',
    confidence01: 0.87,
    objects,
    relations: Array.from({ length: 70 }, (_, i) => ({ from: `object-${i}`, relation: 'near', to: 'notebook', confidence01: 0.7 })),
    events: Array.from({ length: 30 }, (_, i) => ({ label: `event-${i}`, confidence01: 0.6 })),
  };
  const backend = new LocalOpenAICompatibleVisionBackend({
    baseUrl: 'http://127.0.0.1:8080/v1/',
    model: 'tiny-vlm-q4',
    timeoutMs: 2500,
    maxImageBytes: 32000,
    fetchImpl: async (url, init) => {
      calls++;
      requestUrl = String(url);
      requestBody = JSON.parse(init.body);
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.equal(init.signal.aborted, false);
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(validResult) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const result = await backend.analyze({
    imagePath,
    at: Date.now(),
    cameraId: 1,
    context: { scene: 'current room', uncertainty01: 0.2 },
  });
  assert.equal(requestUrl, 'http://127.0.0.1:8080/v1/chat/completions');
  assert.equal(requestBody.model, 'tiny-vlm-q4');
  assert.equal(requestBody.max_tokens, 768);
  assert.equal(requestBody.temperature, 0);
  const userContent = requestBody.messages[1].content;
  assert.equal(userContent[0].type, 'text');
  assert.ok(userContent[0].text.includes('uncertainty=0.20'));
  assert.equal(userContent[1].type, 'image_url');
  assert.ok(userContent[1].image_url.url.startsWith('data:image/png;base64,'));
  assert.equal(result.semantic, true);
  assert.equal(result.backend, 'local-vision:tiny-vlm-q4');
  assert.equal(result.sceneLabel, 'desk and notebook');
  assert.equal(result.objects.length, 48, 'object output must be bounded');
  assert.equal(result.objects[0].kind, 'unknown', 'unsupported class labels must be normalized');
  assert.equal(result.objects[0].y, undefined, 'out-of-range coordinates must be discarded');
  assert.equal(result.objects[0].z, undefined, 'negative coordinates must be discarded');
  assert.equal(result.relations.length, 64, 'relation output must be bounded');
  assert.equal(result.events.length, 24, 'event output must be bounded');
  assert.equal(result.evidenceKind, 'model-output');
  assert.equal(calls, 1);

  await writeFile(imagePath, Buffer.alloc(32001, 7));
  await assert.rejects(
    () => backend.analyze({ imagePath, at: Date.now(), cameraId: 1 }),
    /image-too-large/,
  );
  assert.equal(calls, 1, 'oversized images must be rejected before any network request');

  const oversizeResponseBackend = new LocalOpenAICompatibleVisionBackend({
    baseUrl: 'http://127.0.0.1:8080/v1',
    fetchImpl: async () => new Response('', { status: 200, headers: { 'content-length': '2200000' } }),
  });
  await writeFile(imagePath, png);
  await assert.rejects(
    () => oversizeResponseBackend.analyze({ imagePath, at: Date.now(), cameraId: 1 }),
    /response-too-large/,
  );

  const invalidResponseBackend = new LocalOpenAICompatibleVisionBackend({
    baseUrl: 'http://127.0.0.1:8080/v1',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not JSON' } }] }), { status: 200 }),
  });
  await assert.rejects(
    () => invalidResponseBackend.analyze({ imagePath, at: Date.now(), cameraId: 1 }),
    /invalid-json/,
  );

  console.log('LOCAL_VISION_BACKEND=PASS', JSON.stringify({
    loopbackOnly: true,
    multimodalPayload: true,
    boundedImageAndResponse: true,
    normalizedOutput: true,
    malformedOutputRejected: true,
  }));
} finally {
  await rm(directory, { recursive: true, force: true });
}
