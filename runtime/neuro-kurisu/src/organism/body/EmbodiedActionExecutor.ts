import type { EnvironmentAction } from '../world/WorldEnvironment.ts';
import type { EmbodimentRuntime } from './EmbodimentRuntime.ts';

export type EmbodiedExecutionStatus = 'executed'|'unavailable'|'skipped'|'failed'|'ambiguous';
export type EmbodiedRealityClass = 'device-observation'|'device-actuation'|'external-observation'|'derived';

export interface EmbodiedActionInput {
  spokenText?: string;
  speechEventId?: string;
  allowCamera?: boolean;
  /** Trusted runtime adapter; it must already route through the durable ActionGateway. */
  captureCamera?: (cameraId:number,retain:boolean)=>Promise<{ok:boolean;path?:string;size?:number;hash?:string;error?:string;executionId?:string;providerReceiptId?:string}>;
}

/** Descriptor-based normalization avoids invoking caller-owned field getters. */
export function normalizeEmbodiedActionInput(value:unknown):EmbodiedActionInput|null {
  if(value===undefined)return {};
  try {
    if(value===null||typeof value!=='object'||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const keys=Reflect.ownKeys(value);
    const allowed=new Set(['spokenText','speechEventId','allowCamera','captureCamera']);
    if(keys.some(key=>typeof key!=='string'||!allowed.has(key)))return null;
    const read=(key:string):unknown=>{
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor)return undefined;
      if(!('value'in descriptor)||descriptor.get||descriptor.set||!descriptor.enumerable)return Symbol.for('nk1.invalid-action-input-field');
      return descriptor.value;
    };
    const spokenText=read('spokenText'),speechEventId=read('speechEventId'),allowCamera=read('allowCamera'),captureCamera=read('captureCamera');
    const invalid=Symbol.for('nk1.invalid-action-input-field');
    if([spokenText,speechEventId,allowCamera,captureCamera].includes(invalid))return null;
    if(spokenText!==undefined&&(typeof spokenText!=='string'||spokenText.length>8192))return null;
    if(speechEventId!==undefined&&(typeof speechEventId!=='string'||speechEventId.length>140||speechEventId.trim()!==speechEventId))return null;
    if(allowCamera!==undefined&&typeof allowCamera!=='boolean')return null;
    if(captureCamera!==undefined&&typeof captureCamera!=='function')return null;
    return {
      ...(spokenText===undefined?{}:{spokenText}),
      ...(speechEventId===undefined?{}:{speechEventId}),
      ...(allowCamera===undefined?{}:{allowCamera}),
      ...(captureCamera===undefined?{}:{captureCamera}),
    };
  } catch { return null; }
}

export interface EmbodiedActionResult {
  version:1;
  action:string;
  status:EmbodiedExecutionStatus;
  realityClass:EmbodiedRealityClass;
  source:string;
  at:number;
  before:{battery01:number;thermal01:number;cognitiveCapacity01:number;awake:boolean;source:string};
  after:{battery01:number;thermal01:number;cognitiveCapacity01:number;awake:boolean;source:string};
  stateDelta:{battery01:number;thermal01:number;cognitiveCapacity01:number;awakeChanged:boolean};
  effect01:number;
  reason:string;
  capability:string|null;
  artifact?:{kind:string;hash?:string;size?:number;executionId?:string;providerReceiptId?:string};
  consequenceVerification:{attempted:boolean;independent:boolean;verified:boolean;sourceStable:boolean;freshBefore01:number;freshAfter01:number;changed01:number;reason:string;verificationMode:'independent-observation'|'actuation-receipt-only'|'derived-state-transition'|'none'};
}

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

/**
 * B365: the organism's chosen internal action gets an explicit embodiment gate.
 * This executor never fabricates a successful device effect. If Termux/Android
 * capability is absent, the result is `unavailable`, not a simulated success.
 */
export class EmbodiedActionExecutor {
  private readonly embodiment: EmbodimentRuntime;
  constructor(embodiment: EmbodimentRuntime) { this.embodiment = embodiment; }

