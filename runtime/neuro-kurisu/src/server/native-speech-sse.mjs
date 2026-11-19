import { connectNativeSpeechHostRouter } from '../organism/body/NativeSpeechHostRouter.ts';

const DEFAULT_MAX_STREAMS = 8;
const DEFAULT_MAX_PENDING_FRAMES = 64;
const DEFAULT_HEARTBEAT_MS = 15_000;
let activeStreams = 0;

function isResponseWritable(response) {
  return !response.destroyed && !response.writableEnded;
}

function removeListener(target, name, listener) {
  if (typeof target.off === 'function') target.off(name, listener);
  else if (typeof target.removeListener === 'function') target.removeListener(name, listener);
}

/**
 * Bridge validated Termux provider-process telemetry to browser EventSource clients.
 * This stream intentionally carries provider-process events only. It does not
 * synthesize playback start/end, audio time, or phoneme/viseme boundaries.
 */
export function startNativeSpeechSseStream(request, response, runtimeSource, options = {}) {
  const maxStreams = Math.max(1, Math.min(32, Math.floor(Number(options.maxStreams) || DEFAULT_MAX_STREAMS)));
  const maxPendingFrames = Math.max(1, Math.min(256, Math.floor(Number(options.maxPendingFrames) || DEFAULT_MAX_PENDING_FRAMES)));
  const heartbeatMs = Math.max(1_000, Math.min(60_000, Math.floor(Number(options.heartbeatMs) || DEFAULT_HEARTBEAT_MS)));
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;

  if (activeStreams >= maxStreams) {
    response.writeHead(503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '3',
    });
    response.end(JSON.stringify({ ok: false, error: 'native-speech-stream-capacity-reached', maxStreams }));
    return { ok: false, close() {} };
  }

  activeStreams += 1;
  let closed = false;
  let blocked = false;
  let unsubscribe = null;
  let heartbeat = null;
  const pending = [];

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat !== null) clearIntervalFn(heartbeat);
    heartbeat = null;
    if (unsubscribe) {
      const stop = unsubscribe;
      unsubscribe = null;
      try { stop(); } catch { /* observer teardown must remain best-effort */ }
    }
    removeListener(request, 'aborted', cleanup);
    removeListener(response, 'close', cleanup);
    removeListener(response, 'error', cleanup);
    removeListener(response, 'drain', onDrain);
    pending.length = 0;
    activeStreams = Math.max(0, activeStreams - 1);
  };

  const endStream = () => {
    cleanup();
    if (isResponseWritable(response)) {
      try { response.end(); } catch { /* connection may already be gone */ }
    }
  };

  const writeFrame = (frame) => {
    if (closed || !isResponseWritable(response)) return false;
    try {
      return response.write(frame);
    } catch {
      endStream();
      return false;
    }
  };

  const flushPending = () => {
    if (closed || blocked) return;
    while (pending.length && !blocked && isResponseWritable(response)) {
      const next = pending.shift();
      if (typeof next !== 'string') continue;
      blocked = !writeFrame(next);
    }
    if (!isResponseWritable(response)) cleanup();
  };

  function onDrain() {
    if (closed) return;
    blocked = false;
    flushPending();
  }

  const enqueueFrame = (frame) => {
    if (closed || !isResponseWritable(response)) {
      cleanup();
      return;
    }
    if (blocked) {
      if (pending.length >= maxPendingFrames) {
        // Do not silently lose an unbounded event tail: close and let EventSource reconnect.
        endStream();
        return;
      }
      pending.push(frame);
      return;
    }
    blocked = !writeFrame(frame);
  };

  try {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    blocked = !response.write(': nk1-native-speech-stream-v1\nretry: 3000\n\n');
    request.on('aborted', cleanup);
    response.on('close', cleanup);
    response.on('error', cleanup);
    response.on('drain', onDrain);

    unsubscribe = connectNativeSpeechHostRouter(runtimeSource, (envelope) => {
      const event = envelope.event;
      const frame = 'id: ' + event.eventId
        + '\nevent: nk1.native_speech_provider_event'
        + '\ndata: ' + JSON.stringify(envelope)
        + '\n\n';
      enqueueFrame(frame);
    });

    heartbeat = setIntervalFn(() => {
      if (closed || blocked || !isResponseWritable(response)) return;
      blocked = !writeFrame(': heartbeat\n\n');
    }, heartbeatMs);
    heartbeat?.unref?.();
    return { ok: true, close: endStream };
  } catch (error) {
    endStream();
    throw error;
  }
}

export function nativeSpeechSseStreamStats() {
  return { activeStreams };
}
