export type BatteryCondition = 'replay-on'|'replay-off'|'negative-control';
export type BatteryPhase = 'acquisition'|'delay'|'test'|'holdout'|'negative-control';
export type EvidenceClaimStatus = 'insufficient'|'exploratory'|'confirmatory-eligible'|'replicated'|'contradicted';
export type BatterySessionStatus = 'active'|'complete'|'incomplete';
export type EvaluatorSource = 'external-evaluator'|'manual-observer'|'synthetic-test';

export interface ReproducibilityCapsule {
  release:string;
  stateSchema:number;
  protocolHash:string;
  scheduleHash?:string;
  seed:number;
  evaluatorVersion:string;
}

export interface CognitiveBatteryProtocol {
  id:string;
  hypothesisKey:string;
  taskIds:string[];
  contextKeys:string[];
  delaysMs:number[];
  requiredMatchedPairs:number;
  requiredHoldout:number;
  randomized:boolean;
  balanced:boolean;
  blinded:boolean;
  evaluatorVersion:string;
  seed:number;
  preregistrationHash:string;
  capsule:ReproducibilityCapsule;
  createdAt:number;
}

export interface CognitiveBatteryScheduleItem {
  slotId:string;
  protocolId:string;
  sessionId:string;
  sequence:number;
  taskId:string;
  phase:BatteryPhase;
  condition:BatteryCondition;
  contextKey:string;
  pairKey:string;
  delayMs:number;
  holdout:boolean;
}

export interface CognitiveBatterySession {
  id:string;
  protocolId:string;
  scheduleHash:string;
  status:BatterySessionStatus;
  expectedSlots:number;
  recordedSlots:number;
  missingSlots:number;
  adherence01:number;
  createdAt:number;
  startedAt:number;
  sealedAt?:number;
}

export interface CognitiveBatteryCheckpoint {
  id:string;
  sessionId:string;
  phase:BatteryPhase;
  tick:number;
  runtimeStateHash:string;
  at:number;
}

export interface CognitiveTaskEvaluatorResult {
  evaluatorRunId:string;
  evaluatorVersion:string;
  source:EvaluatorSource;
  score01:number;
  baselineScore01:number;
  independentVerified:boolean;
  holdout:boolean;
  baselineEstablishedAt:number;
  outcomeRecordedAt:number;
}

export interface CognitiveBatteryTrial {
  id:string;
  protocolId:string;
  sessionId?:string;
  scheduleSlotId?:string;
  hypothesisKey:string;
  taskId:string;
  phase:BatteryPhase;
  condition:BatteryCondition;
  contextKey:string;
  pairKey?:string;
  delayMs:number;
  baselineScore01:number;
  score01:number;
  independentVerified:boolean;
  holdout:boolean;
  evaluatorVersion:string;
  evaluatorRunId?:string;
  evaluatorSource?:EvaluatorSource;
  baselineEstablishedAt:number;
  outcomeRecordedAt:number;
  at:number;
}

export interface BatteryAnalysis {
  protocolId:string;
  hypothesisKey:string;
  taskId:string;
  matchedPairs:number;
  holdoutTrials:number;
  distinctDelays:number;
  distinctContexts:number;
  completeSessions:number;
  scheduledCoverage01:number;
  meanDifference01:number|null;
  medianDifference01:number|null;
  ci95Low01:number|null;
  ci95High01:number|null;
  effectMagnitude01:number|null;
  negativeControlDifference01:number|null;
  dataQuality01:number;
  claimStatus:EvidenceClaimStatus;
  reason:string;
  analyzedAt:number;
}

