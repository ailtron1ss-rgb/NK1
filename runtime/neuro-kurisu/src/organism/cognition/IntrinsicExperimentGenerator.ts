import type { OrganismGoal } from '../core/types.ts';
export interface IntrinsicExperiment { id:string; question:string; hypothesis:string; action:string; expectedInformationGain:number; linkedGoal?:string; createdAt:number; source?:'intrinsic'|'dream-association'; dreamId?:string; sourceMemoryIds?:string[]; sharedTerms?:string[]; epistemicStatus?:'hypothesis'; status?:'candidate'|'validated'|'rejected'; verificationRequired?:boolean; }
export class IntrinsicExperimentGenerator {
  generate(opts:{uncertainty:number; predictionError:number; novelty:number; goals:OrganismGoal[]}):IntrinsicExperiment|null{
    const drive=Math.max(opts.uncertainty,opts.predictionError*0.9,opts.novelty*0.8); if(drive<0.48) return null;
    const goal=opts.goals.find(g=>g.source==='intrinsic'||g.source==='homeostatic');
    return {id:`exp-${Date.now()}-${Math.random().toString(16).slice(2)}`,question:opts.uncertainty>opts.predictionError?'Что в текущей среде объясняет мою неопределённость?':'Почему мой последний прогноз оказался неточным?',hypothesis:opts.uncertainty>0.6?'новое наблюдение сократит неопределённость':'проверка конкретного предположения даст более точную модель',action:opts.uncertainty>opts.predictionError?'inspect':'verify',expectedInformationGain:Number(Math.min(1,drive*0.8).toFixed(3)),linkedGoal:goal?.id,createdAt:Date.now(),source:'intrinsic'};
  }
  /** Convert a dream bridge into a verification task, never into a factual memory. */
  fromDreamAssociation(input:{id:string;question:string;confidence:number;at:number;sourceMemoryIds?:string[];sharedTerms?:string[];kind?:string;validationStatus?:string},goals:OrganismGoal[]):IntrinsicExperiment|null{
    const id=String(input?.id??'').trim().slice(0,160);
    const question=String(input?.question??'').normalize('NFKC').trim().slice(0,400);
    const sources=Array.isArray(input?.sourceMemoryIds)?[...new Set(input.sourceMemoryIds.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.slice(0,160)))].slice(0,2):[];
    const terms=Array.isArray(input?.sharedTerms)?[...new Set(input.sharedTerms.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.normalize('NFKC').trim().slice(0,64)))].slice(0,8):[];
    const confidence=Number(input?.confidence);
    if(!id||!question||input.kind!=='association'||input.validationStatus!=='candidate'||sources.length!==2||terms.length<2||!Number.isFinite(confidence)||confidence<.45)return null;
    const goal=goals.find(g=>g.source==='intrinsic'||g.source==='homeostatic');
    const createdAt=Number.isFinite(input.at)?Math.max(0,input.at):Date.now();
    return {id:`exp-dream-${id}`,question,hypothesis:`Unverified association hypothesis only: memories ${sources[0]} and ${sources[1]} share concepts ${terms.join(', ')}. Use an independent observation or tool outcome to test the connection; do not promote it to fact without verification.`,action:'verify',expectedInformationGain:Number(Math.min(.9,Math.max(.1,confidence)).toFixed(3)),linkedGoal:goal?.id,createdAt,source:'dream-association',dreamId:id,sourceMemoryIds:sources,sharedTerms:terms,epistemicStatus:'hypothesis',status:'candidate',verificationRequired:true};
  }
}
