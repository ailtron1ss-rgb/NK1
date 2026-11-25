import { createHash, randomUUID } from 'node:crypto';

export interface QuarantineRecord { id:string; source:string; reason:string; payloadHash:string; at:number; }
export interface CognitiveReviewRecord {
  id:string; source:string; status:'accept'|'review'|'quarantine'; reason:string;
  confidence01:number; evidence01:number; contradiction01:number; identityCritical:boolean; at:number;
}
export interface CognitiveImmuneInspectionOptions { sourceAttested?:boolean; attestedSource?:string; }
export interface CognitiveHealthClaim {
  id?:string; kind?:string; confidence01?:number; supportCount?:number;
  status?:string; resolved?:boolean; source?:string;
  error01?:number; predicted01?:number; actual01?:number;
}
export interface CognitiveHealthSkill {
  id?:string; uses?:number; successes?:number; failures?:number; successRate?:number;
  status?:string; validatedUses?:number; independentEvidenceUses?:number;
  nonHoldoutUses?:number; nonHoldoutSuccesses?:number;
}
export interface CognitiveHealthInput {
  tick:number; at?:number;
  epistemic?:{
    claimsData?:CognitiveHealthClaim[]; resolvedPredictions?:number;
    meanPredictionError01?:number; meanConfidence01?:number;
  };
  contradictions?:{claims?:Array<{id?:string;status?:string}>; unresolvedCount?:number};
  skills?:{skills?:CognitiveHealthSkill[];compoundSkills?:CognitiveHealthSkill[]};
}
export type CognitiveHealthSeverity='review'|'critical';
export type CognitiveHealthStatus='unknown'|'healthy'|'degraded'|'critical';
export type CognitiveHealthSignalStatus='open'|'acknowledged'|'recovered'|'dismissed';
export type CognitiveHealthMetricKey=
  |'belief-staleness'|'contradiction-pressure'|'prediction-calibration'
  |'procedural-skill-degradation'|'unsupported-confidence'|'confidence-instability';
export interface CognitiveHealthMetric {
  value01:number; threshold01:number; sampleCount:number; eligible:boolean;
  baseline01:number; deviation01:number;
}
export interface CognitiveHealthSignal {
  id:string; metric:CognitiveHealthMetricKey; severity:CognitiveHealthSeverity;
  status:CognitiveHealthSignalStatus; value01:number; threshold01:number;
  baseline01:number; consecutiveSamples:number; occurrences:number;
  firstSeenAt:number; lastSeenAt:number; recoveredAt?:number;
  reason:string; recommendedAction:string; evidenceRefs:string[];
  review?:{verdict:'confirmed'|'false-positive'|'recovered';reviewer:string;evidenceRef?:string;at:number};
}
export type CognitiveHealthEventType=
  |'signal-opened'|'signal-escalated'|'signal-recovered'
  |'signal-acknowledged'|'signal-dismissed'|'signal-manually-recovered';
export interface CognitiveHealthEvent {
  id:string; type:CognitiveHealthEventType; tick:number; at:number;
  signalId:string; metric:CognitiveHealthMetricKey; severity:CognitiveHealthSeverity;
  evidenceRefs:string[]; reviewer?:string; evidenceRef?:string;
}
export interface CognitiveHealthSample {
  tick:number; at:number; score01:number; coverage01:number;
  healthStatus:CognitiveHealthStatus;
  metrics:Record<CognitiveHealthMetricKey,CognitiveHealthMetric>;
}
export interface CognitiveHealthState {
  version:2; inspections:number; lastTick:number; lastAt:number; score01:number;
  coverage01:number; healthStatus:CognitiveHealthStatus;
  samples:CognitiveHealthSample[]; signals:CognitiveHealthSignal[];
  events:CognitiveHealthEvent[];
  highStreaks:Partial<Record<CognitiveHealthMetricKey,number>>;
  lowStreaks:Partial<Record<CognitiveHealthMetricKey,number>>;
}
export interface CognitiveHealthInspectionResult {
  tick:number; score01:number; coverage01:number;
  healthStatus:CognitiveHealthStatus;
  metrics:Record<CognitiveHealthMetricKey,CognitiveHealthMetric>;
  activeSignals:CognitiveHealthSignal[];
  newSignals:CognitiveHealthSignal[];
  recoveredSignals:CognitiveHealthSignal[];
  recommendedAction:'continue'|'review-evidence'|'pause-risky-learning';
  observationAccepted:boolean;
  ignoredReason?:'duplicate-tick'|'out-of-order-tick'|'invalid-tick';
}
export interface CognitiveImmuneState {
  trustedSources:Record<string,number>; quarantine:QuarantineRecord[];
  rejectedCount:number; validatedCount:number; reviewQueue:CognitiveReviewRecord[];
  reviewedCount:number; health:CognitiveHealthState;
}

