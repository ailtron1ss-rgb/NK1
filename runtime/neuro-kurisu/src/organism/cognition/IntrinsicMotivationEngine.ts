export type IntrinsicEmotionLabel='curiosity'|'calm'|'joy'|'anxiety'|'frustration'|'sadness'|'anger'|'protective';
export interface IntrinsicAffectSignal {
  emotionId?:string;
  label:IntrinsicEmotionLabel;
  valence01:number;
  arousal01:number;
  dominance01:number;
  confidence01:number;
}
export interface IntrinsicAffectiveInfluence {
  emotionId:string|null;
  label:IntrinsicEmotionLabel|'none';
  exploration01:number;
  regulation01:number;
  engagement01:number;
  connection01:number;
  confidence01:number;
}
export interface IntrinsicDriveState {
  epistemic:number;
  novelty:number;
  competence:number;
  coherence:number;
  social:number;
  homeostatic:number;
  overall:number;
  dominant:'epistemic'|'novelty'|'competence'|'coherence'|'social'|'homeostatic';
  /** Last bounded affect-to-drive projection; does not own or duplicate emotion state. */
  affectiveInfluence:IntrinsicAffectiveInfluence;
  updatedAt:number;
}

type DriveName='epistemic'|'novelty'|'competence'|'coherence'|'social'|'homeostatic';
const DRIVE_NAMES:readonly DriveName[]=['epistemic','novelty','competence','coherence','social','homeostatic'];
const EMOTIONS:readonly IntrinsicEmotionLabel[]=['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective'];
const isDriveName=(value:unknown):value is DriveName=>typeof value==='string'&&DRIVE_NAMES.includes(value as DriveName);
const isEmotion=(value:unknown):value is IntrinsicEmotionLabel=>typeof value==='string'&&EMOTIONS.includes(value as IntrinsicEmotionLabel);
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finiteInput=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const safeTimestamp=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:fallback;
const safeId=(value:unknown):string|null=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!Array.from(value).some(ch=>{const code=ch.charCodeAt(0);return code<32||(code>=127&&code<=159);})?value:null;
const defaultAffectiveInfluence=():IntrinsicAffectiveInfluence=>({emotionId:null,label:'none',exploration01:0,regulation01:0,engagement01:0,connection01:0,confidence01:0});
const normalizeAffectiveInfluence=(raw:unknown):IntrinsicAffectiveInfluence=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return defaultAffectiveInfluence();
  const r=raw as Record<string,unknown>;
  return {
    emotionId:safeId(r.emotionId),
    label:isEmotion(r.label)?r.label:'none',
    exploration01:finiteInput(r.exploration01),
    regulation01:finiteInput(r.regulation01),
    engagement01:finiteInput(r.engagement01),
    connection01:finiteInput(r.connection01),
    confidence01:finiteInput(r.confidence01),
  };
};

export function defaultIntrinsicDriveState():IntrinsicDriveState{
  return {epistemic:0,novelty:0,competence:0,coherence:0,social:0,homeostatic:0,overall:0,dominant:'epistemic',affectiveInfluence:defaultAffectiveInfluence(),updatedAt:Date.now()};
}

export class IntrinsicMotivationEngine {
  private state=defaultIntrinsicDriveState();

  snapshot(){return structuredClone(this.state);}

