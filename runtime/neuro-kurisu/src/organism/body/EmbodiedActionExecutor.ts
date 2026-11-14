import { randomUUID } from 'node:crypto';
import type { EnvironmentAction } from '../world/WorldEnvironment.ts';
import type { EmbodimentRuntime } from './EmbodimentRuntime.ts';

export type EmbodiedExecutionStatus = 'executed'|'unavailable'|'skipped'|'failed'|'ambiguous';
export type EmbodiedRealityClass = 'device-telemetry'|'camera-artifact'|'device-observation'|'device-actuation'|'external-observation'|'derived';

export interface EmbodiedActionResult {
  version:1;
  action:string;
  status:EmbodiedExecutionStatus;
  realityClass:EmbodiedRealityClass;
  source:string;
  at:number;
  executionId:string;
  decisionId?:string;
  before:{battery01:number;thermal01:number;cognitiveCapacity01:number;awake:boolean;source:string};
  after:{battery01:number;thermal01:number;cognitiveCapacity01:number;awake:boolean;source:string};
  stateDelta:{battery01:number;thermal01:number;cognitiveCapacity01:number;awakeChanged:boolean};
  effect01:number;
  reason:string;
  capability:string|null;
  artifact?:{kind:string;hash?:string;size?:number;executionId?:string;providerReceiptId?:string};
  consequenceVerification:{attempted:boolean;independent:boolean;verified:boolean;sourceStable:boolean;freshBefore01:number;freshAfter01:number;changed01:number;reason:string;verificationMode:'independent-observation'|'actuation-receipt-only'|'derived-state-transition'|'none'};
}

const trustedEmbodiedActionResults = new WeakSet<object>();

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const object = value as unknown as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    let child: unknown;
    try { child = (object as Record<PropertyKey, unknown>)[key]; } catch { continue; }
    deepFreeze(child, seen);
  }
  return Object.freeze(value) as T;
}

/**
 * Only the exact in-process result minted by EmbodiedActionExecutor is trusted.
 * Structured clones, restored JSON and caller-constructed receipts deliberately
 * lose this capability and must be re-verified before affecting world learning.
 */
export function isTrustedEmbodiedActionResult(value: unknown): value is EmbodiedActionResult {
  return Boolean(value && typeof value === 'object' && trustedEmbodiedActionResults.has(value as object));
}


/**
 * B365: the organism's chosen internal action gets an explicit embodiment gate.
 * This executor never fabricates a successful device effect. If Termux/Android
 * capability is absent, the result is `unavailable`, not a simulated success.
 */
export class EmbodiedActionExecutor {
  private readonly embodiment: EmbodimentRuntime;
  constructor(embodiment: EmbodimentRuntime) { this.embodiment = embodiment; }

  async execute(action:string, input:{spokenText?:string;speechEventId?:string;allowCamera?:boolean;decisionId?:string;/** @deprecated ignored: execution identity is always executor-minted. */executionId?:string;captureCamera?:(cameraId:number,retain:boolean)=>Promise<{ok:boolean;path?:string;size?:number;hash?:string;error?:string;executionId?:string;providerReceiptId?:string}>}={}):Promise<EmbodiedActionResult>{
    const preSample=await this.embodiment.sample({force:true,requestedSensors:['battery','thermal','network']});
    const before=this.embodiment.snapshot();
    const at=Date.now();
    // Never accept caller-selected receipt keys: this identity is minted at the executor boundary.
    const executionId=`exec-${randomUUID()}`;
    const suppliedDecisionId=typeof input.decisionId==='string'?input.decisionId.normalize('NFKC').trim():'';
    const decisionId=suppliedDecisionId && suppliedDecisionId.length<=180 && !/[\u0000-\u001f\u007f-\u009f]/.test(suppliedDecisionId)?suppliedDecisionId:undefined;
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
          if(!String(input.spokenText??'').trim()){
            status='skipped'; reason='no-speech-payload'; capability='android.tts'; break;
          }
          if(!before.ttsAvailable || before.telemetry.source!=='android-termux'){
            status='unavailable'; reason='live-tts-unavailable'; capability='android.tts'; break;
          }
          const ok=await this.embodiment.speak(String(input.spokenText),{speechEventId:input.speechEventId,action:'respond'});
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
    const telemetryFresh=before.telemetry.source==='android-termux' && after.telemetry.source==='android-termux' && before.telemetry.staleMs===0 && after.telemetry.staleMs===0 && sourceStable && after.telemetry.sampledAt>before.telemetry.sampledAt;
    const delta={battery01:afterBody.telemetry.battery01-before.telemetry.battery01,thermal01:afterBody.thermalStrain01-before.thermalStrain01,cognitiveCapacity01:afterBody.cognitiveCapacity01-before.cognitiveCapacity01,awakeChanged:afterBody.awake!==before.awake};
    const observationAction=['explore','verify','wait','inspect'].includes(action);
    const actuationAction=['respond'].includes(action);
    // Fresh Android telemetry proves only device state. It is not a semantic observation of the external world.
    const telemetryObservation=Boolean(telemetryFresh && status==='executed' && observationAction);
    const independent=false;
    const verified=false;
    const verificationMode:EmbodiedActionResult['consequenceVerification']['verificationMode']=
      actuationAction && status==='executed' ? 'actuation-receipt-only' : (action==='rest' ? 'derived-state-transition' : 'none');
    const consequenceReason=artifact?.kind==='camera-capture' && status==='executed'
      ? 'camera-artifact-requires-semantic-world-observation-receipt'
      : telemetryObservation
        ? 'fresh-device-telemetry-is-not-world-observation'
        : actuationAction && status==='executed'
          ? 'device-command-acknowledged-without-independent-effect-verification'
          : status==='ambiguous'
            ? 'tts-result-unknown-do-not-retry-or-credit'
            : status==='executed'
              ? 'action-executed-without-independent-device-proof'
              : 'no-independent-device-consequence-proof';
    // No world-effect score is inferred from battery/thermal telemetry or a camera file receipt.
    const changed01=0;
    const effect01=0;
    const realityClass:EmbodiedRealityClass=actuationAction&&(status==='executed'||status==='ambiguous')&&afterBody.telemetry.source==='android-termux'
      ? 'device-actuation'
      : artifact?.kind==='camera-capture' && status==='executed'
        ? 'camera-artifact'
        : telemetryObservation
          ? 'device-telemetry'
          : 'derived';
    const result: EmbodiedActionResult = {
      version:1,action,status,realityClass,source:afterBody.telemetry.source,at,executionId,...(decisionId?{decisionId}:{}),before:base,
      after:{battery01:afterBody.telemetry.battery01,thermal01:afterBody.thermalStrain01,cognitiveCapacity01:afterBody.cognitiveCapacity01,awake:afterBody.awake,source:afterBody.telemetry.source},
      stateDelta:delta,effect01,reason,capability,artifact,
      consequenceVerification:{attempted:true,independent,verified,sourceStable,freshBefore01:beforeFresh,freshAfter01:afterFresh,changed01,reason:consequenceReason,verificationMode},
    };
    deepFreeze(result);
    trustedEmbodiedActionResults.add(result);
    return result;
  }
}
