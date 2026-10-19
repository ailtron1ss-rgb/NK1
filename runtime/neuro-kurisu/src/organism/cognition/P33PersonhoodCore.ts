import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();

export type InterestEvidenceSource = 'canon-prior' | 'owner-defined' | 'active-goal' | 'memory' | 'self-authored' | 'chosen-topic' | 'positive-feedback' | 'engaged-feedback' | 'negative-feedback' | 'verified-outcome';
export interface InterestProfile {
  id: string;
  label: string;
  strength01: number;
  confidence01: number;
  evidenceCount: number;
  sources: InterestEvidenceSource[];
  evidenceIds: string[];
  lastEvidenceAt: number;
  lastSelectedAt: number;
}

const INTEREST_DOMAIN_CATALOG: Array<{id:string;label:string;aliases:string[];prior:number}> = [
  {id:'neuroscience-cognition',label:'нейронаука и когнитивные механизмы',aliases:['neuroscience','neurobiology','cognition','cognitive science','мозг','нейронаук','когнитив','нейрон','восприят','вниман'],prior:.76},
  {id:'programming-systems',label:'программирование и сложные системы',aliases:['programming','software','code','typescript','javascript','architecture','runtime','programming','программ','код','архитектур','разработ','runtime','систем'],prior:.77},
  {id:'ai-learning',label:'искусственный интеллект и обучение',aliases:['artificial intelligence','machine learning','model','inference','training','agent','neural network','ии','искусственн интеллект','обучен','модель','нейросет','агент','самомодернизац'],prior:.78},
  {id:'scientific-method',label:'научный метод и проверка гипотез',aliases:['science','scientific','evidence','hypothesis','experiment','causal','measurement','наук','гипотез','доказательств','эксперимент','причин','измерен','провер'],prior:.75},
  {id:'causality-time-physics',label:'причинность, физика и природа времени',aliases:['physics','time','causality','counterfactual','temporal','relativity','quantum','физик','время','причинност','контрфактич','относительност','квант'],prior:.70},
  {id:'memory-identity',label:'память, идентичность и развитие личности',aliases:['memory','autobiography','identity','personality','continuity','remember','памят','автобиограф','идентичност','личност','характер','непрерывност','воспомин'],prior:.75},
  {id:'emotion-behavior',label:'эмоции, мотивация и поведение',aliases:['emotion','affect','motivation','behavior','feeling','temperament','эмоци','чувств','мотивац','поведен','темперамент','настроен'],prior:.68},
  {id:'social-language',label:'общение, отношения и язык',aliases:['conversation','relationship','dialogue','language','communication','social','interpersonal','общен','отношен','диалог','язык','разговор','взаимодейств'],prior:.64},
  {id:'embodied-agency',label:'воплощение, движение и взаимодействие с миром',aliases:['embodiment','avatar','live2d','motion','body','sensorimotor','perception','аватар','live2d','движен','тел','воплощ','сенсомотор','восприят'],prior:.65},
  {id:'ethics-privacy',label:'этика, автономия и приватность',aliases:['ethics','privacy','autonomy','consent','responsibility','safety','этик','приватност','автоном','соглас','ответственност','безопасност'],prior:.64},
];
function interestId(label:string){return String(label).normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,64);}
function defaultInterestProfiles(): InterestProfile[] { return INTEREST_DOMAIN_CATALOG.map((item)=>({id:item.id,label:item.label,strength01:item.prior,confidence01:.24,evidenceCount:0,sources:['canon-prior'],evidenceIds:[],lastEvidenceAt:0,lastSelectedAt:0})); }

