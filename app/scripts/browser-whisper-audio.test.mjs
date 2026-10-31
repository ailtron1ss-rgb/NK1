import assert from "node:assert/strict";
import test from "node:test";
import { encodeMonoPcm16Wav } from "../src/components/avatar/browserWhisperAudio.ts";

test("browser encoder creates mono 16 kHz little-endian PCM16 RIFF/WAVE", async () => {
  const samples = new Float32Array(3_200);
  samples[0] = -2;
  samples[1] = -1;
  samples[2] = -0.5;
  samples[3] = 0;
  samples[4] = 0.5;
  samples[5] = 1;
  samples[6] = 2;
  samples[7] = Number.NaN;

  const wav = encodeMonoPcm16Wav(samples);
  assert.equal(wav.type, "audio/wav");
  const bytes = Buffer.from(await wav.arrayBuffer());
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.readUInt32LE(4), bytes.byteLength - 8);
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.equal(bytes.toString("ascii", 12, 16), "fmt ");
  assert.equal(bytes.readUInt16LE(20), 1);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), 16_000);
  assert.equal(bytes.readUInt32LE(28), 32_000);
  assert.equal(bytes.readUInt16LE(32), 2);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(bytes.toString("ascii", 36, 40), "data");
  assert.equal(bytes.readUInt32LE(40), 6_400);
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => bytes.readInt16LE(44 + index * 2)),
    [-32768, -32768, -16384, 0, 16384, 32767, 32767, 0],
  );
});

test("browser encoder rejects captures outside the short bounded speech window", () => {
  assert.throws(() => encodeMonoPcm16Wav(new Float32Array(100)), /recording-duration-or-format-invalid/);
  assert.throws(() => encodeMonoPcm16Wav(new Float32Array(16_000 * 31)), /recording-duration-or-format-invalid/);
  assert.throws(() => encodeMonoPcm16Wav(new Float32Array(3_200), 48_000), /recording-duration-or-format-invalid/);
});
