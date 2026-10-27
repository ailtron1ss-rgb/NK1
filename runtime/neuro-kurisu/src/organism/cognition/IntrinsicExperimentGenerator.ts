import type { OrganismGoal } from '../core/types.ts';

export interface IntrinsicExperiment {
  id:string;
  question:string;
  hypothesis:string;
  action:string;
  expectedInformationGain:number;
  linkedGoal?:string;
  createdAt:number;
  source?:'intrinsic'|'dream-association';
  dreamId?:string;
  sourceMemoryIds?:string[];
  sharedTerms?:string[];
  epistemicStatus?:'hypothesis';
  status?:'candidate'|'validated'|'rejected';
  verificationRequired?:boolean;
}

const unit=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const timestamp=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.floor(value):fallback;

export class IntrinsicExperimentGenerator {
  constructor(
    private readonly now:()=>number=()=>Date.now(),
    private readonly createSuffix:()=>string=()=>Math.random().toString(16).slice(2),
  ) {}

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
      action:uncertainty>predictionError?'inspect':'verify',
      expectedInformationGain:Number(Math.min(1,drive*0.8).toFixed(3)),
      linkedGoal:goal?.id,
      createdAt,
      source:'intrinsic',
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
}
