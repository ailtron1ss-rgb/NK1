export interface IntrinsicDriveState {
  epistemic: number;
  novelty: number;
  competence: number;
  coherence: number;
  social: number;
  homeostatic: number;
  overall: number;
  dominant: 'epistemic'|'novelty'|'competence'|'coherence'|'social'|'homeostatic';
  updatedAt: number;
}

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function defaultIntrinsicDriveState(): IntrinsicDriveState {
  return { epistemic:0, novelty:0, competence:0, coherence:0, social:0, homeostatic:0, overall:0, dominant:'epistemic', updatedAt:Date.now() };
}

export class IntrinsicMotivationEngine {
  private state = defaultIntrinsicDriveState();
  snapshot(){ return structuredClone(this.state); }
  restore(value:IntrinsicDriveState|undefined){ this.state={...defaultIntrinsicDriveState(),...(value||{})}; }
  update(input:{uncertainty:number; predictionError:number; novelty:number; goalPressure:number; socialNeed:number; energy:number; lastSuccess:number|null; worldEvidenceQuality:number}):IntrinsicDriveState {
    const epistemic = clamp(input.uncertainty*0.62 + input.predictionError*0.38);
    const novelty = clamp(input.novelty*0.74 + input.uncertainty*0.26);
    const competence = clamp((input.lastSuccess == null ? 0.5 : input.lastSuccess)*0.72 + input.predictionError*0.18 + (1-input.goalPressure)*0.10);
    const coherence = clamp(input.predictionError*0.42 + (1-input.worldEvidenceQuality)*0.30 + (1-input.energy)*0.08 + input.goalPressure*0.20);
    const social = clamp(input.socialNeed*0.88 + (1-input.energy)*0.05);
    const homeostatic = clamp((1-input.energy)*0.72 + input.goalPressure*0.28);
    const entries = { epistemic, novelty, competence, coherence, social, homeostatic };
    const dominant = (Object.entries(entries).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'epistemic') as IntrinsicDriveState['dominant'];
    this.state = { ...entries, overall:clamp(Math.max(epistemic,novelty,competence,coherence,social,homeostatic)), dominant, updatedAt:Date.now() };
    return this.snapshot();
  }

  proposeGoal(): { title:string; reason:string; source:'intrinsic'|'homeostatic'; importance:number; urgency:number; confidence:number } | null {
    const d=this.state;
    if(d.overall<0.52) return null;
    if(d.dominant==='epistemic') return { title:'Получить наблюдение, которое сильнее всего уменьшит неопределённость', reason:`intrinsic-epistemic=${d.epistemic.toFixed(2)}`, source:'intrinsic', importance:d.epistemic, urgency:d.epistemic*0.9, confidence:0.62 };
    if(d.dominant==='novelty') return { title:'Исследовать новое состояние среды и проверить границы известного', reason:`intrinsic-novelty=${d.novelty.toFixed(2)}`, source:'intrinsic', importance:d.novelty, urgency:d.novelty*0.78, confidence:0.58 };
    if(d.dominant==='competence') return { title:'Улучшить точность собственного прогноза через практический эксперимент', reason:`intrinsic-competence=${d.competence.toFixed(2)}`, source:'intrinsic', importance:d.competence, urgency:d.competence*0.7, confidence:0.55 };
    if(d.dominant==='coherence') return { title:'Согласовать модель мира, себя и недавний опыт', reason:`intrinsic-coherence=${d.coherence.toFixed(2)}`, source:'intrinsic', importance:d.coherence, urgency:d.coherence*0.72, confidence:0.6 };
    if(d.dominant==='social') return { title:'Улучшить понимание текущего социального сигнала через наблюдение и диалог', reason:`intrinsic-social=${d.social.toFixed(2)}`, source:'intrinsic', importance:d.social, urgency:d.social*0.74, confidence:0.54 };
    return { title:'Восстановить внутренний ресурс до устойчивого уровня', reason:`homeostatic=${d.homeostatic.toFixed(2)}`, source:'homeostatic', importance:d.homeostatic, urgency:d.homeostatic, confidence:0.72 };
  }
}
