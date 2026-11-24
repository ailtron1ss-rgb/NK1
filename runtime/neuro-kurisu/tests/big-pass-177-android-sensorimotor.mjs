import assert from 'node:assert/strict';
import { mkdir, writeFile, chmod, rm, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';
import { sampleAndroidTelemetryDetailed, invalidateTermuxCapabilityCache } from '../src/organism/body/AndroidEmbodimentBridge.ts';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';

const dir = await mkdtemp(join(tmpdir(), 'nk177-termux-'));
const bin = join(dir, 'bin'); await mkdir(bin);
const mk = async (name, body) => { const f=join(bin,name); await writeFile(f, `#!/bin/sh\n${body}\n`); await chmod(f,0o755); };
await mk('termux-battery-status', 'printf \'{"percentage":62,"temperature":34.5,"plugged":"USB"}\'');
await mk('termux-sensor', 'printf \'[{"name":"Light","values":[420]},{"name":"Proximity","values":[3]},{"name":"Accelerometer","values":[12,0,0]}]\'');
await mk('termux-wifi-connectioninfo', 'printf \'{"ssid":"LabNet","bssid":"AA:BB"}\'');
for (const x of ['termux-tts-speak','termux-speech-to-text','termux-camera-info']) await mk(x, 'exit 0');
const oldPath=process.env.PATH; process.env.PATH=`${bin}:${oldPath}`; invalidateTermuxCapabilityCache();
try {
  const previous=defaultBodyState();
  const sample=await sampleAndroidTelemetryDetailed(previous.telemetry);
  assert.equal(sample.telemetry.source,'android-termux');
  assert.equal(sample.telemetry.charging,true);
  assert.ok(sample.telemetry.battery01 > .6 && sample.telemetry.battery01 < .63);
  assert.ok(sample.telemetry.motion01 > .2);
  assert.equal(sample.telemetry.networkOnline,true);
  assert.equal(sample.diagnostics.commandFailures,0);
  assert.equal(sample.diagnostics.commandsAttempted,3);
  assert.equal(sample.diagnostics.commandsSucceeded,3);

  const runtime=new EmbodimentRuntime();
  await runtime.init();
  // The diagnostics path is safe even though runtime init used the mocked capabilities.
  const d=runtime.sensorDiagnosticsSnapshot();
  assert.ok(d.sampleCount >= 1);
  assert.equal(d.sensorFailures,0);
  assert.equal(d.diagnostics?.commandFailures,0);
  console.log(`BIG_PASS_177_ANDROID=PASS source=${sample.telemetry.source} battery=${sample.telemetry.battery01.toFixed(2)} motion=${sample.telemetry.motion01.toFixed(2)} commands=${sample.diagnostics.commandsSucceeded}/${sample.diagnostics.commandsAttempted}`);
} finally { process.env.PATH=oldPath; invalidateTermuxCapabilityCache(); await rm(dir,{recursive:true,force:true}); }
