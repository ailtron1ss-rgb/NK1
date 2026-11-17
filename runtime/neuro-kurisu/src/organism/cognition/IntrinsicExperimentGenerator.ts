import type { OrganismGoal } from '../core/types.ts';

export interface IntrinsicExperiment {
  id:string;
  question:string;
  hypothesis:string;
  action:string;
  expectedInformationGain:number;
  linkedGoal?:string;
  createdAt:number;
  source?:'intrinsic'|'dream-association'|'mechanism-serendipity';
  dreamId?:string;
  sourceMemoryIds?:string[];
  sharedTerms?:string[];
  mechanismDiscoveryId?:string;
  mechanismFlowEvidenceClass?:'observed-causal'|'declared-dependency'|'inferred';
  mechanismSourceDomain?:string;
  mechanismTargetDomain?:string;
  mechanismCorrespondences?:string[];
  mechanismBreakpoints?:string[];
  verificationPlan?:string;
  epistemicStatus?:'hypothesis';
  status?:'candidate'|'validated'|'rejected';
  verificationRequired?:boolean;
  scientificProjectId?:string;
  createdTick?:number;
  verifiedAt?:number;
  verificationEvidence?:string[];
  verified?:boolean;
}

/** Narrow dependency-free bridge contract from MechanismSerendipityEngine. */
export interface MechanismDiscoveryExperimentInput {
  id:string; title:string; sourceDomain:string; targetDomain:string;
  flowEvidenceClass:'observed-causal'|'declared-dependency'|'inferred';
  confidence01:number; transferability01:number; status:'candidate'; epistemicStatus:'hypothesis';
  hypothesis:string; verificationPlan:string; correspondences:string[]; breakpoints:string[];
}

const unit=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const timestamp=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.floor(value):fallback;
const cleanText=(value:unknown,max=320):string=>typeof value==='string'?value.normalize('NFKC').trim().slice(0,max):'';
const cleanUnique=(values:unknown,limit:number):string[]=>Array.isArray(values)?[...new Set(values.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>cleanText(x,240)))].filter(Boolean).slice(0,limit):[];

export class IntrinsicExperimentGenerator {
  private readonly now:()=>number;
  private readonly createSuffix:()=>string;

  constructor(
    now:()=>number=()=>Date.now(),
    createSuffix:()=>string=()=>Math.random().toString(16).slice(2),
  ) {
    this.now=now;
    this.createSuffix=createSuffix;
  }

  private currentTime():number { return timestamp(this.now(),0); }

  generate(opts:{uncertainty:number; predictionError:number; novelty:number; goals:OrganismGoal[]}):IntrinsicExperiment|null {
    // Cognitive signals can originate in restored state or adapters. Clamp them
    // before arithmetic so NaN/Infinity cannot create an invalid experiment.
    const uncertainty=unit(opts?.uncertainty);
    const predictionError=unit(opts?.predictionError);
    const novelty=unit(opts?.novelty);
    const drive=Math.max(uncertainty,predictionError*0.9,novelty*0.8);
    if(drive<0.48) return null;
    const goals=Array.isArray(opts?.goals)?opts.goals:[];
    const goal=goals.find(g=>g?.source==='intrinsic'||g?.source==='homeostatic');
    const createdAt=this.currentTime();
    const suffix=String(this.createSuffix()??'').replace(/[^a-zA-Z0-9_-]/gu,'').slice(0,64)||'fallback';
    return {
      id:`exp-${createdAt}-${suffix}`,
      question:uncertainty>predictionError?'Что в текущей среде объясняет мою неопределённость?':'Почему мой последний прогноз оказался неточным?',
      hypothesis:uncertainty>0.6?'новое наблюдение сократит неопределённость':'проверка конкретного предположения даст более точную модель',
      action:uncertainty>predictionError?'explore':'verify',
      expectedInformationGain:Number(Math.min(1,drive*0.8).toFixed(3)),
      linkedGoal:goal?.id,
      createdAt,
      source:'intrinsic',
      // Every generated experiment is an unverified proposal until an independent
      // observation/tool outcome closes the loop. Never let intrinsic drive alone
      // convert a hypothesis into a trusted fact.
      epistemicStatus:'hypothesis',
      status:'candidate',
      verificationRequired:true,
    };
  }

