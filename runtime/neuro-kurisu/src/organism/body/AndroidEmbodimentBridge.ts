import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import os from 'node:os';
import type { BodyTelemetry, SensorSource } from './EmbodiedBody.ts';
import { nativeSpeechEventChannel } from './NativeSpeechEventChannel.ts';

const execFileAsync = promisify(execFile);
let capabilityCache: { at:number; value:TermuxCapabilities } | null = null;
let lastCpuUsage: { user:number; system:number } | null = null;
let activeTtsProcess: ReturnType<typeof spawn> | null = null;
let activeTtsOperationId: string | null = null;
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
  // Host process/OS telemetry is useful for runtime diagnostics, but it must not
  // become embodied cognition when no real Android/Termux sensor source is available.
  // Otherwise V8 flags such as --max-old-space-size can change the organism's
  // cognitive state even though the world, inputs and logical clock are identical.
  const memory = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const hostRamPressure = clamp(1 - freeMem / Math.max(1, totalMem));
  const load = os.loadavg?.()[0] ?? 0;
  const cpuCount = Math.max(1, os.cpus()?.length ?? 1);
  const nowCpuUsage = (process as any).cpuUsage() as { user:number; system:number };
  let processCpu = 0;
  if (lastCpuUsage && lastCpuAt) { const elapsedUs=Math.max(1,(now-lastCpuAt)*1000); const deltaUs=Math.max(0,(nowCpuUsage.user-lastCpuUsage.user)+(nowCpuUsage.system-lastCpuUsage.system)); processCpu=clamp(deltaUs/(elapsedUs*cpuCount)); }
  lastCpuUsage=nowCpuUsage; lastCpuAt=now;
  const hostCpuLoad = Math.max(clamp(load / cpuCount), processCpu);
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
  const useHostDiagnosticsAsEmbodiment = source === 'node-host' && !androidFresh;
  const cpuLoad = useHostDiagnosticsAsEmbodiment ? previous.cpuLoad01 : hostCpuLoad;
  const ramPressure = useHostDiagnosticsAsEmbodiment ? previous.ramPressure01 : hostRamPressure;
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

/**
 * A TTS process returning non-zero or timing out does not prove that playback never
 * started. Keep that epistemic distinction so ActionGateway leaves a durable pending
 * receipt instead of committing a false no-effect outcome and replaying the utterance.
 */
export type TermuxSpeechOutcome =
  | { status:'completed'; command:'termux-tts-speak'; operationId:string }
  | { status:'not-started'; command:'termux-tts-speak'; reason:string }
  | { status:'unknown'; command:'termux-tts-speak'; reason:string; operationId?:string };

export type TermuxSpeechInterruptOutcome =
  | { status:'requested'; command:'termux-tts-speak'; operationId:string; processExited:true; playbackVerified:false }
  | { status:'unknown'; command:'termux-tts-speak'; operationId:string; reason:string }
  | { status:'not-active'; command:'termux-tts-speak'; operationId:string; reason:string };

