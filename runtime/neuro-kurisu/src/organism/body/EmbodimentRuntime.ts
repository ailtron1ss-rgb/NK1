import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import { sampleAndroidTelemetryDetailed, type TermuxCapabilities, type TermuxTtsOptions, detectTermuxCapabilities, synthesizeSpeechInput, type AndroidTelemetryDiagnostics } from './AndroidEmbodimentBridge.ts';
import { buildVoicePlan, defaultVoiceRuntimeState, type VoiceRuntimeState, type VoicePlan } from './VoiceEmbodiment.ts';
import { defaultBodyState, normalizePersistedBodyState, synthesizeBody, type OrganismBodyEvent, type OrganismBodyState, shouldEnterSleep } from './EmbodiedBody.ts';
import type { OrganismState } from '../core/types.ts';
import type { AndroidSamplingPlan } from './AndroidEmbodimentBridge.ts';

type OrganismNeedsLike = { energy:number; cognitiveLoad:number; uncertainty:number; socialNeed:number; novelty:number; identityCoherence:number; goalPressure:number; };

function isValidTimestamp(value:unknown):value is number { return typeof value==='number' && Number.isFinite(value) && value>=0; }
function cleanEventText(value:unknown,maxLength=240):string|null {
  if(typeof value!=='string') return null;
  const clean=value.normalize('NFKC').replace(/[\r\n\t]+/g,' ').trim();
  if(!clean || clean.length>maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(clean)) return null;
  return clean;
}
export type SpeechGatewayResult = { ok:boolean; uncertain?:boolean; outcomeClass?:string; reason?:string };
export type SpeechGatewayDispatcher = (text:string, options:TermuxTtsOptions, speechEventId:string) => Promise<SpeechGatewayResult>;
export type SpeechInterruptGatewayDispatcher = (speechEventId:string, reason:string, interruptEventId:string) => Promise<SpeechGatewayResult>;

export class EmbodimentRuntime {
  private body: OrganismBodyState = defaultBodyState();
  private events: OrganismBodyEvent[] = [];
  private capabilities: TermuxCapabilities = { battery:false, sensors:false, tts:false, stt:false, camera:false, wifi:false };
  private lastSampleAt = 0;
  private voice: VoiceRuntimeState = defaultVoiceRuntimeState();
  private lastVoicePlan: VoicePlan | null = null;
  private lastDiagnostics: AndroidTelemetryDiagnostics | null = null;
  private sensorFailures = 0;
  private sampleCount = 0;
  private speechGatewayDispatcher:SpeechGatewayDispatcher|null=null;
  private speechInterruptGatewayDispatcher:SpeechInterruptGatewayDispatcher|null=null;
  private activeSpeechEventId:string|null=null;
  private speechInputDispatcher: (()=>Promise<string|null>) = synthesizeSpeechInput;

  /** The only permitted routes to physical TTS and interruption are ActionGateway-backed dispatchers. */
  setSpeechGatewayDispatcher(dispatcher:SpeechGatewayDispatcher|null):void { this.speechGatewayDispatcher=dispatcher; }
  setSpeechInterruptGatewayDispatcher(dispatcher:SpeechInterruptGatewayDispatcher|null):void { this.speechInterruptGatewayDispatcher=dispatcher; }
  /** Injectable STT boundary for platform adapters and deterministic recovery tests. */
  setSpeechInputDispatcher(dispatcher:(()=>Promise<string|null>)|null):void { this.speechInputDispatcher=dispatcher??synthesizeSpeechInput; }

  async init(persisted?: OrganismBodyState | null): Promise<void> {
    this.body = normalizePersistedBodyState(persisted) ?? defaultBodyState();
    this.capabilities = await detectTermuxCapabilities();
    this.body.ttsAvailable = this.capabilities.tts;
    this.body.sttAvailable = this.capabilities.stt;
    this.body.cameraAvailable = this.capabilities.camera;
    this.body.microphoneAvailable = this.capabilities.stt;
    await this.sample();
  }