export interface CognitiveResearchBatteryState {
  version:3;
  protocols:CognitiveBatteryProtocol[];
  sessions:CognitiveBatterySession[];
  schedules:CognitiveBatteryScheduleItem[];
  checkpoints:CognitiveBatteryCheckpoint[];
  trials:CognitiveBatteryTrial[];
  analyses:BatteryAnalysis[];
  counters:{protocols:number;sessions:number;trials:number;analyses:number;duplicatesBlocked:number;invalidRejected:number;checkpoints:number};
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=96)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const hash=(text:string)=>{let h=2166136261>>>0;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');};
const median=(xs:number[])=>{if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

function xorshift(seed:number){let x=(seed>>>0)||0x9e3779b9;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function bootstrapCI(values:number[],seed:number,resamples=384){
  if(values.length<2)return {low:null,high:null};
  const rnd=xorshift(seed),means:number[]=[];const n=values.length;
  for(let r=0;r<Math.min(512,Math.max(32,resamples));r++){let sum=0;for(let i=0;i<n;i++)sum+=values[Math.floor(rnd()*n)];means.push(sum/n);}
  means.sort((a,b)=>a-b);return {low:means[Math.floor(means.length*.025)],high:means[Math.floor(means.length*.975)]};
}
function shuffle<T>(values:T[],seed:number){const a=[...values],rnd=xorshift(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

export const defaultCognitiveResearchBattery=():CognitiveResearchBatteryState=>({
  version:3,protocols:[],sessions:[],schedules:[],checkpoints:[],trials:[],analyses:[],
  counters:{protocols:0,sessions:0,trials:0,analyses:0,duplicatesBlocked:0,invalidRejected:0,checkpoints:0}
});

export class CognitiveResearchBattery {
  readonly systemName='learning:cognitive-research-battery' as const;
  private state=defaultCognitiveResearchBattery();

  restore(raw?:Partial<CognitiveResearchBatteryState>|null){
    const d=defaultCognitiveResearchBattery(),r=raw??{};
    this.state={...d,...r,version:3,
      protocols:Array.isArray(r.protocols)?r.protocols.slice(-32):[],
      sessions:Array.isArray(r.sessions)?r.sessions.slice(-24):[],
      schedules:Array.isArray(r.schedules)?r.schedules.slice(-1024):[],
      checkpoints:Array.isArray(r.checkpoints)?r.checkpoints.slice(-384):[],
      trials:Array.isArray(r.trials)?r.trials.slice(-1024):[],
      analyses:Array.isArray(r.analyses)?r.analyses.slice(-96):[],
      counters:{...d.counters,...(r.counters??{})}
    };
  }
  snapshot(){return structuredClone(this.state);}

  createProtocol(input:{id:string;hypothesisKey:string;taskIds:string[];contextKeys:string[];delaysMs:number[];requiredMatchedPairs?:number;requiredHoldout?:number;randomized:boolean;balanced:boolean;blinded?:boolean;evaluatorVersion:string;seed:number;release:string;stateSchema:number;at?:number}){
    const id=clean(input.id,64),existing=this.state.protocols.find(p=>p.id===id);
    if(existing){this.state.counters.duplicatesBlocked++;return structuredClone(existing);}
    const taskIds=[...new Set(input.taskIds.map(x=>clean(x,64)).filter(Boolean))].slice(0,16);
    const contextKeys=[...new Set(input.contextKeys.map(x=>clean(x,64)).filter(Boolean))].slice(0,32);
    const delaysMs=[...new Set(input.delaysMs.map(x=>Math.max(0,Math.floor(Number(x)||0))).filter(x=>Number.isFinite(x)))].sort((a,b)=>a-b).slice(0,12);
    if(!id||!clean(input.hypothesisKey,96)||!taskIds.length||!contextKeys.length||delaysMs.length<2||!clean(input.evaluatorVersion,64)){this.state.counters.invalidRejected++;throw new Error('invalid-research-protocol');}
    const requiredMatchedPairs=Math.max(4,Math.min(64,Math.floor(input.requiredMatchedPairs??8)));
    const requiredHoldout=Math.max(2,Math.min(32,Math.floor(input.requiredHoldout??4)));
    const at=input.at??Date.now(),seed=Math.floor(Number(input.seed)||1)>>>0;
    const canonical=JSON.stringify({hypothesisKey:clean(input.hypothesisKey,96),taskIds,contextKeys,delaysMs,requiredMatchedPairs,requiredHoldout,randomized:Boolean(input.randomized),balanced:Boolean(input.balanced),blinded:Boolean(input.blinded),evaluatorVersion:clean(input.evaluatorVersion,64),seed});
    const preregistrationHash=hash(canonical);
    const capsule:ReproducibilityCapsule={release:clean(input.release,48),stateSchema:Math.max(0,Math.floor(input.stateSchema)),protocolHash:preregistrationHash,seed,evaluatorVersion:clean(input.evaluatorVersion,64)};
    const protocol:CognitiveBatteryProtocol={id,hypothesisKey:clean(input.hypothesisKey,96),taskIds,contextKeys,delaysMs,requiredMatchedPairs,requiredHoldout,randomized:Boolean(input.randomized),balanced:Boolean(input.balanced),blinded:Boolean(input.blinded),evaluatorVersion:clean(input.evaluatorVersion,64),seed,preregistrationHash,capsule,createdAt:at};
    this.state.protocols.push(protocol);if(this.state.protocols.length>32)this.state.protocols=this.state.protocols.slice(-32);this.state.counters.protocols++;return structuredClone(protocol);
  }

  createSession(protocolId:string,sessionId?:string,at=Date.now()){
    const protocol=this.state.protocols.find(p=>p.id===clean(protocolId,64));if(!protocol)throw new Error('unknown-protocol');
    const id=clean(sessionId||`session:${protocol.id}:${at}`,96);const existing=this.state.sessions.find(s=>s.id===id);if(existing){this.state.counters.duplicatesBlocked++;return structuredClone(existing);}
    const totalPairs=protocol.requiredMatchedPairs+protocol.requiredHoldout;
    const pairSeeds=shuffle(Array.from({length:totalPairs},(_,i)=>i),protocol.seed);
    const items:CognitiveBatteryScheduleItem[]=[];
    let sequence=0;
    for(const pairIndex of pairSeeds){
      const holdout=pairIndex>=protocol.requiredMatchedPairs;
      const contextKey=protocol.contextKeys[pairIndex%protocol.contextKeys.length];
      const delayMs=protocol.delaysMs[pairIndex%protocol.delaysMs.length];
      const taskId=protocol.taskIds[pairIndex%protocol.taskIds.length];
      const order=pairIndex%2===0;
      const pairKey=`${id}:pair:${String(pairIndex).padStart(3,'0')}`;
      const conditions=order?(['replay-on','replay-off'] as BatteryCondition[]):(['replay-off','replay-on'] as BatteryCondition[]);
      for(const condition of conditions){
        items.push({slotId:`${id}:slot:${String(sequence).padStart(4,'0')}`,protocolId:protocol.id,sessionId:id,sequence,taskId,phase:holdout?'holdout':'test',condition,contextKey,pairKey,delayMs,holdout});
        sequence++;
      }
    }
    const scheduleHash=hash(JSON.stringify({protocolHash:protocol.preregistrationHash,items}));
    const session:CognitiveBatterySession={id,protocolId:protocol.id,scheduleHash,status:'active',expectedSlots:items.length,recordedSlots:0,missingSlots:items.length,adherence01:0,createdAt:at,startedAt:at};
    this.state.sessions.push(session);this.state.schedules.push(...items);if(this.state.sessions.length>24)this.state.sessions=this.state.sessions.slice(-24);if(this.state.schedules.length>1024)this.state.schedules=this.state.schedules.slice(-1024);this.state.counters.sessions++;
    const nextCapsule=structuredClone(protocol.capsule);nextCapsule.scheduleHash=scheduleHash;protocol.capsule=nextCapsule;
    return structuredClone({session,scheduleHash,schedule:items});
  }

  private scheduledSlotMatch(input:any,protocol:CognitiveBatteryProtocol){
    if(!input.sessionId&&!input.scheduleSlotId)return null;
    const slot=this.state.schedules.find(s=>s.slotId===clean(input.scheduleSlotId,128)||(!input.scheduleSlotId&&s.sessionId===clean(input.sessionId,96)&&s.taskId===clean(input.taskId,64)&&s.pairKey===clean(input.pairKey,64)&&s.condition===input.condition&&s.contextKey===clean(input.contextKey,64)&&s.delayMs===Math.max(0,Math.floor(Number(input.delayMs)||0))));
    if(!slot||slot.protocolId!==protocol.id||slot.sessionId!==clean(input.sessionId||slot.sessionId,96))throw new Error('trial-not-in-preregistered-schedule');
    if(slot.taskId!==clean(input.taskId,64)||slot.condition!==input.condition||slot.contextKey!==clean(input.contextKey,64)||slot.delayMs!==Math.max(0,Math.floor(Number(input.delayMs)||0))||slot.holdout!==Boolean(input.holdout)||slot.phase!==input.phase)throw new Error('trial-schedule-mismatch');
    return slot;
  }

  recordTrial(input:{id:string;protocolId:string;taskId:string;phase:BatteryPhase;condition:BatteryCondition;contextKey:string;pairKey?:string;delayMs:number;baselineScore01:number;score01:number;independentVerified:boolean;holdout:boolean;evaluatorVersion:string;baselineEstablishedAt:number;outcomeRecordedAt:number;at?:number;sessionId?:string;scheduleSlotId?:string;evaluatorRunId?:string;evaluatorSource?:EvaluatorSource}){
    const protocol=this.state.protocols.find(p=>p.id===clean(input.protocolId,64));
    if(!protocol){this.state.counters.invalidRejected++;throw new Error('unknown-protocol');}
    if(input.sessionId){const session=this.state.sessions.find(s=>s.id===clean(input.sessionId,96));if(session?.sealedAt){this.state.counters.invalidRejected++;throw new Error('session-sealed');}}
    const existing=this.state.trials.find(t=>t.id===clean(input.id,96));if(existing){this.state.counters.duplicatesBlocked++;return structuredClone(existing);}
    const slot=this.scheduledSlotMatch(input,protocol);
    const eventAt=Number(input.at??input.outcomeRecordedAt);
    if(clean(input.evaluatorVersion,64)!==protocol.evaluatorVersion||Number(input.outcomeRecordedAt)<Number(input.baselineEstablishedAt)||eventAt<Number(input.baselineEstablishedAt)||eventAt>Number(input.outcomeRecordedAt)||!clean(input.taskId,64)){
      this.state.counters.invalidRejected++;
      throw new Error('invalid-trial-provenance');
    }
    const row:CognitiveBatteryTrial={
      id:clean(input.id,96),
      protocolId:protocol.id,
      sessionId:slot?.sessionId??(input.sessionId?clean(input.sessionId,96):undefined),
      scheduleSlotId:slot?.slotId??(input.scheduleSlotId?clean(input.scheduleSlotId,128):undefined),
      hypothesisKey:protocol.hypothesisKey,
      taskId:clean(input.taskId,64), phase:input.phase, condition:input.condition,
      contextKey:clean(input.contextKey,64), pairKey:input.pairKey?clean(input.pairKey,64):undefined,
      delayMs:Math.max(0,Math.floor(Number(input.delayMs)||0)),
      baselineScore01:clamp(input.baselineScore01), score01:clamp(input.score01),
      independentVerified:Boolean(input.independentVerified), holdout:Boolean(input.holdout),
      evaluatorVersion:clean(input.evaluatorVersion,64),
      evaluatorRunId:input.evaluatorRunId?clean(input.evaluatorRunId,96):undefined,
      evaluatorSource:input.evaluatorSource??'external-evaluator',
      baselineEstablishedAt:Number(input.baselineEstablishedAt), outcomeRecordedAt:Number(input.outcomeRecordedAt),
      at:eventAt
    };
    const duplicate=this.state.trials.some(t=>t.protocolId===row.protocolId&&t.taskId===row.taskId&&t.phase===row.phase&&t.condition===row.condition&&t.contextKey===row.contextKey&&t.pairKey===row.pairKey&&t.delayMs===row.delayMs&&t.evaluatorVersion===row.evaluatorVersion&&t.sessionId===row.sessionId&&t.scheduleSlotId===row.scheduleSlotId);
    if(duplicate){this.state.counters.duplicatesBlocked++;return structuredClone(this.state.trials.find(t=>t.protocolId===row.protocolId&&t.taskId===row.taskId&&t.phase===row.phase&&t.condition===row.condition&&t.contextKey===row.contextKey&&t.pairKey===row.pairKey&&t.delayMs===row.delayMs&&t.evaluatorVersion===row.evaluatorVersion&&t.sessionId===row.sessionId&&t.scheduleSlotId===row.scheduleSlotId)!);}
    this.state.trials.push(row);if(this.state.trials.length>1024)this.state.trials=this.state.trials.slice(-1024);this.state.counters.trials++;
    if(row.sessionId){const session=this.state.sessions.find(s=>s.id===row.sessionId);if(session&&row.scheduleSlotId&&session.status==='active'){session.recordedSlots=new Set(this.state.trials.filter(t=>t.sessionId===session.id&&t.scheduleSlotId).map(t=>t.scheduleSlotId!)).size;session.missingSlots=Math.max(0,session.expectedSlots-session.recordedSlots);session.adherence01=session.expectedSlots?session.recordedSlots/session.expectedSlots:0;}}
    return structuredClone(row);
  }

  recordEvaluatorOutcome(input:{id:string;protocolId:string;sessionId?:string;scheduleSlotId?:string;taskId:string;phase:BatteryPhase;condition:BatteryCondition;contextKey:string;pairKey?:string;delayMs:number;result:CognitiveTaskEvaluatorResult;at?:number}){
    if(!clean(input.result.evaluatorRunId,96)||input.result.source==='synthetic-test'){
      this.state.counters.invalidRejected++;
      throw new Error('non-empirical-evaluator-source');
    }
    return this.recordTrial({id:input.id,protocolId:input.protocolId,sessionId:input.sessionId,scheduleSlotId:input.scheduleSlotId,taskId:input.taskId,phase:input.phase,condition:input.condition,contextKey:input.contextKey,pairKey:input.pairKey,delayMs:input.delayMs,baselineScore01:input.result.baselineScore01,score01:input.result.score01,independentVerified:input.result.independentVerified,holdout:input.result.holdout,evaluatorVersion:input.result.evaluatorVersion,baselineEstablishedAt:input.result.baselineEstablishedAt,outcomeRecordedAt:input.result.outcomeRecordedAt,at:input.at??input.result.outcomeRecordedAt,evaluatorRunId:input.result.evaluatorRunId,evaluatorSource:input.result.source});
  }

  finalizeSession(sessionId:string,at=Date.now()){
    const session=this.state.sessions.find(s=>s.id===clean(sessionId,96));if(!session)throw new Error('unknown-session');
    const scheduled=this.state.schedules.filter(s=>s.sessionId===session.id);const recorded=new Set(this.state.trials.filter(t=>t.sessionId===session.id&&t.scheduleSlotId).map(t=>t.scheduleSlotId!));
    session.recordedSlots=recorded.size;session.missingSlots=Math.max(0,scheduled.length-recorded.size);session.adherence01=scheduled.length?recorded.size/scheduled.length:0;session.status=session.missingSlots===0?'complete':'incomplete';session.sealedAt=at;
    return structuredClone({session,missingSlotIds:scheduled.filter(s=>!recorded.has(s.slotId)).map(s=>s.slotId)});
  }

  recordCheckpoint(input:{id:string;sessionId:string;phase:BatteryPhase;tick:number;runtimeStateHash:string;at?:number}){
    if(!this.state.sessions.some(s=>s.id===clean(input.sessionId,96))){this.state.counters.invalidRejected++;throw new Error('unknown-session');}
    const id=clean(input.id,96);if(this.state.checkpoints.some(c=>c.id===id)){this.state.counters.duplicatesBlocked++;return structuredClone(this.state.checkpoints.find(c=>c.id===id)!);}
    const row:CognitiveBatteryCheckpoint={id,sessionId:clean(input.sessionId,96),phase:input.phase,tick:Math.max(0,Math.floor(Number(input.tick)||0)),runtimeStateHash:clean(input.runtimeStateHash,128),at:Number(input.at??Date.now())};
    if(!row.runtimeStateHash){this.state.counters.invalidRejected++;throw new Error('missing-runtime-state-hash');}
    this.state.checkpoints.push(row);if(this.state.checkpoints.length>384)this.state.checkpoints=this.state.checkpoints.slice(-384);this.state.counters.checkpoints++;return structuredClone(row);
  }

  analyze(protocolId:string,taskId:string):BatteryAnalysis{
    const protocol=this.state.protocols.find(p=>p.id===protocolId);if(!protocol)throw new Error('unknown-protocol');
    const rows=this.state.trials.filter(t=>t.protocolId===protocolId&&t.taskId===taskId&&t.independentVerified);
    const sessions=this.state.sessions.filter(s=>s.protocolId===protocolId);
    const completeSessions=sessions.filter(s=>s.status==='complete').length;
    const sessionCoverage01=sessions.length?completeSessions/sessions.length:0;
    const matched=new Map<string,{on?:CognitiveBatteryTrial;off?:CognitiveBatteryTrial}>();
    for(const t of rows){if(!t.pairKey||t.condition==='negative-control'||t.phase==='negative-control')continue;const key=`${t.pairKey}|${t.contextKey}|${t.delayMs}`;const p=matched.get(key)??{};if(t.condition==='replay-on')p.on=t;else if(t.condition==='replay-off')p.off=t;matched.set(key,p);}
    const pairs=[...matched.values()].filter(p=>p.on&&p.off) as Array<{on:CognitiveBatteryTrial;off:CognitiveBatteryTrial}>;
    const diffs=pairs.map(p=>p.on.score01-p.off.score01);const distinctDelays=new Set(rows.map(r=>r.delayMs)).size,distinctContexts=new Set(rows.map(r=>r.contextKey)).size;
    const holdout=rows.filter(r=>r.holdout&&r.phase==='holdout').length;
    const negativeRows=this.state.trials.filter(t=>t.protocolId===protocolId&&t.taskId===taskId&&t.independentVerified&&(t.condition==='negative-control'||t.phase==='negative-control'));
    const negativeControlDifference01=negativeRows.length?negativeRows.reduce((s,t)=>s+(t.score01-t.baselineScore01),0)/negativeRows.length:null;
    const meanDifference01=diffs.length?diffs.reduce((s,x)=>s+x,0)/diffs.length:null,med=median(diffs),ci=bootstrapCI(diffs,protocol.seed),effectMagnitude01=meanDifference01===null?null:Math.abs(meanDifference01);
    const scheduledTrials=rows.filter(r=>r.sessionId).length,validSources=rows.filter(r=>r.evaluatorSource!=='synthetic-test').length;
    const qualityParts=[pairs.length>=protocol.requiredMatchedPairs,holdout>=protocol.requiredHoldout,distinctDelays>=Math.min(3,protocol.delaysMs.length),distinctContexts>=Math.min(2,protocol.contextKeys.length),protocol.randomized,protocol.balanced,protocol.blinded,rows.every(r=>r.evaluatorVersion===protocol.evaluatorVersion),rows.length>0,sessions.length===0||completeSessions===sessions.length,scheduledTrials===0||scheduledTrials===rows.length,validSources===rows.length].map(Boolean);
    const dataQuality01=qualityParts.filter(Boolean).length/qualityParts.length;
    let claimStatus:EvidenceClaimStatus='insufficient',reason='insufficient-matched-data';
    const confirmatory= pairs.length>=protocol.requiredMatchedPairs&&holdout>=protocol.requiredHoldout&&distinctDelays>=Math.min(3,protocol.delaysMs.length)&&distinctContexts>=2&&protocol.randomized&&protocol.balanced&&(sessions.length===0||completeSessions===sessions.length)&&validSources===rows.length;
    if(confirmatory){claimStatus='confirmatory-eligible';reason='protocol-sample-session-and-provenance-thresholds-met';}
    else if(pairs.length>=2&&distinctContexts>=2){claimStatus='exploratory';reason='matched-but-not-confirmatory';}
    if(meanDifference01!==null&&ci.low!==null&&ci.high!==null&&ci.high<0&&claimStatus==='confirmatory-eligible'){claimStatus='contradicted';reason='negative-effect-ci';}
    const analysis:BatteryAnalysis={protocolId,hypothesisKey:protocol.hypothesisKey,taskId,matchedPairs:pairs.length,holdoutTrials:holdout,distinctDelays,distinctContexts,completeSessions,scheduledCoverage01:sessionCoverage01,meanDifference01,medianDifference01:med,ci95Low01:ci.low,ci95High01:ci.high,effectMagnitude01,negativeControlDifference01,dataQuality01,claimStatus,reason,analyzedAt:Date.now()};
    this.state.analyses.push(analysis);if(this.state.analyses.length>96)this.state.analyses=this.state.analyses.slice(-96);this.state.counters.analyses++;return structuredClone(analysis);
  }

  claimReport(hypothesisKey:string){
    const analyses=this.state.analyses.filter(a=>a.hypothesisKey===hypothesisKey).slice(-16);const eligible=analyses.filter(a=>a.claimStatus==='confirmatory-eligible');
    const distinctProtocols=new Set(eligible.map(a=>a.protocolId)).size;let status:EvidenceClaimStatus='insufficient';
    if(eligible.length>=2&&distinctProtocols>=2){const signs=eligible.map(a=>Math.sign(a.meanDifference01??0)).filter(Boolean);const positive=signs.filter(x=>x>0).length,negative=signs.filter(x=>x<0).length;status=positive>0&&negative===0?'replicated':negative>0&&positive===0?'contradicted':'confirmatory-eligible';}
    else if(eligible.length===1)status='confirmatory-eligible';else if(analyses.some(a=>a.claimStatus==='exploratory'))status='exploratory';
    return {hypothesisKey,analyses,distinctConfirmatoryProtocols:distinctProtocols,status};
  }

  diagnostics(){return {version:this.state.version,protocols:this.state.protocols.length,sessions:this.state.sessions.length,schedules:this.state.schedules.length,checkpoints:this.state.checkpoints.length,trials:this.state.trials.length,analyses:this.state.analyses.length,counters:this.state.counters,latestAnalysis:this.state.analyses.at(-1)??null};}
}
