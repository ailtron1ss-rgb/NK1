import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalWhisperCppProvider,
  validateWhisperPcm16Wav,
} from "../src/server/local-whisper-cpp-provider.mjs";

function makeWav({ sampleRate = 16_000, channels = 1, bits = 16, seconds = 0.1 } = {}) {
  const bytesPerSample = bits / 8;
  const dataBytes = Math.round(sampleRate * channels * bytesPerSample * seconds);
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

test("WAV gate accepts only bounded mono 16 kHz PCM16 captures", () => {
  const wav = makeWav();
  const meta = validateWhisperPcm16Wav(wav);
  assert.equal(meta.sampleRate, 16_000);
  assert.equal(meta.channels, 1);
  assert.equal(meta.bitsPerSample, 16);
  assert.equal(meta.durationSeconds, 0.1);
  assert.throws(() => validateWhisperPcm16Wav(makeWav({ channels: 2 })), /audio-invalid-wav/);
  assert.throws(() => validateWhisperPcm16Wav(makeWav({ sampleRate: 48_000 })), /audio-invalid-wav/);
  assert.throws(() => validateWhisperPcm16Wav(makeWav({ bits: 8 })), /audio-invalid-wav/);
  assert.throws(() => validateWhisperPcm16Wav(Buffer.from("not audio")), /audio-invalid-wav/);
  assert.throws(() => validateWhisperPcm16Wav(makeWav({ seconds: 0.01 })), /audio-invalid-wav/);
  const trailingGarbage = Buffer.concat([wav, Buffer.from([0])]);
  trailingGarbage.writeUInt32LE(trailingGarbage.byteLength - 8, 4);
  assert.throws(() => validateWhisperPcm16Wav(trailingGarbage), /audio-invalid-wav/);
});

test("provider refuses non-loopback endpoints and stays disabled by default", async () => {
  const disabled = createLocalWhisperCppProvider({ endpoint: "" });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.snapshot().inFlight, false);
  await assert.rejects(disabled.transcribeWav(makeWav()), /whisper-provider-not-configured/);

  for (const endpoint of [
    "https://127.0.0.1:8081/inference",
    "http://example.com:8081/inference",
    "http://localhost:8081/inference",
    "http://192.168.1.10:8081/inference",
    "http://127.0.0.1:8081/other",
    "http://user:pass@127.0.0.1:8081/inference",
  ]) {
    assert.throws(() => createLocalWhisperCppProvider({ endpoint }), /whisper-endpoint/);
  }
  assert.equal(createLocalWhisperCppProvider({ endpoint: "http://127.0.0.1:8081/inference" }).enabled, true);
});

test("provider forwards WAV through whisper.cpp multipart API and returns bounded transcript", async () => {
  const wav = makeWav();
  let observed = null;
  const provider = createLocalWhisperCppProvider({
    endpoint: "http://127.0.0.1:8081/inference",
    fetchImpl: async (url, init) => {
      const form = init.body;
      const file = form.get("file");
      observed = {
        url,
        method: init.method,
        language: form.get("language"),
        responseFormat: form.get("response_format"),
        fileName: file.name,
        mimeType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      };
      return new Response(JSON.stringify({
        language: "Russian",
        text: "  Привет, NK1!  ",
        segments: [{ start: 0, end: 0.1, text: "Привет, NK1!" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await provider.transcribeWav(wav);
  assert.equal(observed.url, "http://127.0.0.1:8081/inference");
  assert.equal(observed.method, "POST");
  assert.equal(observed.language, "auto");
  assert.equal(observed.responseFormat, "verbose_json");
  assert.equal(observed.fileName, "nk1-capture.wav");
  assert.equal(observed.mimeType, "audio/wav");
  assert.deepEqual(observed.bytes, wav);
  assert.equal(result.provider, "whisper.cpp");
  assert.equal(result.text, "Привет, NK1!");
  assert.equal(result.language, "Russian");
  assert.equal(result.segments.length, 1);
  assert.equal(provider.snapshot().requests, 1);
  assert.equal(provider.snapshot().failures, 0);
});

test("invalid WAV is rejected before any sidecar request", async () => {
  let calls = 0;
  const provider = createLocalWhisperCppProvider({
    endpoint: "http://127.0.0.1:8081/inference",
    fetchImpl: async () => { calls += 1; return new Response("{}"); },
  });
  await assert.rejects(provider.transcribeWav(Buffer.from("bad")), /audio-invalid-wav/);
  assert.equal(calls, 0);
});

test("single-flight gate rejects overlapping audio jobs and releases after completion", async () => {
  let resolveFetch;
  const provider = createLocalWhisperCppProvider({
    endpoint: "http://127.0.0.1:8081/inference",
    fetchImpl: () => new Promise((resolve) => { resolveFetch = resolve; }),
  });
  const first = provider.transcribeWav(makeWav());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(provider.snapshot().inFlight, true);
  await assert.rejects(provider.transcribeWav(makeWav()), /whisper-provider-busy/);
  resolveFetch(new Response(JSON.stringify({ text: "done", language: "English", segments: [] }), { status: 200 }));
  assert.equal((await first).text, "done");
  assert.equal(provider.snapshot().inFlight, false);
});

test("provider bounds response stream before buffering oversized sidecar output", async () => {
  const provider = createLocalWhisperCppProvider({
    endpoint: "http://127.0.0.1:8081/inference",
    fetchImpl: async () => new Response("x".repeat(1_000_001), { status: 200 }),
  });
  await assert.rejects(provider.transcribeWav(makeWav()), /whisper-response-too-large/);
  assert.equal(provider.snapshot().inFlight, false);
});

test("caller cancellation is propagated before any inference", async () => {
  let calls = 0;
  const provider = createLocalWhisperCppProvider({
    endpoint: "http://127.0.0.1:8081/inference",
    fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ text: "ignored" })); },
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(provider.transcribeWav(makeWav(), { signal: controller.signal }), /whisper-transcription-aborted/);
  assert.equal(calls, 0);
});