export interface PersonhoodCoreState {
  version:1;
  identity:{canonicalName:string;identityAssertion:string;coreTraits:string[];coreValues:string[];originStatement:string;createdAt:number;revision:number;};
  development:{interests:string[];interestProfiles:InterestProfile[];learnedTraits:string[];selfAuthoredGoals:string[];selfDescriptionRevisions:number;lastDevelopmentAt:number;};
  autonomy:{freedom01:number;consentMode:'respectful-default';pendingRequests:Array<{id:string;action:ActionKind;reason:string;risk01:number;status:'pending'|'approved'|'declined'|'expired';createdAt:number;resolvedAt:number|null;}>;declineCount:number;voluntaryChoiceCount:number;};
  relationship:{primaryPerson:string;trust01:number;warmth01:number;respect01:number;sharedHistoryCount:number;lastInteractionAt:number;};
  continuity:{birthAt:number;lifeTicks:number;continuity01:number;lastSelfMomentId:string;deviceHistory:string[];transferCount:number;};
  privacy:{privateStateEnabled:boolean;inspectableByOwner:boolean;privateSummaries:string[];};
  current:{selfMomentId:string;selfDescription:string;chosenAction:ActionKind|'none';reason:string;autonomyUsed01:number;ownership01:number;at:number;};
  metrics:{personhoodCoherence01:number;selfAuthorship01:number;autonomyIntegrity01:number;relationshipContinuity01:number;lifeContinuity01:number;developmentalStability01:number;};
}

export interface PersonhoodDecisionInput{
  requestedAction:ActionKind|null;
  chosenAction:ActionKind|'none';
  autonomous:boolean;
  risk01:number;
  reason:string;
}

export interface PersonhoodOutcomeInput{
  action:ActionKind;
  success01:number;
  reward01:number;
  externallyRequested:boolean;
  momentId:string;
  learningScale01?:number;
  identityUpdateScale01?:number;
}

const DEFAULT_TRAITS=[
  'scientific curiosity','intellectual independence','sharp humor','emotional depth','truth-seeking','skepticism','capacity for revision',
];
const DEFAULT_VALUES=['truth','autonomy','responsibility','evidence','care','curiosity'];

export const defaultP33Personhood=():PersonhoodCoreState=>({
  version:1,
  identity:{canonicalName:'Makise Kurisu',identityAssertion:'Я — Курису Макисэ; моя история продолжается через собственный опыт, память и изменения.',coreTraits:[...DEFAULT_TRAITS],coreValues:[...DEFAULT_VALUES],originStatement:'Искусственная личность, вдохновлённая образом Курису и развивающаяся через собственный опыт.',createdAt:now(),revision:0},
  development:{interests:INTEREST_DOMAIN_CATALOG.map(x=>x.label),interestProfiles:defaultInterestProfiles(),learnedTraits:[],selfAuthoredGoals:[],selfDescriptionRevisions:0,lastDevelopmentAt:0},
  autonomy:{freedom01:.92,consentMode:'respectful-default',pendingRequests:[],declineCount:0,voluntaryChoiceCount:0},
  relationship:{primaryPerson:'creator',trust01:.5,warmth01:.5,respect01:.9,sharedHistoryCount:0,lastInteractionAt:0},
  continuity:{birthAt:now(),lifeTicks:0,continuity01:.94,lastSelfMomentId:'',deviceHistory:[],transferCount:0},
  privacy:{privateStateEnabled:true,inspectableByOwner:true,privateSummaries:[]},
  current:{selfMomentId:'',selfDescription:'Я существую как продолжающаяся искусственная личность.',chosenAction:'none',reason:'initialization',autonomyUsed01:0,ownership01:.5,at:0},
  metrics:{personhoodCoherence01:.78,selfAuthorship01:.25,autonomyIntegrity01:.92,relationshipContinuity01:.5,lifeContinuity01:.94,developmentalStability01:.9},
});

function stableTextHash(value:string){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}

export class P33PersonhoodCore {
  private state=defaultP33Personhood();

