import { isTrustedEmbodiedActionResult, type EmbodiedActionResult } from '../body/EmbodiedActionExecutor.ts';
import { sha256Stable } from '../core/StableSerialization.ts';
import {
  isTrustedDecisionLinkedExternalPostcondition,
  OutcomeVerificationService,
  type ExpectedDecisionOutcomeBinding,
  type OutcomeVerification,
  type OutcomeVerificationContext,
} from './OutcomeVerificationService.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const EMBODIED_ACTION_TOOL_ID='organism.embodied.action';

interface ActionContract {
  observation:boolean;
  actuation:boolean;
  minIndependent01:number;
}

function noVerification(notes:string):OutcomeVerification {
  return {verified:false,basis:'none',confidence01:0,externalObservation:false,notes};
}

function bindingFor(result:EmbodiedActionResult):ExpectedDecisionOutcomeBinding|null {
  const executionId=typeof result.executionId==='string'?result.executionId.trim():'';
  const decisionId=typeof result.decisionId==='string'?result.decisionId.trim():'';
  if(!/^exec-[a-z0-9-]{8,80}$/i.test(executionId)) return null;
  if(!decisionId || decisionId.length>180 || /[\u0000-\u001f\u007f-\u009f]/.test(decisionId)) return null;
  return {
    toolId:EMBODIED_ACTION_TOOL_ID,
    input:{
      action:result.action,
      executionId,
      decisionId,
      resultFingerprint:sha256Stable(result),
    },
    executionId,
    decisionId,
  };
}

/**
 * The canonical OutcomeVerificationService token is the only authority for an
 * independently verified embodied postcondition. The result itself must first
 * be the exact in-process object minted by EmbodiedActionExecutor; the token is
 * then bound to its execution ID, decision ID, action and stable result digest.
 */
export function isTrustedEmbodiedOutcomeVerification(value:unknown, expectedResult:unknown):value is OutcomeVerification {
  if(!isTrustedEmbodiedActionResult(expectedResult)) return false;
  const binding=bindingFor(expectedResult);
  return Boolean(binding && isTrustedDecisionLinkedExternalPostcondition(value,binding));
}

export class ExternalPostconditionVerifier {
  private readonly verifier=new OutcomeVerificationService();
  private matrix:Record<string,ActionContract>={
    explore:{observation:true,actuation:false,minIndependent01:.65},
    verify:{observation:true,actuation:false,minIndependent01:.70},
    wait:{observation:true,actuation:false,minIndependent01:.70},
    inspect:{observation:true,actuation:false,minIndependent01:.70},
    respond:{observation:false,actuation:true,minIndependent01:.80},
    rest:{observation:false,actuation:true,minIndependent01:.80},
  };

  registerAction(action:string,contract:Partial<ActionContract>){
    const current=this.actionContract(action);
    this.matrix[action]={
      observation:contract.observation??current.observation,
      actuation:contract.actuation??current.actuation,
      minIndependent01:clamp(contract.minIndependent01??current.minIndependent01),
    };
  }

  actionContract(action:string):ActionContract {
    const c=this.matrix[action]??{observation:false,actuation:false,minIndependent01:.80};
    return {...c};
  }