/** Starts TTS only when no prior process is still unresolved. The operation ID links a keyed gateway receipt to the exact process. */
export async function speakViaTermuxWithOutcome(text: string, options: TermuxTtsOptions = {}, timeout = 12000, operationIdInput?:string): Promise<TermuxSpeechOutcome> {
  const clean=String(text||'').replace(/[\r\n]+/g,' ').trim().slice(0,4000);
  if(!clean) return {status:'not-started',command:'termux-tts-speak',reason:'empty-text'};
  if(activeTtsProcess) return {status:'not-started',command:'termux-tts-speak',reason:'prior-tts-process-still-unresolved'};
  const operationId=String(operationIdInput??'').trim().slice(0,140)||`tts-${randomUUID()}`;
  const boundedTimeout=Math.max(100,Math.min(120000,Math.floor(Number(timeout)||12000)));
  const args:string[]=[];
  if(options.language) args.push('-l',String(options.language));
  if(options.region) args.push('-n',String(options.region));
  if(options.variant) args.push('-v',String(options.variant));
  if(Number.isFinite(options.pitch)) args.push('-p',String(clamp(Number(options.pitch))));
  if(Number.isFinite(options.rate)) args.push('-r',String(clamp(Number(options.rate))));
  if(options.stream) args.push('-s',String(options.stream));
  nativeSpeechEventChannel.publish(operationId, { phase:'command-requested' });
  return await new Promise<TermuxSpeechOutcome>((resolve) => {
    let settled=false;
    let timedOut=false;
    let deadline:ReturnType<typeof setTimeout>|undefined;
    let escalation:ReturnType<typeof setTimeout>|undefined;
    const releaseActive=()=>{ if(activeTtsProcess===child){activeTtsProcess=null;activeTtsOperationId=null;} };
    const finish=(outcome:TermuxSpeechOutcome, release=false)=>{
      if(release) releaseActive();
      if(settled) return;
      settled=true;
      if(deadline) clearTimeout(deadline);
      if(escalation) clearTimeout(escalation);
      resolve(outcome);
    };
    const child=spawn('termux-tts-speak',[...args,clean],{ windowsHide:true, stdio:'ignore' });
    activeTtsProcess=child;
    activeTtsOperationId=operationId;
    child.once('spawn',()=>nativeSpeechEventChannel.publish(operationId,{phase:'process-spawned'}));
    deadline=setTimeout(()=>{
      timedOut=true;
      try { child.kill('SIGTERM'); } catch { /* process may already have exited */ }
      escalation=setTimeout(()=>{
        try { child.kill('SIGKILL'); } catch { /* process may already have exited */ }
        finish({status:'unknown',command:'termux-tts-speak',reason:'tts-timeout-after-process-start',operationId});
      },750);
      (escalation as unknown as {unref?:()=>void}).unref?.();
    },boundedTimeout);
    child.once('error',(error:{code?:string})=>{
      // The Node spawn error event is emitted when process creation failed, so no
      // Termux command could have accepted the utterance.
      nativeSpeechEventChannel.publish(operationId,{phase:'process-error',errorCode:error.code??'spawn-error'});
      finish({status:'not-started',command:'termux-tts-speak',reason:error.code==='ENOENT'?'termux-tts-unavailable':'termux-tts-process-not-started'},true);
    });
    child.once('close',(code: number | null, signal: string | null)=>{
      nativeSpeechEventChannel.publish(operationId,{phase:'process-exited',exitCode:code,signal,reason:timedOut?'process-timeout':'process-closed'});
      if(timedOut) finish({status:'unknown',command:'termux-tts-speak',reason:'tts-timeout-after-process-start',operationId},true);
      else if(code===0 && signal==null) finish({status:'completed',command:'termux-tts-speak',operationId},true);
      else finish({status:'unknown',command:'termux-tts-speak',reason:'termux-tts-process-ended-with-uncertain-playback',operationId},true);
    });
  });
}

/**
 * Cancellation is deliberately not treated as proof that audio stopped: Termux can hand
 * work to Android's TTS service before the process exits. Only the canonical gateway owner
 * should call this function. A target mismatch is never allowed to kill a newer utterance.
 */