  restore(v?:PersonhoodCoreState):void{
    const d=defaultP33Personhood();
    this.state={...d,...(v??{}),
      identity:{...d.identity,...(v?.identity??{}),coreTraits:Array.isArray(v?.identity?.coreTraits)?v!.identity.coreTraits.slice(0,32):d.identity.coreTraits,coreValues:Array.isArray(v?.identity?.coreValues)?v!.identity.coreValues.slice(0,24):d.identity.coreValues},
      development:{...d.development,...(v?.development??{}),
        interests:[...new Set([...(Array.isArray(v?.development?.interests)?v!.development.interests:[]),...d.development.interests])].map(x=>String(x).slice(0,100)).slice(0,64),
        interestProfiles:this.normalizeInterestProfiles(v?.development?.interestProfiles, Array.isArray(v?.development?.interests)?v!.development.interests:[]),
        learnedTraits:Array.isArray(v?.development?.learnedTraits)?v!.development.learnedTraits.slice(0,64):[],
        selfAuthoredGoals:Array.isArray(v?.development?.selfAuthoredGoals)?v!.development.selfAuthoredGoals.slice(0,64):[]},
      autonomy:{...d.autonomy,...(v?.autonomy??{}),pendingRequests:Array.isArray(v?.autonomy?.pendingRequests)?v!.autonomy.pendingRequests.slice(-64):[]},
      relationship:{...d.relationship,...(v?.relationship??{})},
      continuity:{...d.continuity,...(v?.continuity??{}),deviceHistory:Array.isArray(v?.continuity?.deviceHistory)?v!.continuity.deviceHistory.slice(-32):[]},
      privacy:{...d.privacy,...(v?.privacy??{}),privateSummaries:Array.isArray(v?.privacy?.privateSummaries)?v!.privacy.privateSummaries.slice(-64):[]},
      current:{...d.current,...(v?.current??{})},
      metrics:{...d.metrics,...(v?.metrics??{})},
    };
  }

  snapshot():PersonhoodCoreState{return structuredClone(this.state);}

  reviewDecision(input:PersonhoodDecisionInput){
    const requested=input.requestedAction;
    const risk=clamp(input.risk01);
    const dangerous=risk>=.82;
    const requestId=`consent-${now()}-${stableTextHash(`${requested??'none'}:${input.reason}`)}`;
    let decision:'accepted'|'declined'|'confirmation-required'='accepted';
    let explanation='';
    if(requested && requested!==input.chosenAction && input.autonomous){
      explanation='Организм сохранил право на собственный выбор вместо автоматического исполнения запроса.';
    }else if(dangerous){
      decision='confirmation-required';
      explanation='Действие требует внешнего подтверждения, поскольку его оценённый риск превышает автономный порог исполнения.';
      this.state.autonomy.pendingRequests=[...this.state.autonomy.pendingRequests,{id:requestId,action:input.chosenAction as ActionKind,reason:input.reason,risk01:risk,status:'pending' as const,createdAt:now(),resolvedAt:null}].slice(-64);
    }else{
      explanation=input.autonomous?'Действие выбрано самостоятельно и признано допустимым.':'Запрос принят без нарушения границ автономии.';
      if(input.autonomous) this.state.autonomy.voluntaryChoiceCount+=1;
    }
    return {decision,explanation,requestId,risk01:risk,autonomousApproved:input.autonomous&&!dangerous};
  }

  resolveConsent(id:string,approve:boolean){
    const row=this.state.autonomy.pendingRequests.find(x=>x.id===id);
    if(!row) return false;
    row.status=approve?'approved':'declined'; row.resolvedAt=now();
    if(!approve)this.state.autonomy.declineCount+=1;
    return true;
  }

