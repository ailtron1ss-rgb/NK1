import test from 'node:test';
import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';

function envelope(sessionId, overrides = {}) {
  return {
    protocol: 'neko.asr.transcript',
    version: 1,
    eventId: 'embodiment-event-1',
    sessionId,
    turnId: 'embodiment-turn-1',
    provider: 'faster-whisper-local',
    speakerRole: 'user',
    phase: 'final',
    transcript: 'Проверка входящей речи',
    ...overrides,
  };
}

test('EmbodimentRuntime accepts a host-injected final ASR transcript and exposes provider provenance', async () => {
  let providerSessionId = '';
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal(request) {
      providerSessionId = request.sessionId;
      return envelope(request.sessionId);
    },
  });
  runtime.body.sttAvailable = true;
  assert.equal(runtime.speechInputProviderId, 'faster-whisper-local');
  assert.equal(await runtime.listen(), 'Проверка входящей речи');
  assert.ok(providerSessionId.length > 0);
  assert.equal(runtime.voiceSnapshot().state.listening, false);
  assert.equal(runtime.voiceSnapshot().state.lastError, null);
});

test('EmbodimentRuntime does not claim ASR interruption when provider cancellation is unverified', async () => {
  let release;
  let captureStarted;
  const started = new Promise(resolve => { captureStarted = resolve; });
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal() {
      captureStarted();
      return new Promise(resolve => { release = resolve; });
    },
    async cancelSession() {
      return { requested: true, verified: false, reason: 'provider-stop-not-confirmed' };
    },
  });
  runtime.body.sttAvailable = true;
  const pending = runtime.listen();
  await started;
  const interrupted = await runtime.markVoiceInterruption('user-interrupt');
  assert.equal(interrupted, false);
  assert.match(runtime.voiceSnapshot().state.lastError, /asr-interruption-unverified/);
  release(null);
  assert.equal(await pending, null);
  assert.equal(runtime.voiceSnapshot().state.listening, false);
});
console.log('NEKO_ASR_EMBODIMENT_WIRING=PASS');
