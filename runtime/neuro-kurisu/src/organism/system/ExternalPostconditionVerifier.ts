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
  if(!decisionId || decisionId.length>180 || /[\\u0000-\\u001f\\u007f-\\u009f]/.test(decisionId)) return null;
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
    const binding=bindingFor(result);
    if(!binding) return noVerification('missing-host-owned-execution-or-decision-binding');

    const contract=this.actionContract(result.action);
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