  async execute(action:string, input:EmbodiedActionInput={}):Promise<EmbodiedActionResult>{
    const normalized=normalizeEmbodiedActionInput(input);
    const safeAction=typeof action==='string'&&action.length>0&&action.length<=96&&action.trim()===action?action:'unknown';
    if(!normalized||safeAction==='unknown'){
      const body=this.embodiment.snapshot();
      const base={battery01:body.telemetry.battery01,thermal01:body.thermalStrain01,cognitiveCapacity01:body.cognitiveCapacity01,awake:body.awake,source:body.telemetry.source};
      return {
        version:1,action:safeAction,status:'failed',realityClass:'derived',source:body.telemetry.source,at:Date.now(),
        before:base,after:{...base},stateDelta:{battery01:0,thermal01:0,cognitiveCapacity01:0,awakeChanged:false},
        effect01:0,reason:'embodied-action-input-invalid',capability:null,
        consequenceVerification:{attempted:false,independent:false,verified:false,sourceStable:false,freshBefore01:0,freshAfter01:0,changed01:0,reason:'input-rejected-before-device-or-gateway-access',verificationMode:'none'},
      };
    }
    input=normalized;
    const preSample=await this.embodiment.sample({force:true,requestedSensors:['battery','thermal','network']});
    const before=this.embodiment.snapshot();
    const at=Date.now();
    const base={battery01:before.telemetry.battery01,thermal01:before.thermalStrain01,cognitiveCapacity01:before.cognitiveCapacity01,awake:before.awake,source:before.telemetry.source};
    let status:EmbodiedExecutionStatus='skipped';
    let reason='action-has-no-direct-device-effect';
    let capability:string|null=null;
    let artifact:EmbodiedActionResult['artifact'];
    try {
      switch(action){
        case 'explore':
        case 'verify': {
          await this.embodiment.sample();
          const afterSample=this.embodiment.snapshot();
          if(input.allowCamera && afterSample.cameraAvailable && afterSample.telemetry.source==='android-termux'){
            // The motor executor cannot bypass ActionGateway for a real camera side effect.
            // Runtime supplies the canonical keyed adapter; without it, report unavailable.
            if(!input.captureCamera){
              status='unavailable'; reason='camera-capture-action-gateway-required'; capability='android.camera';
            } else {
              const shot=await input.captureCamera(0,false);
              if(shot.ok){
                status='executed'; reason='live-android-camera-observation'; capability='android.camera';
                artifact={kind:'camera-capture',hash:shot.hash,size:shot.size,executionId:shot.executionId,providerReceiptId:shot.providerReceiptId};
              } else {
                status='failed'; reason=shot.error ? `android-camera-command-failed:${String(shot.error).slice(0,100)}` : 'android-camera-command-failed'; capability='android.camera';
              }
            }
          } else if(afterSample.telemetry.source==='android-termux'){
            status='executed'; reason='live-android-telemetry-observation'; capability='android.sensors';
          } else {
            status='unavailable'; reason='no-live-android-capability'; capability='android.sensors';
          }
          break;
        }
        case 'wait':
        case 'inspect': {
          await this.embodiment.sample();
          const afterSample=this.embodiment.snapshot();
          status=afterSample.telemetry.source==='android-termux'?'executed':'unavailable';
          reason=status==='executed'?'live-android-body-sample':'android-body-sample-unavailable';
          capability='android.battery';
          break;
        }
        case 'respond': {
          if(typeof input.spokenText!=='string'||!input.spokenText.trim()){
            status='skipped'; reason='no-speech-payload'; capability='android.tts'; break;
          }
          if(!before.ttsAvailable || before.telemetry.source!=='android-termux'){
            status='unavailable'; reason='live-tts-unavailable'; capability='android.tts'; break;
          }
          const ok=await this.embodiment.speak(input.spokenText,{speechEventId:input.speechEventId,action:'respond'});
          const voiceError=String(this.embodiment.voiceSnapshot().state.lastError??'');
          if(ok){status='executed';reason='live-android-tts-command-accepted';}
          else if(voiceError.includes('tts-outcome-unknown-reconciliation-required')){status='ambiguous';reason='tts-outcome-unknown-reconciliation-required';}
          else if(/unavailable|gateway-dispatcher-unavailable|idempotency-storage-unavailable|idempotency-key-required/i.test(voiceError)){status='unavailable';reason=voiceError.slice(0,180)||'tts-output-unavailable';}
          else {status='failed';reason=voiceError.slice(0,180)||'android-tts-command-failed';}
          capability='android.tts';
          break;
        }
        case 'rest': {
          await this.embodiment.sample();
          this.embodiment.sleep('organism-rest');
          status='executed'; reason='embodied-rest-state-transition'; capability=null;
          break;
        }
        case 'defer': {
          await this.embodiment.sample();
          if(this.embodiment.snapshot().telemetry.source==='android-termux'){
            status='executed'; reason='live-android-resource-observation-and-defer'; capability='android.battery';
          } else {
            status='unavailable'; reason='android-resource-observation-unavailable'; capability='android.battery';
          }
          break;
        }
        case 'reflect':
          status='skipped'; reason='reflection-is-cognitive-not-direct-device-effect'; break;
        default:
          status='skipped'; reason='no-embodiment-mapping'; break;
      }
    } catch(error){
      status='failed'; reason=`embodied-action-error:${String((error as any)?.message||error).slice(0,160)}`;
    }
    const after=await this.embodiment.sample({force:true,requestedSensors:['battery','thermal','network']});
    const afterBody=this.embodiment.snapshot();
    const beforeFresh=preSample.telemetry.source==='android-termux' && preSample.telemetry.staleMs===0 ? 1 : 0;
    const afterFresh=after.telemetry.source==='android-termux' && after.telemetry.staleMs===0 ? 1 : 0;
    const sourceStable=before.telemetry.source===after.telemetry.source;
    const independent=after.telemetry.sampledAt>before.telemetry.sampledAt;
    const delta={battery01:afterBody.telemetry.battery01-before.telemetry.battery01,thermal01:afterBody.thermalStrain01-before.thermalStrain01,cognitiveCapacity01:afterBody.cognitiveCapacity01-before.cognitiveCapacity01,awakeChanged:afterBody.awake!==before.awake};
    const changed01=clamp(Math.abs(delta.battery01)*.25+Math.abs(delta.thermal01)*.35+Math.abs(delta.cognitiveCapacity01)*.25+(delta.awakeChanged?.15:0));
    const deviceFresh=beforeFresh===1 && afterFresh===1 && sourceStable && independent;
    const observationAction=['explore','verify','wait','inspect'].includes(action);
    const actuationAction=['respond'].includes(action);
    // A fresh sensor sample is an independently observed outcome for observation actions.
    // It is NOT evidence that an actuator such as TTS had an external effect.
    const verified=Boolean(deviceFresh && status==='executed' && observationAction);
    const verificationMode:EmbodiedActionResult['consequenceVerification']['verificationMode']=
      verified ? 'independent-observation' : (actuationAction && status==='executed' ? 'actuation-receipt-only' : (action==='rest' ? 'derived-state-transition' : (status==='executed' ? 'none' : 'none')));
    const consequenceReason=verified?'independent-live-device-post-action-measurement':(actuationAction&&status==='executed'?'device-command-acknowledged-without-independent-effect-verification':(status==='ambiguous'?'tts-result-unknown-do-not-retry-or-credit':(status==='executed'?'action-executed-without-independent-device-proof':'no-independent-device-consequence-proof')));
    const effect01=clamp(changed01*(verified?.9:.15));
    const realityClass:EmbodiedRealityClass=verified?'device-observation':(actuationAction&&(status==='executed'||status==='ambiguous')&&afterBody.telemetry.source==='android-termux'?'device-actuation':'derived');
    return {version:1,action,status,realityClass,source:afterBody.telemetry.source,at,before:base,after:{battery01:afterBody.telemetry.battery01,thermal01:afterBody.thermalStrain01,cognitiveCapacity01:afterBody.cognitiveCapacity01,awake:afterBody.awake,source:afterBody.telemetry.source},stateDelta:delta,effect01,reason,capability,artifact,consequenceVerification:{attempted:true,independent,verified,sourceStable,freshBefore01:beforeFresh,freshAfter01:afterFresh,changed01,reason:consequenceReason,verificationMode}};
  }
}