export async function interruptTermuxTtsWithOutcome(operationIdInput:string, timeout=1200):Promise<TermuxSpeechInterruptOutcome>{
  const operationId=String(operationIdInput??'').trim().slice(0,140);
  if(!operationId) return {status:'unknown',command:'termux-tts-speak',operationId:'',reason:'speech-operation-id-required'};
  const child=activeTtsProcess;
  if(!child) return {status:'unknown',command:'termux-tts-speak',operationId,reason:'no-live-process-playback-state-unavailable'};
  if(activeTtsOperationId!==operationId) return {status:'unknown',command:'termux-tts-speak',operationId,reason:'active-tts-target-mismatch-playback-state-unavailable'};
  const bounded=Math.max(100,Math.min(5000,Math.floor(Number(timeout)||1200)));
  let timer:ReturnType<typeof setTimeout>|undefined;
  let closed=false;
  const closePromise=new Promise<boolean>(resolve=>{
    timer=setTimeout(()=>resolve(false),bounded);
    (timer as unknown as {unref?:()=>void}).unref?.();
    child.once('close',()=>{closed=true;if(timer)clearTimeout(timer);resolve(true);});
  });
  let signalled=false;
  try { signalled=child.kill('SIGTERM'); } catch { signalled=false; }
  if(signalled) nativeSpeechEventChannel.publish(operationId,{phase:'interrupt-requested'});
  if(!signalled){ if(timer)clearTimeout(timer); return {status:'unknown',command:'termux-tts-speak',operationId,reason:'termination-signal-not-confirmed'}; }
  if(await closePromise) return {status:'requested',command:'termux-tts-speak',operationId,processExited:true,playbackVerified:false};
  try { child.kill('SIGKILL'); } catch { /* process state remains unresolved */ }
  nativeSpeechEventChannel.publish(operationId,{phase:'interrupt-unconfirmed',reason:closed?'process-closed-without-playback-proof':'process-exit-not-confirmed-after-interrupt'});
  return {status:'unknown',command:'termux-tts-speak',operationId,reason:closed?'process-closed-without-playback-proof':'process-exit-not-confirmed-after-interrupt'};
}

/** Compatibility wrapper. Unknown playback outcome is thrown, never flattened to false. */
export async function speakViaTermux(text: string, options: TermuxTtsOptions = {}, timeout = 12000): Promise<boolean> {
  const outcome=await speakViaTermuxWithOutcome(text,options,timeout);
  if(outcome.status==='unknown') throw new Error(outcome.reason);
  return outcome.status==='completed';
}

/** Legacy compatibility only. Physical cancellation must go through ActionGateway. */
export function interruptTermuxTts(): boolean { return false; }

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


export class CameraCaptureOutcomeUncertainError extends Error {
  constructor(message = 'camera-capture-outcome-uncertain') { super(message); this.name = 'CameraCaptureOutcomeUncertainError'; }
}

export interface CameraCaptureReceiptResult {
  ok: true; verified: true; receiptId: string; providerReceiptId: string;
  size: number; hash: string; cameraId: number; retained: boolean; capturedAt: number; path?: string;
}
export type CameraCaptureReceiptLookup =
  | { status: 'found'; authoritative: true; receiptId: string; result: CameraCaptureReceiptResult; checkedAt: number }
  | { status: 'unknown'; reason: string; checkedAt: number };
interface CameraCaptureReceiptFile {
  version: 1; type: 'termux-camera-capture'; tokenHash: string; operationHash: string;
  receiptId: string; recordedAt: number; result: CameraCaptureReceiptResult;
}