  restore(value:Partial<IntrinsicDriveState>|undefined):void{
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
      ?source.dominant
      :(DRIVE_NAMES.find(name=>drives[name]===maximum)??'epistemic');
    this.state={
      ...drives,
      overall:maximum,
      dominant,
      affectiveInfluence:normalizeAffectiveInfluence(source.affectiveInfluence),
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
    worldEvidenceQuality:number;
    /** Canonical appraisal from EmotionAppraisalEngine; never infer emotion from user wording here. */
    affect?:IntrinsicAffectSignal;
    /** P66 regulation pressure: used as an allostatic need signal, not as a reward receipt. */
    homeostaticPressure01?:number;
  }):IntrinsicDriveState{
    // Treat all external signals as bounded observations. Invalid numbers cannot leak NaN.
    const uncertainty=finiteInput(input.uncertainty);
    const predictionError=finiteInput(input.predictionError);
    const noveltyInput=finiteInput(input.novelty);
    const goalPressure=finiteInput(input.goalPressure);
    const socialNeed=finiteInput(input.socialNeed);
    const energy=finiteInput(input.energy);
    const worldEvidenceQuality=finiteInput(input.worldEvidenceQuality);
    const lastSuccess=input.lastSuccess===null?0.5:finiteInput(input.lastSuccess,0.5);
    const homeostaticPressure=input.homeostaticPressure01===undefined
      ?null
      :finiteInput(input.homeostaticPressure01);

    const affect=input.affect&&isEmotion(input.affect.label)
      ?{
        emotionId:safeId(input.affect.emotionId),
        label:input.affect.label,
        valence01:finiteInput(input.affect.valence01,.5),
        arousal01:finiteInput(input.affect.arousal01),
        dominance01:finiteInput(input.affect.dominance01,.5),
        confidence01:finiteInput(input.affect.confidence01),
      }
      :null;
    const confidence=affect?.confidence01??0;
    const arousal=affect?.arousal01??.5;
    let exploration01=0,regulation01=0,engagement01=0,connection01=0;
    if(affect){
      switch(affect.label){
        case 'curiosity':
          exploration01=confidence*(.035+.065*arousal);
          break;
        case 'anxiety':
          regulation01=confidence*(.045+.075*arousal);
          break;
        case 'frustration':
          regulation01=confidence*(.035+.055*arousal);
          exploration01=confidence*.012;
          break;
        case 'protective':
          regulation01=confidence*(.06+.08*arousal);
          break;
        case 'anger':
          regulation01=confidence*(.035+.045*arousal);
          break;
        case 'sadness':
          connection01=confidence*.055;
          break;
        case 'joy':
          engagement01=confidence*(.035+.035*affect.valence01);
          connection01=confidence*.025;
          break;
        case 'calm':
          engagement01=confidence*.035;
          break;
      }
    }
    const affectiveInfluence:IntrinsicAffectiveInfluence={
      emotionId:affect?.emotionId??null,
      label:affect?.label??'none',
      exploration01:clamp(exploration01),
      regulation01:clamp(regulation01),
      engagement01:clamp(engagement01),
      connection01:clamp(connection01),
      confidence01:clamp(confidence),
    };

    const epistemic=clamp(uncertainty*.62+predictionError*.38+exploration01*.30+regulation01*.20);
    const novelty=clamp(noveltyInput*.74+uncertainty*.26+exploration01-regulation01*.52);
    const competence=clamp(lastSuccess*.72+predictionError*.18+(1-goalPressure)*.10+engagement01*.18);
    const coherence=clamp(predictionError*.42+(1-worldEvidenceQuality)*.30+(1-energy)*.08+goalPressure*.20+regulation01*.22);
    const social=clamp(socialNeed*.88+(1-energy)*.05+connection01+engagement01*.10);
    const homeostaticBase=(1-energy)*.72+goalPressure*.28;
    const homeostatic=clamp(Math.max(homeostaticBase,(homeostaticPressure??homeostaticBase)*.78)+regulation01*.16);
    const entries:Record<DriveName,number>={epistemic,novelty,competence,coherence,social,homeostatic};
    const dominant=DRIVE_NAMES.reduce<DriveName>((best,name)=>entries[name]>entries[best]?name:best,'epistemic');
    this.state={...entries,overall:clamp(Math.max(...Object.values(entries))),dominant,affectiveInfluence,updatedAt:Date.now()};
    return this.snapshot();
  }

  proposeGoal():{title:string;reason:string;source:'intrinsic'|'homeostatic';importance:number;urgency:number;confidence:number}|null{
    const d=this.state;
    const affectSuffix=d.affectiveInfluence.label==='none'?'':`;affect=${d.affectiveInfluence.label}`;
    if(d.overall<.52)return null;
    if(d.dominant==='epistemic')return {title:'Получить наблюдение, которое сильнее всего уменьшит неопределённость',reason:`intrinsic-epistemic=${d.epistemic.toFixed(2)}${affectSuffix}`,source:'intrinsic',importance:d.epistemic,urgency:d.epistemic*.9,confidence:.62};
    if(d.dominant==='novelty')return {title:'Исследовать новое состояние среды и проверить границы известного',reason:`intrinsic-novelty=${d.novelty.toFixed(2)}${affectSuffix}`,source:'intrinsic',importance:d.novelty,urgency:d.novelty*.78,confidence:.58};
    if(d.dominant==='competence')return {title:'Улучшить точность собственного прогноза через практический эксперимент',reason:`intrinsic-competence=${d.competence.toFixed(2)}${affectSuffix}`,source:'intrinsic',importance:d.competence,urgency:d.competence*.7,confidence:.55};
    if(d.dominant==='coherence')return {title:'Согласовать модель мира, себя и недавний опыт',reason:`intrinsic-coherence=${d.coherence.toFixed(2)}${affectSuffix}`,source:'intrinsic',importance:d.coherence,urgency:d.coherence*.72,confidence:.6};
    if(d.dominant==='social')return {title:'Улучшить понимание текущего социального сигнала через наблюдение и диалог',reason:`intrinsic-social=${d.social.toFixed(2)}${affectSuffix}`,source:'intrinsic',importance:d.social,urgency:d.social*.74,confidence:.54};
    return {title:'Восстановить внутренний ресурс до устойчивого уровня',reason:`homeostatic=${d.homeostatic.toFixed(2)}${affectSuffix}`,source:'homeostatic',importance:d.homeostatic,urgency:d.homeostatic,confidence:.72};
  }
}
