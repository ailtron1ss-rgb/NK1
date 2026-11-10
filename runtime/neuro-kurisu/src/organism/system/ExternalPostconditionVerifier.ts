import { isTrustedEmbodiedActionResult, type EmbodiedActionResult } from '../body/EmbodiedActionExecutor.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type PostconditionProofClass='independent-observation'|'stable-device-receipt'|'derived-state-transition'|'none';

export interface PostconditionAssessment {
  action:string;
  status:string;
  source:string;
  proofClass:PostconditionProofClass;
  verified01:number;
  independent01:number;
  evidence01:number;
  consequence01:number;
  effect01:number;
  reason:string;
}

/**
 * P2841: a second-stage postcondition verifier.
 *
 * EmbodiedActionExecutor reports raw device facts. This layer converts them into
 * a conservative evidence contract that downstream world/identity learning can
 * consume without treating a command receipt as proof of the intended effect.
 */
export class ExternalPostconditionVerifier {
  private matrix:Record<string,{observation:boolean;actuation:boolean;minIndependent01:number}>={
    explore:{observation:true,actuation:false,minIndependent01:.65},verify:{observation:true,actuation:false,minIndependent01:.70},wait:{observation:true,actuation:false,minIndependent01:.70},inspect:{observation:true,actuation:false,minIndependent01:.70},respond:{observation:false,actuation:true,minIndependent01:.80},rest:{observation:false,actuation:true,minIndependent01:.55},reflect:{observation:false,actuation:false,minIndependent01:0},defer:{observation:false,actuation:false,minIndependent01:0}
  };
  registerAction(action:string,contract:{observation?:boolean;actuation?:boolean;minIndependent01?:number}){this.matrix[action]={observation:Boolean(contract.observation),actuation:Boolean(contract.actuation),minIndependent01:clamp(contract.minIndependent01??.7)};}
  actionContract(action:string){return {...(this.matrix[action]??{observation:false,actuation:false,minIndependent01:.75})};}
  assess(result:EmbodiedActionResult):PostconditionAssessment {
    if (!isTrustedEmbodiedActionResult(result)) {
      return {
        action:'unknown',status:'untrusted',source:'untrusted',proofClass:'none',
        verified01:0,independent01:0,evidence01:0,consequence01:0,effect01:0,
        reason:'untrusted-embodied-action-result',
      };
    }

    const cv=result.consequenceVerification;
    const contract=this.actionContract(result.action);
    // Observation proof requires all three independent signals to agree:
    // the action contract, the executor's reality class, and its verification mode.
    // A device-actuation receipt can never become an observation by setting a flag.
    const observation=contract.observation &&
      result.realityClass==='device-observation' &&
      cv.verificationMode==='independent-observation';
    const actuation=contract.actuation||result.realityClass==='device-actuation';
    const sourceIsDevice=result.source==='android-termux';
    const executed=result.status==='executed';
    const freshness01=Math.min(clamp(cv.freshBefore01),clamp(cv.freshAfter01));
    // Keep the existing conservative 0.8 floor; action-specific thresholds may only raise it.
    const fresh=Boolean(freshness01>Math.max(.8,contract.minIndependent01) && cv.sourceStable);
    const independent=Boolean(
      observation && cv.verified===true && cv.independent===true &&
      fresh && sourceIsDevice
    );

    let proofClass:PostconditionProofClass='none';
    if(executed && observation && independent) proofClass='independent-observation';
    else if(executed && actuation && sourceIsDevice) proofClass='stable-device-receipt';
    else if(executed && result.action==='rest' && cv.verificationMode==='derived-state-transition') proofClass='derived-state-transition';

    const verified01=proofClass==='independent-observation'
      ? 1
      : proofClass==='derived-state-transition' ? .72
      : 0;
    const independent01=proofClass==='independent-observation' ? 1 : independent ? .55 : 0;
    const receiptStrength=proofClass==='stable-device-receipt' ? .58 : 0;
    const evidence01=clamp(
      (executed ? 1 : 0)*.22 +
      verified01*.46 +
      independent01*.18 +
      receiptStrength*.08 +
      clamp(result.effect01)*.06,
    );
    const consequence01=clamp(
      proofClass==='independent-observation' ? Math.max(cv.changed01, result.effect01) :
      proofClass==='derived-state-transition' ? cv.changed01 :
      proofClass==='stable-device-receipt' ? Math.min(.18, result.effect01) : 0,
    );
    const reason=proofClass==='independent-observation'
      ? 'fresh-independent-device-observation-confirms-postcondition'
      : proofClass==='stable-device-receipt'
        ? 'device-receipt-proves-command-acceptance-but-not-intended-external-effect'
        : proofClass==='derived-state-transition'
          ? 'local-embodiment-state-transition-is-observed-but-not-independent-world-proof'
          : 'no-sufficient-postcondition-proof';

    return {
      action:result.action,status:result.status,source:result.source,proofClass,verified01,independent01,
      evidence01,consequence01,effect01:clamp(result.effect01),reason,
    };
  }
}
