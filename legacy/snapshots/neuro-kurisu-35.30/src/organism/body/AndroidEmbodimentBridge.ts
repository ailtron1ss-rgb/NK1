import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import type { BodyTelemetry, SensorSource } from './EmbodiedBody.ts';

const execFileAsync = promisify(execFile);
let capabilityCache: { at:number; value:TermuxCapabilities } | null = null;
let lastCpuUsage: { user:number; system:number } | null = null;
let activeTtsProcess: ReturnType<typeof spawn> | null = null;
let lastCpuAt = 0;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export interface TermuxCapabilities {
  battery: boolean;
  sensors: boolean;
  tts: boolean;
  stt: boolean;
  camera: boolean;
  wifi: boolean;
}

export interface AndroidTelemetryDiagnostics {
  sampledAt: number;
  commandsAttempted: number;
  commandsSucceeded: number;
  commandFailures: number;
  sensorPayloadValid: boolean;
  batteryPayloadValid: boolean;
  wifiPayloadValid: boolean;
  capabilitySnapshot: TermuxCapabilities;
  source: SensorSource;
}

export interface AndroidTelemetrySample { telemetry: BodyTelemetry; diagnostics: AndroidTelemetryDiagnostics; }
export interface AndroidSamplingPlan { requestedSensors?: string[]; force?: boolean; }

async function commandJson(command: string, args: string[] = [], timeout = 3500): Promise<any | null> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout, windowsHide: true, maxBuffer: 512 * 1024 });
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

async function commandExists(command: string): Promise<boolean> {
  try { await execFileAsync('sh', ['-c', `command -v ${command}`], { timeout: 1500 }); return true; } catch { return false; }
}

function parseSensorPayload(value: any): Pick<BodyTelemetry, 'ambientLight01'|'proximity01'|'motion01'> {
  const out: Pick<BodyTelemetry, 'ambientLight01'|'proximity01'|'motion01'> = { ambientLight01: null, proximity01: null, motion01: null };
  const rows = Array.isArray(value) ? value : (Array.isArray(value?.sensors) ? value.sensors : []);
  const flat: Record<string, number> = {};
  const visit = (name: string, payload: any) => {
    if (Array.isArray(payload?.values)) payload.values.forEach((v: unknown, i: number) => flat[`${name}:${i}`] = Number(v));
    if (Array.isArray(payload?.data)) payload.data.forEach((v: unknown, i: number) => flat[`${name}:${i}`] = Number(v));
  };
  for (const row of rows) visit(String(row?.name ?? row?.type ?? ''), row);
  const light = Object.entries(flat).find(([k]) => /light/i.test(k));
  const proximity = Object.entries(flat).find(([k]) => /proximity/i.test(k));
  const accel = Object.entries(flat).filter(([k]) => /accelerometer|accel/i.test(k));
  if (light) out.ambientLight01 = clamp(Number(light[1]) / 1000);
  if (proximity) out.proximity01 = clamp(Number(proximity[1]) / 10);
  if (accel.length) {
    const magnitude = Math.sqrt(accel.slice(0, 3).reduce((s, [,v]) => s + v * v, 0));
    out.motion01 = clamp(Math.abs(magnitude - 9.81) / 9.81);
  }
  return out;
}

export function invalidateTermuxCapabilityCache(): void { capabilityCache = null; }

export async function detectTermuxCapabilities(): Promise<TermuxCapabilities> {
  const now = Date.now();
  if (capabilityCache && now - capabilityCache.at < 60_000) return { ...capabilityCache.value };
  const [battery, sensors, tts, stt, camera, wifi] = await Promise.all([
    commandExists('termux-battery-status'),
    commandExists('termux-sensor'),
    commandExists('termux-tts-speak'),
    commandExists('termux-speech-to-text'),
    commandExists('termux-camera-info'),
    commandExists('termux-wifi-connectioninfo'),
  ]);
  capabilityCache = { at:now, value:{ battery, sensors, tts, stt, camera, wifi } };
  return { ...capabilityCache.value };
}

