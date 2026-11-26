import { EmbodiedActionExecutor } from '../../src/organism/body/EmbodiedActionExecutor.ts';

let fixtureSequence = 0;

export async function createTrustedEmbodiedActionFixture(action = 'explore', options = {}) {
  fixtureSequence += 1;
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
    cameraAvailable: options.cameraAvailable === true,
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
  return executor.execute(action, {
    spokenText: action === 'respond' ? 'test utterance' : '',
    executionId: options.executionId ?? `exec-fixture-${String(fixtureSequence).padStart(8,'0')}`,
    decisionId: options.decisionId ?? `fixture-decision-${fixtureSequence}`,
    allowCamera: options.cameraAvailable === true,
    captureCamera: options.cameraAvailable === true ? async () => ({
      ok:true,
      path:'/tmp/nk1-fixture-camera.jpg',
      size:options.cameraSize ?? 4,
      hash:options.cameraHash ?? 'a'.repeat(64),
      executionId:options.cameraCaptureExecutionId ?? `exec-camera-${fixtureSequence}`,
      providerReceiptId:options.cameraProviderReceiptId ?? `fixture-camera-${fixtureSequence}`,
      verification:options.cameraCaptureVerification,
      verificationInput:options.cameraCaptureVerificationInput,
      cameraId:options.cameraId ?? 0,
      capturedAt:options.cameraCapturedAt ?? 1_700_000_000_100 + fixtureSequence,
      captureNonce:options.cameraNonce ?? `fixture-camera-nonce-${fixtureSequence}`,
      sourceId:options.cameraSourceId ?? 'android-termux.camera',
      retained:options.cameraRetained === true,
      semanticVision:options.semanticVision === true,
      decisionId:options.decisionId ?? `fixture-decision-${fixtureSequence}`,
    }) : undefined,
  });
}
