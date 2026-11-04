import { createHash } from 'node:crypto';
import { sampleAndroidTelemetryDetailed, type TermuxCapabilities, type TermuxTtsOptions, detectTermuxCapabilities, synthesizeSpeechInput, type AndroidTelemetryDiagnostics } from './AndroidEmbodimentBridge.ts';
import { buildVoicePlan, defaultVoiceRuntimeState, type VoiceRuntimeState, type VoicePlan } from './VoiceEmbodiment.ts';
import { defaultBodyState, synthesizeBody, type OrganismBodyEvent, type OrganismBodyState, shouldEnterSleep } from './EmbodiedBody.ts';
import type { OrganismState } from '../core/types.ts';
import type { AndroidSamplingPlan } from './AndroidEmbodimentBridge.ts';
import { nativeSpeechEventChannel, type NativeSpeechProviderEventV1 } from './NativeSpeechEventChannel.ts';
import { NekoAsrTranscriptAdapter, type NekoAsrProviderPort } from '../integration/neko/NekoAsrTranscriptAdapter.ts';
import type { NekoSpeechAdmissionSnapshotV1 } from '../integration/neko/NekoSpeechAdmissionGate.ts';

export interface VoiceInputResult {
  readonly text: string;
  readonly providerId: string;
  readonly confidence01?: number;
  readonly language?: string;
  readonly eventId?: string;
  readonly turnId?: string;
  readonly speechAdmission?: NekoSpeechAdmissionSnapshotV1;
  readonly speechAdmissionError?: string;
}

type OrganismNeedsLike = { energy:number; cognitiveLoad:number; uncertainty:number; socialNeed:number; novelty:number; identityCoherence:number; goalPressure:number; };
export interface VoiceCognitiveContextOverrides {
  continuity01?:number;
  grounding01?:number;
  uncertainty01?:number;
  emotion?:{label?:string;valence01?:number;arousal01?:number;dominance01?:number};
  needs?:OrganismNeedsLike;
}
export interface VoiceCognitiveContextSnapshot {
  needs:OrganismNeedsLike;
  continuity01:number;
  grounding01:number;
  uncertainty01:number;
  emotion?:{label?:string;valence01?:number;arousal01?:number;dominance01?:number};
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
  private lastVoiceCognitiveContext:VoiceCognitiveContextSnapshot|null=null;
  private lastDiagnostics: AndroidTelemetryDiagnostics | null = null;
  private sensorFailures = 0;
  private sampleCount = 0;
  private speechGatewayDispatcher:SpeechGatewayDispatcher|null=null;
  private speechInterruptGatewayDispatcher:SpeechInterruptGatewayDispatcher|null=null;
  private activeSpeechEventId:string|null=null;
  private nekoAsrAdapter:NekoAsrTranscriptAdapter|null=null;

  /** Inject a host-owned N.E.K.O./local ASR provider; null preserves the Termux STT fallback. */
  setNekoAsrProvider(provider:NekoAsrProviderPort|null):void { this.nekoAsrAdapter=provider?new NekoAsrTranscriptAdapter(provider):null; }
  get speechInputProviderId():string { return this.nekoAsrAdapter?.providerId ?? 'termux-speech-to-text'; }

  /** The only permitted routes to physical TTS and interruption are ActionGateway-backed dispatchers. */
  setSpeechGatewayDispatcher(dispatcher:SpeechGatewayDispatcher|null):void { this.speechGatewayDispatcher=dispatcher; }
  setSpeechInterruptGatewayDispatcher(dispatcher:SpeechInterruptGatewayDispatcher|null):void { this.speechInterruptGatewayDispatcher=dispatcher; }

  async init(persisted?: OrganismBodyState | null): Promise<void> {
    this.body = persisted?.schemaVersion === 1 ? structuredClone(persisted) : defaultBodyState();
    this.capabilities = await detectTermuxCapabilities();
    this.body.ttsAvailable = this.capabilities.tts;
    const externalAsrAvailable=this.nekoAsrAdapter?await this.nekoAsrAdapter.isAvailable():false;
    this.body.sttAvailable = this.nekoAsrAdapter?externalAsrAvailable:this.capabilities.stt;
    this.body.cameraAvailable = this.capabilities.camera;
    this.body.microphoneAvailable = this.nekoAsrAdapter?externalAsrAvailable:this.capabilities.stt;
    await this.sample();
  }