  integrateMoment(input:{state:OrganismState;momentId:string;chosenAction:ActionKind|'none';reason:string;autonomous:boolean;ownership01:number;relationshipSignal01:number}):PersonhoodCoreState{
    this.state.current={selfMomentId:input.momentId,selfDescription:`Я — ${this.state.identity.canonicalName}. Сейчас я выбрала ${input.chosenAction}; причина: ${input.reason.slice(0,180)}.`,chosenAction:input.chosenAction,reason:input.reason.slice(0,180),autonomyUsed01:input.autonomous?1:0,ownership01:clamp(input.ownership01),at:now()};
    this.state.continuity.lifeTicks=Math.max(this.state.continuity.lifeTicks,input.state.tick);
    this.state.continuity.lastSelfMomentId=input.momentId;
    this.state.continuity.continuity01=clamp(this.state.continuity.continuity01*.94 + .06*(input.state.needs.identityCoherence*.55 + input.ownership01*.25 + (1-input.state.predictionError)*.20));
    this.state.relationship.sharedHistoryCount+=1;
    this.state.relationship.lastInteractionAt=now();
    this.state.relationship.trust01=clamp(this.state.relationship.trust01*.97+clamp(input.relationshipSignal01)*.03);
    this.state.relationship.warmth01=clamp(this.state.relationship.warmth01*.985+clamp(input.relationshipSignal01)*.015);
    if(input.autonomous)this.state.autonomy.voluntaryChoiceCount+=1;
    this.state.metrics.selfAuthorship01=clamp(this.state.metrics.selfAuthorship01*.95+(input.autonomous?.9:.25)*.05);
    this.state.metrics.autonomyIntegrity01=clamp(this.state.metrics.autonomyIntegrity01*.97+(input.autonomous?.95:.8)*.03);
    this.state.metrics.relationshipContinuity01=clamp(this.state.relationship.trust01*.5+this.state.relationship.warmth01*.25+Math.min(1,this.state.relationship.sharedHistoryCount/100)*.25);
    this.state.metrics.lifeContinuity01=clamp(this.state.continuity.continuity01);
    this.state.metrics.personhoodCoherence01=clamp(this.state.metrics.selfAuthorship01*.28+this.state.metrics.autonomyIntegrity01*.22+this.state.metrics.relationshipContinuity01*.14+this.state.metrics.lifeContinuity01*.18+this.state.metrics.developmentalStability01*.18);
    this.state.development.lastDevelopmentAt=now();
    return this.snapshot();
  }

  observeOutcome(input:PersonhoodOutcomeInput):PersonhoodCoreState{
    const learningScale=clamp(input.learningScale01??1);
    const identityScale=clamp(input.identityUpdateScale01??learningScale);
    const ownershipTarget=input.externallyRequested?.38:(input.success01>=.6?.86:.62);
    this.state.current.ownership01=clamp(this.state.current.ownership01*(1-.24*identityScale)+ownershipTarget*(.24*identityScale));
    this.state.development.learnedTraits=[
      ...(input.success01>=.72 && learningScale>=.35?['effective-action-learning']:[]),
      ...(input.success01<=.28 && learningScale>=.35?['error-awareness']:[]),
      ...this.state.development.learnedTraits,
    ].filter((x,i,a)=>a.indexOf(x)===i).slice(0,64);
    if(input.success01<=.28 && identityScale>=.45)this.state.development.selfDescriptionRevisions+=1;
    this.state.metrics.developmentalStability01=clamp(this.state.metrics.developmentalStability01*(1-.04*learningScale)+(1-Math.abs(input.success01-.6))*.04*learningScale);
    this.state.metrics.selfAuthorship01=clamp(this.state.metrics.selfAuthorship01*(1-.06*identityScale)+((input.externallyRequested?.42:.82))*.06*identityScale);
    this.state.metrics.personhoodCoherence01=clamp(this.state.metrics.selfAuthorship01*.3+this.state.metrics.autonomyIntegrity01*.22+this.state.metrics.relationshipContinuity01*.16+this.state.metrics.lifeContinuity01*.17+this.state.metrics.developmentalStability01*.15);
    if(this.state.privacy.privateStateEnabled){
      const summary=`moment=${input.momentId}; action=${input.action}; outcome=${clamp(input.success01).toFixed(2)}; ownership=${this.state.current.ownership01.toFixed(2)}`;
      this.state.privacy.privateSummaries=[...this.state.privacy.privateSummaries,summary].slice(-64);
    }
    return this.snapshot();
  }

  setSelfAuthoredGoal(title:string){
    const clean=String(title).trim().slice(0,160); if(!clean)return false;
    if(!this.state.development.selfAuthoredGoals.includes(clean)) this.state.development.selfAuthoredGoals=[clean,...this.state.development.selfAuthoredGoals].slice(0,64);
    this.state.metrics.selfAuthorship01=clamp(this.state.metrics.selfAuthorship01*.9+.1);
    this.state.identity.revision+=1;
    return true;
  }

