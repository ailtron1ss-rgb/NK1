import { randomUUID } from 'node:crypto';

export interface QuarantineRecord { id:string; source:string; reason:string; payloadHash:string; at:number; }
export interface CognitiveReviewRecord {
  id:string; source:string; status:'accept'|'review'|'quarantine'; reason:string;
  confidence01:number; evidence01:number; contradiction01:number; identityCritical:boolean; at:number;
}
export interface CognitiveImmuneInspectionOptions { sourceAttested?:boolean; attestedSource?:string; }
export interface CognitiveHealthClaim {
  id?:string; kind?:string; confidence01?:number; supportCount?:number;
  status?:string; resolved?:boolean; source?:string;
}
export interface CognitiveHealthSkill {
  id?:string; uses?:number; successes?:number; failures?:number; successRate?:number;
  status?:string; validatedUses?:number; independentEvidenceUses?:number;
}
export interface CognitiveHealthInput {
  tick:number; at?:number;
  epistemic?:{
    claimsData?:CognitiveHealthClaim[]; resolvedPredictions?:number;
    meanPredictionError01?:number; meanConfidence01?:number;
  };
  contradictions?:{claims?:Array<{status?:string}>; unresolvedCount?:number};
  skills?:{skills?:CognitiveHealthSkill[]};
}
export type CognitiveHealthSeverity='review'|'critical';
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
  reason:string; recommendedAction:string;
  review?:{verdict:'confirmed'|'false-positive'|'recovered';reviewer:string;evidenceRef?:string;at:number};
}
export interface CognitiveHealthSample {
  tick:number; at:number; score01:number;
  metrics:Record<CognitiveHealthMetricKey,CognitiveHealthMetric>;
}
export interface CognitiveHealthState {
  version:1; inspections:number; lastTick:number; lastAt:number; score01:number;
  samples:CognitiveHealthSample[]; signals:CognitiveHealthSignal[];
  highStreaks:Partial<Record<CognitiveHealthMetricKey,number>>;
  lowStreaks:Partial<Record<CognitiveHealthMetricKey,number>>;
}
export interface CognitiveHealthInspectionResult {
  tick:number; score01:number;
  metrics:Record<CognitiveHealthMetricKey,CognitiveHealthMetric>;
  activeSignals:CognitiveHealthSignal[];
  newSignals:CognitiveHealthSignal[];
  recoveredSignals:CognitiveHealthSignal[];
  recommendedAction:'continue'|'review-evidence'|'pause-risky-learning';
}
export interface CognitiveImmuneState {
  trustedSources:Record<string,number>; quarantine:QuarantineRecord[];
  rejectedCount:number; validatedCount:number; reviewQueue:CognitiveReviewRecord[];
  reviewedCount:number; health:CognitiveHealthState;
}

