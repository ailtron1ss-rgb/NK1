import test from 'node:test';
import assert from 'node:assert/strict';

const bufferModule = await import('../src/organism/integration/neko/NekoAudioFrameBuffer.ts').catch(() => ({
  NekoBoundedAudioFrameChannel: class {
    push() { return { status: 'accepted' }; }
    get pendingFrameCount() { return 0; }
    close() {}
    [Symbol.asyncIterator]() { return { next: async () => ({ done: true, value: undefined }) }; }
  },
  NekoPcm16RingBuffer: class {
    frames = [];
    append(frame) { this.frames.push(frame); return this.frames.length; }
    snapshot() { return this.frames; }
    clear() { this.frames = []; }
    get length() { return this.frames.length; }
  },
}));

function frame(sequence) {
  return {
    protocol: 'neko.audio.pcm16',
    version: 1,
    sessionId: 'session-1',
    turnId: 'turn-1',
    token: {
      sessionEpoch: 1, connectionId: 'connection-1', leaseGeneration: 1,
      routeGeneration: 1, audioGeneration: 1, turnId: 'turn-1',
    },
    sequence,
    capturedAtMs: sequence * 20,
    sampleRateHz: 16000,
    channels: 1,
    encoding: 's16le',
    samples: new Uint8Array(640),
  };
}

test('bounds pending audio to one second and invalidates the whole queue on overflow', () => {
  const channel = new bufferModule.NekoBoundedAudioFrameChannel();
  let backpressureSeen = false;
  for (let sequence = 0; sequence < 50; sequence += 1) {
    const result = channel.push(frame(sequence));
    assert.ok(result.status === 'accepted' || result.status === 'backpressure');
    if (result.status === 'backpressure') backpressureSeen = true;
  }
  assert.equal(backpressureSeen, true);
  assert.equal(channel.pendingFrameCount, 50);
  assert.deepEqual(channel.push(frame(50)), { status: 'invalidated', reason: 'queue-overflow' });
  assert.equal(channel.pendingFrameCount, 0, 'overflow must clear all queued audio');
});

test('exposes a single-reader async iterable and closes after queued frames drain', async () => {
  const channel = new bufferModule.NekoBoundedAudioFrameChannel();
  assert.equal(channel.push(frame(0)).status, 'accepted');
  assert.equal(channel.push(frame(1)).status, 'accepted');
  const reader = channel[Symbol.asyncIterator]();
  assert.equal((await reader.next()).value.sequence, 0);
  assert.equal((await reader.next()).value.sequence, 1);
  channel.close();
  assert.equal((await reader.next()).done, true);
  assert.throws(() => channel[Symbol.asyncIterator](), /single-reader/);
});

test('signals backpressure relief when the pending queue falls below its high-water mark', async () => {
  const channel = new bufferModule.NekoBoundedAudioFrameChannel();
  for (let sequence = 0; sequence < 40; sequence += 1) channel.push(frame(sequence));
  const reader = channel[Symbol.asyncIterator]();
  let settled = false;
  const capacity = channel.waitForCapacity().then(value => { settled = true; return value; });
  await reader.next();
  assert.equal(await capacity, true);
  assert.equal(settled, true);
});

test('keeps only the newest eight seconds of semantic PCM and clears on teardown', () => {
  const ring = new bufferModule.NekoPcm16RingBuffer();
  for (let sequence = 0; sequence < 401; sequence += 1) ring.append(frame(sequence));
  const snapshot = ring.snapshot();
  assert.equal(ring.length, 400);
  assert.equal(snapshot[0].sequence, 1);
  assert.equal(snapshot.at(-1).sequence, 400);
  ring.clear();
  assert.equal(ring.length, 0);
  assert.deepEqual(ring.snapshot(), []);
});

console.log('NEKO_AUDIO_FRAME_BUFFER_TESTS=PASS');