function cameraReceiptDirectory(receiptDir?: string): string {
  const supplied = String(receiptDir ?? process.env.NEURO_ACTION_RECEIPT_DIR ?? '').trim();
  return supplied || path.join(os.homedir(), '.neuro-kurisu', 'action-receipts');
}
function cameraOperationHash(cameraId: number, retain: boolean): string {
  return createHash('sha256').update(JSON.stringify({ cameraId: Math.max(0, Math.floor(cameraId)), retain: Boolean(retain), kind: 'termux-camera-capture-v1' })).digest('hex');
}
function normalizeCaptureToken(value: string): string {
  const token = String(value ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new CameraCaptureOutcomeUncertainError('camera-capture-requires-stable-sha256-idempotency-token');
  return token;
}
function cameraReceiptPath(token: string, receiptDir?: string): string {
  return path.join(cameraReceiptDirectory(receiptDir), `termux-camera-${normalizeCaptureToken(token)}.json`);
}

/** Durable, metadata-only receipt persistence. The captured image is never copied into this journal. */
export async function persistCameraCaptureReceipt(input: {
  idempotencyToken: string; cameraId: number; retain: boolean;
  result: { ok: true; size: number; hash: string; path?: string };
  receiptDir?: string; capturedAt?: number;
}): Promise<CameraCaptureReceiptResult> {
  const token = normalizeCaptureToken(input.idempotencyToken);
  const cameraId = Math.max(0, Math.floor(Number(input.cameraId) || 0));
  if (!input.result || input.result.ok !== true || !Number.isFinite(input.result.size) || input.result.size <= 0 || !/^[a-f0-9]{64}$/i.test(String(input.result.hash ?? ''))) {
    throw new CameraCaptureOutcomeUncertainError('camera-capture-result-is-not-a-valid-receipt');
  }
  if (input.retain && (!input.result.path || !path.isAbsolute(input.result.path))) throw new CameraCaptureOutcomeUncertainError('retained-camera-capture-path-missing');
  const receiptId = `termux-camera:${token.slice(0, 32)}`;
  const result: CameraCaptureReceiptResult = {
    ok: true, verified: true, receiptId, providerReceiptId: receiptId,
    size: Math.floor(input.result.size), hash: String(input.result.hash).toLowerCase(),
    cameraId, retained: Boolean(input.retain), capturedAt: Math.max(0, Number(input.capturedAt ?? Date.now()) || Date.now()),
    ...(input.retain && input.result.path ? { path: input.result.path } : {}),
  };
  const entry: CameraCaptureReceiptFile = {
    version: 1, type: 'termux-camera-capture', tokenHash: token,
    operationHash: cameraOperationHash(cameraId, input.retain), receiptId,
    recordedAt: Date.now(), result,
  };
  const destination = cameraReceiptPath(token, input.receiptDir);
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(entry)); await handle.sync(); }
  finally { await handle.close(); }
  try {
    try { await link(temporary, destination); }
    catch (error) {
      if (String((error as any)?.code ?? '') !== 'EEXIST') throw error;
      const existing = await readFile(destination, 'utf8');
      const prior = JSON.parse(existing) as CameraCaptureReceiptFile;
      if (prior?.version !== 1 || prior.tokenHash !== token || prior.operationHash !== entry.operationHash || prior.result?.hash !== result.hash || prior.result?.size !== result.size) {
        throw new CameraCaptureOutcomeUncertainError('camera-capture-receipt-key-conflict');
      }
      return structuredClone(prior.result);
    }
    // fsync the directory entry as well as the receipt contents where supported.
    try { const dirHandle = await open(directory, 'r'); try { await dirHandle.sync(); } finally { await dirHandle.close(); } } catch { /* some mobile filesystems disallow directory fsync; file contents are already synced */ }
  } catch (error) {
    if (error instanceof CameraCaptureOutcomeUncertainError) throw error;
    throw new CameraCaptureOutcomeUncertainError(`camera-capture-receipt-persistence-failed:${String((error as any)?.code ?? (error as any)?.message ?? 'io').slice(0, 80)}`);
  } finally { await unlink(temporary).catch(() => {}); }
  return result;
}

/**
 * A missing camera receipt is not proof the camera command never ran; a crash or
 * device restart may have removed temporary image bytes. Only a validated saved
 * receipt may resolve the pending operation as found. Absence is always unknown.
 */