export async function sampleAndroidTelemetryDetailed(previous: BodyTelemetry, plan: AndroidSamplingPlan = {}): Promise<AndroidTelemetrySample> {
  const now = Date.now();
  const memory = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramPressure = clamp(1 - freeMem / Math.max(1, totalMem));
  const load = os.loadavg?.()[0] ?? 0;
  const cpuCount = Math.max(1, os.cpus()?.length ?? 1);
  const nowCpuUsage = (process as any).cpuUsage() as { user:number; system:number };
  let processCpu = 0;
  if (lastCpuUsage && lastCpuAt) { const elapsedUs=Math.max(1,(now-lastCpuAt)*1000); const deltaUs=Math.max(0,(nowCpuUsage.user-lastCpuUsage.user)+(nowCpuUsage.system-lastCpuUsage.system)); processCpu=clamp(deltaUs/(elapsedUs*cpuCount)); }
  lastCpuUsage=nowCpuUsage; lastCpuAt=now;
  const cpuLoad = Math.max(clamp(load / cpuCount), processCpu);
  const caps = await detectTermuxCapabilities();
  const requested = new Set((plan.requestedSensors ?? ['battery','motion','light','proximity','network']).map(String));
  const wantsBattery = requested.has('battery') || requested.has('thermal');
  const wantsMotion = requested.has('motion') || requested.has('light') || requested.has('proximity');
  const wantsNetwork = requested.has('network');

  let battery01 = previous.battery01;
  let temp: number | null = previous.batteryTemperatureC;
  let androidFresh = false;
  let charging = previous.charging;
  let source: SensorSource = 'node-host';
  let commandsAttempted = 0; let commandsSucceeded = 0; let commandFailures = 0;
  if (caps.battery && wantsBattery) {
    commandsAttempted++; const b = await commandJson('termux-battery-status', [], 2200); if (b) commandsSucceeded++; else commandFailures++;
    const pct = Number(b?.percentage);
    if (Number.isFinite(pct)) { battery01 = clamp(pct / 100); androidFresh=true; }
    temp = Number.isFinite(Number(b?.temperature)) ? Number(b.temperature) : temp;
    charging = typeof b?.plugged === 'string' ? !/unplugged/i.test(b.plugged) : charging;
    source = 'android-termux';
  }
  let sensor = null;
  if (caps.sensors && wantsMotion) { commandsAttempted++; sensor = await commandJson('termux-sensor', ['-n', '1'], 3500); if (sensor) { androidFresh=true; commandsSucceeded++; } else commandFailures++; }
  const wifi = caps.wifi && wantsNetwork ? (commandsAttempted++, await commandJson('termux-wifi-connectioninfo', [], 2200)) : null;
  if (wifi) { androidFresh=true; commandsSucceeded++; } else if (caps.wifi) commandFailures++;
  const networkOnline = caps.wifi ? Boolean(wifi && (wifi.ssid || wifi.bssid)) : previous.networkOnline;
  const s = parseSensorPayload(sensor);
  const screenOverride=String(process.env.NEURO_SCREEN_INTERACTIVE??'').trim().toLowerCase();
  const screenInteractive=screenOverride==='true'?true:screenOverride==='false'?false:previous.screenInteractive;
  const thermalPressure = temp == null ? previous.thermalPressure01 * 0.92 : clamp((temp - 30) / 18);
  const telemetry: BodyTelemetry = {
    battery01, batteryTemperatureC: temp, thermalPressure01: thermalPressure, cpuLoad01: cpuLoad, ramPressure01: ramPressure,
    networkOnline, screenInteractive, ambientLight01: s.ambientLight01 ?? previous.ambientLight01,
    proximity01: s.proximity01 ?? previous.proximity01, motion01: s.motion01 ?? previous.motion01, charging, sampledAt: now,
    source: caps.battery || caps.sensors ? source : 'node-host', staleMs: androidFresh ? 0 : Math.max(0, now - Number(previous.sampledAt || now)),
  };
  return { telemetry, diagnostics: { sampledAt: now, commandsAttempted, commandsSucceeded, commandFailures, sensorPayloadValid: sensor != null, batteryPayloadValid: !caps.battery || battery01 !== null, wifiPayloadValid: !caps.wifi || wifi != null, capabilitySnapshot: caps, source: telemetry.source } };
}

export async function sampleAndroidTelemetry(previous: BodyTelemetry, plan: AndroidSamplingPlan = {}): Promise<BodyTelemetry> {
  return (await sampleAndroidTelemetryDetailed(previous, plan)).telemetry;
}

