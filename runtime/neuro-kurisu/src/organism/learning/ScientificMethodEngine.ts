import { randomUUID } from 'node:crypto';
export interface ScientificHypothesis{id:string;text:string;confidence:number;status:'open'|'supported'|'rejected';evidenceIds:string[];}
export interface ScientificVerificationContract { protocol:'paired-holdout-v1'; minPairedSeeds:5; baselineRequired:true; independentHoldoutRequired:true; maxVariantsPerRun:1; rollbackRequired:true; autoApply:false; }
export interface ScientificProject{ id:string; question:string; hypotheses:ScientificHypothesis[]; predictions:string[]; experiments:string[]; evidence:string[]; contradictions:string[]; beliefRevisions:string[]; uncertainty:number; status:'open'|'testing'|'concluded'; provenance:string[]; verificationContract?:ScientificVerificationContract; createdAt:number; updatedAt:number; }
export interface ScientificVerificationPair {
 seedId:string;
 baselineEvidenceId:string;
 variantEvidenceId:string;
 baselineScore:number;
 variantScore:number;
}
export interface ScientificVerificationReceipt {
 protocol:'paired-holdout-v1';
 runId:string;
 evidenceId:string;
 pairedRuns:ScientificVerificationPair[];
 holdoutRuns:ScientificVerificationPair[];
 independentHoldout:true;
 variantCount:1;
 rollbackAvailable:true;
 autoApplied:false;
 safetyRegression:false;
}
export interface ScientificMethodState{projects:ScientificProject[];completed:number;revisionCount:number;}
export const defaultScientificMethod=():ScientificMethodState=>({projects:[],completed:0,revisionCount:0});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const normalizeVerificationContract=(value:unknown):ScientificVerificationContract|undefined=>{
 if(!value||typeof value!=='object')return undefined;
 const v=value as Record<string,unknown>;
 if(v.protocol!=='paired-holdout-v1'||v.minPairedSeeds!==5||v.baselineRequired!==true||
    v.independentHoldoutRequired!==true||v.maxVariantsPerRun!==1||v.rollbackRequired!==true||v.autoApply!==false)return undefined;
 return{protocol:'paired-holdout-v1',minPairedSeeds:5,baselineRequired:true,independentHoldoutRequired:true,maxVariantsPerRun:1,rollbackRequired:true,autoApply:false};
};
const validPair=(value:unknown):value is ScientificVerificationPair=>{
 if(!value||typeof value!=='object')return false;
 const pair=value as Record<string,unknown>;
 const ids=['seedId','baselineEvidenceId','variantEvidenceId'].map(key=>typeof pair[key]==='string'?(pair[key] as string).trim():'');
 return ids.every(Boolean)&&new Set(ids).size===3&&
  typeof pair.baselineScore==='number'&&Number.isFinite(pair.baselineScore)&&pair.baselineScore>=0&&pair.baselineScore<=1&&
  typeof pair.variantScore==='number'&&Number.isFinite(pair.variantScore)&&pair.variantScore>=0&&pair.variantScore<=1;
};
const validMechanismReceipt=(contract:ScientificVerificationContract,receipt:unknown,evidence:string,success:unknown):receipt is ScientificVerificationReceipt=>{
 if(!receipt||typeof receipt!=='object')return false;
 const r=receipt as Record<string,unknown>;
 if(r.protocol!==contract.protocol||typeof r.runId!=='string'||!r.runId.trim()||r.evidenceId!==evidence||
    r.independentHoldout!==true||r.variantCount!==contract.maxVariantsPerRun||r.rollbackAvailable!==true||
    r.autoApplied!==false||r.safetyRegression!==false||!Array.isArray(r.pairedRuns)||!Array.isArray(r.holdoutRuns))return false;
 const paired=r.pairedRuns,holdout=r.holdoutRuns;
 if(paired.length<contract.minPairedSeeds||paired.length>64||holdout.length<1||holdout.length>32)return false;
 if(!paired.every(validPair)||!holdout.every(validPair))return false;
 const trainSeeds=new Set(paired.map(pair=>(pair as ScientificVerificationPair).seedId.trim()));
 const holdoutSeeds=holdout.map(pair=>(pair as ScientificVerificationPair).seedId.trim());
 if(trainSeeds.size!==paired.length||new Set(holdoutSeeds).size!==holdout.length||holdoutSeeds.some(seed=>trainSeeds.has(seed)))return false;
 const evidenceIds=[...paired,...holdout].flatMap(pair=>[(pair as ScientificVerificationPair).baselineEvidenceId.trim(),(pair as ScientificVerificationPair).variantEvidenceId.trim()]);
 if(new Set(evidenceIds).size!==evidenceIds.length)return false;
 const holdoutGain=holdout.reduce((sum,pair)=>sum+(pair as ScientificVerificationPair).variantScore-(pair as ScientificVerificationPair).baselineScore,0)/holdout.length;
 const expectedSuccess=clamp(.5+holdoutGain*5);
 return typeof success==='number'&&Number.isFinite(success)&&Math.abs(success-expectedSuccess)<=.001;
};