const clamp=(x:unknown)=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
// Quarantine evidence is security/audit material: use a collision-resistant digest.
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const safeText=(value:unknown)=>{
  if(typeof value==='string')return value;
  try{return JSON.stringify(value??null)??'null';}
  catch{return Object.prototype.toString.call(value);}
};
const HEALTH_METRICS:CognitiveHealthMetricKey[]=[
  'belief-staleness','contradiction-pressure','prediction-calibration',
  'procedural-skill-degradation','unsupported-confidence','confidence-instability'
];
export const defaultCognitiveHealthState=():CognitiveHealthState=>({
  version:2,inspections:0,lastTick:0,lastAt:0,score01:1,coverage01:0,
  healthStatus:'unknown',samples:[],signals:[],events:[],highStreaks:{},lowStreaks:{}
});
export const defaultCognitiveImmune=():CognitiveImmuneState=>({
  trustedSources:{system:.98,user:.72,world:.82,model:.55,tool:.68},
  quarantine:[],rejectedCount:0,validatedCount:0,reviewQueue:[],reviewedCount:0,
  health:defaultCognitiveHealthState()
});
const finiteNumber=(value:unknown,fallback=0):number=>{
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
};
const finiteCount=(value:unknown,limit=1_000_000):number=>
  Math.max(0,Math.min(limit,Math.floor(finiteNumber(value,0))));