const clamp=(x:unknown)=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
const hash=(value:string)=>{
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16);
};
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
  version:1,inspections:0,lastTick:0,lastAt:0,score01:1,samples:[],signals:[],
  highStreaks:{},lowStreaks:{}
});
export const defaultCognitiveImmune=():CognitiveImmuneState=>({
  trustedSources:{system:.98,user:.72,world:.82,model:.55,tool:.68},
  quarantine:[],rejectedCount:0,validatedCount:0,reviewQueue:[],reviewedCount:0,
  health:defaultCognitiveHealthState()
});
function restoreHealth(raw?:Partial<CognitiveHealthState>):CognitiveHealthState {
  const d=defaultCognitiveHealthState(),r:any=raw??{};
  const signals=Array.isArray(r.signals)?r.signals.slice(-64).filter((s:any)=>s&&HEALTH_METRICS.includes(s.metric)).map((s:any)=>({
    ...s,id:String(s.id??''),metric:s.metric,severity:s.severity==='critical'?'critical':'review',
    status:['open','acknowledged','recovered','dismissed'].includes(s.status)?s.status:'open',
    value01:clamp(s.value01),threshold01:clamp(s.threshold01),baseline01:clamp(s.baseline01),
    consecutiveSamples:Math.max(0,Math.floor(Number(s.consecutiveSamples??0))),
    occurrences:Math.max(1,Math.floor(Number(s.occurrences??1))),
    firstSeenAt:Math.max(0,Number(s.firstSeenAt??0)),lastSeenAt:Math.max(0,Number(s.lastSeenAt??0)),
    recoveredAt:Number.isFinite(Number(s.recoveredAt))?Number(s.recoveredAt):undefined,
    reason:String(s.reason??'').slice(0,240),recommendedAction:String(s.recommendedAction??'').slice(0,180),
    review:s.review&&typeof s.review==='object'?{
      verdict:['confirmed','false-positive','recovered'].includes(s.review.verdict)?s.review.verdict:'confirmed',
      reviewer:String(s.review.reviewer??'').slice(0,80),
      evidenceRef:s.review.evidenceRef?String(s.review.evidenceRef).slice(0,160):undefined,
      at:Math.max(0,Number(s.review.at??0))
    }:undefined
  })): [];
  const samples=Array.isArray(r.samples)?r.samples.slice(-64).map((s:any)=>({
    tick:Math.max(0,Math.floor(Number(s.tick??0))),at:Math.max(0,Number(s.at??0)),
    score01:clamp(s.score01),metrics:(s.metrics&&typeof s.metrics==='object'?s.metrics:{}) as any
  })): [];
  const streaks=(rawValue:any)=>Object.fromEntries(HEALTH_METRICS.map(k=>[k,Math.max(0,Math.min(128,Math.floor(Number(rawValue?.[k]??0))))]));
  return {
    ...d,...r,version:1,inspections:Math.max(0,Math.floor(Number(r.inspections??0))),
    lastTick:Math.max(0,Math.floor(Number(r.lastTick??0))),lastAt:Math.max(0,Number(r.lastAt??0)),
    score01:clamp(r.score01??1),samples,signals,
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
    const at=Math.max(0,Number(input.at??Date.now()));
    const tick=Math.max(0,Math.floor(Number(input.tick??0)));
    const claims=Array.isArray(input.epistemic?.claimsData)?input.epistemic!.claimsData!.slice(0,256):[];
    const beliefs=claims.filter(c=>c.kind==='belief'&&c.status!=='resolved');
    const staleBeliefs=beliefs.filter(c=>c.status==='stale'||c.status==='expired').length;
    const openContradictions=Array.isArray(input.contradictions?.claims)
      ?input.contradictions!.claims!.filter(c=>c.status==='open').length
      :Math.max(0,Math.floor(Number(input.contradictions?.unresolvedCount??0)));
    const contradictionTotal=Array.isArray(input.contradictions?.claims)?input.contradictions!.claims!.length:openContradictions;
    const predictions=Math.max(0,Math.floor(Number(input.epistemic?.resolvedPredictions??0)));
    const skills=(Array.isArray(input.skills?.skills)?input.skills!.skills!:[])
      .filter(s=>s.status!=='disabled'&&Number(s.uses??0)>=6);
    const skillUses=skills.reduce((n,s)=>n+Math.max(0,Number(s.uses??0)),0);
    const skillFailures=skills.reduce((n,s)=>n+Math.max(0,Number(s.failures??Math.round((1-clamp(s.successRate))*Number(s.uses??0)))),0);
    const beliefEligible=beliefs.length>=3;
    const contradictionEligible=contradictionTotal>=2;
    const predictionEligible=predictions>=3;
    const skillEligible=skills.length>=2&&skillUses>=12;
    const certaintyClaims=claims.filter(c=>(c.kind==='belief'||c.kind==='inference')&&(c.status==='active'||c.status==='stale'));
    const unsupported=certaintyClaims.filter(c=>clamp(c.confidence01)>=.85&&Number(c.supportCount??1)<=1).length;
    const certaintyEligible=certaintyClaims.length>=8;
    const confidences=claims.slice(0,32).map(c=>clamp(c.confidence01));
    const mean=confidences.length?confidences.reduce((a,b)=>a+b,0)/confidences.length:0;
    const variance=confidences.length?confidences.reduce((n,x)=>n+(x-mean)**2,0)/confidences.length:0;
    const instabilityEligible=confidences.length>=8;
    const metrics=emptyMetrics();
    const raw:Record<CognitiveHealthMetricKey,{value:number;threshold:number;count:number;eligible:boolean}>={
      'belief-staleness':{value:beliefEligible?staleBeliefs/beliefs.length:0,threshold:.35,count:beliefs.length,eligible:beliefEligible},
      'contradiction-pressure':{value:contradictionEligible?openContradictions/Math.max(3,contradictionTotal):0,threshold:.25,count:contradictionTotal,eligible:contradictionEligible},
      'prediction-calibration':{value:predictionEligible?clamp(input.epistemic?.meanPredictionError01):0,threshold:.55,count:predictions,eligible:predictionEligible},
      'procedural-skill-degradation':{value:skillEligible?skillFailures/Math.max(1,skillUses):0,threshold:.42,count:skills.length,eligible:skillEligible},
      'unsupported-confidence':{value:certaintyEligible?unsupported/certaintyClaims.length:0,threshold:.7,count:certaintyClaims.length,eligible:certaintyEligible},
      'confidence-instability':{value:instabilityEligible?Math.sqrt(variance):0,threshold:.38,count:confidences.length,eligible:instabilityEligible}
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
    const newSignals:CognitiveHealthSignal[]=[],recoveredSignals:CognitiveHealthSignal[]=[];
    const signals=[...this.state.health.signals];
    const highStreaks={...this.state.health.highStreaks},lowStreaks={...this.state.health.lowStreaks};
    const reasons:Record<CognitiveHealthMetricKey,string>={
      'belief-staleness':'A sustained share of active beliefs is stale or expired; verify supporting evidence before reuse.',
      'contradiction-pressure':'Open contradictions are accumulating relative to the tracked contradiction set.',
      'prediction-calibration':'Resolved predictions show persistently high absolute prediction error.',
      'procedural-skill-degradation':'Mature procedural skills have a sustained decline in observed success rate.',
      'unsupported-confidence':'Many active inferences or beliefs have high confidence but only one support.',
      'confidence-instability':'Recent epistemic claims show unusually dispersed confidence estimates.'
    };
    const actions:Record<CognitiveHealthMetricKey,string>={
      'belief-staleness':'Schedule evidence refresh and keep stale beliefs distinguishable from current observations.',
      'contradiction-pressure':'Reconcile the competing claims with independent evidence; do not delete either claim.',
      'prediction-calibration':'Run a held-out calibration check and retain prediction/outcome pairs.',
      'procedural-skill-degradation':'Pause automatic skill promotion; inspect recent failures and test on a separate context.',
      'unsupported-confidence':'Require independent corroboration before promoting these claims to durable beliefs.',
      'confidence-instability':'Inspect calibration and source lineage; avoid globally changing source trust.'
    };
    for(const key of HEALTH_METRICS){
      const metric=metrics[key],high=metric.eligible&&metric.value01>=metric.threshold01;
      const streak=high?Number(highStreaks[key]??0)+1:0;
      highStreaks[key]=streak;lowStreaks[key]=high?0:Number(lowStreaks[key]??0)+1;
      const existing=signals.find(s=>s.metric===key&&s.status==='open');
      if(high&&streak>=2){
        const severity:CognitiveHealthSeverity=streak>=4&&metric.value01>=metric.threshold01+.25?'critical':'review';
        if(existing){
          existing.value01=metric.value01;existing.baseline01=metric.baseline01;
          existing.lastSeenAt=at;existing.consecutiveSamples=streak;existing.occurrences++;
          existing.severity=severity;existing.reason=reasons[key];existing.recommendedAction=actions[key];
        }else{
          const signal:CognitiveHealthSignal={
            id:`cognitive-health:${key}:${tick}:${this.state.health.inspections+1}`,
            metric:key,severity,status:'open',value01:metric.value01,threshold01:metric.threshold01,
            baseline01:metric.baseline01,consecutiveSamples:streak,occurrences:1,
            firstSeenAt:at,lastSeenAt:at,reason:reasons[key],recommendedAction:actions[key]
          };
          signals.unshift(signal);newSignals.push(signal);
        }
      }else if(existing&&lowStreaks[key]>=3){
        existing.status='recovered';existing.recoveredAt=at;existing.lastSeenAt=at;
        recoveredSignals.push(existing);
      }
    }
    const next:CognitiveHealthState={
      version:1,inspections:this.state.health.inspections+1,lastTick:tick,lastAt:at,score01,
      samples:[...this.state.health.samples,{tick,at,score01,metrics}].slice(-64),
      signals:signals.slice(0,64),highStreaks,lowStreaks
    };
    this.state.health=next;
    const activeSignals=signals.filter(s=>s.status==='open'||s.status==='acknowledged');
    const result:CognitiveHealthInspectionResult={
      tick,score01,metrics:structuredClone(metrics),activeSignals:structuredClone(activeSignals),
      newSignals:structuredClone(newSignals),recoveredSignals:structuredClone(recoveredSignals),
      recommendedAction:activeSignals.some(s=>s.severity==='critical')?'pause-risky-learning'
        :activeSignals.length?'review-evidence':'continue'
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
    return true;
  }
  healthSnapshot(){return structuredClone(this.state.health);}
  summary(){
    const health=this.state.health,active=health.signals.filter(s=>s.status==='open'||s.status==='acknowledged');
    return {
      quarantineCount:this.state.quarantine.length,rejectedCount:this.state.rejectedCount,
      validatedCount:this.state.validatedCount,reviewQueueCount:this.state.reviewQueue.length,
      reviewedCount:this.state.reviewedCount,trustedSources:{...this.state.trustedSources},
      cognitiveHealth01:health.score01,healthInspections:health.inspections,
      activeHealthSignals:active.length,criticalHealthSignals:active.filter(s=>s.severity==='critical').length
    };
  }
  snapshot(){return structuredClone(this.state);}
}
