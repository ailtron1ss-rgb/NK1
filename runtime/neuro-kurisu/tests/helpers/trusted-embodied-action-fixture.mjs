import { EmbodiedActionExecutor } from '../../src/organism/body/EmbodiedActionExecutor.ts';

export async function createTrustedEmbodiedActionFixture(action = 'explore', options = {}) {
  let sampleCount = 0;
  const body = {
    telemetry: {
      battery01: 0.8,
      batteryTemperatureC: 25,
      cpuLoad01: 0.1,
      ramPressure01: 0.2,
      source: 'android-termux',
      sampledAt: 0,
      staleMs: 0,
    },
    thermalStrain01: 0.2,
    cognitiveCapacity01: 0.9,
    awake: true,
    cameraAvailable: false,
    ttsAvailable: true,
  };
  const snapshot = () => structuredClone(body);
  const embodiment = {
    async sample() {
      sampleCount += 1;
      body.telemetry.sampledAt = 1_700_000_000_000 + sampleCount;
      body.telemetry.staleMs = options.staleFirstSample === true && sampleCount === 1 ? 500 : 0;
      return snapshot();
    },
    snapshot,
    sleep() { body.awake = false; },
    async speak() { return true; },
    voiceSnapshot() { return { state: { lastError: null } }; },
  };
  const executor = new EmbodiedActionExecutor(embodiment);
  return executor.execute(action, { spokenText: action === 'respond' ? 'test utterance' : '' });
}
