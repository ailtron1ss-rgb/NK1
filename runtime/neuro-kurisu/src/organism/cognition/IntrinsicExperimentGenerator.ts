import type { OrganismGoal } from '../core/types.ts';
export interface IntrinsicExperiment { id:string; question:string; hypothesis:string; action:string; expectedInformationGain:number; linkedGoal?:string; createdAt:number; }
export class IntrinsicExperimentGenerator {
  generate(opts:{uncertainty:number; predictionError:number; novelty:number; goals:OrganismGoal[]}):IntrinsicExperiment|null{
    const drive=Math.max(opts.uncertainty,opts.predictionError*0.9,opts.novelty*0.8); if(drive<0.48) return null;
    const goal=opts.goals.find(g=>g.source==='intrinsic'||g.source==='homeostatic');
    return {id:`exp-${Date.now()}-${Math.random().toString(16).slice(2)}`,question:opts.uncertainty>opts.predictionError?'Что в текущей среде объясняет мою неопределённость?':'Почему мой последний прогноз оказался неточным?',hypothesis:opts.uncertainty>0.6?'новое наблюдение сократит неопределённость':'проверка конкретного предположения даст более точную модель',action:opts.uncertainty>opts.predictionError?'inspect':'verify',expectedInformationGain:Number(Math.min(1,drive*0.8).toFixed(3)),linkedGoal:goal?.id,createdAt:Date.now()};
  }
}
