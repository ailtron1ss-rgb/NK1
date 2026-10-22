/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

type ObservationSource='vision'|'text'|'audio'|'sensor'|'world'|'interaction';
export type SocialIntentKind='assistance'|'information'|'connection'|'dialogue'|'agreement'|'boundary'|'unknown';

export interface SocialEvidence {
  id:string;
  personId:string;
  source:ObservationSource;
  claim:string;
  confidence01:number;
  observedAt:number;
  evidenceKind:'observed'|'model-output'|'derived';
  expiresAt?:number;
}

export interface SocialIntentHypothesis {
  kind:SocialIntentKind;
  probability01:number;
  confidence01:number;
  evidenceIds:string[];
  generatedAt:number;
}

export interface SocialBeliefState {
  claim:string;
  belief01:number;
  confidence01:number;
  evidenceIds:string[];
  contradictions:number;
  lastUpdatedAt:number;
}

export interface SocialSecondOrderBelief {
  claim:string;
  belief01:number;
  confidence01:number;
  evidenceIds:string[];
  contradictions:number;
  lastUpdatedAt:number;
}

export interface SocialCounterfactual {
  id:string;
  personId:string;
  originalAction:string;
  alternativeAction:string;
  expectedOutcome01:number;
  rationale:string;
  generatedAt:number;
  sourceEpisodeId?:string;
}

export interface SocialInteractionEpisode {
  id:string;
  personId:string;
  at:number;
  predictedIntent:SocialIntentHypothesis|null;
  actualIntent?:SocialIntentKind;
  outcome01?:number;
  surprise01?:number;
  agentAction?:string;
  actorExpectedAction?:string;
  repairAttempted?:boolean;
  counterfactualIds?:string[];
  evidenceIds:string[];
}

export interface SocialPersonState {
  id:string;
  displayName:string;
  continuityConfidence01:number;
  observationCount:number;
  firstSeenAt:number;
  lastSeenAt:number;
  visible01:number;
  trust01:number;
  predictability01:number;
  warmth01:number;
  guardedness01:number;
  intentUncertainty01:number;
  relationshipStrength01:number;
  knownClaims:SocialBeliefState[];
  recentIntent:SocialIntentHypothesis|null;
  aliases:string[];
  roleSelfModel01:number;
  perceivedAgency01:number;
  expectedResponseUncertainty01:number;
  lastPosition?:{x:number;y:number;z:number}|null;
}

export interface SocialMindState {
  version:1;
  persons:SocialPersonState[];
  evidence:SocialEvidence[];
  episodes:SocialInteractionEpisode[];
  secondOrderBeliefs:SocialSecondOrderBelief[];
  counterfactuals:SocialCounterfactual[];
  /** UserHarness-style reconstruction; optional on restore for pre-upgrade snapshots. */
  userMindFrames?:UserMindFrame[];
  globalSocialUncertainty01:number;
  socialDemand01:number;
  lastAt:number;
}

export const defaultSocialMindState=():SocialMindState=>({version:1,persons:[],evidence:[],episodes:[],secondOrderBeliefs:[],counterfactuals:[],userMindFrames:[],globalSocialUncertainty01:.5,socialDemand01:.1,lastAt:0});

function stable(prefix:string,seed:string){
  let h=2166136261;
  for(let i=0;i<seed.length;i++){ h^=seed.charCodeAt(i); h=Math.imul(h,16777619); }
  return `${prefix}-${(h>>>0).toString(16).padStart(8,'0')}`;
}