export async function lookupCameraCaptureReceipt(
  idempotencyToken: string, cameraId: number, retain: boolean, receiptDir?: string,
): Promise<CameraCaptureReceiptLookup> {
  const checkedAt = Date.now();
  let token: string;
  try { token = normalizeCaptureToken(idempotencyToken); }
  catch { return { status: 'unknown', reason: 'camera-capture-invalid-idempotency-token', checkedAt }; }
  let text: string;
  try { text = await readFile(cameraReceiptPath(token, receiptDir), 'utf8'); }
  catch (error) {
    if (String((error as any)?.code ?? '') === 'ENOENT') return { status: 'unknown', reason: 'camera-capture-receipt-not-found-is-ambiguous', checkedAt };
    return { status: 'unknown', reason: 'camera-capture-receipt-read-failed', checkedAt };
  }
  let entry: CameraCaptureReceiptFile;
  try { entry = JSON.parse(text) as CameraCaptureReceiptFile; }
  catch { return { status: 'unknown', reason: 'camera-capture-receipt-invalid-json', checkedAt }; }
  if (entry?.version !== 1 || entry.type !== 'termux-camera-capture' || entry.tokenHash !== token || entry.operationHash !== cameraOperationHash(cameraId, retain) || entry.receiptId !== `termux-camera:${token.slice(0, 32)}` || entry.result?.ok !== true || entry.result.verified !== true || !/^[a-f0-9]{64}$/.test(String(entry.result.hash ?? '')) || !Number.isFinite(entry.result.size) || entry.result.size <= 0) {
    return { status: 'unknown', reason: 'camera-capture-receipt-schema-or-request-mismatch', checkedAt };
  }
  if (retain) {
    const savedPath = String(entry.result.path ?? '');
    if (!path.isAbsolute(savedPath) || path.basename(savedPath) !== 'capture.jpg' || !path.basename(path.dirname(savedPath)).startsWith('neuro-kurisu-camera-')) {
      return { status: 'unknown', reason: 'retained-camera-capture-path-invalid', checkedAt };
    }
    try {
      const fileStat = await stat(savedPath);
      const bytes = await readFile(savedPath);
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (!fileStat.isFile() || fileStat.size !== entry.result.size || hash !== entry.result.hash) return { status: 'unknown', reason: 'retained-camera-capture-payload-mismatch', checkedAt };
    } catch { return { status: 'unknown', reason: 'retained-camera-capture-payload-missing', checkedAt }; }
  }
  return { status: 'found', authoritative: true, receiptId: entry.receiptId, result: structuredClone(entry.result), checkedAt };
}

/** Execute camera capture once for a keyed operation and persist the provider-style receipt. */
export async function captureCameraPhotoWithReceipt(
  cameraId = 0, timeout = 15_000, retain = false, idempotencyToken: string, receiptDir?: string,
): Promise<CameraCaptureReceiptResult> {
  const token = normalizeCaptureToken(idempotencyToken);
  const prior = await lookupCameraCaptureReceipt(token, cameraId, retain, receiptDir);
  if (prior.status === 'found') return prior.result;
  if (!prior.reason?.includes('not-found-is-ambiguous')) throw new CameraCaptureOutcomeUncertainError(prior.reason);
  let capture: { ok: boolean; path?: string; size?: number; hash?: string; error?: string };
  try { capture = await captureCameraPhoto(cameraId, timeout, retain); }
  catch (error) { throw new CameraCaptureOutcomeUncertainError(String((error as any)?.message ?? 'camera-capture-command-outcome-unknown')); }
  if (!capture.ok) throw new CameraCaptureOutcomeUncertainError(`camera-capture-command-outcome-unknown:${String(capture.error ?? 'capture-failed').replace(/[\\r\\n\\t]+/g, ' ').slice(0, 100)}`);
  try {
    return await persistCameraCaptureReceipt({ idempotencyToken: token, cameraId, retain, result: { ok: true, size: Number(capture.size), hash: String(capture.hash ?? ''), ...(capture.path ? { path: capture.path } : {}) }, receiptDir });
  } catch (error) {
    if (error instanceof CameraCaptureOutcomeUncertainError) throw error;
    throw new CameraCaptureOutcomeUncertainError('camera-capture-receipt-persistence-failed');
  }
}