  /** Convert a dream bridge into a verification task, never into a factual memory. */
  fromDreamAssociation(input:{id:string;question:string;confidence:number;at:number;sourceMemoryIds?:string[];sharedTerms?:string[];kind?:string;validationStatus?:string},goals:OrganismGoal[]):IntrinsicExperiment|null {
    const id=String(input?.id??'').normalize('NFKC').trim().slice(0,160);
    const question=String(input?.question??'').normalize('NFKC').trim().slice(0,400);
    const sources=Array.isArray(input?.sourceMemoryIds)?[...new Set(input.sourceMemoryIds.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.normalize('NFKC').trim().slice(0,160)))].slice(0,2):[];
    const terms=Array.isArray(input?.sharedTerms)?[...new Set(input.sharedTerms.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.normalize('NFKC').trim().slice(0,64)))].slice(0,8):[];
    const confidence=unit(input?.confidence);
    if(!id||!question||input.kind!=='association'||input.validationStatus!=='candidate'||sources.length!==2||terms.length<2||confidence<.45)return null;
    const safeGoals=Array.isArray(goals)?goals:[];
    const goal=safeGoals.find(g=>g?.source==='intrinsic'||g?.source==='homeostatic');
    const createdAt=timestamp(input.at,this.currentTime());
    return {
      id:`exp-dream-${id}`,
      question,
      hypothesis:`Unverified association hypothesis only: memories ${sources[0]} and ${sources[1]} share concepts ${terms.join(', ')}. Use an independent observation or tool outcome to test the connection; do not promote it to fact without verification.`,
      action:'verify',
      expectedInformationGain:Number(Math.min(.9,Math.max(.1,confidence)).toFixed(3)),
      linkedGoal:goal?.id,
      createdAt,
      source:'dream-association',
      dreamId:id,
      sourceMemoryIds:sources,
      sharedTerms:terms,
      epistemicStatus:'hypothesis',
      status:'candidate',
      verificationRequired:true,
    };
  }

  /** Converts a structural cross-domain analogy into a verification task only. */
  fromMechanismDiscovery(input:MechanismDiscoveryExperimentInput,goals:OrganismGoal[]):IntrinsicExperiment|null {
    const id=cleanText(input?.id,120),title=cleanText(input?.title,160);
    const sourceDomain=cleanText(input?.sourceDomain,80),targetDomain=cleanText(input?.targetDomain,80);
    const confidence=unit(input?.confidence01),transferability=unit(input?.transferability01);
    const flowEvidenceClass=input?.flowEvidenceClass;
    if(!['observed-causal','declared-dependency','inferred'].includes(String(flowEvidenceClass)))return null;
    const correspondences=cleanUnique(input?.correspondences,12),breakpoints=cleanUnique(input?.breakpoints,12);
    const hypothesis=cleanText(input?.hypothesis,640),verificationPlan=cleanText(input?.verificationPlan,640);
    if(!id||!title||!sourceDomain||!targetDomain||sourceDomain.toLowerCase()===targetDomain.toLowerCase())return null;
    if(input?.status!=='candidate'||input?.epistemicStatus!=='hypothesis')return null;
    if(confidence<.4||transferability<.3||correspondences.length<2||!hypothesis||!verificationPlan)return null;
    const safeGoals=Array.isArray(goals)?goals:[];
    const goal=safeGoals.find(g=>g?.source==='intrinsic'||g?.source==='homeostatic');
    const createdAt=this.currentTime();
    return {
      id:'exp-mechanism-'+id,
      question:'Проверить перенос механизма «'+title+'» из области «'+sourceDomain+'» в «'+targetDomain+'»',
      hypothesis:'Unverified cross-domain mechanism hypothesis only: '+hypothesis+' Correspondences: '+correspondences.join('; ')+'. Breakpoints: '+(breakpoints.join('; ')||'none-recorded')+'.',
      action:'verify',
      expectedInformationGain:Number(Math.min(.9,.55*confidence+.35*transferability).toFixed(3)),
      linkedGoal:goal?.id,createdAt,source:'mechanism-serendipity',
      mechanismDiscoveryId:id,mechanismFlowEvidenceClass:flowEvidenceClass,mechanismSourceDomain:sourceDomain,mechanismTargetDomain:targetDomain,
      mechanismCorrespondences:correspondences,mechanismBreakpoints:breakpoints,verificationPlan,
      epistemicStatus:'hypothesis',status:'candidate',verificationRequired:true,
    };
  }

}