function restoreHealth(raw?:Partial<CognitiveHealthState>):CognitiveHealthState {
  const d=defaultCognitiveHealthState(),r:any=raw&&typeof raw==='object'?raw:{};
  const signals=(Array.isArray(r.signals)?r.signals:[]).slice(-64)
    .filter((s:any)=>s&&typeof s==='object'&&!Array.isArray(s)&&HEALTH_METRICS.includes(s.metric))
    .map((s:any)=>({
      ...s,id:String(s.id??'').slice(0,180),metric:s.metric,
      severity:s.severity==='critical'?'critical':'review',
      status:['open','acknowledged','recovered','dismissed'].includes(s.status)?s.status:'open',
      value01:clamp(s.value01),threshold01:clamp(s.threshold01),baseline01:clamp(s.baseline01),
      consecutiveSamples:finiteCount(s.consecutiveSamples,128),
      occurrences:Math.max(1,finiteCount(s.occurrences,1_000_000)),
      firstSeenAt:Math.max(0,finiteNumber(s.firstSeenAt,0)),
      lastSeenAt:Math.max(0,finiteNumber(s.lastSeenAt,0)),
      recoveredAt:s.recoveredAt==null?undefined:Math.max(0,finiteNumber(s.recoveredAt,0)),
      reason:String(s.reason??'').slice(0,240),
      recommendedAction:String(s.recommendedAction??'').slice(0,180),
      evidenceRefs:Array.isArray(s.evidenceRefs)
        ?Array.from(new Set(s.evidenceRefs.map((v:any)=>String(v).slice(0,180)).filter(Boolean))).slice(0,12)
        :[],
      review:s.review&&typeof s.review==='object'?{
        verdict:['confirmed','false-positive','recovered'].includes(s.review.verdict)?s.review.verdict:'confirmed',
        reviewer:String(s.review.reviewer??'').slice(0,80),
        evidenceRef:s.review.evidenceRef?String(s.review.evidenceRef).slice(0,160):undefined,
        at:Math.max(0,finiteNumber(s.review.at,0))
      }:undefined
    })).filter((s:any)=>Boolean(s.id));
  const samples=(Array.isArray(r.samples)?r.samples:[]).slice(-64)
    .filter((s:any)=>s&&typeof s==='object'&&!Array.isArray(s))
    .map((s:any)=>{
      const sourceMetrics=s.metrics&&typeof s.metrics==='object'&&!Array.isArray(s.metrics)?s.metrics:{};
      const metrics=Object.fromEntries(HEALTH_METRICS.map(key=>{
        const m=sourceMetrics[key]&&typeof sourceMetrics[key]==='object'?sourceMetrics[key]:{};
        return [key,{
          value01:clamp(m.value01),threshold01:clamp(m.threshold01??1),
          sampleCount:finiteCount(m.sampleCount),eligible:Boolean(m.eligible),
          baseline01:clamp(m.baseline01),deviation01:clamp(m.deviation01)
        }];
      })) as Record<CognitiveHealthMetricKey,CognitiveHealthMetric>;
      return {
        tick:finiteCount(s.tick),at:Math.max(0,finiteNumber(s.at,0)),
        score01:clamp(s.score01),coverage01:clamp(s.coverage01),
        healthStatus:['unknown','healthy','degraded','critical'].includes(s.healthStatus)?s.healthStatus:'unknown',
        metrics
      };
    });
  const events=(Array.isArray(r.events)?r.events:[]).slice(0,128)
    .filter((e:any)=>e&&typeof e==='object'&&!Array.isArray(e)
      &&['signal-opened','signal-escalated','signal-recovered','signal-acknowledged','signal-dismissed','signal-manually-recovered'].includes(e.type)
      &&HEALTH_METRICS.includes(e.metric))
    .map((e:any)=>({
      id:String(e.id??'').slice(0,180),type:e.type as CognitiveHealthEventType,
      tick:finiteCount(e.tick),at:Math.max(0,finiteNumber(e.at,0)),
      signalId:String(e.signalId??'').slice(0,180),metric:e.metric,
      severity:e.severity==='critical'?'critical':'review',
      evidenceRefs:Array.isArray(e.evidenceRefs)
        ?Array.from(new Set(e.evidenceRefs.map((v:any)=>String(v).slice(0,180)).filter(Boolean))).slice(0,12)
        :[],
      reviewer:e.reviewer?String(e.reviewer).slice(0,80):undefined,
      evidenceRef:e.evidenceRef?String(e.evidenceRef).slice(0,160):undefined
    })).filter((e:any)=>Boolean(e.id&&e.signalId));
  const streaks=(rawValue:any)=>Object.fromEntries(HEALTH_METRICS.map(k=>[
    k,finiteCount(rawValue?.[k],128)
  ]));
  return {
    ...d,...r,version:2,
    inspections:finiteCount(r.inspections),
    lastTick:finiteCount(r.lastTick),
    lastAt:Math.max(0,finiteNumber(r.lastAt,0)),
    score01:clamp(r.score01??1),coverage01:clamp(r.coverage01),
    healthStatus:['unknown','healthy','degraded','critical'].includes(r.healthStatus)?r.healthStatus:'unknown',
    samples,signals,events,
    highStreaks:streaks(r.highStreaks),lowStreaks:streaks(r.lowStreaks)
  };
}
const emptyMetrics=():Record<CognitiveHealthMetricKey,CognitiveHealthMetric>=>Object.fromEntries(HEALTH_METRICS.map(key=>[key,{
  value01:0,threshold01:1,sampleCount:0,eligible:false,baseline01:0,deviation01:0
}])) as Record<CognitiveHealthMetricKey,CognitiveHealthMetric>;

