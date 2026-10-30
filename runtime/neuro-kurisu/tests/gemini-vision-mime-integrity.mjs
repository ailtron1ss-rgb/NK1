import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GeminiVisionSemanticBackend, detectGeminiImageMimeType } from '../src/organism/body/GeminiVisionSemanticBackend.ts';

assert.equal(detectGeminiImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), 'image/jpeg');
assert.equal(detectGeminiImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
assert.equal(detectGeminiImageMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
assert.throws(() => detectGeminiImageMimeType(new Uint8Array([0, 1, 2, 3])), /unsupported-image-format/);

const directory = await mkdtemp(path.join(os.tmpdir(), 'nk1-gemini-vision-mime-'));
const imagePath = path.join(directory, 'camera.png');
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
await writeFile(imagePath, png);

const originalFetch = globalThis.fetch;
let sentMime = '';
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body ?? '{}'));
  sentMime = body.contents?.[0]?.parts?.[0]?.inline_data?.mime_type ?? '';
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            sceneLabel: 'laboratory',
            confidence01: 0.9,
            objects: [
              { label: 'chair', confidence01: 0.88, x: 0.2, y: 0.4, z: 7.5, bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, bboxConfidence01: 0.82 },
              { label: 'ambiguous-object', confidence01: 0.7, bbox: { x: 0.9, y: 0.9, width: 0.4, height: 0.4 }, bboxConfidence01: 0.9 },
            ],
            relations: [],
            events: [],
          }),
        }],
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

try {
  const backend = new GeminiVisionSemanticBackend({ apiKey: 'test-key', timeoutMs: 5_000 });
  const result = await backend.analyze({ imagePath, at: 100, cameraId: 0, context: { scene: 'laboratory' } });
  assert.equal(sentMime, 'image/png', 'the request MIME must match the actual camera bytes');
  assert.equal(result.semantic, true);
  assert.equal(result.objects.length, 2, 'objects with invalid boxes remain semantic observations');
  assert.equal(result.objects[1].label, 'ambiguous-object');
  assert.equal(result.objects[0].label, 'chair');
  assert.equal('x' in result.objects[0], false, '2D image-relative coordinates must not be passed as 3D world positions');
  assert.equal('y' in result.objects[0], false);
  assert.equal('z' in result.objects[0], false);
  assert.deepEqual(result.objects[0].bbox, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  assert.equal(result.objects[0].bboxConfidence01, 0.82);
  assert.equal('bbox' in result.objects[1], false, 'out-of-frame boxes are rejected');
} finally {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
}

console.log('GEMINI_VISION_MIME_AND_SPATIAL_TRUTHFULNESS=PASS');