  async assess(result:EmbodiedActionResult):Promise<OutcomeVerification> {
    if(!isTrustedEmbodiedActionResult(result)) return noVerification('untrusted-embodied-action-result');
    if(result.realityClass==='device-telemetry') return noVerification('device-telemetry-is-not-world-observation');

    const binding=bindingFor(result);
    if(!binding) return noVerification('missing-host-owned-execution-or-decision-binding');

    const contract=this.actionContract(result.action);
    if(result.realityClass==='camera-artifact') {
      const artifact=result.artifact;
      const captureInput=result.captureVerificationInput;
      const captureProof=result.captureVerification;
      const cameraId=Number(artifact?.cameraId);
      const size=Number(artifact?.size);
      const hash=String(artifact?.hash??'');
      const nonce=String(artifact?.captureNonce??'');
      const cameraExecutionId=String(artifact?.executionId??'');
      const capturedAt=Number(artifact?.capturedAt??0);
      const captureStartedAt=Number(artifact?.captureStartedAt??0);
      const ageMs=Date.now()-capturedAt;
      const capturePostcondition=`android-camera-frame:${cameraId}:${hash}:${size}:${nonce}`;
      const captureBindingValid=Boolean(
        captureInput && typeof captureInput==='object' &&
        captureInput.cameraId===cameraId && captureInput.retain===true &&
        /^exec-[a-z0-9-]{8,80}$/i.test(cameraExecutionId) &&
        result.decisionId && artifact?.decisionId===result.decisionId &&
        isTrustedDecisionLinkedExternalPostcondition(captureProof,{
          toolId:'organism.device.capture',
          input:captureInput,
          executionId:cameraExecutionId,
          decisionId:result.decisionId,
        }) &&
        captureProof && typeof captureProof==='object' &&
        (captureProof as OutcomeVerification).verified===true &&
        (captureProof as OutcomeVerification).basis==='external-postcondition' &&
        (captureProof as OutcomeVerification).externalObservation===true &&
        (captureProof as OutcomeVerification).expectedPostcondition===capturePostcondition &&
        (captureProof as OutcomeVerification).observedPostcondition===capturePostcondition
      );
      const cameraFrameValid=Boolean(
        contract.observation && (result.action==='explore'||result.action==='verify') &&
        result.status==='executed' && result.source==='android-termux' &&
        result.semanticVision===true &&
        artifact?.kind==='camera-capture' && artifact.retained===true &&
        artifact.sourceId==='android-termux.camera' && artifact.decisionId===result.decisionId &&
        Number.isSafeInteger(cameraId) && cameraId>=0 &&
        /^[a-f0-9]{64}$/i.test(hash) && Number.isSafeInteger(size) && size>0 &&
        /^[a-f0-9-]{20,64}$/i.test(nonce) &&
        Number.isFinite(captureStartedAt) && Number.isFinite(capturedAt) &&
        capturedAt>=captureStartedAt && capturedAt-captureStartedAt<=30_000 &&
        ageMs>=-2_000 && ageMs<=30_000 &&
        captureBindingValid
      );
      if(!cameraFrameValid) return noVerification('camera-frame-lacks-fresh-decision-bound-host-observation-proof');

      const context:OutcomeVerificationContext={
        toolId:binding.toolId,input:binding.input,
        result:structuredClone(result) as unknown as Record<string,unknown>,
        executionId:binding.executionId,decisionId:binding.decisionId,
      };
      return this.verifier.verify(context,async isolated=>{
        const observed=isolated.result as unknown as EmbodiedActionResult;
        const inputFingerprint=typeof isolated.input.resultFingerprint==='string'?isolated.input.resultFingerprint:'';
        let exact=false;
        try {
          exact=Boolean(inputFingerprint && sha256Stable(observed)===inputFingerprint &&
            observed.executionId===binding.executionId && observed.decisionId===binding.decisionId &&
            observed.action===result.action);
        } catch { exact=false; }
        if(!exact) return noVerification('camera-frame-embodied-result-fingerprint-mismatch');
        return {
          verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,
          observationId:`camera-frame-observation:${nonce}`,
          expectedPostcondition:capturePostcondition,observedPostcondition:capturePostcondition,
          notes:'fresh-retained-host-camera-frame-bound-to-action-gateway-execution-and-decision',
        };
      });
    }

    const threshold=Math.max(.8,contract.minIndependent01);
    const context:OutcomeVerificationContext={
      toolId:binding.toolId,
      input:binding.input,
      result:structuredClone(result) as unknown as Record<string,unknown>,
      executionId:binding.executionId,
      decisionId:binding.decisionId,
    };

    return this.verifier.verify(context,async isolated=>{
      const observed=isolated.result as unknown as EmbodiedActionResult;
      const inputFingerprint=typeof isolated.input.resultFingerprint==='string'?isolated.input.resultFingerprint:'';
      let exact=false;
      try {
        exact=Boolean(
          inputFingerprint &&
          sha256Stable(observed)===inputFingerprint &&
          observed.executionId===binding.executionId &&
          observed.decisionId===binding.decisionId &&
          observed.action===result.action
        );
      } catch {
        exact=false;
      }

      const cv=observed.consequenceVerification;
      const freshness01=Math.min(clamp(cv.freshBefore01),clamp(cv.freshAfter01));
      const valid=Boolean(
        exact &&
        contract.observation &&
        observed.status==='executed' &&
        observed.source==='android-termux' &&
        observed.realityClass==='device-observation' &&
        cv.verified===true &&
        cv.independent===true &&
        cv.sourceStable===true &&
        cv.verificationMode==='independent-observation' &&
        cv.freshBefore01>threshold &&
        cv.freshAfter01>threshold
      );

      if(!valid) return {
        verified:false,basis:'none',confidence01:0,externalObservation:false,
        notes:'no independently verified external observation postcondition',
      };

      const postcondition=`fresh-device-observation:${observed.action}:${binding.executionId}`;
      return {
        verified:true,
        basis:'external-postcondition',
        confidence01:freshness01,
        externalObservation:true,
        observationId:binding.executionId,
        expectedPostcondition:postcondition,
        observedPostcondition:postcondition,
        notes:'executor-minted-device-observation-with-fresh-pre-and-post-samples',
      };
    });
  }
}
