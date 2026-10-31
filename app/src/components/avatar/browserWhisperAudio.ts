export const WHISPER_INPUT_SAMPLE_RATE = 16_000;
export const WHISPER_MAX_CAPTURE_SECONDS = 30;
const MIN_CAPTURE_SECONDS = 0.1;

function captureError(code: string): Error {
  return new Error(code);
}

/** Encode mono float PCM as the exact little-endian RIFF/WAVE form accepted by NK1. */
export function encodeMonoPcm16Wav(samples: ArrayLike<number>, sampleRate = WHISPER_INPUT_SAMPLE_RATE): Blob {
  if (sampleRate !== WHISPER_INPUT_SAMPLE_RATE
    || !samples
    || typeof samples.length !== "number"
    || !Number.isSafeInteger(samples.length)
    || samples.length < Math.ceil(MIN_CAPTURE_SECONDS * sampleRate)
    || samples.length > WHISPER_MAX_CAPTURE_SECONDS * sampleRate) {
    throw captureError("recording-duration-or-format-invalid");
  }

  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < samples.length; index += 1) {
    const raw = Number(samples[index]);
    const finite = Number.isFinite(raw) ? raw : 0;
    const clamped = Math.max(-1, Math.min(1, finite));
    view.setInt16(44 + index * 2, clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Decode a browser MediaRecorder blob, downmix/resample with Web Audio's native
 * resampler, and emit a small mono PCM16 WAV. No remote speech API is used here.
 */
export async function convertBrowserRecordingToWhisperWav(recording: Blob): Promise<Blob> {
  if (!(recording instanceof Blob) || recording.size === 0) throw captureError("recording-empty");
  if (typeof window === "undefined"
    || typeof window.AudioContext !== "function"
    || typeof window.OfflineAudioContext !== "function") {
    throw captureError("browser-audio-conversion-unsupported");
  }

  const decoder = new window.AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
    if (!Number.isFinite(decoded.duration)
      || decoded.duration < MIN_CAPTURE_SECONDS
      || decoded.duration > WHISPER_MAX_CAPTURE_SECONDS + 0.5) {
      throw captureError("recording-duration-invalid");
    }
    const frameCount = Math.ceil(decoded.duration * WHISPER_INPUT_SAMPLE_RATE);
    const offline = new window.OfflineAudioContext(1, frameCount, WHISPER_INPUT_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const mono = await offline.startRendering();
    return encodeMonoPcm16Wav(mono.getChannelData(0));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("recording-")) throw error;
    throw captureError("recording-decode-failed");
  } finally {
    await decoder.close().catch(() => {});
  }
}