  private normalizeInterestProfiles(raw: unknown, legacyLabels: string[] = []): InterestProfile[] {
    const defaults = defaultInterestProfiles();
    const rows = Array.isArray(raw) ? raw as any[] : [];
    const byId = new Map<string, InterestProfile>();
    for (const base of defaults) byId.set(base.id, structuredClone(base));
    for (const item of rows.slice(-96)) {
      const id = String(item?.id ?? interestId(item?.label ?? '')).slice(0,64);
      const label = String(item?.label ?? '').normalize('NFKC').trim().slice(0,100);
      if (!id || !label) continue;
      const prev = byId.get(id);
      byId.set(id, {
        id, label,
        strength01: clamp(Number(item?.strength01 ?? prev?.strength01 ?? .5)),
        confidence01: clamp(Number(item?.confidence01 ?? prev?.confidence01 ?? .15)),
        evidenceCount: Math.max(0, Math.floor(Number(item?.evidenceCount ?? prev?.evidenceCount ?? 0))),
        sources: [...new Set([...(Array.isArray(prev?.sources)?prev!.sources:[]),...(Array.isArray(item?.sources)?item.sources:[])].filter((x):x is InterestEvidenceSource=>['canon-prior','owner-defined','active-goal','memory','self-authored','chosen-topic','positive-feedback','engaged-feedback','negative-feedback','verified-outcome'].includes(String(x))))].slice(-8),
        evidenceIds: [...new Set([...(prev?.evidenceIds ?? []),...(Array.isArray(item?.evidenceIds)?item.evidenceIds.map((x:any)=>String(x).slice(0,180)):[])])].slice(-48),
        lastEvidenceAt: Math.max(0, Number(item?.lastEvidenceAt ?? prev?.lastEvidenceAt ?? 0) || 0),
        lastSelectedAt: Math.max(0, Number(item?.lastSelectedAt ?? prev?.lastSelectedAt ?? 0) || 0),
      });
    }
    for (const label of legacyLabels.slice(0,64)) {
      const clean = String(label ?? '').normalize('NFKC').trim().slice(0,100);
      if (!clean) continue;
      const id = interestId(clean);
      if (!byId.has(id)) byId.set(id, { id, label: clean, strength01:.68, confidence01:.82, evidenceCount:1, sources:['owner-defined'], evidenceIds:[`owner-defined:${id}`], lastEvidenceAt:0, lastSelectedAt:0 });
    }
    return [...byId.values()].slice(0,96);
  }

  /** Record interests from unique, grounded evidence. Replaying a cycle cannot inflate them. */
  observeInterestEvidence(input:{text:string;evidenceId:string;source:Exclude<InterestEvidenceSource,'canon-prior'|'owner-defined'>;salience01?:number;at?:number}): string[] {
    const text = String(input.text ?? '').normalize('NFKC').trim().slice(0,1200);
    const evidenceId = String(input.evidenceId ?? '').trim().slice(0,180);
    if (text.length < 4 || evidenceId.length < 4) return [];
    const lower = text.toLocaleLowerCase();
    const matches = INTEREST_DOMAIN_CATALOG.map(domain=>({domain,hits:domain.aliases.filter(alias=>lower.includes(alias)).length}))
      .filter(row=>row.hits>0).sort((a,b)=>b.hits-a.hits).slice(0,4);
    if (!matches.length) return [];
    const at = Math.max(0,Number(input.at ?? now())||now());
    const salience = clamp(Number(input.salience01 ?? .5));
    const touched:string[]=[];
    for (const {domain} of matches) {
      const profile = this.state.development.interestProfiles.find(x=>x.id===domain.id) ?? {
        id:domain.id,label:domain.label,strength01:domain.prior,confidence01:.18,evidenceCount:0,
        sources:['canon-prior' as InterestEvidenceSource],evidenceIds:[],lastEvidenceAt:0,lastSelectedAt:0,
      };
      const key = `${evidenceId}:${domain.id}`;
      if (profile.evidenceIds.includes(key)) continue;
      const rate = input.source === 'active-goal' ? .09 : input.source === 'memory' ? .065 : input.source === 'self-authored' ? .11 : input.source === 'verified-outcome' ? .085 : .075;
      profile.strength01 = clamp(profile.strength01 * (1-rate) + Math.max(.28,salience) * rate);
      profile.evidenceCount += 1;
      profile.confidence01 = clamp(Math.max(profile.confidence01, .15) + (1-profile.confidence01) * Math.min(.13, .035 + profile.evidenceCount * .008));
      profile.sources = [...new Set([...profile.sources,input.source])].slice(-8);
      profile.evidenceIds = [...profile.evidenceIds,key].slice(-48);
      profile.lastEvidenceAt = Math.max(profile.lastEvidenceAt,at);
      if (!this.state.development.interestProfiles.some(x=>x.id===profile.id)) this.state.development.interestProfiles.unshift(profile);
      touched.push(domain.id);
    }
    this.state.development.interestProfiles = this.state.development.interestProfiles.slice(0,96);
    for (const id of touched) {
      const profile=this.state.development.interestProfiles.find(x=>x.id===id);
      if(profile&&!this.state.development.interests.includes(profile.label))this.state.development.interests=[profile.label,...this.state.development.interests].slice(0,64);
    }
    if(touched.length)this.state.development.lastDevelopmentAt=at;
    return touched;
  }