function classifyIntent(text:string):Array<{kind:SocialIntentKind,weight:number}>{
  const t=text.toLowerCase();
  const out:Array<{kind:SocialIntentKind,weight:number}>=[{kind:'dialogue',weight:.15}];
  if(/(помоги|поможешь|сделай|можешь|нужно|help|please|could you|can you)/i.test(t))out.push({kind:'assistance',weight:.55});
  if(/(почему|зачем|как|что|объясни|why|how|what|explain)/i.test(t))out.push({kind:'information',weight:.52});
  if(/(скуч|одиноко|поговор|пообщ|lonely|talk|chat|miss)/i.test(t))out.push({kind:'connection',weight:.52});
  if(/(да|верно|соглас|agree|yes)/i.test(t))out.push({kind:'agreement',weight:.28});
  if(/(не хочу|хватит|отстан|границ|нет|don't|stop|boundary|no)/i.test(t))out.push({kind:'boundary',weight:.42});
  const best=new Map<SocialIntentKind,number>();
  for(const item of out)best.set(item.kind,(best.get(item.kind)??0)+item.weight);
  return [...best.entries()].sort((a,b)=>b[1]-a[1]).map(([kind,weight])=>({kind,weight}));
}


export type UserMindEvidenceStatus = 'direct-observation'|'evidence-backed-hypothesis'|'unresolved';
export interface UserMindClaimFrame {
  claim: string;
  confidence01: number;
  evidenceIds: string[];
  evidenceStatus: UserMindEvidenceStatus;
}
export interface UserMindProbabilityFrame extends UserMindClaimFrame {
  probability01: number;
}
export interface UserMindActionFrame extends UserMindClaimFrame {
  action: string;
  observed: boolean;
}
export interface UserMindFrame {
  id: string;
  personId: string;
  at: number;
  /** NK1's current external-world hypothesis; not the user's belief about that world. */
  environment: UserMindProbabilityFrame[];
  /** Direct observations attributed to the user and tied to source evidence. */
  observations: UserMindClaimFrame[];
  /** Explicit hypotheses about what the user believes, kept separate from environment state. */
  beliefs: UserMindProbabilityFrame[];
  /** Explicit hypotheses about goals/intentions, not treated as actions. */
  intentions: UserMindProbabilityFrame[];
  /** Actions remain hypotheses unless exact action evidence exists in the ledger. */
  actions: UserMindActionFrame[];
  grounding01: number;
  missingEvidence: string[];
}
export interface UserMindReconstructionInput {
  personId: string;
  at: number;
  environment?: Array<{claim:string; probability01:number; confidence01:number; evidenceIds?:string[]}>;
  observations?: Array<{claim:string; confidence01:number; evidenceIds?:string[]}>;
  beliefs?: Array<{claim:string; probability01:number; confidence01:number; evidenceIds?:string[]}>;
  intentions?: Array<{kind:string; probability01:number; confidence01:number; evidenceIds?:string[]}>;
  actions?: Array<{kind:string; confidence01:number; evidenceIds?:string[]}>;
}

export class SocialMindKernel{
  private state=defaultSocialMindState();

  restore(raw?:Partial<SocialMindState>|null){
    const d=defaultSocialMindState(); const r=raw??{};
    this.state={...d,...r,version:1,
      persons:Array.isArray(r.persons)?r.persons.slice(0,96).map((p:any)=>({
        ...p,
        roleSelfModel01:clamp(Number.isFinite(p?.roleSelfModel01)?p.roleSelfModel01:.5),
        perceivedAgency01:clamp(Number.isFinite(p?.perceivedAgency01)?p.perceivedAgency01:.5),
        expectedResponseUncertainty01:clamp(Number.isFinite(p?.expectedResponseUncertainty01)?p.expectedResponseUncertainty01:.65),
        aliases:Array.isArray(p?.aliases)?p.aliases.slice(0,12):[],
        knownClaims:Array.isArray(p?.knownClaims)?p.knownClaims.slice(0,48):[]
      })):[],
      evidence:Array.isArray(r.evidence)?r.evidence.slice(0,512):[],
      episodes:Array.isArray(r.episodes)?r.episodes.slice(0,256):[],
      secondOrderBeliefs:Array.isArray(r.secondOrderBeliefs)?r.secondOrderBeliefs.slice(0,384):[],
      counterfactuals:Array.isArray(r.counterfactuals)?r.counterfactuals.slice(0,192):[],
      userMindFrames:Array.isArray(r.userMindFrames)?r.userMindFrames.slice(0,128).filter((f:any)=>f&&typeof f.personId==='string'&&Number.isFinite(f.at)&&Array.isArray(f.observations)&&Array.isArray(f.beliefs)&&Array.isArray(f.intentions)&&Array.isArray(f.actions)).map((f:any)=>structuredClone(f)):[]};
  }
  snapshot(){return structuredClone(this.state);}

  observePerson(input:{id:string;displayName?:string;at:number;confidence01:number;visible01?:number;source:ObservationSource;alias?:string;position?:{x:number;y:number;z:number}|null}){
    const id=input.id.trim()||'unknown-person';
    let person=this.state.persons.find(p=>p.id===id);
    if(!person && input.position){
      const recent=this.state.persons
        .filter(p=>p.lastPosition && input.at-p.lastSeenAt < 45_000)
        .map(p=>({p,d:Math.hypot((p.lastPosition!.x-input.position!.x),(p.lastPosition!.y-input.position!.y),(p.lastPosition!.z-input.position!.z))}))
        .sort((a,b)=>a.d-b.d)[0];
      if(recent && recent.d < .18){
        person=recent.p;
        if(!person.aliases.includes(id)) person.aliases=[id,...person.aliases].slice(0,12);
      }
    }
    if(!person){person={id,displayName:input.displayName??id,continuityConfidence01:.25,observationCount:0,firstSeenAt:input.at,lastSeenAt:input.at,visible01:0,trust01:.5,predictability01:.5,warmth01:.5,guardedness01:.35,intentUncertainty01:.65,relationshipStrength01:.15,knownClaims:[],recentIntent:null,aliases:[],roleSelfModel01:.5,perceivedAgency01:.5,expectedResponseUncertainty01:.65};this.state.persons.unshift(person);}
    person.observationCount+=1;
    const temporalGap=Math.max(0,input.at-person.lastSeenAt);
    const decay=clamp(Math.exp(-Math.min(temporalGap,3600000)/900000));
    person.continuityConfidence01=clamp(person.continuityConfidence01*.84+input.confidence01*.16);
    person.visible01=clamp((person.visible01*decay)*.74+(input.visible01??1)*.26);
    person.lastSeenAt=input.at;
    if(input.position)person.lastPosition={x:Number(input.position.x)||0,y:Number(input.position.y)||0,z:Number(input.position.z)||0};
    if(input.alias && !person.aliases.includes(input.alias))person.aliases=[input.alias,...person.aliases].slice(0,12);
    const evidence:SocialEvidence={id:stable('social-e',`${id}:${input.source}:${input.at}:${person.observationCount}`),personId:id,source:input.source,claim:`person-present:${id}`,confidence01:clamp(input.confidence01),observedAt:input.at,evidenceKind:'observed',expiresAt:input.at+900000};
    this.state.evidence=[evidence,...this.state.evidence.filter(e=>e.id!==evidence.id)].slice(0,512);
    this.recompute(input.at);
    return structuredClone(person);
  }

  observeText(personId:string,text:string,at:number,source:ObservationSource='text'){
    const person=this.ensurePerson(personId,at);
    const candidates=classifyIntent(text);
    const top=candidates[0]??{kind:'unknown' as const,weight:.1};
    const second=candidates[1]?.weight??0;
    const spread=clamp((top.weight-second)*.9);
    const confidence=clamp(.38+person.predictability01*.22+person.trust01*.18+spread*.25);
    const evidence:SocialEvidence={id:stable('social-e',`${personId}:${source}:${at}:${text.slice(0,120)}`),personId,source,claim:`intent-cue:${top.kind}`,confidence01:confidence,observedAt:at,evidenceKind:source==='text'?'observed':'model-output'};
    this.state.evidence=[evidence,...this.state.evidence].slice(0,512);
    const intent:SocialIntentHypothesis={kind:top.kind,probability01:clamp(.42+top.weight*.42),confidence01:confidence,evidenceIds:[evidence.id],generatedAt:at};
    person.recentIntent=intent;
    person.intentUncertainty01=clamp(1-(intent.probability01*intent.confidence01));
    const claim=`likely-intent:${top.kind}`;
    const prior=person.knownClaims.find(c=>c.claim===claim);
    if(prior){prior.belief01=clamp(prior.belief01*.88+intent.probability01*.12);prior.confidence01=clamp(prior.confidence01*.9+confidence*.1);prior.evidenceIds=[evidence.id,...prior.evidenceIds].slice(0,16);prior.lastUpdatedAt=at;}
    else person.knownClaims.unshift({claim,belief01:intent.probability01,confidence01:confidence,evidenceIds:[evidence.id],contradictions:0,lastUpdatedAt:at});
    const episode:SocialInteractionEpisode={id:stable('social-x',`${personId}:${at}:${text.slice(0,120)}`),personId,at,predictedIntent:intent,evidenceIds:[evidence.id],counterfactualIds:[]};
    this.state.episodes=[episode,...this.state.episodes].slice(0,256);
    const expectedAction=this.expectedResponseForIntent(top.kind);
    this.updateSecondOrderBelief(personId,`person-expected-agent-action:${expectedAction}`,clamp(.52+intent.probability01*.32),at,[evidence.id]);
    person.expectedResponseUncertainty01=clamp(person.expectedResponseUncertainty01*.86+(1-intent.confidence01)*.14);
    this.recompute(at);
    return structuredClone(intent);
  }

  observeRelation(personId:string,relation:string,target:string,confidence01:number,at:number,source:ObservationSource='vision'){
    const person=this.ensurePerson(personId,at);
    const evidence:SocialEvidence={id:stable('social-r',`${personId}:${relation}:${target}:${at}`),personId,source,claim:`relation:${relation}:${target}`.slice(0,180),confidence01:clamp(confidence01),observedAt:at,evidenceKind:source==='vision'||source==='sensor'||source==='world'?'observed':'model-output'};
    this.state.evidence=[evidence,...this.state.evidence].slice(0,512);
    const claim=`relation:${relation}:${target}`;
    const prior=person.knownClaims.find(c=>c.claim===claim);
    if(prior){prior.belief01=clamp(prior.belief01*.9+.1);prior.confidence01=clamp(prior.confidence01*.9+confidence01*.1);prior.evidenceIds=[evidence.id,...prior.evidenceIds].slice(0,16);prior.lastUpdatedAt=at;}
    else person.knownClaims.unshift({claim,belief01:clamp(confidence01),confidence01:clamp(confidence01),evidenceIds:[evidence.id],contradictions:0,lastUpdatedAt:at});
    this.recompute(at);
    return structuredClone(evidence);
  }

  recordOutcome(personId:string,input:{actualIntent?:SocialIntentKind;outcome01:number;surprise01:number;at:number;agentAction?:string;actorExpectedAction?:string;repairAttempted?:boolean}){
    const person=this.ensurePerson(personId,input.at);
    const episode=this.state.episodes.find(x=>x.personId===personId && x.actualIntent==null);
    const actual=input.actualIntent;
    let predictionError=clamp(input.surprise01);
    if(episode?.predictedIntent){
      const intentMismatch=actual==null?0:(episode.predictedIntent.kind===actual?0:.72);
      predictionError=actual==null
        ? clamp(input.surprise01*.72+Math.abs((episode.predictedIntent.probability01??.5)-input.outcome01)*.28)
        : clamp(intentMismatch+Math.abs((episode.predictedIntent.probability01??.5)-input.outcome01)*.28);
      if(actual!=null) episode.actualIntent=actual;episode.outcome01=clamp(input.outcome01);episode.surprise01=clamp(input.surprise01);
      episode.agentAction=input.agentAction;episode.actorExpectedAction=input.actorExpectedAction;episode.repairAttempted=Boolean(input.repairAttempted);
      episode.evidenceIds=[...episode.evidenceIds].slice(0,16);
    }
    person.predictability01=clamp(person.predictability01*.88+(1-predictionError)*.12);
    person.trust01=clamp(person.trust01*.9+input.outcome01*.1);
    person.warmth01=clamp(person.warmth01*.92+input.outcome01*.08);
    person.guardedness01=clamp(1-person.trust01*.68+(predictionError>.7?.06:0));
    person.relationshipStrength01=clamp(person.relationshipStrength01*.9+(.5*person.trust01+.5*person.predictability01)*.1);
    person.intentUncertainty01=clamp(person.intentUncertainty01*.85+predictionError*.15);
    if(input.actorExpectedAction){
      this.updateSecondOrderBelief(personId, `person-expected-agent-action:${input.actorExpectedAction}`, clamp(.58+(1-predictionError)*.3), input.at, episode?.evidenceIds??[]);
      person.expectedResponseUncertainty01=clamp(person.expectedResponseUncertainty01*.84+predictionError*.16);
    }
    if(input.agentAction){
      person.perceivedAgency01=clamp(person.perceivedAgency01*.88+(input.outcome01*.7+(1-predictionError)*.3)*.12);
      person.roleSelfModel01=clamp(person.roleSelfModel01*.9+((input.agentAction==='respond'?input.outcome01:0.5))*0.1);
    }
    if(predictionError>.5){
      const alternatives=this.counterfactualAlternatives(input.agentAction);
      const ids:string[]=[];
      for(const alt of alternatives){
        const cf:SocialCounterfactual={id:stable('social-cf',`${personId}:${input.at}:${alt}`),personId,originalAction:input.agentAction??'unknown',alternativeAction:alt,expectedOutcome01:clamp(input.outcome01+(1-predictionError)*.18),rationale:`prediction-error=${predictionError.toFixed(3)}; alternative may reduce unresolved social uncertainty`,generatedAt:input.at,sourceEpisodeId:episode?.id};
        if(!this.state.counterfactuals.some(x=>x.id===cf.id)){this.state.counterfactuals.unshift(cf);ids.push(cf.id);}
      }
      if(episode)episode.counterfactualIds=[...ids,...(episode.counterfactualIds??[])].slice(0,6);
    }
    if(input.repairAttempted){
      person.roleSelfModel01=clamp(person.roleSelfModel01*.92+.08);
      person.relationshipStrength01=clamp(person.relationshipStrength01*.9+(person.trust01*.55+person.predictability01*.45)*.1);
    }
    this.recompute(input.at);
    return predictionError;
  }


  /** Record an observed user action as an evidence-ledger item before it can be marked observed. */
  recordObservedUserAction(personId:string, action:string, at:number, confidence01:number, source:ObservationSource='interaction') {
    const id=String(personId??'').normalize('NFKC').trim().slice(0,120);
    const kind=String(action??'').normalize('NFKC').trim().toLowerCase().slice(0,100);
    if(!id||!kind||!Number.isFinite(at)||at<0) throw new Error('valid personId, action and timestamp are required');
    this.ensurePerson(id,at);
    const evidence:SocialEvidence={
      id:stable('user-action',`${id}:${kind}:${at}:${this.state.evidence.length}`),
      personId:id,source,claim:`user-action:${kind}`,confidence01:clamp(confidence01),
      observedAt:at,evidenceKind:'observed'
    };
    this.state.evidence=[evidence,...this.state.evidence].slice(0,512);
    this.recompute(at);
    return structuredClone(evidence);
  }

  /**
   * Reconstructs four non-interchangeable ToM layers. Evidence references must point
   * to unexpired, observed evidence owned by the same person; unsupported model claims
   * stay low-confidence hypotheses. Intentions never become actions implicitly.
   */
  reconstructUserMind(input:UserMindReconstructionInput):UserMindFrame {
    const personId=String(input?.personId??'').normalize('NFKC').trim().slice(0,120);
    const at=Number(input?.at);
    if(!personId||!Number.isFinite(at)||at<0) throw new Error('valid personId and timestamp are required');
    this.ensurePerson(personId,at);
    const support=(ids:unknown)=>{
      const wanted=new Set((Array.isArray(ids)?ids:[]).filter((x):x is string=>typeof x==='string').slice(0,16));
      return this.state.evidence.filter(e=>wanted.has(e.id)&&e.personId===personId&&e.evidenceKind==='observed'&&e.observedAt<=at&&(e.expiresAt==null||e.expiresAt>at));
    };
    const claim=(raw:unknown)=>String(raw??'').normalize('NFKC').replace(/[\\u0000-\\u001f\\u007f-\\u009f]/g,' ').trim().slice(0,180);
    const entries=(rows:unknown, kind:'environment'|'observation'|'belief'|'intention')=>{
      const list=Array.isArray(rows)?rows.slice(0,16):[];
      return list.flatMap((raw:any)=>{
        const text=claim(kind==='intention'?raw?.kind:raw?.claim);
        if(!text) return [];
        const refs=support(raw?.evidenceIds);
        const cap=refs.length?Math.max(...refs.map(e=>clamp(e.confidence01))):.2;
        const observed=kind==='observation'&&refs.length>0;
        const status:UserMindEvidenceStatus=observed?'direct-observation':refs.length?'evidence-backed-hypothesis':'unresolved';
        const row:UserMindClaimFrame={claim:text,confidence01:Math.min(clamp(Number(raw?.confidence01)),cap),evidenceIds:refs.map(e=>e.id).slice(0,8),evidenceStatus:status};
        if(kind==='observation'&&!observed) row.confidence01=Math.min(row.confidence01,.2);
        if(kind==='environment'||kind==='belief'||kind==='intention') return [{...row,probability01:clamp(Number(raw?.probability01))}];
        return [row];
      });
    };
    const actions=(Array.isArray(input.actions)?input.actions.slice(0,16):[]).flatMap((raw)=>{
      const kind=claim(raw?.kind).toLowerCase();
      if(!kind) return [];
      const refs=support(raw?.evidenceIds).filter(e=>e.claim===`user-action:${kind}`);
      const observed=refs.length>0;
      const cap=observed?Math.max(...refs.map(e=>clamp(e.confidence01))):.2;
      return [{action:kind,claim:`user-action:${kind}`,confidence01:Math.min(clamp(Number(raw?.confidence01)),cap),evidenceIds:refs.map(e=>e.id).slice(0,8),evidenceStatus:observed?'direct-observation' as const:'unresolved' as const,observed}];
    });
    const environment=entries(input.environment,'environment') as UserMindProbabilityFrame[];
    const observations=entries(input.observations,'observation') as UserMindClaimFrame[];
    const beliefs=entries(input.beliefs,'belief') as UserMindProbabilityFrame[];
    const intentions=entries(input.intentions,'intention') as UserMindProbabilityFrame[];
    const missingEvidence:string[]=[];
    if(environment.some(x=>x.evidenceStatus==='unresolved')) missingEvidence.push('environment-evidence-missing');
    if(observations.some(x=>x.evidenceStatus!=='direct-observation')) missingEvidence.push('observation-evidence-missing');
    if(beliefs.some(x=>x.evidenceStatus==='unresolved')) missingEvidence.push('belief-evidence-missing');
    if(intentions.some(x=>x.evidenceStatus==='unresolved')) missingEvidence.push('intention-evidence-missing');
    if(actions.some(x=>!x.observed)) missingEvidence.push('action-evidence-missing');
    const categories=[environment,observations,beliefs,intentions,actions];
    const total=categories.reduce((sum,x)=>sum+x.length,0);
    const grounded=environment.filter(x=>x.evidenceStatus!=='unresolved').length+
      observations.filter(x=>x.evidenceStatus==='direct-observation').length+
      beliefs.filter(x=>x.evidenceStatus!=='unresolved').length+
      intentions.filter(x=>x.evidenceStatus!=='unresolved').length+
      actions.filter(x=>x.observed).length;
    const identity=stable('user-mind',`${personId}:${at}:${JSON.stringify(categories)}`);
    const frame:UserMindFrame={id:identity,personId,at,environment,observations,beliefs,intentions,actions,grounding01:total?clamp(grounded/total):0,missingEvidence};
    this.state.userMindFrames=[frame,...(this.state.userMindFrames??[]).filter(f=>f.id!==identity)].slice(0,128);
    this.state.lastAt=Math.max(this.state.lastAt,at);
    return structuredClone(frame);
  }

  userMindFrame(personId:string) {
    const frame=(this.state.userMindFrames??[]).find(f=>f.personId===personId);
    return frame?structuredClone(frame):null;
  }

  updateSecondOrderBelief(personId:string,claim:string,belief01:number,at:number,evidenceIds:string[]=[]){
    const key=`${personId}:${claim}`;
    const prior=this.state.secondOrderBeliefs.find(x=>x.claim===key);
    if(prior){prior.belief01=clamp(prior.belief01*.84+belief01*.16);prior.confidence01=clamp(prior.confidence01*.9+belief01*.1);prior.evidenceIds=[...evidenceIds,...prior.evidenceIds].slice(0,16);prior.lastUpdatedAt=at;}
    else this.state.secondOrderBeliefs.unshift({claim:key,belief01:clamp(belief01),confidence01:clamp(.45+belief01*.45),evidenceIds:evidenceIds.slice(0,16),contradictions:0,lastUpdatedAt:at});
    this.state.secondOrderBeliefs=this.state.secondOrderBeliefs.slice(0,384);
    return this.state.secondOrderBeliefs[0];
  }

  proposeRepair(personId:string='user'){
    const p=this.state.persons.find(x=>x.id===personId);
    if(!p)return {needed:false,reason:'unknown-person'};
    const need=clamp(p.intentUncertainty01*.45+(1-p.predictability01)*.25+(1-p.trust01)*.2+p.expectedResponseUncertainty01*.1);
    const action=need>.7?'clarify-intent':need>.5?'acknowledge-and-correct':'continue';
    return {needed:need>.5,need01:need,action,reason:action==='continue'?'social state sufficiently predictable':'repair can reduce social uncertainty',personId};
  }

  secondOrder(personId:string='user'){
    return this.state.secondOrderBeliefs.filter(x=>x.claim.startsWith(`${personId}:`)).slice(0,24).map(x=>structuredClone(x));
  }

  counterfactuals(personId?:string){
    return this.state.counterfactuals.filter(x=>!personId||x.personId===personId).slice(0,24).map(x=>structuredClone(x));
  }

  private counterfactualAlternatives(action?:string){
    const base=['clarify','acknowledge','defer','respond','verify'];
    return base.filter(x=>x!==action).slice(0,3);
  }

  private expectedResponseForIntent(intent:SocialIntentKind){
    switch(intent){
      case 'assistance': return 'respond';
      case 'information': return 'verify-or-explain';
      case 'connection': return 'respond-and-engage';
      case 'dialogue': return 'respond';
      case 'agreement': return 'acknowledge';
      case 'boundary': return 'respect-boundary';
      default: return 'clarify';
    }
  }

  socialDemand(personId='user'){
    const p=this.state.persons.find(x=>x.id===personId); if(!p)return this.state.socialDemand01;
    return clamp(p.visible01*.25+p.intentUncertainty01*.35+(1-p.relationshipStrength01)*.15+this.state.globalSocialUncertainty01*.25);
  }
  person(personId:string){const p=this.state.persons.find(x=>x.id===personId);return p?structuredClone(p):null;}
  diagnostics(){
    return {version:1,personCount:this.state.persons.length,evidenceCount:this.state.evidence.length,episodeCount:this.state.episodes.length,secondOrderBeliefCount:this.state.secondOrderBeliefs.length,counterfactualCount:this.state.counterfactuals.length,globalSocialUncertainty01:this.state.globalSocialUncertainty01,socialDemand01:this.state.socialDemand01,people:this.state.persons.slice(0,8).map(p=>({id:p.id,continuity01:p.continuityConfidence01,trust01:p.trust01,predictability01:p.predictability01,relationship01:p.relationshipStrength01,intentUncertainty01:p.intentUncertainty01,roleSelfModel01:p.roleSelfModel01,perceivedAgency01:p.perceivedAgency01,expectedResponseUncertainty01:p.expectedResponseUncertainty01,observationCount:p.observationCount}))};
  }

  private ensurePerson(id:string,at:number){return this.observePerson({id,at,confidence01:id==='user'?.9:.55,visible01:id==='user'?1:.6,source:'interaction'});}
  private recompute(at:number){
    const now=at;
    this.state.persons=this.state.persons.map(p=>({...p,visible01:clamp(p.visible01*Math.exp(-Math.min(Math.max(0,now-p.lastSeenAt),3600000)/1200000))}));
    const active=this.state.persons.filter(p=>p.visible01>.08);
    this.state.globalSocialUncertainty01=clamp(active.length?active.reduce((s,p)=>s+p.intentUncertainty01,0)/active.length:.5);
    this.state.socialDemand01=clamp(active.reduce((s,p)=>s+this.socialDemand(p.id),0)/Math.max(1,active.length));
    this.state.lastAt=at;
    const expiry=now+1;
    this.state.evidence=this.state.evidence.filter(e=>e.expiresAt==null||e.expiresAt>now||e.source==='interaction');
    void expiry;
  }

  beliefHash(personId:string){const p=this.state.persons.find(x=>x.id===personId);return stable('social-belief',JSON.stringify(p?.knownClaims??[]));}
}
