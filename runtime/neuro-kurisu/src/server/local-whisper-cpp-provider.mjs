const MAX_WAV_BYTES = 2_000_044;
const MAX_WAV_DURATION_SECONDS = 60;
const MAX_TRANSCRIPT_CHARS = 12_000;
const MAX_SEGMENTS = 512;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]"]);

function providerError(code, status = 503) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * NK1's upload contract is deliberately narrow: mono 16 kHz PCM16 RIFF/WAVE.
 * The browser recorder converts device formats into this representation before
 * transmission. Reject compressed/ambiguous inputs instead of relying on ffmpeg.
 */
export function validateWhisperPcm16Wav(input, maxBytes = MAX_WAV_BYTES) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    throw providerError("audio-invalid-wav", 415);
  }
  const audio = Buffer.isBuffer(input)
    ? input
    : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (audio.byteLength > maxBytes) throw providerError("audio-too-large", 413);
  if (audio.byteLength < 46
    || audio.toString("ascii", 0, 4) !== "RIFF"
    || audio.toString("ascii", 8, 12) !== "WAVE") {
    throw providerError("audio-invalid-wav", 415);
  }
  if (audio.readUInt32LE(4) + 8 !== audio.byteLength) {
    throw providerError("audio-invalid-wav", 415);
  }

  let format = null;
  let dataBytes = null;
  let offset = 12;
  while (offset < audio.byteLength) {
    if (offset + 8 > audio.byteLength) throw providerError("audio-invalid-wav", 415);
    const chunkId = audio.toString("ascii", offset, offset + 4);
    const chunkBytes = audio.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkBytes;
    const paddedEnd = chunkEnd + (chunkBytes & 1);
    if (!Number.isSafeInteger(chunkEnd) || paddedEnd > audio.byteLength) {
      throw providerError("audio-invalid-wav", 415);
    }
    if (chunkId === "fmt ") {
      if (format !== null || chunkBytes < 16) throw providerError("audio-invalid-wav", 415);
      format = {
        encoding: audio.readUInt16LE(chunkStart),
        channels: audio.readUInt16LE(chunkStart + 2),
        sampleRate: audio.readUInt32LE(chunkStart + 4),
        byteRate: audio.readUInt32LE(chunkStart + 8),
        blockAlign: audio.readUInt16LE(chunkStart + 12),
        bitsPerSample: audio.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === "data") {
      if (dataBytes !== null) throw providerError("audio-invalid-wav", 415);
      dataBytes = chunkBytes;
    }
    offset = paddedEnd;
  }
  if (offset !== audio.byteLength) throw providerError("audio-invalid-wav", 415);

  if (!format || dataBytes === null
    || format.encoding !== 1
    || format.channels !== 1
    || format.sampleRate !== 16_000
    || format.byteRate !== 32_000
    || format.blockAlign !== 2
    || format.bitsPerSample !== 16
    || dataBytes < 3_200
    || (dataBytes % 2) !== 0) {
    throw providerError("audio-invalid-wav", 415);
  }
  const durationSeconds = dataBytes / 32_000;
  if (durationSeconds > MAX_WAV_DURATION_SECONDS) {
    throw providerError("audio-too-long", 413);
  }
  return Object.freeze({ durationSeconds, dataBytes, sampleRate: 16_000, channels: 1, bitsPerSample: 16 });
}

function resolveLoopbackInferenceUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { throw providerError("whisper-endpoint-invalid", 500); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "http:"
    || !LOOPBACK_HOSTS.has(hostname)
    || url.username || url.password
    || url.search || url.hash
    || url.pathname !== "/inference") {
    throw providerError("whisper-endpoint-must-be-loopback-inference", 500);
  }
  return url.toString();
}

async function readBoundedResponseText(response, maxBytes = 1_000_000) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw providerError("whisper-response-too-large", 502);
  }
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw providerError("whisper-response-too-large", 502);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) continue;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw providerError("whisper-response-too-large", 502);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks, bytes));
}

function normalizeSegments(value, durationSeconds) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SEGMENTS).flatMap((segment) => {
    if (!segment || typeof segment !== "object" || Array.isArray(segment)) return [];
    const text = typeof segment.text === "string" ? segment.text.slice(0, 2_000) : "";
    const start = Number(segment.start);
    const end = Number(segment.end);
    if (!text || !isFiniteNumber(start) || !isFiniteNumber(end)
      || start < 0 || end < start || start > durationSeconds + 1 || end > durationSeconds + 1) return [];
    return [{ start, end, text }];
  });
}