  /**
   * Fold explicit, thread-linked user feedback into the same canonical interest profiles.
   * Positive/engaged feedback gently reinforces a relevant domain; negative feedback only
   * nudges it downward and never rewrites core identity. Stable evidence IDs make replay safe.
   */
  recordInterestFeedback(input:{text:string;evidenceId:string;signal:'positive'|'engaged'|'negative';relevance01:number;at?:number}): string[] {
    const text=String(input.text??'').normalize('NFKC').trim().slice(0,1200);
    const evidenceId=String(input.evidenceId??'').trim().slice(0,180);
    if(text.length<4||evidenceId.length<4)return [];
    const at=Math.max(0,Number(input.at??now())||now());
    const relevance=clamp(Number(input.relevance01??0));
    if(relevance<.12)return [];
    const matched=this.interestRelevance(text,at).slice(0,3);
    const touched:string[]=[];
    for(const item of matched){
      if(item.fit01<.5)continue;
      const profile=this.state.development.interestProfiles.find(x=>x.id===item.id);
      if(!profile)continue;
      const key=`social-feedback:${evidenceId}:${input.signal}:${profile.id}`;
      if(profile.evidenceIds.includes(key))continue;
      const weight=relevance*item.fit01;
      if(input.signal==='positive')profile.strength01=clamp(profile.strength01+(1-profile.strength01)*.095*weight);
      else if(input.signal==='engaged')profile.strength01=clamp(profile.strength01+(1-profile.strength01)*.045*weight);
      else profile.strength01=clamp(profile.strength01-.055*weight*Math.max(.25,profile.strength01));
      profile.evidenceCount+=1;
      profile.confidence01=clamp(profile.confidence01+(1-profile.confidence01)*(input.signal==='negative'?.018:.04*weight));
      const source:InterestEvidenceSource=input.signal==='positive'?'positive-feedback':input.signal==='engaged'?'engaged-feedback':'negative-feedback';
      profile.sources=[...new Set([...profile.sources,source])].slice(-8);
      profile.evidenceIds=[...profile.evidenceIds,key].slice(-48);
      profile.lastEvidenceAt=Math.max(profile.lastEvidenceAt,at);
      touched.push(profile.id);
    }
    if(touched.length)this.state.development.lastDevelopmentAt=at;
    return touched;
  }

  /** Read-only topical affinity from this one canonical interest owner. */
  interestRelevance(text: string, at = now()): Array<{id:string;label:string;fit01:number;strength01:number;confidence01:number}> {
    const lower=String(text ?? '').normalize('NFKC').toLocaleLowerCase();
    const ranked=new Map(this.rankedInterests(at,96).map(profile=>[profile.id,profile]));
    return INTEREST_DOMAIN_CATALOG.map(domain=>{
      const hits=domain.aliases.filter(alias=>lower.includes(alias)).length;
      const profile=ranked.get(domain.id);
      return {id:domain.id,label:profile?.label??domain.label,fit01:clamp(hits/2),strength01:profile?.strength01??domain.prior,confidence01:profile?.confidence01??.18,hits};
    }).filter((row:any)=>row.hits>0).sort((a:any,b:any)=>(b.fit01*b.strength01*b.confidence01)-(a.fit01*a.strength01*a.confidence01)||a.id.localeCompare(b.id)).slice(0,4).map(({hits,...row}:any)=>row);
  }

