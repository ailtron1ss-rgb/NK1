import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';
import { invalidateTermuxCapabilityCache, sampleAndroidTelemetryDetailed } from '../src/organism/body/AndroidEmbodimentBridge.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk-android-telemetry-'));
const bin = path.join(root, 'bin');
const originalPath = process.env.PATH;

async function writeCommand(name, payload) {
  const file = path.join(bin, name);
  await writeFile(file, `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(payload)}'\n`, 'utf8');
  await chmod(file, 0o755);
}

const previous = {
  ...defaultBodyState().telemetry,
  battery01: 0.74,
  cpuLoad01: 0.27,
  ramPressure01: 0.31,
  ambientLight01: 0.12,
  proximity01: 0.23,
  motion01: 0.34,
  networkOnline: true,
};

try {
  await mkdir(bin);
  process.env.PATH = `${bin}:/usr/bin:/bin`;

  await writeCommand('termux-battery-status', { percentage: null, temperature: null, plugged: null });
  await writeCommand('termux-sensor', [
    { name: 'Light', values: ['not-a-number'] },
    { name: 'Proximity', values: [null] },
    { name: 'Accelerometer', values: [12, 'bad-axis', 0] },
  ]);
  invalidateTermuxCapabilityCache();
  const malformed = await sampleAndroidTelemetryDetailed(previous);
  assert.equal(malformed.telemetry.source, 'node-host', 'malformed Android JSON must not establish fresh Android sensor provenance');
  assert.equal(malformed.diagnostics.sensorPayloadValid, false);
  assert.equal(malformed.diagnostics.batteryPayloadValid, false);
  assert.equal(malformed.telemetry.battery01, previous.battery01, 'null battery percentage must not become zero');
  assert.equal(malformed.telemetry.batteryTemperatureC, previous.batteryTemperatureC, 'null temperature must not become zero degrees');
  assert.equal(malformed.telemetry.ambientLight01, previous.ambientLight01, 'invalid light must preserve the last known value');
  assert.equal(malformed.telemetry.proximity01, previous.proximity01, 'invalid proximity must preserve the last known value');
  assert.equal(malformed.telemetry.motion01, previous.motion01, 'incomplete accelerometer axes must not become a motion sample');
  assert.equal(malformed.telemetry.cpuLoad01, previous.cpuLoad01, 'host CPU diagnostics must not leak into embodied state without fresh Android data');
  assert.equal(malformed.telemetry.ramPressure01, previous.ramPressure01, 'host RAM diagnostics must not leak into embodied state without fresh Android data');

  await writeCommand('termux-sensor', {
    Light: { values: [420] },
    Proximity: { values: [3] },
    Accelerometer: { values: [12, 0, 0] },
  });
  invalidateTermuxCapabilityCache();
  const sensorOnly = await sampleAndroidTelemetryDetailed(previous);
  assert.equal(sensorOnly.telemetry.source, 'android-termux', 'valid sensor-only observations must retain Android provenance when battery data is invalid');
  assert.equal(sensorOnly.diagnostics.sensorPayloadValid, true);
  assert.equal(sensorOnly.diagnostics.batteryPayloadValid, false);
  assert.equal(sensorOnly.telemetry.ambientLight01, 0.42);
  assert.equal(sensorOnly.telemetry.proximity01, 0.3);
  assert.ok(sensorOnly.telemetry.motion01 !== null);

  await writeCommand('termux-battery-status', { percentage: 62, temperature: 34.5, plugged: 'USB' });
  await writeCommand('termux-sensor', [{ name: 'Light', values: ['bad'] }]);
  invalidateTermuxCapabilityCache();
  const batteryOnly = await sampleAndroidTelemetryDetailed(previous);
  assert.equal(batteryOnly.telemetry.source, 'android-termux', 'valid battery observations must establish Android provenance even when sensor payloads are malformed');
  assert.equal(batteryOnly.diagnostics.batteryPayloadValid, true);
  assert.equal(batteryOnly.diagnostics.sensorPayloadValid, false);
  assert.equal(batteryOnly.telemetry.battery01, 0.62);
  assert.equal(batteryOnly.telemetry.batteryTemperatureC, 34.5);
  assert.equal(batteryOnly.telemetry.charging, true);

  // Presence of a Wi-Fi JSON key is not enough: null/blank placeholders are not
  // observations and must not claim Android provenance or overwrite network state.
  await writeCommand('termux-battery-status', { percentage: null, temperature: null, plugged: null });
  await writeCommand('termux-wifi-connectioninfo', {
    ssid: null, bssid: '', supplicant_state: '', ip: null, ip_address: ' ',
  });
  invalidateTermuxCapabilityCache();
  const invalidWifi = await sampleAndroidTelemetryDetailed(previous);
  assert.equal(invalidWifi.diagnostics.wifiPayloadValid, false);
  assert.equal(invalidWifi.telemetry.source, 'node-host');
  assert.equal(invalidWifi.telemetry.networkOnline, previous.networkOnline,
    'empty Wi-Fi placeholders must preserve the last known network state');

  // A real disconnected supplicant state is still useful device telemetry even
  // when SSID/BSSID are absent; it truthfully reports offline rather than unknown.
  await writeCommand('termux-wifi-connectioninfo', {
    ssid: null, bssid: '', supplicant_state: 'DISCONNECTED', ip: null,
  });
  invalidateTermuxCapabilityCache();
  const disconnectedWifi = await sampleAndroidTelemetryDetailed(previous);
  assert.equal(disconnectedWifi.diagnostics.wifiPayloadValid, true);
  assert.equal(disconnectedWifi.telemetry.source, 'android-termux');
  assert.equal(disconnectedWifi.telemetry.networkOnline, false);
  assert.equal(disconnectedWifi.telemetry.staleMs, 0);

  console.log('ANDROID_TELEMETRY_PROVENANCE=PASS malformed=preserved sensorOnly=android-termux batteryOnly=android-termux wifi=truthful');
} finally {
  process.env.PATH = originalPath;
  invalidateTermuxCapabilityCache();
  await rm(root, { recursive: true, force: true });
}