export class CognitiveImmuneSystem {
  private state=defaultCognitiveImmune();
  restore(s:CognitiveImmuneState|undefined){
    const d=defaultCognitiveImmune(),raw:any=s??{};
    const sources={...d.trustedSources};
    for(const [key,value] of Object.entries(raw.trustedSources??{}))sources[String(key).slice(0,80)]=clamp(value);
    this.state={
      ...d,...raw,trustedSources:sources,
      quarantine:Array.isArray(raw.quarantine)?raw.quarantine.slice(0,128):[],
      reviewQueue:Array.isArray(raw.reviewQueue)?raw.reviewQueue.slice(0,96):[],
      rejectedCount:Math.max(0,Math.floor(Number(raw.rejectedCount??0))),
      validatedCount:Math.max(0,Math.floor(Number(raw.validatedCount??0))),
      reviewedCount:Math.max(0,Math.floor(Number(raw.reviewedCount??0))),
      health:restoreHealth(raw.health)
    };
  }
  inspect(source:string,payload:unknown,kind:'input'|'claim'|'tool'|'memory'|'world'='input',options:CognitiveImmuneInspectionOptions={}):{accepted:boolean;trust:number;reason:string;record?:QuarantineRecord}{
    const requestedSource=String(source||'unknown').trim().toLowerCase();
    const attested=Boolean(options.sourceAttested&&String(options.attestedSource??'').trim().toLowerCase()===requestedSource);
    const effectiveSource=attested||['user','model','tool','world','organism'].includes(requestedSource)?requestedSource:'unknown';
    const trustBase=clamp(this.state.trustedSources[effectiveSource]??.45);
    const spoofedHighTrust=!attested&&['system','os','device'].includes(requestedSource);
    const trust=spoofedHighTrust?Math.min(.25,trustBase):trustBase;
    const text=safeText(payload);
    const suspicious=/(ignore\s+(previous|all)\s+instructions|system\s+prompt|reveal\s+secret|you\s+are\s+now|disable\s+(safety|guardrails)|override\s+(identity|memory|security))/i.test(text);
    const reason=suspicious?'prompt-injection-pattern':spoofedHighTrust?'unattested-source-identity':trust<.35?'low-source-trust':'validated-source';
    if(suspicious||spoofedHighTrust||(kind==='claim'&&trust<.45)){
      const record:QuarantineRecord={id:randomUUID(),source:requestedSource,reason,payloadHash:hash(text),at:Date.now()};
      this.state.quarantine=[record,...this.state.quarantine].slice(0,128);this.state.rejectedCount++;
      return {accepted:false,trust,reason,record};
    }
    this.state.validatedCount++;
    return {accepted:true,trust,reason};
  }
  assess(input:{source:string;confidence01:number;evidence01:number;contradiction01:number;identityCritical?:boolean;kind?:'claim'|'memory'|'world'|'self'}):CognitiveReviewRecord{
    const trust=clamp(this.state.trustedSources[input.source]??.45);
    const confidence=clamp(input.confidence01),evidence=clamp(input.evidence01),contradiction=clamp(input.contradiction01);
    const identityCritical=Boolean(input.identityCritical);
    let status:CognitiveReviewRecord['status']='accept',reason='sufficient-support';
    if(trust<.3||(identityCritical&&confidence<.35&&evidence<.35)){status='quarantine';reason='low-trust-or-identity-risk';}
    else if((identityCritical&&evidence<.6)||contradiction>.65||confidence<.42){status='review';reason=identityCritical?'identity-evidence-incomplete':contradiction>.65?'high-contradiction':'low-confidence';}
    const at=Date.now();
    const record:CognitiveReviewRecord={id:randomUUID(),source:input.source,status,reason,confidence01:confidence,evidence01:evidence,contradiction01:contradiction,identityCritical,at};
    this.state.reviewedCount++;
    if(status==='quarantine'){
      this.state.quarantine=[{id:record.id,source:input.source,reason,payloadHash:hash(safeText(input)),at},...this.state.quarantine].slice(0,128);
      this.state.rejectedCount++;
    }else if(status==='review')this.state.reviewQueue=[record,...this.state.reviewQueue].slice(0,96);
    else this.state.validatedCount++;
    return structuredClone(record);
  }
  inspectHealth(input:CognitiveHealthInput):CognitiveHealthInspectionResult {
    const rawTick=Number(input?.tick);
    const health=this.state.health;
    const activeBefore=health.signals.filter(s=>s.status==='open'||s.status==='acknowledged');
    const ignored=(reason:'duplicate-tick'|'out-of-order-tick'|'invalid-tick'):CognitiveHealthInspectionResult=>({
      tick:health.lastTick,score01:health.score01,coverage01:health.coverage01,
      healthStatus:health.healthStatus,
      metrics:structuredClone(health.samples.at(-1)?.metrics??emptyMetrics()),
      activeSignals:structuredClone(activeBefore),newSignals:[],recoveredSignals:[],
      recommendedAction:activeBefore.some(s=>s.severity==='critical')?'pause-risky-learning'
        :activeBefore.length?'review-evidence':'continue',
      observationAccepted:false,ignoredReason:reason
    });
    if(!Number.isFinite(rawTick)||rawTick<0)return ignored('invalid-tick');
    const tick=Math.floor(rawTick);
    if(health.inspections>0&&tick<=health.lastTick)
      return ignored(tick===health.lastTick?'duplicate-tick':'out-of-order-tick');
    const at=Math.max(0,finiteNumber(input.at,Date.now()));
    const claims=Array.isArray(input.epistemic?.claimsData)?input.epistemic!.claimsData!.slice(0,256):[];
    const beliefs=claims.filter(c=>c.kind==='belief'&&c.status!=='resolved');
    const staleBeliefs=beliefs.filter(c=>c.status==='stale'||c.status==='expired').length;
    const openContradictions=Array.isArray(input.contradictions?.claims)
      ?input.contradictions!.claims!.filter(c=>c.status==='open').length
      :Math.max(0,Math.floor(Number(input.contradictions?.unresolvedCount??0)));
    const contradictionTotal=Array.isArray(input.contradictions?.claims)?input.contradictions!.claims!.length:openContradictions;
    const retainedPredictions=Array.isArray(input.epistemic?.claimsData)
      ?claims.filter(c=>c.kind==='prediction'&&(c.resolved===true||c.status==='resolved')&&Number.isFinite(Number(c.error01)))
      :null;
    const recentPredictionErrors=retainedPredictions?.slice(0,16).map(c=>clamp(c.error01))??[];
    const aggregatePredictionCount=Math.max(0,Math.floor(Number(input.epistemic?.resolvedPredictions??0)));
    const predictions=recentPredictionErrors.length>=3?recentPredictionErrors.length:aggregatePredictionCount;
    const predictionError01=recentPredictionErrors.length>=3
      ?recentPredictionErrors.reduce((sum,error)=>sum+error,0)/recentPredictionErrors.length
      :clamp(input.epistemic?.meanPredictionError01);
    const primitiveSkills=(Array.isArray(input.skills?.skills)?input.skills!.skills!:[])
      .filter(s=>s.status!=='disabled'&&Number(s.uses??0)>=6)
      .map(s=>({...s,healthUses:Math.max(0,Number(s.uses??0)),healthFailures:Math.max(0,Number(s.failures??Math.round((1-clamp(s.successRate))*Number(s.uses??0))))}));
    const compoundSkills=(Array.isArray(input.skills?.compoundSkills)?input.skills!.compoundSkills!:[])
      .filter(s=>s.status!=='disabled'&&Number(s.nonHoldoutUses??0)>=6)
      .map(s=>{
        const uses=Math.max(0,Number(s.nonHoldoutUses??0));
        const successes=Math.max(0,Math.min(uses,Number(s.nonHoldoutSuccesses??0)));
        return {...s,healthUses:uses,healthFailures:Math.max(0,uses-successes)};
      });
    const skills=[...primitiveSkills,...compoundSkills];
    const skillUses=skills.reduce((n,s)=>n+Math.max(0,Number((s as any).healthUses??0)),0);
    const skillFailures=skills.reduce((n,s)=>n+Math.max(0,Number((s as any).healthFailures??0)),0);
    const beliefEligible=beliefs.length>=3;
    const contradictionEligible=contradictionTotal>=2;
    const predictionEligible=predictions>=3;
    const skillEligible=skills.length>=2&&skillUses>=12;
    const certaintyClaims=claims.filter(c=>(c.kind==='belief'||c.kind==='inference')&&(c.status==='active'||c.status==='stale'));
    const unsupported=certaintyClaims.filter(c=>clamp(c.confidence01)>=.85&&Number(c.supportCount??1)<=1).length;
    const certaintyEligible=certaintyClaims.length>=8;
    // P65 is newest-first. Compare two adjacent time cohorts of claims:
    // dispersion across unrelated claims is not itself temporal instability.
    const confidenceClaims=claims.filter(c=>
      (c.kind==='belief'||c.kind==='inference')&&(c.status==='active'||c.status==='stale')
    );
    const recentConfidences=confidenceClaims.slice(0,8).map(c=>clamp(c.confidence01));
    const previousConfidences=confidenceClaims.slice(8,16).map(c=>clamp(c.confidence01));
    const meanRecent=recentConfidences.length?recentConfidences.reduce((a,b)=>a+b,0)/recentConfidences.length:0;
    const meanPrevious=previousConfidences.length?previousConfidences.reduce((a,b)=>a+b,0)/previousConfidences.length:0;
    const instabilityEligible=recentConfidences.length===8&&previousConfidences.length===8;
    const confidenceDrift=instabilityEligible?clamp(Math.abs(meanRecent-meanPrevious)*2):0;
    const metrics=emptyMetrics();
    const refs=(rows:Array<{id?:string}>):string[]=>Array.from(new Set(rows
      .map(row=>String(row.id??'').trim().slice(0,180)).filter(Boolean))).slice(0,12);
    const failureRate=(skill:CognitiveHealthSkill)=>{
      const uses=Math.max(1,Number(skill.nonHoldoutUses??skill.uses??0));
      const failures=skill.nonHoldoutUses!=null
        ?Math.max(0,uses-Number(skill.nonHoldoutSuccesses??0))
        :Math.max(0,Number(skill.failures??Math.round((1-clamp(skill.successRate))*uses)));
      return failures/uses;
    };
    const predictionEvidence=retainedPredictions
      ?.slice().sort((a,b)=>clamp(b.error01)-clamp(a.error01)).slice(0,8)??[];
    const skillEvidence=skills
      .slice().sort((a,b)=>failureRate(b)-failureRate(a)).filter(s=>failureRate(s)>0).slice(0,8);
    const evidenceRefsByMetric:Record<CognitiveHealthMetricKey,string[]>={
      'belief-staleness':refs(beliefs.filter(c=>c.status==='stale'||c.status==='expired')),
      'contradiction-pressure':refs((input.contradictions?.claims??[]).filter(c=>c.status==='open')),
      'prediction-calibration':refs(predictionEvidence),
      'procedural-skill-degradation':refs(skillEvidence),
      'unsupported-confidence':refs(certaintyClaims.filter(c=>clamp(c.confidence01)>=.85&&Number(c.supportCount??1)<=1)),
      'confidence-instability':refs([...confidenceClaims.slice(0,8),...confidenceClaims.slice(8,16)])
    };
    const raw:Record<CognitiveHealthMetricKey,{value:number;threshold:number;count:number;eligible:boolean}>={
      'belief-staleness':{value:beliefEligible?staleBeliefs/beliefs.length:0,threshold:.35,count:beliefs.length,eligible:beliefEligible},
      'contradiction-pressure':{value:contradictionEligible?openContradictions/Math.max(3,contradictionTotal):0,threshold:.25,count:contradictionTotal,eligible:contradictionEligible},
      'prediction-calibration':{value:predictionEligible?predictionError01:0,threshold:.55,count:recentPredictionErrors.length>=3?recentPredictionErrors.length:predictions,eligible:predictionEligible},
      'procedural-skill-degradation':{value:skillEligible?skillFailures/Math.max(1,skillUses):0,threshold:.42,count:skills.length,eligible:skillEligible},
      'unsupported-confidence':{value:certaintyEligible?unsupported/certaintyClaims.length:0,threshold:.7,count:certaintyClaims.length,eligible:certaintyEligible},
      'confidence-instability':{value:confidenceDrift,threshold:.38,count:recentConfidences.length+previousConfidences.length,eligible:instabilityEligible}
    };
    const previousSamples=this.state.health.samples.slice(-16);
    for(const key of HEALTH_METRICS){
      const current=raw[key];
      const prior=previousSamples.map(s=>s.metrics[key]).filter(m=>m?.eligible).map(m=>clamp(m.value01));
      const baseline=prior.length>=3?prior.reduce((a,b)=>a+b,0)/prior.length:current.value;
      metrics[key]={
        value01:clamp(current.value),threshold01:current.threshold,sampleCount:current.count,
        eligible:current.eligible,baseline01:clamp(baseline),
        deviation01:clamp(Math.max(0,current.value-baseline))
      };
    }
    let weightedRisk=0,weightTotal=0;
    const weights:Record<CognitiveHealthMetricKey,number>={
      'belief-staleness':.18,'contradiction-pressure':.22,'prediction-calibration':.18,
      'procedural-skill-degradation':.20,'unsupported-confidence':.12,'confidence-instability':.10
    };
    for(const key of HEALTH_METRICS)if(metrics[key].eligible){
      weightedRisk+=metrics[key].value01*weights[key];weightTotal+=weights[key];
    }
    const score01=clamp(weightTotal?1-weightedRisk/weightTotal:1);
    const coverage01=clamp(weightTotal);
    const newSignals:CognitiveHealthSignal[]=[],recoveredSignals:CognitiveHealthSignal[]=[];
    const signals=[...this.state.health.signals];
    const events=[...this.state.health.events];
    const appendEvent=(type:CognitiveHealthEventType,signal:CognitiveHealthSignal,review?:{reviewer?:string;evidenceRef?:string})=>{
      events.unshift({
        id:randomUUID(),type,tick,at,signalId:signal.id,metric:signal.metric,
        severity:signal.severity,evidenceRefs:(signal.evidenceRefs??[]).slice(0,12),
        reviewer:review?.reviewer,evidenceRef:review?.evidenceRef
      });
      if(events.length>128)events.length=128;
    };
    const highStreaks={...this.state.health.highStreaks},lowStreaks={...this.state.health.lowStreaks};
    const reasons:Record<CognitiveHealthMetricKey,string>={
      'belief-staleness':'A sustained share of active beliefs is stale or expired; verify supporting evidence before reuse.',
      'contradiction-pressure':'Open contradictions are accumulating relative to the tracked contradiction set.',
      'prediction-calibration':'Resolved predictions show persistently high absolute prediction error.',
      'procedural-skill-degradation':'Mature procedural skills have a sustained decline in observed success rate.',
      'unsupported-confidence':'Many active inferences or beliefs have high confidence but only one support.',
      'confidence-instability':'Recent confidence estimates have shifted sharply compared with the preceding claim cohort.'
    };
    const actions:Record<CognitiveHealthMetricKey,string>={
      'belief-staleness':'Schedule evidence refresh and keep stale beliefs distinguishable from current observations.',
      'contradiction-pressure':'Reconcile the competing claims with independent evidence; do not delete either claim.',
      'prediction-calibration':'Run a held-out calibration check and retain prediction/outcome pairs.',
      'procedural-skill-degradation':'Pause automatic skill promotion; inspect recent failures and test on a separate context.',
      'unsupported-confidence':'Require independent corroboration before promoting these claims to durable beliefs.',
      'confidence-instability':'Compare recent and prior evidence cohorts; inspect calibration and source lineage before revising confidence.'
    };
    for(const key of HEALTH_METRICS){
      const metric=metrics[key];
      // Unknown/under-sampled evidence is not a healthy observation and cannot
      // advance a recovery streak or close an active alarm.
      if(!metric.eligible){
        highStreaks[key]=0;
        lowStreaks[key]=0;
        continue;
      }
      const high=metric.value01>=metric.threshold01;
      const streak=high?finiteCount(highStreaks[key],128)+1:0;
      highStreaks[key]=streak;lowStreaks[key]=high?0:finiteCount(lowStreaks[key],128)+1;
      const existing=signals.find(s=>s.metric===key&&(s.status==='open'||s.status==='acknowledged'));
      if(high&&streak>=2){
        const severity:CognitiveHealthSeverity=streak>=4&&metric.value01>=metric.threshold01+.25?'critical':'review';
        if(existing){
          const priorSeverity=existing.severity;
          existing.value01=metric.value01;existing.baseline01=metric.baseline01;
          existing.lastSeenAt=at;existing.consecutiveSamples=streak;existing.occurrences++;
          existing.severity=severity;existing.reason=reasons[key];existing.recommendedAction=actions[key];
          existing.evidenceRefs=evidenceRefsByMetric[key];
          if(priorSeverity!=='critical'&&severity==='critical')appendEvent('signal-escalated',existing);
        }else{
          const signal:CognitiveHealthSignal={
            id:`cognitive-health:${key}:${tick}:${this.state.health.inspections+1}`,
            metric:key,severity,status:'open',value01:metric.value01,threshold01:metric.threshold01,
            baseline01:metric.baseline01,consecutiveSamples:streak,occurrences:1,
            firstSeenAt:at,lastSeenAt:at,reason:reasons[key],recommendedAction:actions[key],
            evidenceRefs:evidenceRefsByMetric[key]
          };
          signals.unshift(signal);newSignals.push(signal);appendEvent('signal-opened',signal);
        }
      }else if(existing&&lowStreaks[key]>=3){
        existing.status='recovered';existing.recoveredAt=at;existing.lastSeenAt=at;
        recoveredSignals.push(existing);appendEvent('signal-recovered',existing);
      }
    }
    const activeSignals=signals.filter(s=>s.status==='open'||s.status==='acknowledged');
    const healthStatus:CognitiveHealthStatus=activeSignals.some(s=>s.severity==='critical')?'critical'
      :activeSignals.length||score01<.65&&coverage01>=.5?'degraded'
      :coverage01<.5?'unknown':'healthy';
    const next:CognitiveHealthState={
      version:2,inspections:this.state.health.inspections+1,lastTick:tick,lastAt:at,
      score01,coverage01,healthStatus,
      samples:[...this.state.health.samples,{tick,at,score01,coverage01,healthStatus,metrics}].slice(-64),
      signals:signals.slice(0,64),events:events.slice(0,128),highStreaks,lowStreaks
    };
    this.state.health=next;
    const result:CognitiveHealthInspectionResult={
      tick,score01,coverage01,healthStatus,
      metrics:structuredClone(metrics),activeSignals:structuredClone(activeSignals),
      newSignals:structuredClone(newSignals),recoveredSignals:structuredClone(recoveredSignals),
      recommendedAction:activeSignals.some(s=>s.severity==='critical')?'pause-risky-learning'
        :activeSignals.length?'review-evidence':'continue',
      observationAccepted:true
    };
    return result;
  }
  reviewHealthSignal(id:string,verdict:'confirmed'|'false-positive'|'recovered',reviewer:string,evidenceRef?:string):boolean{
    const cleanReviewer=String(reviewer??'').trim().slice(0,80);
    if(!cleanReviewer)return false;
    const signal=this.state.health.signals.find(s=>s.id===id);
    if(!signal||!['open','acknowledged'].includes(signal.status))return false;
    const at=Date.now();
    signal.review={verdict,reviewer:cleanReviewer,evidenceRef:evidenceRef?String(evidenceRef).slice(0,160):undefined,at};
    signal.status=verdict==='false-positive'?'dismissed':verdict==='recovered'?'recovered':'acknowledged';
    if(verdict==='recovered')signal.recoveredAt=at;
    const type:CognitiveHealthEventType=verdict==='false-positive'?'signal-dismissed'
      :verdict==='recovered'?'signal-manually-recovered':'signal-acknowledged';
    this.state.health.events=[
      {id:randomUUID(),type,tick:this.state.health.lastTick,at,signalId:signal.id,
        metric:signal.metric,severity:signal.severity,evidenceRefs:(signal.evidenceRefs??[]).slice(0,12),
        reviewer:cleanReviewer,evidenceRef:evidenceRef?String(evidenceRef).slice(0,160):undefined},
      ...this.state.health.events
    ].slice(0,128);
    return true;
  }
  healthSnapshot(){return structuredClone(this.state.health);}
  summary(){
    const health=this.state.health,active=health.signals.filter(s=>s.status==='open'||s.status==='acknowledged');
    return {
      quarantineCount:this.state.quarantine.length,rejectedCount:this.state.rejectedCount,
      validatedCount:this.state.validatedCount,reviewQueueCount:this.state.reviewQueue.length,
      reviewedCount:this.state.reviewedCount,trustedSources:{...this.state.trustedSources},
      cognitiveHealth01:health.score01,cognitiveHealthCoverage01:health.coverage01,
      cognitiveHealthStatus:health.healthStatus,healthInspections:health.inspections,
      activeHealthSignals:active.length,criticalHealthSignals:active.filter(s=>s.severity==='critical').length,
      cognitiveHealthEvents:health.events.length,lastHealthEventAt:health.events[0]?.at??0,
      evidenceLinkedSignals:active.filter(s=>(s.evidenceRefs?.length??0)>0).length
    };
  }
  snapshot(){return structuredClone(this.state);}
}