  snapshot(): OrganismBodyState { return structuredClone(this.body); }
  eventLog(): OrganismBodyEvent[] { return structuredClone(this.events.slice(0, 200)); }
  capabilitiesSnapshot(): TermuxCapabilities { return { ...this.capabilities }; }
  voiceSnapshot(): { state: VoiceRuntimeState; plan: VoicePlan | null } { return { state: structuredClone(this.voice), plan: structuredClone(this.lastVoicePlan) }; }
  voiceCognitiveContextSnapshot():VoiceCognitiveContextSnapshot|null{return this.lastVoiceCognitiveContext?structuredClone(this.lastVoiceCognitiveContext):null;}
  sensorDiagnosticsSnapshot(): { diagnostics: AndroidTelemetryDiagnostics | null; sampleCount:number; sensorFailures:number } { return { diagnostics: structuredClone(this.lastDiagnostics), sampleCount:this.sampleCount, sensorFailures:this.sensorFailures }; }

  /** Subscribe to native provider-process telemetry without importing the low-level Termux bridge. These events are not verified audio playback events. */
  subscribeNativeSpeechEvents(listener:(event:NativeSpeechProviderEventV1)=>void):()=>void {
    return nativeSpeechEventChannel.subscribe(listener);
  }

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
    this.body.lastUserActivityAt = at;
    this.body.lastExternalEventAt = at;
    if (!this.body.awake) this.wake('user-activity');
  }

  externalEvent(detail: string, importance = 0.4, at = Date.now()): void {
    this.body.lastExternalEventAt = at;
    this.push('external', detail, importance);
    if (!this.body.awake && importance >= 0.5) this.wake('important-external-event');
  }

  maybeSleep(now = Date.now()): boolean {
    if (!this.body.awake) return true;
    if (shouldEnterSleep(this.body, now)) { this.sleep('resource-or-idle'); return true; }
    return false;
  }

  sleep(reason = 'manual'): void {
    if (!this.body.awake) return;
    this.body.sleep = this.body.telemetry.battery01 < 0.12 ? 'deep-sleep' : 'light-sleep';
    this.body.awake = false;
    this.body.wakeReason = reason;
    this.push('sleep', `enter ${this.body.sleep}: ${reason}`, 0.6);
  }

  wake(reason = 'manual'): void {
    if (this.body.awake && this.body.sleep === 'awake') return;
    this.body.sleep = 'waking';
    this.body.awake = true;
    this.body.wakeReason = reason;
    this.body.lastExternalEventAt = Date.now();
    this.push('wake', `wake: ${reason}`, 0.7);
    this.body.sleep = 'awake';
  }

  applyToState(state: OrganismState, voiceContext:VoiceCognitiveContextOverrides={}): OrganismState {
    const lowBattery = Math.max(0, 0.35 - this.body.telemetry.battery01) / 0.35;
    const heat = this.body.thermalStrain01;
    state.needs.energy = Math.max(0, Math.min(1, state.needs.energy * 0.75 + this.body.bodyEnergy01 * 0.25 - lowBattery * 0.08));
    state.needs.cognitiveLoad = Math.max(0, Math.min(1, state.needs.cognitiveLoad * 0.76 + (1 - this.body.cognitiveCapacity01) * 0.28 + heat * 0.12 + (this.body.awake ? 0 : 0.15)));
    state.attentionBudget = Math.max(0, Math.min(1, state.attentionBudget * 0.72 + this.body.cognitiveCapacity01 * 0.28));
    // Capture the post-interoceptive state, not stale pre-body values. This context
    // is consumed by both previewVoicePlan() and speak(), unless a turn overrides it.
    const unit=(value:number,fallback:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
    const needs:OrganismNeedsLike={
      energy:unit(state.needs.energy,this.body.bodyEnergy01),
      cognitiveLoad:unit(state.needs.cognitiveLoad,1-this.body.cognitiveCapacity01),
      uncertainty:unit(state.needs.uncertainty,1-this.body.sensoryFreshness01),
      socialNeed:unit(state.needs.socialNeed,.35),
      novelty:unit(state.needs.novelty,.2),
      identityCoherence:unit(state.needs.identityCoherence,.8),
      goalPressure:unit(state.needs.goalPressure,.35),
    };
    const rawEmotion=voiceContext.emotion;
    const emotion=rawEmotion?{
      ...(typeof rawEmotion.label==='string'?{label:rawEmotion.label.slice(0,40)}:{}),
      ...(rawEmotion.valence01!==undefined?{valence01:unit(rawEmotion.valence01,.5)}:{}),
      ...(rawEmotion.arousal01!==undefined?{arousal01:unit(rawEmotion.arousal01,.22)}:{}),
      ...(rawEmotion.dominance01!==undefined?{dominance01:unit(rawEmotion.dominance01,.5)}:{}),
    }:undefined;
    this.lastVoiceCognitiveContext={
      needs,
      continuity01:unit(voiceContext.continuity01??needs.identityCoherence,needs.identityCoherence),
      grounding01:unit(voiceContext.grounding01??.7,.7),
      uncertainty01:unit(voiceContext.uncertainty01??needs.uncertainty,needs.uncertainty),
      ...(emotion?{emotion}:{}),
    };
    return state;
  }

  resourceSummary(): string {
    const t = this.body.telemetry;
    return `battery=${Math.round(t.battery01*100)}%, temp=${t.batteryTemperatureC == null ? 'n/a' : `${t.batteryTemperatureC.toFixed(1)}C`}, cpu=${Math.round(t.cpuLoad01*100)}%, ram=${Math.round(t.ramPressure01*100)}%, thermal=${Math.round(this.body.thermalStrain01*100)}%, sleep=${this.body.sleep}`;
  }

  previewVoicePlan(text:string,context:VoiceCognitiveContextOverrides & {action?:string|null;mode?:string|null}={}):VoicePlan{
    const cached=this.lastVoiceCognitiveContext;
    const needs=context.needs??cached?.needs??{
      energy:this.body.bodyEnergy01,
      cognitiveLoad:1-this.body.cognitiveCapacity01,
      uncertainty:1-this.body.sensoryFreshness01,
      socialNeed:.35,novelty:.2,identityCoherence:.8,goalPressure:.35,
    };
    return buildVoicePlan({
      text:String(text||''),
      action:context.action,
      mode:context.mode,
      needs,
      body:this.body,
      continuity01:context.continuity01??cached?.continuity01,
      grounding01:context.grounding01??cached?.grounding01,
      uncertainty01:context.uncertainty01??cached?.uncertainty01??needs.uncertainty,
      emotion:context.emotion??cached?.emotion,
    });
  }

  async speak(text: string, context?: VoiceCognitiveContextOverrides & { action?:string|null; mode?:string|null; speechEventId?:string }): Promise<boolean> {
    if(this.activeSpeechEventId){this.voice.lastError='tts-prior-outcome-unresolved-no-overlap';this.voice.lastAt=Date.now();return false;}
    if(!this.body.ttsAvailable) { this.voice.lastError='tts-unavailable'; this.voice.lastAt=Date.now(); return false; }
    const plan=this.previewVoicePlan(text,context);
    this.lastVoicePlan=plan;
    const clean=String(text||'').replace(/[\r\n]+/g,' ').trim().slice(0,2000);
    const dispatcher=this.speechGatewayDispatcher;
    if(!dispatcher){this.voice.speaking=false;this.voice.lastAt=Date.now();this.voice.lastError='action-gateway-speech-dispatcher-unavailable';return false;}
    const speechEventId=String(context?.speechEventId??'').trim().slice(0,140)||`speech-${createHash('sha256').update(JSON.stringify({text:clean,action:context?.action??null,mode:context?.mode??null,lastUserActivityAt:this.body.lastUserActivityAt,lastExternalEventAt:this.body.lastExternalEventAt})).digest('hex').slice(0,48)}`;
    const options:TermuxTtsOptions={ language:plan.language, pitch:plan.prosody.pitch, rate:plan.prosody.rate, volume:plan.prosody.volume, stream:plan.stream };
    this.activeSpeechEventId=speechEventId;
    this.voice.speaking=true; this.voice.lastMode=plan.mode; this.voice.lastTone=plan.tone; this.voice.lastProsody=plan.prosody; this.voice.lastAt=Date.now(); this.voice.lastError=null;
    try {
      const result=await dispatcher(clean,options,speechEventId);
      this.voice.lastAt=Date.now();
      // A concurrent gateway-mediated interrupt may already have retired this utterance.
      // Do not let a late speech receipt overwrite the newer interruption state.
      if(this.activeSpeechEventId!==speechEventId) return false;
      if(result.uncertain || result.outcomeClass==='idempotency-recovery-required' || result.outcomeClass==='executed-partial') {
        // Preserve the target so a user interruption can ask the gateway to reconcile/cancel it.
        this.voice.speaking=true; this.voice.lastError='tts-outcome-unknown-reconciliation-required';
        return false;
      }
      if(this.activeSpeechEventId===speechEventId){this.activeSpeechEventId=null;this.voice.speaking=false;}
      if(!result.ok) this.voice.lastError=String(result.reason??result.outcomeClass??'tts-execution-not-completed').slice(0,120);
      else {this.voice.lastError=null;this.voice.utteranceCount+=1;}
      return result.ok===true;
    } catch(error) {
      if(this.activeSpeechEventId!==speechEventId) return false;
      this.voice.lastAt=Date.now();
      // A thrown dispatcher may have crossed the side-effect boundary; retain the target.
      this.voice.speaking=true; this.voice.lastError=`tts-outcome-unknown-reconciliation-required:${String((error as Error)?.message??error).replace(/[\r\n\t]+/g,' ').slice(0,100)}`;
      return false;
    }
  }
  async listenDetailed(): Promise<VoiceInputResult | null> {
    if(!this.body.sttAvailable) { this.voice.lastError='stt-unavailable'; this.voice.lastAt=Date.now(); return null; }
    this.voice.listening=true; this.voice.listenCount+=1; this.voice.lastAt=Date.now(); this.voice.lastError=null;
    try {
      if(this.nekoAsrAdapter){
        const result=await this.nekoAsrAdapter.captureFinal();
        if(result.status==='accepted') {
          return {
            text: result.transcript,
            providerId: result.provider,
            ...(result.confidence01 !== undefined ? { confidence01: result.confidence01 } : {}),
            ...(result.language ? { language: result.language } : {}),
            eventId: result.eventId,
            turnId: result.turnId,
            ...(result.speechAdmission ? { speechAdmission: result.speechAdmission } : {}),
            ...(result.speechAdmissionError ? { speechAdmissionError: result.speechAdmissionError } : {}),
          };
        }
        this.voice.lastError=result.status==='rejected'?`asr-${result.reason}`:result.status==='replayed'?'asr-replayed-final':result.status==='error'?`asr-provider-error:${result.reason}`:'asr-capture-cancelled';
        return null;
      }
      const text=await synthesizeSpeechInput();
      if(!text) {
        this.voice.lastError='stt-empty-or-failed';
        return null;
      }
      return { text, providerId: 'termux-speech-to-text' };
    } catch(error) {
      this.voice.lastError=`stt-failed:${String((error as Error)?.message??error).replace(/[\\r\\n\\t]+/g,' ').slice(0,100)}`;
      return null;
    } finally {
      this.voice.listening=false; this.voice.lastAt=Date.now();
    }
  }

  /** Backward-compatible transcript-only API; detailed consumers use listenDetailed(). */
  async listen(): Promise<string | null> {
    const result = await this.listenDetailed();
    return result?.text ?? null;
  }

  async markVoiceInterruption(reason='manual'): Promise<boolean> {
    const speechEventId=this.activeSpeechEventId;
    if(!speechEventId){
      if(!this.voice.listening) return false;
      if(this.nekoAsrAdapter?.isListening){
        const result=await this.nekoAsrAdapter.interrupt(reason);
        this.voice.lastAt=Date.now();
        if(result.status==='verified'){this.voice.interruptionCount+=1;this.voice.lastError='asr-interruption-verified';return true;}
        this.voice.lastError=result.status==='unverified'?`asr-interruption-unverified:${result.reason}`:`asr-interruption-unavailable:${result.reason}`;
        return false;
      }
      // Legacy Termux STT has no durable cancellation adapter; do not claim it stopped.
      this.voice.lastError='speech-listening-interruption-unavailable';this.voice.lastAt=Date.now();return false;
    }
    const dispatcher=this.speechInterruptGatewayDispatcher;
    if(!dispatcher){this.voice.lastError='action-gateway-speech-interrupt-dispatcher-unavailable';this.voice.lastAt=Date.now();return false;}
    const cleanReason=String(reason||'manual').replace(/[\r\n\t]+/g,' ').slice(0,120);
    const interruptEventId=`speech-interrupt-${createHash('sha256').update(`${speechEventId}\u0000${cleanReason}`).digest('hex').slice(0,48)}`;
    try {
      const result=await dispatcher(speechEventId,cleanReason,interruptEventId);
      this.voice.lastAt=Date.now();
      if(result.uncertain||result.outcomeClass==='idempotency-recovery-required'||result.outcomeClass==='executed-partial'){
        this.voice.lastError='tts-interruption-outcome-unknown-reconciliation-required';return false;
      }
      if(result.ok){
        if(this.activeSpeechEventId===speechEventId){this.activeSpeechEventId=null;this.voice.speaking=false;}
        this.voice.interruptionCount+=1;this.voice.lastError='tts-interruption-requested-playback-unverified';return true;
      }
      this.voice.lastError=String(result.reason??result.outcomeClass??'tts-interruption-not-completed').slice(0,120);return false;
    } catch(error) {
      this.voice.lastAt=Date.now();this.voice.lastError=`tts-interruption-outcome-unknown-reconciliation-required:${String((error as Error)?.message??error).replace(/[\r\n\t]+/g,' ').slice(0,80)}`;return false;
    }
  }
  /** Physical camera I/O is owned by OrganismCore's keyed ActionGateway tool. This low-level facade fails closed to prevent bypassing the durable receipt ledger. */
  async captureCamera(_cameraId = 0, _retain = false) { return { ok:false as const, error:'camera-capture-action-gateway-required' }; }

  private push(kind: OrganismBodyEvent['kind'], detail: string, importance: number) {
    this.events.unshift({ at: Date.now(), kind, detail, importance: Math.max(0, Math.min(1, importance)) });
    this.events = this.events.slice(0, 200);
  }
}
