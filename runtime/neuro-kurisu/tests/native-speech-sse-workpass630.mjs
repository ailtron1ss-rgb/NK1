import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import {
  nativeSpeechSseStreamStats,
  startNativeSpeechSseStream,
} from '../src/server/native-speech-sse.mjs';

function createRuntimeSource() {
  const listeners = new Set();
  return {
    subscribeNativeSpeechEvents(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(event) {
      for (const listener of [...listeners]) listener(event);
    },
    listenerCount() { return listeners.size; },
  };
}

function providerEvent(overrides = {}) {
  return {
    protocol: 'nk1.native-speech-provider-event',
    version: 1,
    eventId: 'native-speech-1',
    operationId: 'speech-operation-1',
    sequence: 1,
    provider: 'termux-tts-speak',
    monotonicTimeMs: 10,
    phase: 'process-spawned',
    playbackVerified: false,
    ...overrides,
  };
}

function createResponse(writeResults = []) {
  const response = new EventEmitter();
  response.frames = [];
  response.status = null;
  response.headers = null;
  response.destroyed = false;
  response.writableEnded = false;
  response.writeHead = (status, headers) => { response.status = status; response.headers = headers; };
  response.write = (frame) => {
    response.frames.push(String(frame));
    return writeResults.length ? writeResults.shift() : true;
  };
  response.end = () => { response.writableEnded = true; response.emit('close'); };
  response.destroy = () => { response.destroyed = true; response.emit('close'); };
  return response;
}

function createRequest() {
  return new EventEmitter();
}

const noopInterval = () => 1;
const noopClearInterval = () => {};

test('streams only validated provider envelopes and preserves playbackVerified=false', () => {
  const source = createRuntimeSource();
  const request = createRequest();
  const response = createResponse();
  const stream = startNativeSpeechSseStream(request, response, source, {
    setIntervalFn: noopInterval,
    clearIntervalFn: noopClearInterval,
  });

  assert.equal(stream.ok, true);
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/event-stream/);
  assert.equal(source.listenerCount(), 1);

  source.publish(providerEvent());
  source.publish(providerEvent({
    eventId: 'native-speech-forged',
    operationId: 'forged',
    sequence: 1,
    playbackVerified: true,
  }));

  const eventFrame = response.frames.find((frame) => frame.includes('event: nk1.native_speech_provider_event'));
  assert.ok(eventFrame);
  assert.match(eventFrame, /"eventId":"native-speech-1"/);
  assert.match(eventFrame, /"playbackVerified":false/);
  assert.doesNotMatch(response.frames.join(''), /"playbackVerified":true/);

  response.emit('close');
  assert.equal(source.listenerCount(), 0);
  assert.equal(nativeSpeechSseStreamStats().activeStreams, 0);
});

test('rejects a regressing event before the SSE transport receives it', () => {
  const source = createRuntimeSource();
  const response = createResponse();
  startNativeSpeechSseStream(createRequest(), response, source, {
    setIntervalFn: noopInterval,
    clearIntervalFn: noopClearInterval,
  });

  source.publish(providerEvent());
  source.publish(providerEvent({ eventId: 'native-speech-2', sequence: 1, monotonicTimeMs: 9 }));
  const payloads = response.frames.join('');
  assert.match(payloads, /native-speech-1/);
  assert.doesNotMatch(payloads, /native-speech-2/);
  response.emit('close');
});

test('bounded backpressure closes rather than accumulating an unbounded event queue', () => {
  const source = createRuntimeSource();
  const response = createResponse([false]);
  const stream = startNativeSpeechSseStream(createRequest(), response, source, {
    maxPendingFrames: 2,
    setIntervalFn: noopInterval,
    clearIntervalFn: noopClearInterval,
  });

  source.publish(providerEvent());
  source.publish(providerEvent({ eventId: 'native-speech-2', sequence: 2, monotonicTimeMs: 11 }));
  source.publish(providerEvent({ eventId: 'native-speech-3', sequence: 3, monotonicTimeMs: 12 }));
  assert.equal(response.writableEnded, true);
  assert.equal(source.listenerCount(), 0);
  assert.equal(nativeSpeechSseStreamStats().activeStreams, 0);
  stream.close();
});

test('heartbeat backpressure queues provider events until drain', () => {
  const source = createRuntimeSource();
  const response = createResponse([true, false]);
  let heartbeatCallback = null;
  startNativeSpeechSseStream(createRequest(), response, source, {
    setIntervalFn: (callback) => { heartbeatCallback = callback; return 1; },
    clearIntervalFn: noopClearInterval,
  });

  assert.equal(typeof heartbeatCallback, 'function');
  heartbeatCallback();
  source.publish(providerEvent());
  assert.doesNotMatch(response.frames.join(''), /native-speech-1/);

  response.emit('drain');
  assert.match(response.frames.join(''), /native-speech-1/);
  response.emit('close');
  assert.equal(source.listenerCount(), 0);
});

test('enforces a per-process active stream limit', () => {
  const source = createRuntimeSource();
  const responses = [];
  for (let index = 0; index < 8; index += 1) {
    const response = createResponse();
    responses.push(response);
    const stream = startNativeSpeechSseStream(createRequest(), response, source, {
      maxStreams: 8,
      setIntervalFn: noopInterval,
      clearIntervalFn: noopClearInterval,
    });
    assert.equal(stream.ok, true);
  }
  const rejected = createResponse();
  const result = startNativeSpeechSseStream(createRequest(), rejected, source, {
    maxStreams: 8,
    setIntervalFn: noopInterval,
    clearIntervalFn: noopClearInterval,
  });
  assert.equal(result.ok, false);
  assert.equal(rejected.status, 503);

  for (const response of responses) response.emit('close');
  assert.equal(nativeSpeechSseStreamStats().activeStreams, 0);
});
