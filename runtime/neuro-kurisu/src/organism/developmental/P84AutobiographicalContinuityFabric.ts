export interface P84AutobiographicalMoment {
  id:string;
  tick:number;
  at:number;
  action:string;
  outcome01:number|null;
  realityHash:string;
  realityRevision:number;
  decisionId:string|null;
  predictionIds:string[];
  observationIds:string[];
  memoryIds:string[];
  evidenceIds:string[];
  activeGoalIds:string[];
  beliefIds:string[];
  personIds:string[];
  identity01:number;
  authorship01:number;
  realityConfidence01:number;
  significance01:number;
  continuity01:number;
  transition:boolean;
  changeSummary:string;
  identityDelta01:number;
  memoryBinding01:number;
  realityDelta01:number;
  learningSignal01:number;
  evidenceQuality01:number;
  counterEvidence01:number;
  boundary01:number;
  identityChangeReasons:string[];
  sourceEventIds:string[];
}
export interface P84ActionOutcomeProfile {
  samples:number;
  verifiedSamples:number;
  success01:number;
  confidence01:number;
  lastAt:number;
  lastEvidence01:number;
}
export interface P84BehaviorContext {
  goalFamily?:string;
  uncertainty01?:number;
  novelty01?:number;
  energy01?:number;
  cognitiveLoad01?:number;
  realityConfidence01?:number;
}
export interface P84DevelopmentalConsequence {
  id:string;
  at:number;
  tick:number;
  action:string;
  socialSignal01:number;
  identityPressure01:number;
  selfChange01:number;
  causalSignal01:number;
  evidenceQuality01:number;
  futureSelfDelta01:number;
  verified01:boolean;
  sourceMomentId:string|null;
  summary:string;
}
export interface P84State {
  version:5;
  revision:number;
  moments:P84AutobiographicalMoment[];
  lifeContinuity01:number;
  causalContinuity01:number;
  autobiographicalIntegrity01:number;
  lastTick:number;
  lastRealityHash:string;
  lastMomentId:string;
  transitionCount:number;
  identityChangeCount:number;
  selfChangeLoad01:number;
  memoryBinding01:number;
  actionOutcomeProfiles:Record<string,P84ActionOutcomeProfile>;
  beliefContinuity01:number;
  socialBinding01:number;
  contextualOutcomeProfiles:Record<string,P84ActionOutcomeProfile>;
  carryoverRevision:number;
  developmentalConsequences:P84DevelopmentalConsequence[];
  processedIngestKeys?:string[];
  processedOutcomeEvidenceIds?:string[];
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number,limit=.06)=>Math.max(-limit,Math.min(limit,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=160)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const usableProfile=(p:P84ActionOutcomeProfile|undefined)=>Boolean(p&&p.verifiedSamples>=2);
const uniq=(xs:unknown[],limit=12)=>[...new Set(xs.map(x=>clean(x)).filter(Boolean))].slice(-limit);
const stable=(x:string)=>{let h=2166136261>>>0;for(const c of x){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');};
export const defaultP84=():P84State=>({version:5,revision:0,moments:[],lifeContinuity01:.74,causalContinuity01:.62,autobiographicalIntegrity01:.58,lastTick:0,lastRealityHash:'',lastMomentId:'',transitionCount:0,identityChangeCount:0,selfChangeLoad01:0,memoryBinding01:0,beliefContinuity01:.55,socialBinding01:.5,actionOutcomeProfiles:{},contextualOutcomeProfiles:{},carryoverRevision:0,developmentalConsequences:[],processedIngestKeys:[],processedOutcomeEvidenceIds:[]});

/**
 * P84 — Autobiographical Continuity Fabric.
 *
 * Derived identity-life spine owned by the Self system. It does not replace
 * episodic memory, P78 or narrative chapters. Instead it creates bounded links
 * between their evidence: action/outcome, reality revision, prediction and
 * observation references, memory references, goals, and identity continuity.
 * Raw contents stay in their canonical owners; P84 stores only compact lineage.
 */
export class P84AutobiographicalContinuityFabric {
  readonly systemName='self:p84-autobiographical-continuity' as const;
  private state=defaultP84();
  private readonly maxMoments:number;
  constructor(maxMoments=96){this.maxMoments=Math.max(24,Math.floor(maxMoments));}
  restore(raw?:Partial<P84State>|null){
    const d=defaultP84(), r=raw??{};
    const profiles=(r.actionOutcomeProfiles??{}) as Record<string,P84ActionOutcomeProfile>;
    const contextualProfiles=(r.contextualOutcomeProfiles??{}) as Record<string,P84ActionOutcomeProfile>;
    const developmentalConsequences=Array.isArray((r as any).developmentalConsequences)
      ? (r as any).developmentalConsequences.slice(-96).map((x:any)=>({
          id:clean(x?.id,96)||`dev:${Date.now()}:${Math.random().toString(16).slice(2)}`,
          at:Number(x?.at??0), tick:Math.max(0,Math.floor(Number(x?.tick??0))), action:clean(x?.action,64)||'none',
          socialSignal01:clamp(Number(x?.socialSignal01??0)), identityPressure01:clamp(Number(x?.identityPressure01??0)),
          selfChange01:clamp(Number(x?.selfChange01??0)), causalSignal01:clamp(Number(x?.causalSignal01??0)),
          evidenceQuality01:clamp(Number(x?.evidenceQuality01??0)), futureSelfDelta01:Number.isFinite(x?.futureSelfDelta01)?Number(x.futureSelfDelta01):0,
          verified01:Boolean(x?.verified01), sourceMomentId:x?.sourceMomentId?clean(x.sourceMomentId,96):null, summary:clean(x?.summary,220)||'developmental-consequence'
        })) : [];
    const moments=Array.isArray(r.moments)
      ? r.moments.slice(-Math.max(24,this.maxMoments)).map(m=>({
          ...m,
          predictionIds:uniq(m.predictionIds??[]), observationIds:uniq(m.observationIds??[]),
          memoryIds:uniq(m.memoryIds??[]), evidenceIds:uniq(m.evidenceIds??[]),
          activeGoalIds:uniq(m.activeGoalIds??[]), beliefIds:uniq(m.beliefIds??[]), personIds:uniq(m.personIds??[]), sourceEventIds:uniq(m.sourceEventIds??[])
        }))
      : [];
    const normalizeProfiles=(source:Record<string,P84ActionOutcomeProfile>,limit:number)=>Object.fromEntries(
      Object.entries(source).slice(-limit).map(([k,v])=>[clean(k,96),{
        samples:Math.max(0,Math.floor(Number(v?.samples??0))),
        verifiedSamples:Math.max(0,Math.floor(Number(v?.verifiedSamples??0))),
        success01:clamp(Number(v?.success01??.5)),
        confidence01:clamp(Number(v?.confidence01??0)),
        lastAt:Number(v?.lastAt??0),
        lastEvidence01:clamp(Number(v?.lastEvidence01??0))
      }])
    );
    const actionOutcomeProfiles=normalizeProfiles(profiles,16);
    const contextualOutcomeProfiles=normalizeProfiles(contextualProfiles,64);
    this.state={...d,...r,moments,actionOutcomeProfiles,contextualOutcomeProfiles,developmentalConsequences,
      processedIngestKeys:Array.isArray((r as any).processedIngestKeys)?(r as any).processedIngestKeys.filter((id:any)=>typeof id==='string'&&id.trim()&&id.length<=180).slice(-256):[],
      processedOutcomeEvidenceIds:Array.isArray((r as any).processedOutcomeEvidenceIds)?(r as any).processedOutcomeEvidenceIds.filter((id:any)=>typeof id==='string'&&id.trim()&&id.length<=180).slice(-256):[],
      version:5,beliefContinuity01:clamp(Number(r.beliefContinuity01??d.beliefContinuity01)),socialBinding01:clamp(Number(r.socialBinding01??d.socialBinding01)),carryoverRevision:Math.max(0,Math.floor(Number(r.carryoverRevision??0)))};
  }
  snapshot(){return structuredClone(this.state);}

  ingest(input:{tick:number;at?:number;action?:string;outcome01?:number|null;decisionId?:string|null;realityHash?:string;realityRevision?:number;realityConfidence01?:number;predictionIds?:string[];observationIds?:string[];memoryIds?:string[];evidenceIds?:string[];activeGoalIds?:string[];beliefIds?:string[];personIds?:string[];sourceEventIds?:string[];identity01?:number;authorship01?:number;p78Continuity01?:number;p78Coherence01?:number;narrativeContinuity01?:number;causalLinks01?:number;significance01?:number;counterEvidence01?:number;evidenceQuality01?:number;changeSummary?:string;idempotencyKey?:string}){
    const idempotencyKey=clean(input.idempotencyKey,180);
    if(idempotencyKey&&this.state.processedIngestKeys?.includes(idempotencyKey)) return this.snapshot();
    if(idempotencyKey) this.state.processedIngestKeys=[...(this.state.processedIngestKeys??[]),idempotencyKey].slice(-256);
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const realityHash=clean(input.realityHash,40);
    const action=clean(input.action||'none',64)||'none';
    const prev=this.state.moments.at(-1);
    const realityChanged=Boolean(prev&&realityHash&&prev.realityHash&&prev.realityHash!==realityHash);
    const causalLinks=clamp(input.causalLinks01??(input.predictionIds?.length||input.observationIds?.length?0.78:0.42));
    const evidenceQuality=clamp(input.evidenceQuality01??clamp((input.evidenceIds?.length??0)/4)*.45 + (input.observationIds?.length?0.25:0) + (input.realityConfidence01??.5)*.30);
    const counterEvidence=clamp(input.counterEvidence01??0);
    const beliefIds=uniq(input.beliefIds??[]);
    const personIds=uniq(input.personIds??[]);
    const identity=clamp(input.identity01??.5);
    const authorship=clamp(input.authorship01??.5);
    const realityConfidence=clamp(input.realityConfidence01??.5);
    const coherence=clamp((input.p78Coherence01??.6)*.42+(input.narrativeContinuity01??.6)*.28+(realityConfidence)*.18+(identity)*.12);
    const significance=clamp(input.significance01??(.16+causalLinks*.24+(realityChanged?.24:0)+(Math.abs((input.outcome01??.5)-.5)*.28)+authorship*.18));
    const goalIdsNow=uniq(input.activeGoalIds??[]);
    const goalOverlap=prev&&prev.activeGoalIds.length?prev.activeGoalIds.filter(id=>goalIdsNow.includes(id)).length/Math.max(prev.activeGoalIds.length,goalIdsNow.length||1):goalIdsNow.length?0:1;
    const signature=stable(`${input.tick}|${action}|${realityHash}|${input.decisionId??''}|${input.outcome01??''}|${uniq(input.predictionIds??[]).join(',')}|${uniq(input.observationIds??[]).join(',')}|${beliefIds.join(',')}|${personIds.join(',')}|${goalIdsNow.join(',')}`);
    const priorSignature=prev?stable(`${prev.tick}|${prev.action}|${prev.realityHash}|${prev.decisionId??''}|${prev.outcome01??''}|${prev.predictionIds.join(',')}|${prev.observationIds.join(',')}|${prev.beliefIds.join(',')}|${prev.personIds.join(',')}|${prev.activeGoalIds.join(',')}`):'';
    const materiallyNew=!prev||signature!==priorSignature||realityChanged||significance>=.64;
    if(!materiallyNew){
      this.state.lastTick=input.tick; this.state.selfChangeLoad01=clamp(this.state.selfChangeLoad01*.995); this.state.lifeContinuity01=clamp(this.state.lifeContinuity01*.995+(input.p78Continuity01??this.state.lifeContinuity01)*.005); return this.snapshot();
    }
    const overlap=prev?((prev.realityHash===realityHash?1:0)+(prev.action===action?1:0)+(prev.memoryIds.some(id=>(input.memoryIds??[]).includes(id))?1:0))/3:1;
    const continuity=clamp(.34+overlap*.26+(input.p78Continuity01??.7)*.22+coherence*.18);
    const outcomeDelta=prev?Math.abs((prev.outcome01??0.5)-(input.outcome01??0.5)):0;
    const identityDelta01=clamp(prev?Math.abs(identity-prev.identity01):0);
    const memoryIdsNow=uniq(input.memoryIds??[]);
    const memoryBinding01=clamp((memoryIdsNow.length+(input.evidenceIds?.length??0)*.6)/12);
    const realityDelta01=clamp(realityChanged?.6+Math.min(1,Math.abs((input.realityRevision??0)-(prev?.realityRevision??0))/3)*.4:0);
    const learningSignal01=clamp(causalLinks*.28+outcomeDelta*.34+realityDelta01*.18+memoryBinding01*.10+(input.observationIds?.length?0.10:0));
    const identityChangeReasons:string[]=[];
    if(realityDelta01>=.3) identityChangeReasons.push('reality-change');
    if(identityDelta01>=.08) identityChangeReasons.push('identity-drift');
    if(outcomeDelta>=.25) identityChangeReasons.push('outcome-surprise');
    if(memoryBinding01>=.25) identityChangeReasons.push('memory-binding');
    if((input.observationIds?.length??0)>0) identityChangeReasons.push('external-evidence');
    if(counterEvidence>=.3) identityChangeReasons.push('counter-evidence-review');
    if(causalLinks>=.75) identityChangeReasons.push('causal-link');
    const goalChange=1-goalOverlap;
    const boundary=clamp((realityChanged?.46:0)+Math.min(1,outcomeDelta*1.4)*.18+Math.max(0,(significance-.58))*.52+goalChange*.18+(action!==prev?.action?.toString()?0.05:0));
    const transition=Boolean(realityChanged||outcomeDelta>=.45||significance>=.78||boundary>=.72);
    const moment:P84AutobiographicalMoment={
      id:`p84:${input.tick}:${this.state.revision+1}:${signature}`,
      tick:input.tick,at,action,outcome01:input.outcome01==null?null:clamp(input.outcome01),
      realityHash,realityRevision:Math.max(0,Math.floor(input.realityRevision??0)),decisionId:input.decisionId??null,
      predictionIds:uniq(input.predictionIds??[]),observationIds:uniq(input.observationIds??[]),memoryIds:memoryIdsNow,evidenceIds:uniq(input.evidenceIds??[]),activeGoalIds:uniq(input.activeGoalIds??[]),beliefIds,personIds,
      identity01:identity,authorship01:authorship,realityConfidence01:realityConfidence,significance01:significance,continuity01:continuity,transition,changeSummary:clean(input.changeSummary||'autobiographical-state-update'),
      identityDelta01,memoryBinding01,realityDelta01,learningSignal01,evidenceQuality01:evidenceQuality,counterEvidence01:counterEvidence,boundary01:boundary,identityChangeReasons:identityChangeReasons.slice(0,8),sourceEventIds:uniq(input.sourceEventIds??[])
    };
    this.state.moments=[...this.state.moments,moment].slice(-Math.max(24,this.maxMoments));
    this.state.revision++; this.state.lastTick=input.tick; this.state.lastRealityHash=realityHash; this.state.lastMomentId=moment.id; if(transition)this.state.transitionCount++; if(identityDelta01>=.08||learningSignal01>=.7||identityChangeReasons.length>=3)this.state.identityChangeCount++; this.state.selfChangeLoad01=clamp(this.state.selfChangeLoad01*.82+identityDelta01*.10+learningSignal01*.08); this.state.memoryBinding01=clamp(this.state.memoryBinding01*.86+memoryBinding01*.14);
    this.state.lifeContinuity01=clamp(this.state.lifeContinuity01*.86+continuity*.10+(input.p78Continuity01??.7)*.04);
    this.state.causalContinuity01=clamp(this.state.causalContinuity01*.84+causalLinks*.10+coherence*.06);
    this.state.autobiographicalIntegrity01=clamp(this.state.autobiographicalIntegrity01*.82+((this.state.moments.length>=4?1:0)*.08)+coherence*.06+evidenceQuality*.04+Math.min(1,this.state.revision/48)*.04);
    this.state.beliefContinuity01=clamp(this.state.beliefContinuity01*.84+(beliefIds.length?Math.min(1,beliefIds.length/4):0)*.08+evidenceQuality*.08);
    this.state.socialBinding01=clamp(this.state.socialBinding01*.86+(personIds.length?Math.min(1,personIds.length/3):0)*.06+continuity*.08);
    return this.snapshot();
  }

  learnFromVerifiedOutcome(input:{action:string;success01:number;confidence01:number;evidence01?:number;at?:number;reason?:string;context?:P84BehaviorContext;evidenceId?:string}){
    const action=clean(input.action,64)||'wait';
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const evidence=clamp(input.evidence01??input.confidence01);
    const evidenceId=clean(input.evidenceId,180);
    if(evidence<.62 || clamp(input.confidence01)<.62) return this.snapshot();
    if(evidenceId&&this.state.processedOutcomeEvidenceIds?.includes(evidenceId)) return this.snapshot();
    if(evidenceId) this.state.processedOutcomeEvidenceIds=[...(this.state.processedOutcomeEvidenceIds??[]),evidenceId].slice(-256);
    const prev=this.state.actionOutcomeProfiles[action]??{samples:0,verifiedSamples:0,success01:.5,confidence01:0,lastAt:0,lastEvidence01:0};
    const success=clamp(input.success01);
    const next={samples:prev.samples+1,verifiedSamples:prev.verifiedSamples+1,success01:clamp(prev.success01*.72+success*.28),confidence01:clamp(prev.confidence01*.70+clamp(input.confidence01)*.30),lastAt:at,lastEvidence01:evidence};
    this.state.actionOutcomeProfiles={...this.state.actionOutcomeProfiles,[action]:next};
    const contextKey=this.contextKey(input.context);
    if(contextKey){
      const contextualId=`${action}|${contextKey}`;
      const cPrev=this.state.contextualOutcomeProfiles[contextualId]??{samples:0,verifiedSamples:0,success01:.5,confidence01:0,lastAt:0,lastEvidence01:0};
      const cNext={samples:cPrev.samples+1,verifiedSamples:cPrev.verifiedSamples+1,success01:clamp(cPrev.success01*.68+success*.32),confidence01:clamp(cPrev.confidence01*.66+clamp(input.confidence01)*.34),lastAt:at,lastEvidence01:evidence};
      this.state.contextualOutcomeProfiles={...this.state.contextualOutcomeProfiles,[contextualId]:cNext};
      const keys=Object.keys(this.state.contextualOutcomeProfiles);
      if(keys.length>64){const keep=keys.slice(-64); const nextProfiles:Record<string,P84ActionOutcomeProfile>={}; for(const k of keep) nextProfiles[k]=this.state.contextualOutcomeProfiles[k]; this.state.contextualOutcomeProfiles=nextProfiles;}
    }
    this.state.carryoverRevision++;
    return this.snapshot();
  }

  private contextKey(context?:P84BehaviorContext):string{
    if(!context) return '';
    const bin=(x:number|undefined)=>Math.max(0,Math.min(3,Math.floor(clamp(x??.5)*4)));
    const goal=clean(context.goalFamily??'none',24).toLowerCase().replace(/[^a-z0-9_-]/g,'_')||'none';
    return `${goal}:u${bin(context.uncertainty01)}:n${bin(context.novelty01)}:e${bin(context.energy01)}:l${bin(context.cognitiveLoad01)}:r${bin(context.realityConfidence01)}`;
  }

  actionBias(action:string,at=Date.now(),context?:P84BehaviorContext):number{
    const key=clean(action,64)||'wait';
    const global=this.state.actionOutcomeProfiles[key];
    const requestedContext=this.contextKey(context);
    const exact=requestedContext?this.state.contextualOutcomeProfiles[`${key}|${requestedContext}`]:undefined;
    const usable=(p:P84ActionOutcomeProfile|undefined)=>Boolean(p&&p.verifiedSamples>=2);
    const score=(p:P84ActionOutcomeProfile)=>{const age=Math.max(0,at-p.lastAt);const freshness=Math.exp(-age/(36*60*60*1000));return (p.success01-.5)*2*.06*p.confidence01*freshness;};
    if(!usable(global) && !usable(exact) && !requestedContext)return 0;
    const globalBias=usable(global)?score(global!):0;
    if(usable(exact)){
      const contextualBias=score(exact!);
      const transferred=this.similarContextBias(key,requestedContext,at,exact);
      const local=clampSigned(contextualBias*.78+transferred*.22);
      return clampSigned(Math.max(local,globalBias*.24));
    }
    const transferred=requestedContext?this.similarContextBias(key,requestedContext,at):0;
    return clampSigned(globalBias*.40+transferred*.60);
  }

  private similarContextBias(action:string,requestedContext:string,at:number,exclude?:P84ActionOutcomeProfile):number{
    if(!requestedContext)return 0;
    const rows=Object.entries(this.state.contextualOutcomeProfiles)
      .filter(([id,p])=>id.startsWith(`${action}|`)&&usableProfile(p)&&p!==exclude)
      .map(([id,p])=>({p,similarity:this.contextSimilarity(requestedContext,id.slice(action.length+1))}))
      .filter(row=>row.similarity>=.35)
      .sort((a,b)=>b.similarity-a.similarity)
      .slice(0,5);
    if(rows.length===0)return 0;
    let weighted=0,weightSum=0;
    for(const row of rows){
      const age=Math.max(0,at-row.p.lastAt);
      const freshness=Math.exp(-age/(36*60*60*1000));
      const transferWeight=Math.pow((row.similarity-.5)/.5,1.7)*freshness*clamp(row.p.confidence01);
      weighted+=((row.p.success01-.5)*2*.06)*transferWeight;
      weightSum+=transferWeight;
    }
    return weightSum>0?clampSigned(weighted/weightSum,.004):0;
  }

  private contextSimilarity(a:string,b:string):number{
    const parse=(x:string)=>{
      const goal=(x.match(/^([^:]+):/)?.[1]??'none').toLowerCase();
      const bins=[...(x.matchAll(/:([unelr])([0-3])/g))].map(m=>Number(m[2]));
      return {goal,bins};
    };
    const pa=parse(a),pb=parse(b);
    let distance=pa.goal===pb.goal?0:1;
    const count=Math.max(pa.bins.length,pb.bins.length);
    for(let i=0;i<count;i++) distance+=Math.min(3,Math.abs((pa.bins[i]??1)-(pb.bins[i]??1)))/3;
    return Math.exp(-distance/1.5);
  }


  recordDevelopmentalConsequence(input:{tick:number;at?:number;action?:string;socialSignal01?:number;identityPressure01?:number;selfChange01?:number;causalSignal01?:number;evidenceQuality01?:number;futureSelfDelta01?:number;verified01?:boolean;sourceMomentId?:string|null;summary?:string}){
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const latest=this.state.moments.at(-1);
    const row:P84DevelopmentalConsequence={
      id:`dev-consequence:${input.tick}:${this.state.revision}:${stable(`${input.tick}|${input.action??'none'}|${at}|${input.sourceMomentId??latest?.id??''}`)}`,
      at,tick:Math.max(0,Math.floor(input.tick)),action:clean(input.action??'none',64)||'none',
      socialSignal01:clamp(input.socialSignal01??0),identityPressure01:clamp(input.identityPressure01??0),
      selfChange01:clamp(input.selfChange01??0),causalSignal01:clamp(input.causalSignal01??0),
      evidenceQuality01:clamp(input.evidenceQuality01??0),futureSelfDelta01:Number.isFinite(input.futureSelfDelta01)?Number(input.futureSelfDelta01):0,
      verified01:Boolean(input.verified01),sourceMomentId:input.sourceMomentId??latest?.id??null,
      summary:clean(input.summary??'developmental-consequence')
    };
    const previous=this.state.developmentalConsequences[0];
    if(previous && previous.id===row.id) return structuredClone(previous);
    this.state.developmentalConsequences=[row,...this.state.developmentalConsequences.filter(x=>x.id!==row.id)].slice(0,96);
    this.state.selfChangeLoad01=clamp(this.state.selfChangeLoad01*.92+row.selfChange01*.05+row.socialSignal01*.03);
    this.state.causalContinuity01=clamp(this.state.causalContinuity01*.94+row.causalSignal01*.03+row.evidenceQuality01*.03);
    this.state.socialBinding01=clamp(this.state.socialBinding01*.94+row.socialSignal01*.06);
    this.state.carryoverRevision+=1;
    return structuredClone(row);
  }

  developmentalConsequencesRecent(limit=12){
    return this.state.developmentalConsequences.slice(0,Math.max(1,Math.min(32,Math.floor(limit)))).map(x=>structuredClone(x));
  }

  developmentalSummary(){
    const rows=this.state.developmentalConsequences;
    const mean=(key:keyof Pick<P84DevelopmentalConsequence,'socialSignal01'|'identityPressure01'|'selfChange01'|'causalSignal01'|'evidenceQuality01'>)=>rows.length?rows.reduce((sum,x)=>sum+Number(x[key]),0)/rows.length:0;
    return {count:rows.length,socialSignal01:mean('socialSignal01'),identityPressure01:mean('identityPressure01'),selfChange01:mean('selfChange01'),causalSignal01:mean('causalSignal01'),evidenceQuality01:mean('evidenceQuality01'),verifiedCount:rows.filter(x=>x.verified01).length,carryoverRevision:this.state.carryoverRevision};
  }

  actionOutcomeSnapshot(){return structuredClone(this.state.actionOutcomeProfiles);}
  contextualActionOutcomeSnapshot(){return structuredClone(this.state.contextualOutcomeProfiles);}

  recent(limit=16){const n=Math.max(1,Math.min(this.state.moments.length,Math.floor(limit)));return this.state.moments.slice(-n).reverse();}
  summary(){return{
    version:5,
    revision:this.state.revision,
    momentCount:this.state.moments.length,
    lifeContinuity01:this.state.lifeContinuity01,
    causalContinuity01:this.state.causalContinuity01,
    autobiographicalIntegrity01:this.state.autobiographicalIntegrity01,
    lastTick:this.state.lastTick,
    lastRealityHash:this.state.lastRealityHash,
    lastMomentId:this.state.lastMomentId,
    transitionCount:this.state.transitionCount,
    identityChangeCount:this.state.identityChangeCount,
    selfChangeLoad01:this.state.selfChangeLoad01,
    memoryBinding01:this.state.memoryBinding01,
    beliefContinuity01:this.state.beliefContinuity01,
    socialBinding01:this.state.socialBinding01,
    carryoverRevision:this.state.carryoverRevision,
    actionOutcomeCount:Object.keys(this.state.actionOutcomeProfiles).length,
    evidenceQuality01:this.state.moments.at(-1)?.evidenceQuality01??0,
    counterEvidence01:this.state.moments.at(-1)?.counterEvidence01??0,
  };}
}