export async function certifyAndroidHardware(previous: BodyTelemetry): Promise<{status:'REAL_DEVICE_VERIFIED'|'HOST_PROBE'|'UNAVAILABLE';capabilities:TermuxCapabilities;telemetry:AndroidTelemetrySample|null;checks:{batteryFresh:boolean;sensorCommand:boolean;wifiCommand:boolean};warning:string}> {
  const capabilities=await detectTermuxCapabilities();
  if(!capabilities.battery && !capabilities.sensors && !capabilities.wifi) return {status:'UNAVAILABLE',capabilities,telemetry:null,checks:{batteryFresh:false,sensorCommand:false,wifiCommand:false},warning:'No Termux Android capability was detected; host telemetry is not device evidence.'};
  const telemetry=await sampleAndroidTelemetryDetailed(previous);
  const batteryFresh=capabilities.battery && telemetry.diagnostics.batteryPayloadValid && telemetry.telemetry.source==='android-termux' && telemetry.telemetry.staleMs===0;
  const sensorCommand=!capabilities.sensors || telemetry.diagnostics.sensorPayloadValid;
  const wifiCommand=!capabilities.wifi || telemetry.diagnostics.wifiPayloadValid;
  const status=(batteryFresh && sensorCommand && wifiCommand)?'REAL_DEVICE_VERIFIED':'HOST_PROBE';
  return {status,capabilities,telemetry,checks:{batteryFresh,sensorCommand,wifiCommand},warning:'REAL_DEVICE_VERIFIED means live Termux Android command evidence was observed; it does not certify consciousness or full embodiment.'};
}

export interface TermuxTtsOptions { pitch?:number; rate?:number; volume?:number; language?:string; region?:string; variant?:string; stream?:string; }

export async function speakViaTermux(text: string, options: TermuxTtsOptions = {}, timeout = 12000): Promise<boolean> {
  const clean=String(text||'').replace(/[\r\n]+/g,' ').trim().slice(0,4000);
  if(!clean) return false;
  const args:string[]=[];
  if(options.language) args.push('-l',String(options.language));
  if(options.region) args.push('-n',String(options.region));
  if(options.variant) args.push('-v',String(options.variant));
  if(Number.isFinite(options.pitch)) args.push('-p',String(clamp(Number(options.pitch))));
  if(Number.isFinite(options.rate)) args.push('-r',String(clamp(Number(options.rate))));
  if(options.stream) args.push('-s',String(options.stream));
  activeTtsProcess?.kill('SIGTERM');
  activeTtsProcess=null;
  return await new Promise<boolean>((resolve) => {
    let settled=false;
    const finish=(ok:boolean)=>{ if(settled) return; settled=true; if(activeTtsProcess===child) activeTtsProcess=null; resolve(ok); };
    const child=spawn('termux-tts-speak',[...args,clean],{ windowsHide:true, stdio:'ignore' });
    activeTtsProcess=child;
    const timer=setTimeout(()=>{ child.kill('SIGTERM'); finish(false); },timeout);
    child.once('error',()=>{ clearTimeout(timer); finish(false); });
    child.once('close',(code: number | null, signal: string | null)=>{ clearTimeout(timer); finish(code===0 && signal==null); });
  });
}

export function interruptTermuxTts(): boolean {
  if(!activeTtsProcess) return false;
  const child=activeTtsProcess;
  activeTtsProcess=null;
  try { return child.kill('SIGTERM'); } catch { return false; }
}

export async function synthesizeSpeechInput(timeout = 12000): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('termux-speech-to-text', [], { timeout, windowsHide: true, maxBuffer: 128 * 1024 });
    const value = stdout.trim();
    return value || null;
  } catch { return null; }
}

export async function captureCameraPhoto(cameraId = 0, timeout = 15_000, retain = false): Promise<{ ok:boolean; path?:string; size?:number; hash?:string; error?:string }> {
  const fs = await import('node:fs/promises');
  const crypto = await import('node:crypto');
  const path = await import('node:path');
  const osMod = await import('node:os');
  const dir = await fs.mkdtemp(path.join(osMod.tmpdir(), 'neuro-kurisu-camera-'));
  const output = path.join(dir, 'capture.jpg');
  try {
    await execFileAsync('termux-camera-photo', ['-c', String(Math.max(0, Math.floor(cameraId))), output], { timeout, windowsHide:true, maxBuffer:64 * 1024 });
    const bytes = await fs.readFile(output);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const result = retain ? { ok:true, path:output, size:bytes.length, hash } : { ok:true, size:bytes.length, hash };
    if (!retain) await fs.rm(dir, { recursive:true, force:true }).catch(() => {});
    return result;
  } catch (error:any) {
    await fs.rm(dir, { recursive:true, force:true }).catch(() => {});
    return { ok:false, error:String(error?.message || error) };
  }
}