export class ScientificMethodEngine{
 private state=defaultScientificMethod();
 restore(s:ScientificMethodState|undefined){
  const projects=Array.isArray(s?.projects)?structuredClone(s!.projects.slice(0,64)).map(project=>{
   const verificationContract=normalizeVerificationContract(project.verificationContract);
   const restored={...project};
   if(verificationContract)restored.verificationContract=verificationContract;else delete restored.verificationContract;
   return restored;
  }):[];
  this.state={...defaultScientificMethod(),...(s??{}),projects};
 }
 create(question:string,hypothesis:string,prediction:string,provenance:string[],verificationContract?:ScientificVerificationContract):ScientificProject{
  const safeContract=normalizeVerificationContract(verificationContract);
  const p:ScientificProject={
   id:randomUUID(),question:question.slice(0,240),
   hypotheses:[{id:randomUUID(),text:hypothesis.slice(0,240),confidence:.5,status:'open',evidenceIds:[]}],
   predictions:[prediction.slice(0,240)],experiments:[],evidence:[],contradictions:[],beliefRevisions:[],
   uncertainty:.7,status:'open',provenance:provenance.slice(0,16),
   ...(safeContract?{verificationContract:safeContract}:{}),
   createdAt:Date.now(),updatedAt:Date.now(),
  };
  this.state.projects=[p,...this.state.projects].slice(0,64);
  return structuredClone(p);
 }
 observe(projectId:string,input:{experiment?:string;evidence?:string;success?:number;contradiction?:string;conclusion?:string;verified?:boolean;verificationReceipt?:ScientificVerificationReceipt}){
  const p=this.state.projects.find(x=>x.id===projectId);
  if(!p||p.status==='concluded'||input.verified!==true)return;
  // Outcome credit needs one stable, unique evidence identity; malformed or repeated
  // receipts must not shift confidence, even when a caller retries after a timeout.
  const evidence=typeof input.evidence==='string'?input.evidence.normalize('NFKC').replace(/[\r\n\t]+/gu,' ').trim().slice(0,320):'';
  if(!evidence||p.evidence.includes(evidence))return;
  if(input.success!==undefined&&(!Number.isFinite(input.success)||input.success<0||input.success>1))return;
  if(p.verificationContract&&!validMechanismReceipt(p.verificationContract,input.verificationReceipt,evidence,input.success))return;
  p.status='testing';
  if(input.experiment)p.experiments=[input.experiment,...p.experiments].slice(0,32);
  p.evidence=[evidence,...p.evidence].slice(0,64);
  if(input.contradiction)p.contradictions=[input.contradiction,...p.contradictions].slice(0,32);
  if(input.conclusion){p.beliefRevisions=[input.conclusion,...p.beliefRevisions].slice(0,32);this.state.revisionCount++;}
  if(input.success!=null){
   const h=p.hypotheses[0];
   if(h){h.confidence=clamp(h.confidence*.7+input.success*.3);if(h.confidence>.78)h.status='supported';if(h.confidence<.22)h.status='rejected';h.evidenceIds=[...new Set([...h.evidenceIds,evidence])].slice(-16);}
   p.uncertainty=clamp(p.uncertainty*.75+(1-input.success)*.25);
  }
  p.updatedAt=Date.now();
  if(p.hypotheses[0]&&p.hypotheses[0].status!=='open'&&p.uncertainty<.25){p.status='concluded';this.state.completed++;}
 }
 snapshot(){return structuredClone(this.state);}
}
