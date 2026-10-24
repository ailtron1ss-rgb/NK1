import type { EmbodiedActionResult } from '../body/EmbodiedActionExecutor.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type PostconditionProofClass='independent-observation'|'stable-device-receipt'|'derived-state-transition'|'none';

type PostconditionActionContract={observation?:boolean;actuation?:boolean;minIndependent01?:number};

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
  private matrix:Record<string,PostconditionActionContract>={
    explore:{observation:true,actuation:false,minIndependent01:.65},verify:{observation:true,actuation:false,minIndependent01:.70},wait:{observation:true,actuation:false,minIndependent01:.70},inspect:{observation:true,actuation:false,minIndependent01:.70},respond:{observation:false,actuation:true,minIndependent01:.80},rest:{observation:false,actuation:true,minIndependent01:.55},reflect:{observation:false,actuation:false,minIndependent01:0},defer:{observation:false,actuation:false,minIndependent01:0}
  };
  registerAction(action:string,contract:PostconditionActionContract){
    if(typeof action!=='string'||action.length===0||action.length>96||action.trim()!==action||['__proto__','prototype','constructor'].includes(action)){
      throw new TypeError('postcondition-action-name-invalid');
    }
    const safe=snapshotPlainData<PostconditionActionContract>(contract,{allowNonFiniteNumbers:true,maxDepth:4,maxNodes:16,maxStringUnits:512});
    if(!safe||typeof safe!=='object'||Array.isArray(safe))throw new TypeError('postcondition-action-contract-invalid');
    if(safe.observation!==undefined&&typeof safe.observation!=='boolean')throw new TypeError('postcondition-action-contract-invalid');
    if(safe.actuation!==undefined&&typeof safe.actuation!=='boolean')throw new TypeError('postcondition-action-contract-invalid');
    if(safe.minIndependent01!==undefined&&(typeof safe.minIndependent01!=='number'||!Number.isFinite(safe.minIndependent01)||safe.minIndependent01<0||safe.minIndependent01>1)){
      throw new RangeError('postcondition-independent-threshold-invalid');
    }
    const existing=Object.prototype.hasOwnProperty.call(this.matrix,action)?this.matrix[action]:undefined;
    // Registered policy may strengthen a built-in contract but never weaken it:
    // callers cannot downgrade the default independent-proof floor for verify/
    // respond/rest or turn a required observation/actuation channel off.
    const nextContract:PostconditionActionContract=existing?{
      observation:existing.observation===true||safe.observation===true,
      actuation:existing.actuation===true||safe.actuation===true,
      minIndependent01:Math.max(existing.minIndependent01??0,safe.minIndependent01??(existing.minIndependent01??.7)),
    }:{
      observation:safe.observation??false,
      actuation:safe.actuation??false,
      minIndependent01:clamp(safe.minIndependent01??.7),
    };
    Object.defineProperty(this.matrix,action,{value:nextContract,writable:true,enumerable:true,configurable:true});
  }
  actionContract(action:string){
    if(typeof action!=='string')return {observation:false,actuation:false,minIndependent01:.75};
    const known=Object.prototype.hasOwnProperty.call(this.matrix,action)?this.matrix[action]:undefined;
    return {...(known??{observation:false,actuation:false,minIndependent01:.75})};
  }
  assess(result:EmbodiedActionResult):PostconditionAssessment {
    const rejected=():PostconditionAssessment=>({action:'unknown',status:'invalid-input',source:'unknown',proofClass:'none',verified01:0,independent01:0,evidence01:0,consequence01:0,effect01:0,reason:'invalid-postcondition-result'});
    let detached:unknown;
    try {
      detached=snapshotPlainData<EmbodiedActionResult>(result,{allowNonFiniteNumbers:true,maxDepth:16,maxNodes:4096,maxStringUnits:64*1024});
    } catch {
      return rejected();
    }
    if(!detached||typeof detached!=='object'||Array.isArray(detached))return rejected();
    result=detached as EmbodiedActionResult;
    if(typeof result.action!=='string'||result.action.length===0||result.action.length>96||
       typeof result.status!=='string'||!['executed','unavailable','skipped','failed','ambiguous'].includes(result.status)||
       typeof result.source!=='string'||result.source.length>160||
       typeof result.realityClass!=='string'||
       typeof result.effect01!=='number'||!Number.isFinite(result.effect01)||
       !result.consequenceVerification||typeof result.consequenceVerification!=='object'||Array.isArray(result.consequenceVerification)){
      return rejected();
    }
    const cv=result.consequenceVerification;
    const contract=this.actionContract(result.action);
    const observation=contract.observation||result.realityClass==='device-observation'||cv.verificationMode==='independent-observation';
    const actuation=contract.actuation||result.realityClass==='device-actuation';
    const sourceIsDevice=result.source==='android-termux';
    const executed=result.status==='executed';
    const freshBefore=typeof cv.freshBefore01==='number'&&Number.isFinite(cv.freshBefore01)?clamp(cv.freshBefore01):0;
    const freshAfter=typeof cv.freshAfter01==='number'&&Number.isFinite(cv.freshAfter01)?clamp(cv.freshAfter01):0;
    const fresh=Boolean(freshBefore>.8 && freshAfter>.8 && cv.sourceStable===true);
    // Independence is quantitative, not a truthy boolean disguised as a score.
    const independenceStrength01=Math.min(freshBefore,freshAfter)*(cv.sourceStable===true?1:0)*(cv.attempted===true?1:0)*(cv.verified===true?1:0);
    const independent=Boolean(cv.attempted===true && cv.independent===true && cv.verified===true &&
      cv.verificationMode==='independent-observation' && fresh && sourceIsDevice &&
      independenceStrength01 >= (contract.minIndependent01 ?? .7));

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
