import test from 'node:test';
import assert from 'node:assert/strict';

const contract = await import('../src/organism/integration/neko/NekoAudioStreamContract.ts').catch(() => null);

const token = () => ({
  sessionEpoch: 2,
  connectionId: 'connection-1',
  leaseGeneration: 3,
  routeGeneration: 4,
  audioGeneration: 5,
  turnId: 'turn-1',
});

function frame(overrides = {}) {
  return {
    protocol: 'neko.audio.pcm16',
    version: 1,
    sessionId: 'session-1',
    turnId: 'turn-1',
    token: token(),
    sequence: 0,
    capturedAtMs: 1000,
    sampleRateHz: 16000,
    channels: 1,
    encoding: 's16le',
    samples: new Uint8Array(640),
    ...overrides,
  };
}

function requireApi() {
  assert.ok(contract, 'NekoAudioStreamContract module must be available');
  assert.equal(typeof contract.validateNekoPcm16Frame, 'function');
  assert.equal(typeof contract.NekoPcm16FrameSequenceGuard, 'function');
}

test('accepts exactly one normalized 20ms PCM16 mono frame', () => {
  requireApi();
  const result = contract.validateNekoPcm16Frame(frame());
  assert.equal(result.status, 'accepted');
  assert.equal(result.frame.samples.byteLength, 640);
  assert.notEqual(result.frame.samples, frame().samples, 'validated frames must own a defensive copy of PCM bytes');
});

test('rejects unsupported format, malformed sample payloads, and invalid timing metadata', () => {
  requireApi();
  const invalid = [
    { sampleRateHz: 48000 },
    { channels: 2 },
    { encoding: 'f32le' },
    { samples: new Uint8Array(638) },
    { samples: new Uint8Array(642) },
    { capturedAtMs: Number.NaN },
    { sequence: -1 },
  ];
  for (const patch of invalid) {
    assert.equal(contract.validateNekoPcm16Frame(frame(patch)).status, 'rejected');
  }
});

test('accepts monotonic frames and treats an exact duplicate as replay without a second effect', () => {
  requireApi();
  const first = contract.validateNekoPcm16Frame(frame());
  const second = contract.validateNekoPcm16Frame(frame({ sequence: 1, capturedAtMs: 1020 }));
  assert.equal(first.status, 'accepted');
  assert.equal(second.status, 'accepted');

  const guard = new contract.NekoPcm16FrameSequenceGuard({
    sessionId: 'session-1',
    turnId: 'turn-1',
    token: token(),
  });
  assert.equal(guard.accept(first.frame).status, 'accepted');
  assert.equal(guard.accept(first.frame).status, 'replayed');
  assert.equal(guard.accept(second.frame).status, 'accepted');
});

test('invalidates a turn on conflicting duplicate bytes or a sequence gap', () => {
  requireApi();
  const guardForConflict = new contract.NekoPcm16FrameSequenceGuard({
    sessionId: 'session-1',
    turnId: 'turn-1',
    token: token(),
  });
  const first = contract.validateNekoPcm16Frame(frame());
  const conflicting = contract.validateNekoPcm16Frame(frame({ samples: Uint8Array.from([1, ...new Uint8Array(639)]) }));
  assert.equal(guardForConflict.accept(first.frame).status, 'accepted');
  assert.deepEqual(guardForConflict.accept(conflicting.frame), {
    status: 'invalidated',
    reason: 'sequence-conflict',
  });

  const guardForGap = new contract.NekoPcm16FrameSequenceGuard({
    sessionId: 'session-1',
    turnId: 'turn-1',
    token: token(),
  });
  const gap = contract.validateNekoPcm16Frame(frame({ sequence: 2, capturedAtMs: 1040 }));
  assert.equal(guardForGap.accept(gap.frame).status, 'invalidated');
  assert.equal(guardForGap.accept(gap.frame).reason, 'sequence-gap');
});

console.log('NEKO_AUDIO_STREAM_CONTRACT_TESTS=PASS');
