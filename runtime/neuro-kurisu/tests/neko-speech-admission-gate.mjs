import test from 'node:test';
import assert from 'node:assert/strict';
import { NekoSpeechAdmissionGate } from '../src/organism/integration/neko/NekoSpeechAdmissionGate.ts';

const SAMPLE_RATE = 16_000;
const FRAME_SAMPLES = 512;
function frame(index, probability01 = 0.9, patch = {}) {
  return {
    sampleRateHz: SAMPLE_RATE,
    startSample: index * FRAME_SAMPLES,
    endSample: (index + 1) * FRAME_SAMPLES,
    probability01,
    ...patch,
  };
}
function feed(gate, count, probability01 = 0.9, from = 0) {
  let result = null;
  for (let i = 0; i < count; i += 1) result = gate.observe(frame(from + i, probability01));
  return result;
}

test('admits a sustained local-speech candidate on the bounded 480 ms occupancy window', () => {
  const gate = new NekoSpeechAdmissionGate('session-a');
  const result = feed(gate, 8);
  assert.equal(result?.decision, 'admit');
  assert.equal(result?.reason, 'speech_window');
  assert.equal(result?.sampleRateHz, SAMPLE_RATE);
  assert.equal(result?.candidateId, 1);
  assert.equal(result?.voicedSamples, 8 * FRAME_SAMPLES);
  assert.equal(result?.observedSamples, 8 * FRAME_SAMPLES);
  assert.equal(result?.voicedAudioMs, 256);
  assert.equal(result?.probabilityMean01, 0.9);
  assert.equal(result?.terminalAudioEndSample, 7 * FRAME_SAMPLES);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(gate.snapshot, result);
});

test('keeps a short incomplete observation pending instead of treating it as a turn', () => {
  const gate = new NekoSpeechAdmissionGate('session-b');
  const result = feed(gate, 6);
  assert.equal(result?.decision, 'pending');
  assert.equal(result?.reason, 'collecting');
});

test('counts missing sample ranges as gaps, never as voice or silence', () => {
  const gate = new NekoSpeechAdmissionGate('session-c');
  gate.observe(frame(0));
  const result = feed(gate, 7, 0.9, 2);
  assert.equal(result?.decision, 'admit');
  assert.equal(result?.missingSamples, FRAME_SAMPLES);
  assert.equal(result?.observedSamples, 8 * FRAME_SAMPLES);
  assert.equal(result?.audioStartSample, 0);
  assert.equal(result?.audioEndSample, 9 * FRAME_SAMPLES);
  assert.equal(result?.longestGapSamples, FRAME_SAMPLES);
});

test('rejects candidates with an excessive uninterrupted speech gap', () => {
  const gate = new NekoSpeechAdmissionGate('session-d');
  gate.observe(frame(0));
  const result = feed(gate, 4, 0, 1);
  assert.equal(result?.decision, 'reject');
  assert.equal(result?.reason, 'speech_gap');
  assert.equal(result?.longestGapSamples, 4 * FRAME_SAMPLES);
});

test('rejects candidates exceeding the maximum candidate span without occupancy', () => {
  const gate = new NekoSpeechAdmissionGate('session-e');
  let result = null;
  for (let i = 0; i < 21; i += 1) result = gate.observe(frame(i, i % 2 === 0 ? 0.9 : 0.1));
  assert.equal(result?.decision, 'reject');
  assert.equal(result?.reason, 'candidate_timeout');
});

test('starts a fresh candidate after a rejected candidate and freezes prior evidence', () => {
  const gate = new NekoSpeechAdmissionGate('session-f');
  const rejected = gate.observe(frame(0));
  feed(gate, 4, 0, 1);
  assert.equal(gate.snapshot?.decision, 'reject');
  const newCandidate = gate.observe(frame(5));
  assert.equal(newCandidate?.decision, 'pending');
  assert.equal(newCandidate?.candidateId, 2);
  assert.equal(newCandidate?.audioStartSample, 5 * FRAME_SAMPLES);
  assert.equal(rejected?.decision, 'pending', 'earlier snapshots are immutable point-in-time values');
});

test('seal freezes the candidate and allows a successor without resetting sample time', () => {
  const gate = new NekoSpeechAdmissionGate('session-g');
  const admitted = feed(gate, 8);
  assert.equal(admitted?.decision, 'admit');
  assert.equal(gate.seal(), admitted);
  assert.equal(gate.snapshot, null);
  const next = gate.observe(frame(8));
  assert.equal(next?.candidateId, 2);
  assert.equal(next?.audioStartSample, 8 * FRAME_SAMPLES);
});

test('rejects malformed, overlapping, non-monotonic, and non-Silero frame evidence', () => {
  const gate = new NekoSpeechAdmissionGate('session-h');
  assert.throws(() => gate.observe(frame(0, Number.NaN)), /invalid-speech-probability-window/);
  assert.throws(() => gate.observe(frame(0, 0.5, { sampleRateHz: 48_000 })), /invalid-speech-probability-window/);
  assert.throws(() => gate.observe(frame(0, 0.5, { endSample: 511 })), /invalid-speech-probability-window/);
  gate.observe(frame(0));
  assert.throws(() => gate.observe(frame(0)), /speech-sample-range-overlap/);
  assert.throws(() => gate.observe(frame(1, 1.01)), /invalid-speech-probability-window/);
});

test('does not invoke accessors or proxy traps in provider-supplied activity frames', () => {
  const gate = new NekoSpeechAdmissionGate('session-i');
  let getterCalls = 0;
  const accessor = frame(0);
  Object.defineProperty(accessor, 'probability01', {
    enumerable: true,
    get() { getterCalls += 1; return 0.9; },
  });
  assert.throws(() => gate.observe(accessor), /invalid-speech-probability-window/);
  assert.equal(getterCalls, 0);
  const proxy = new Proxy(frame(0), {
    getPrototypeOf() { throw new Error('proxy-trap'); },
  });
  assert.throws(() => gate.observe(proxy), /invalid-speech-probability-window/);
});

test('keeps per-session state bounded to the rolling admission window', () => {
  const gate = new NekoSpeechAdmissionGate('session-j');
  feed(gate, 8);
  assert.equal(gate.diagnostics().rollingFrames, 8);
  feed(gate, 12, 0.1, 8);
  assert.ok(gate.diagnostics().rollingFrames <= 16);
  assert.equal(gate.diagnostics().sampleRateHz, SAMPLE_RATE);
});

console.log('NEKO_SPEECH_ADMISSION_GATE=PASS tests=10');