  snapshot(): OrganismBodyState { return structuredClone(this.body); }
  eventLog(): OrganismBodyEvent[] { return structuredClone(this.events.slice(0, 200)); }
  capabilitiesSnapshot(): TermuxCapabilities { return { ...this.capabilities }; }
  voiceSnapshot(): { state: VoiceRuntimeState; plan: VoicePlan | null } { return { state: structuredClone(this.voice), plan: structuredClone(this.lastVoicePlan) }; }
  sensorDiagnosticsSnapshot(): { diagnostics: AndroidTelemetryDiagnostics | null; sampleCount:number; sensorFailures:number } { return { diagnostics: structuredClone(this.lastDiagnostics), sampleCount:this.sampleCount, sensorFailures:this.sensorFailures }; }

  async sample(plan: AndroidSamplingPlan = {}): Promise<OrganismBodyState> {
    const force = Boolean(plan.force);
    if (!force && Date.now() - this.lastSampleAt < 5000) return this.snapshot();
    const { telemetry, diagnostics } = await sampleAndroidTelemetryDetailed(this.body.telemetry, plan);
    const wasAwake = this.body.awake;
    this.body = synthesizeBody(telemetry, this.body);
    this.lastDiagnostics = diagnostics; this.sampleCount += 1; this.sensorFailures += diagnostics.commandFailures > 0 ? 1 : 0;
    this.lastSampleAt = Date.now();
    this.push('sensor', `${telemetry.source}: battery=${Math.round(telemetry.battery01*100)}%, cpu=${telemetry.cpuLoad01.toFixed(2)}, ram=${telemetry.ramPressure01.toFixed(2)}`, 0.35);
    if (wasAwake && !this.body.awake) this.sleep('resource-pressure');
    return this.snapshot();
  }

  async sampleActive(requestedSensors:string[], force=true):Promise<OrganismBodyState>{
    return this.sample({requestedSensors:[...new Set(requestedSensors.map(String))].slice(0,8),force});
  }

  userActivity(at = Date.now()): void {
    // Reject invalid clocks before touching continuity fields; NaN can poison idle/sleep logic.
    if(!isValidTimestamp(at)) return;
    this.body.lastUserActivityAt = at;
    this.body.lastExternalEventAt = at;
    if (!this.body.awake) this.wake('user-activity');
  }

  externalEvent(detail: string, importance = 0.4, at = Date.now()): void {
    // External events influence initiative and wake policy, so validate before mutation.
    const cleanDetail=cleanEventText(detail);
    if(!cleanDetail || !isValidTimestamp(at) || typeof importance!=='number' || !Number.isFinite(importance) || importance<0 || importance>1) return;
    this.body.lastExternalEventAt = at;
    this.push('external', cleanDetail, importance);
    if (!this.body.awake && importance >= 0.5) this.wake('important-external-event');
  }

  maybeSleep(now = Date.now()): boolean {
    if(!isValidTimestamp(now)) return !this.body.awake;
    if (!this.body.awake) return true;
    if (shouldEnterSleep(this.body, now)) { this.sleep('resource-or-idle'); return true; }
    return false;
  }

  sleep(reason = 'manual'): void {
    const cleanReason=cleanEventText(reason,120);
    if(!cleanReason || !this.body.awake) return;
    this.body.sleep = this.body.telemetry.battery01 < 0.12 ? 'deep-sleep' : 'light-sleep';
    this.body.awake = false;
    this.body.wakeReason = cleanReason;
    this.push('sleep', 'enter ' + this.body.sleep + ': ' + cleanReason, 0.6);
  }

  wake(reason = 'manual'): void {
    const cleanReason=cleanEventText(reason,120);
    if(!cleanReason || (this.body.awake && this.body.sleep === 'awake')) return;
    this.body.sleep = 'waking';
    this.body.awake = true;
    this.body.wakeReason = cleanReason;
    this.body.lastExternalEventAt = Date.now();
    this.push('wake', 'wake: ' + cleanReason, 0.7);
  }

  /** Physical camera I/O is owned by OrganismCore's keyed ActionGateway tool. This low-level facade fails closed to prevent bypassing the durable receipt ledger. */
  async captureCamera(_cameraId = 0, _retain = false) { return { ok:false as const, error:'camera-capture-action-gateway-required' }; }

  private push(kind: OrganismBodyEvent['kind'], detail: string, importance: number) {
    const cleanDetail=cleanEventText(detail);
    if(!cleanDetail || typeof importance!=='number' || !Number.isFinite(importance)) return;
    this.events.unshift({ at: Date.now(), kind, detail:cleanDetail, importance: Math.max(0, Math.min(1, importance)) });
    this.events = this.events.slice(0, 200);
  }
}
