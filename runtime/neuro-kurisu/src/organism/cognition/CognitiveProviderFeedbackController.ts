import type { CognitiveBridgeMode } from './CognitiveToNeuralBridge.ts';

export const COGNITIVE_PROVIDER_FEEDBACK_MODES:readonly CognitiveBridgeMode[]=[
  'reflex','shallow','retrieve','deep','simulate','defer','sleep',
] as const;

const WINDOW_SIZE=32;
const REQUEST_LEDGER_SIZE=512;
const MIN_SAMPLES_FOR_ADAPTATION=4;
const MAX_TOKENS=768;
const MIN_TOKENS=96;
const MAX_TOKENS_BY_MODE:Record<CognitiveBridgeMode,number>={
  reflex:256,shallow:384,retrieve:512,deep:768,simulate:768,defer:128,sleep:128,
};
const NEAR_LIMIT_UTILIZATION=.9;

export type CognitiveProviderFinishReason='stop'|'length'|'tool_calls'|'content_filter'|'function_call';

export interface CognitiveProviderFeedbackObservation {
  requestId:unknown;
  mode:unknown;
  completionTokens:unknown;
  maxTokens:unknown;
  finishReason?:unknown;
}

export interface CognitiveProviderFeedbackSnapshot {
  version:1;
  mode:CognitiveBridgeMode;
  sampleCount:number;
  truncatedCount:number;
  nearLimitCount:number;
  truncationPressure01:number;
}

export type CognitiveProviderFeedbackResult=
  |{accepted:true;snapshot:CognitiveProviderFeedbackSnapshot}
  |{accepted:false;reason:string};

interface Sample {
  truncated:boolean;
  nearLimit:boolean;
}

function validRequestId(value:unknown):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=128
    &&/^[a-z0-9][a-z0-9._:-]*$/i.test(value);
}
function validMode(value:unknown):value is CognitiveBridgeMode {
  return typeof value==='string'&&COGNITIVE_PROVIDER_FEEDBACK_MODES.includes(value as CognitiveBridgeMode);
}
function validFinishReason(value:unknown):value is CognitiveProviderFinishReason|undefined {
  return value===undefined || value==='stop' || value==='length'
    || value==='tool_calls' || value==='content_filter' || value==='function_call';
}
function pressureFor(sampleCount:number,truncatedCount:number,nearLimitCount:number):number {
  if(sampleCount<MIN_SAMPLES_FOR_ADAPTATION) return 0;
  const truncationRate=truncatedCount/sampleCount;
  const nearLimitRate=nearLimitCount/sampleCount;
  return Number(Math.max(0,Math.min(1,truncationRate*.8+nearLimitRate*.2)).toFixed(3));
}

/**
 * Session-local, per-cognitive-mode provider calibration.
 *
 * It learns only from validated token usage and provider finish reasons. The
 * bounded sliding windows and request-ID ledger keep memory use fixed and
 * suppress replay. This is resource feedback, never a reward/quality signal.
 */
export class CognitiveProviderFeedbackController {
  private readonly samples=new Map<CognitiveBridgeMode,Sample[]>(
    COGNITIVE_PROVIDER_FEEDBACK_MODES.map(mode=>[mode,[]]),
  );
  private readonly seenRequestIds=new Set<string>();
  private readonly requestOrder:string[]=[];

  snapshot(mode:CognitiveBridgeMode):CognitiveProviderFeedbackSnapshot {
    const current=this.samples.get(mode)??[];
    const sampleCount=current.length;
    const truncatedCount=current.filter(sample=>sample.truncated).length;
    const nearLimitCount=current.filter(sample=>sample.nearLimit).length;
    return {
      version:1,
      mode,
      sampleCount,
      truncatedCount,
      nearLimitCount,
      truncationPressure01:pressureFor(sampleCount,truncatedCount,nearLimitCount),
    };
  }

  snapshotAll():CognitiveProviderFeedbackSnapshot[] {
    return COGNITIVE_PROVIDER_FEEDBACK_MODES.map(mode=>this.snapshot(mode));
  }

  record(input:CognitiveProviderFeedbackObservation):CognitiveProviderFeedbackResult {
    if(!validRequestId(input.requestId)) return {accepted:false,reason:'invalid-request-id'};
    if(!validMode(input.mode)) return {accepted:false,reason:'invalid-cognitive-mode'};
    if(!Number.isSafeInteger(input.completionTokens)||Number(input.completionTokens)<0
      ||Number(input.completionTokens)>1_000_000) return {accepted:false,reason:'invalid-completion-token-count'};
    if(!Number.isSafeInteger(input.maxTokens)||Number(input.maxTokens)<MIN_TOKENS
      ||Number(input.maxTokens)>Math.min(MAX_TOKENS,MAX_TOKENS_BY_MODE[input.mode])||Number(input.maxTokens)%16!==0)
      return {accepted:false,reason:'invalid-configured-token-budget'};
    if(Number(input.completionTokens)>Number(input.maxTokens))
      return {accepted:false,reason:'completion-exceeds-configured-budget'};
    if(!validFinishReason(input.finishReason)) return {accepted:false,reason:'invalid-provider-finish-reason'};
    const requestId=input.requestId;
    if(this.seenRequestIds.has(requestId)) return {accepted:false,reason:'duplicate-request-id'};

    this.seenRequestIds.add(requestId);
    this.requestOrder.push(requestId);
    if(this.requestOrder.length>REQUEST_LEDGER_SIZE){
      const expired=this.requestOrder.shift();
      if(expired) this.seenRequestIds.delete(expired);
    }

    const completionTokens=Number(input.completionTokens);
    const maxTokens=Number(input.maxTokens);
    const utilization=completionTokens/Math.max(1,maxTokens);
    const current=this.samples.get(input.mode)!;
    current.push({
      truncated:input.finishReason==='length',
      nearLimit:utilization>=NEAR_LIMIT_UTILIZATION,
    });
    if(current.length>WINDOW_SIZE) current.shift();
    return {accepted:true,snapshot:this.snapshot(input.mode)};
  }
}
