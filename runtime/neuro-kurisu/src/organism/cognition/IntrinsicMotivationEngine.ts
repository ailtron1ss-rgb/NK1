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

type DriveName='epistemic'|'novelty'|'competence'|'coherence'|'social'|'homeostatic';
const DRIVE_NAMES:readonly DriveName[]=['epistemic','novelty','competence','coherence','social','homeostatic'];
const isDriveName=(value:unknown):value is DriveName=>typeof value==='string'&&DRIVE_NAMES.includes(value as DriveName);
const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const finiteInput=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const safeTimestamp=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:fallback;

export function defaultIntrinsicDriveState(): IntrinsicDriveState {
  return { epistemic:0, novelty:0, competence:0, coherence:0, social:0, homeostatic:0, overall:0, dominant:'epistemic', updatedAt:Date.now() };
}

export class IntrinsicMotivationEngine {
  private state = defaultIntrinsicDriveState();

  snapshot(){ return structuredClone(this.state); }

  restore(value:Partial<IntrinsicDriveState>|undefined):void {
    const source=value??{};
    const drives:Record<DriveName,number>={
      epistemic:finiteInput(source.epistemic),
      novelty:finiteInput(source.novelty),
      competence:finiteInput(source.competence),
      coherence:finiteInput(source.coherence),
      social:finiteInput(source.social),
      homeostatic:finiteInput(source.homeostatic),
    };
    const maximum=Math.max(...Object.values(drives));
    const dominant=isDriveName(source.dominant)&&drives[source.dominant]===maximum
      ? source.dominant
      : (DRIVE_NAMES.find(name=>drives[name]===maximum)??'epistemic');
    this.state={
      ...drives,
      overall:maximum,
      dominant,
      updatedAt:safeTimestamp(source.updatedAt,Date.now()),
    };
  }

  update(input:{
    uncertainty:number;
    predictionError:number;
    novelty:number;
    goalPressure:number;
    socialNeed:number;
    energy:number;
    lastSuccess:number|null;
    worldEvidenceQuality:number
  }):IntrinsicDriveState {
    // Treat all externally supplied signals as bounded observations. Invalid
    // numbers cannot leak NaN into ranking or make an arbitrary drive dominant.
    const uncertainty=finiteInput(input.uncertainty);
    const predictionError=finiteInput(input.predictionError);
    const noveltyInput=finiteInput(input.novelty);
    const goalPressure=finiteInput(input.goalPressure);
    const socialNeed=finiteInput(input.socialNeed);
    const energy=finiteInput(input.energy);
    const worldEvidenceQuality=finiteInput(input.worldEvidenceQuality);
    const lastSuccess=input.lastSuccess===null?0.5:finiteInput(input.lastSuccess,0.5);

    const epistemic = clamp(uncertainty*0.62 + predictionError*0.38);
    const novelty = clamp(noveltyInput*0.74 + uncertainty*0.26);
    const competence = clamp(lastSuccess*0.72 + predictionError*0.18 + (1-goalPressure)*0.10);
    const coherence = clamp(predictionError*0.42 + (1-worldEvidenceQuality)*0.30 + (1-energy)*0.08 + goalPressure*0.20);
    const social = clamp(socialNeed*0.88 + (1-energy)*0.05);
    const homeostatic = clamp((1-energy)*0.72 + goalPressure*0.28);
    const entries:Record<DriveName,number> = { epistemic, novelty, competence, coherence, social, homeostatic };
    const dominant = DRIVE_NAMES.reduce<DriveName>((best,name)=>entries[name]>entries[best]?name:best,'epistemic');
    this.state = { ...entries, overall:clamp(Math.max(...Object.values(entries))), dominant, updatedAt:Date.now() };
    return this.snapshot();
  }

  proposeGoal(): { title:string; reason:string; source:'intrinsic'|'homeostatic'; importance:number; urgency:number; confidence:number } | null {
    const d=this.state;
    if(d.overall<0.52) return null;
    if(d.dominant==='epistemic') return { title:'Получить наблюдение, которое сильнее всего уменьшит неопределённость', reason:\`intrinsic-epistemic=\${d.epistemic.toFixed(2)}\`, source:'intrinsic', importance:d.epistemic, urgency:d.epistemic*0.9, confidence:0.62 };
    if(d.dominant==='novelty') return { title:'Исследовать новое состояние среды и проверить границы известного', reason:\`intrinsic-novelty=\${d.novelty.toFixed(2)}\`, source:'intrinsic', importance:d.novelty, urgency:d.novelty*0.78, confidence:0.58 };
    if(d.dominant==='competence') return { title:'Улучшить точность собственного прогноза через практический эксперимент', reason:\`intrinsic-competence=\${d.competence.toFixed(2)}\`, source:'intrinsic', importance:d.competence, urgency:d.competence*0.7, confidence:0.55 };
    if(d.dominant==='coherence') return { title:'Согласовать модель мира, себя и недавний опыт', reason:\`intrinsic-coherence=\${d.coherence.toFixed(2)}\`, source:'intrinsic', importance:d.coherence, urgency:d.coherence*0.72, confidence:0.6 };
    if(d.dominant==='social') return { title:'Улучшить понимание текущего социального сигнала через наблюдение и диалог', reason:\`intrinsic-social=\${d.social.toFixed(2)}\`, source:'intrinsic', importance:d.social, urgency:d.social*0.74, confidence:0.54 };
    return { title:'Восстановить внутренний ресурс до устойчивого уровня', reason:\`homeostatic=\${d.homeostatic.toFixed(2)}\`, source:'homeostatic', importance:d.homeostatic, urgency:d.homeostatic, confidence:0.72 };
  }
}