/**
 * Optional local-only adapter for whisper.cpp's documented multipart /inference
 * endpoint. Audio is never written to disk or logged; only the bounded transcript
 * projection is returned to the caller.
 */
export function createLocalWhisperCppProvider({
  endpoint = process.env.NK1_WHISPER_CPP_URL ?? "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 90_000,
  maxWavBytes = MAX_WAV_BYTES,
} = {}) {
  const inferenceUrl = resolveLoopbackInferenceUrl(endpoint);
  if (inferenceUrl && typeof fetchImpl !== "function") {
    throw new TypeError("whisper-fetch-implementation-required");
  }
  const safeTimeoutMs = Math.max(5_000, Math.min(180_000, Math.floor(Number(timeoutMs) || 90_000)));
  const safeMaxWavBytes = Math.max(46, Math.min(MAX_WAV_BYTES, Math.floor(Number(maxWavBytes) || MAX_WAV_BYTES)));
  let inFlight = false;
  let requests = 0;
  let failures = 0;
  let lastLatencyMs = 0;

  return Object.freeze({
    enabled: Boolean(inferenceUrl),
    async transcribeWav(input, { signal } = {}) {
      if (!inferenceUrl) throw providerError("whisper-provider-not-configured", 503);
      if (inFlight) throw providerError("whisper-provider-busy", 409);
      if (signal?.aborted) throw providerError("whisper-transcription-aborted", 499);
      const audio = Buffer.isBuffer(input) ? input : Buffer.from(input ?? []);
      const wav = validateWhisperPcm16Wav(audio, safeMaxWavBytes);
      inFlight = true;
      requests += 1;
      const startedAt = globalThis.performance?.now?.() ?? Date.now();
      try {
        const form = new FormData();
        form.set("file", new Blob([audio], { type: "audio/wav" }), "nk1-capture.wav");
        form.set("language", "auto");
        form.set("response_format", "verbose_json");
        form.set("temperature", "0.0");
        // whisper.cpp 1.9.5 defaults no_context=true; the server does not
        // consume a multipart no_context field, so leave that setting at its default.

        const deadline = AbortSignal.timeout(safeTimeoutMs);
        const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
        let response;
        try {
          response = await fetchImpl(inferenceUrl, { method: "POST", body: form, signal: requestSignal });
        } catch (error) {
          if (signal?.aborted) throw providerError("whisper-transcription-aborted", 499);
          if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            throw providerError("whisper-provider-timeout", 504);
          }
          throw providerError("whisper-provider-unavailable", 503);
        }
        const responseText = await readBoundedResponseText(response);
        if (!response.ok) {
          throw providerError(response.status === 503 ? "whisper-model-not-ready" : "whisper-provider-rejected-audio", 502);
        }
        let decoded;
        try { decoded = JSON.parse(responseText); } catch { throw providerError("whisper-response-invalid-json", 502); }
        const text = typeof decoded?.text === "string" ? decoded.text.trim().slice(0, MAX_TRANSCRIPT_CHARS) : "";
        if (!text) throw providerError("whisper-empty-transcript", 422);
        const language = typeof decoded.language === "string"
          ? decoded.language.slice(0, 48)
          : typeof decoded.detected_language === "string" ? decoded.detected_language.slice(0, 48) : "und";
        const finishedAt = globalThis.performance?.now?.() ?? Date.now();
        lastLatencyMs = Math.max(0, Math.round(finishedAt - startedAt));
        return Object.freeze({
          provider: "whisper.cpp",
          text,
          language,
          durationSeconds: wav.durationSeconds,
          latencyMs: lastLatencyMs,
          segments: normalizeSegments(decoded.segments, wav.durationSeconds),
        });
      } catch (error) {
        failures += 1;
        if (error?.code) throw error;
        throw providerError("whisper-provider-failed", 503);
      } finally {
        inFlight = false;
      }
    },
    snapshot() {
      return Object.freeze({
        enabled: Boolean(inferenceUrl),
        inFlight,
        requests,
        failures,
        lastLatencyMs,
        maxWavBytes: safeMaxWavBytes,
        maxDurationSeconds: MAX_WAV_DURATION_SECONDS,
        endpointHost: inferenceUrl ? new URL(inferenceUrl).hostname : null,
      });
    },
  });
}

export const WHISPER_CPP_MAX_WAV_BYTES = MAX_WAV_BYTES;