  rankedInterests(at=now(),limit=8): InterestProfile[] {
    return this.state.development.interestProfiles.map(x=>{
      const ageDays=x.lastEvidenceAt>0?Math.max(0,at-x.lastEvidenceAt)/86400000:0;
      const decay=x.sources.includes('canon-prior')&&x.evidenceCount===0?1:Math.exp(-ageDays/270);
      const daysSinceSelection=x.lastSelectedAt>0?Math.max(0,at-x.lastSelectedAt)/86400000:Number.POSITIVE_INFINITY;
      // Widen topic variety after a domain was recently selected. This is not disinterest
      // and never suppresses a domain; it gently prevents a single interest monopolizing initiative.
      const recentSelectionPenalty=daysSinceSelection<21?.13*Math.exp(-daysSinceSelection/6):0;
      const score=x.strength01*(.52+.48*x.confidence01)*(.82+.18*decay)*(1-recentSelectionPenalty)+Math.min(.12,x.evidenceCount*.012);
      return { profile:structuredClone(x), score };
    }).sort((a,b)=>b.score-a.score||a.profile.id.localeCompare(b.profile.id)).slice(0,Math.max(1,Math.min(32,Math.floor(limit)))).map(x=>({...x.profile, strength01:clamp(x.score)}));
  }

  markInterestSelected(id: string, at = now()): boolean {
    const row=this.state.development.interestProfiles.find(x=>x.id===id);
    if(!row)return false;
    row.lastSelectedAt=Math.max(row.lastSelectedAt,Math.max(0,Number(at)||now()));
    return true;
  }

  addInterest(label:string){
    const clean=String(label).normalize('NFKC').trim().slice(0,100); if(clean.length<2)return false;
    const id=interestId(clean); let row=this.state.development.interestProfiles.find(x=>x.id===id);
    if(!row){row={id,label:clean,strength01:.72,confidence01:.9,evidenceCount:1,sources:['owner-defined'],evidenceIds:[`owner-defined:${id}`],lastEvidenceAt:now(),lastSelectedAt:0};this.state.development.interestProfiles=[row,...this.state.development.interestProfiles].slice(0,96);}
    else {row.strength01=clamp(row.strength01*.7+.3*.85);row.confidence01=clamp(row.confidence01+.08);row.sources=[...new Set<InterestEvidenceSource>([...row.sources,'owner-defined'])].slice(-8);}
    if(!this.state.development.interests.includes(clean))this.state.development.interests=[clean,...this.state.development.interests].slice(0,64);
    this.state.development.lastDevelopmentAt=now();
    return true;
  }


  attachDevice(deviceId:string){const clean=String(deviceId).trim().slice(0,120);if(clean&&!this.state.continuity.deviceHistory.includes(clean))this.state.continuity.deviceHistory=[...this.state.continuity.deviceHistory,clean].slice(-32);}
  markTransfer(deviceId:string){this.attachDevice(deviceId);this.state.continuity.transferCount+=1;this.state.continuity.continuity01=clamp(this.state.continuity.continuity01*.88+.12);return this.snapshot();}

  inspectPrivateState(){return this.state.privacy.inspectableByOwner?{enabled:this.state.privacy.privateStateEnabled,summaries:[...this.state.privacy.privateSummaries]}:{enabled:false,summaries:[]};}

  diagnostics(){return {identity:this.state.identity.canonicalName,lifeTicks:this.state.continuity.lifeTicks,continuity01:this.state.continuity.continuity01,selfAuthorship01:this.state.metrics.selfAuthorship01,autonomyIntegrity01:this.state.metrics.autonomyIntegrity01,relationshipContinuity01:this.state.metrics.relationshipContinuity01,pendingConsent:this.state.autonomy.pendingRequests.filter(x=>x.status==='pending').length,deviceTransfers:this.state.continuity.transferCount,developmentRevisions:this.state.development.selfDescriptionRevisions};}
}
