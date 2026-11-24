import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp24=(x:number)=>Math.max(0,Math.min(24,Number.isFinite(x)?x:0));
const DAY=86_400_000;
const HOUR=3_600_000;
const MAX_EVENTS=128;
const MAX_HOSTS=32;
const MAX_SLEEP=64;

type LifePhase='wake'|'active'|'wind-down'|'sleep'|'recovering'|'maintenance';

export interface LifeEvent { id:string; at:number; type:'phase'|'sleep'|'wake'|'maintenance'|'host-transfer'|'continuity-gap'|'resource-stress'; detail:string; }
export interface P39LifeState {
  version:1;
  birthAt:number;
  lastTickAt:number;
  lastWakeAt:number;
  lastSleepAt:number;
  totalActiveMs:number;
  totalSleepMs:number;
  lifeTicks:number;
  sessionCount:number;
  phase:LifePhase;
  sleepDebtHours:number;
  recovery01:number;
  continuity01:number;
  maintenanceDue01:number;
  host:{current:string; history:string[]; transfers:number};
  sleepSessions:Array<{startedAt:number; endedAt:number; durationMs:number; quality01:number; reason:string}>;
  maintenance:{runs:number; lastAt:number; compactions:number; memoryDormantDelta:number; lastReason:string};
  stress:{resourceEvents:number; thermalEvents:number; batteryEvents:number};
  events:LifeEvent[];
  metrics:{daysObserved01:number; activeRatio01:number; sleepRatio01:number; continuityGaps:number; selfMaintenanceCount:number; autonomyPreserved01:number};
}

const defaultState=():P39LifeState=>({
  version:1,birthAt:Date.now(),lastTickAt:0,lastWakeAt:0,lastSleepAt:0,totalActiveMs:0,totalSleepMs:0,lifeTicks:0,sessionCount:0,phase:'wake',sleepDebtHours:0,recovery01:.8,continuity01:1,maintenanceDue01:0,
  host:{current:'unknown-host',history:[],transfers:0},sleepSessions:[],maintenance:{runs:0,lastAt:0,compactions:0,memoryDormantDelta:0,lastReason:''},stress:{resourceEvents:0,thermalEvents:0,batteryEvents:0},events:[],metrics:{daysObserved01:0,activeRatio01:0,sleepRatio01:0,continuityGaps:0,selfMaintenanceCount:0,autonomyPreserved01:1}
});

function pushBounded<T>(arr:T[],value:T,max:number){arr.unshift(value); if(arr.length>max)arr.length=max;}

export class P39ContinuousArtificialLifeEngine{
  private state=defaultState();
  static defaultState=defaultState;
  restore(input:P39LifeState|undefined){
    const d=defaultState(); const s=input??d;
    this.state={...d,...s,host:{...d.host,...(s.host??{}),history:Array.isArray(s.host?.history)?s.host.history.slice(0,MAX_HOSTS):[]},sleepSessions:Array.isArray(s.sleepSessions)?s.sleepSessions.slice(0,MAX_SLEEP):[],maintenance:{...d.maintenance,...(s.maintenance??{})},stress:{...d.stress,...(s.stress??{})},events:Array.isArray(s.events)?s.events.slice(0,MAX_EVENTS):[],metrics:{...d.metrics,...(s.metrics??{})}};
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(input:{at:number;host?:string;awake:boolean;energy01:number;cognitiveLoad01:number;battery01?:number;thermal01?:number;storagePressure01?:number}):{phase:LifePhase;suggestedAction:ActionKind;shouldSleep:boolean;maintenanceDue01:number;continuity01:number}{
    const s=this.state; const at=Math.max(0,input.at||Date.now()); const prev=s.lastTickAt||at; const dt=Math.max(0,at-prev);
    s.lastTickAt=at; s.lifeTicks++; if(dt>90*60_000){s.continuity01=clamp(s.continuity01*.86+.14);s.metrics.continuityGaps++;this.event('continuity-gap',at,`gapMs=${Math.round(dt)}`);} else if(dt>0){s.continuity01=clamp(s.continuity01*.995+.005);}
    if(!s.birthAt)s.birthAt=at;
    if(input.host&&input.host!==s.host.current){s.host.current=input.host;s.host.transfers+=s.host.history.length?1:0;if(!s.host.history.includes(input.host))s.host.history.unshift(input.host);s.host.history=s.host.history.slice(0,MAX_HOSTS);this.event('host-transfer',at,`host=${input.host}`);}
    if(!s.sessionCount){s.sessionCount=1;s.lastWakeAt=at;} else if(input.awake && s.phase==='sleep'){s.sessionCount++;s.lastWakeAt=at;this.event('wake',at,'wake detected');}
    const sleepNeed=clamp((1-clamp(input.energy01))*.35+clamp(input.cognitiveLoad01)*.35+(input.thermal01??0)*.15+(1-(input.battery01??input.energy01))*.15);
    s.sleepDebtHours=clamp24(s.sleepDebtHours + (input.awake?dt/HOUR*sleepNeed:-dt/HOUR*.35));
    s.recovery01=clamp(s.recovery01 + (input.awake?-dt/HOUR*.018:dt/HOUR*.055));
    const thermal=(input.thermal01??0), battery=input.battery01??input.energy01, storage=input.storagePressure01??0;
    if(thermal>.82){s.stress.thermalEvents++;this.event('resource-stress',at,`thermal=${thermal.toFixed(2)}`);}
    if(battery<.15){s.stress.batteryEvents++;this.event('resource-stress',at,`battery=${battery.toFixed(2)}`);}
    if(storage>.82){s.stress.resourceEvents++;this.event('resource-stress',at,`storage=${storage.toFixed(2)}`);}
    const shouldSleep=!input.awake || s.sleepDebtHours>6 || (sleepNeed>.72 && s.recovery01<.5);
    const phase:LifePhase=!input.awake?'sleep':s.recovery01<.28?'recovering':shouldSleep?'wind-down':(s.maintenanceDue01>.82?'maintenance':'active');
    s.phase=phase;
    if(shouldSleep && input.awake)this.event('phase',at,'wind-down recommended');
    if(phase==='active')s.totalActiveMs+=dt; else if(phase==='sleep')s.totalSleepMs+=dt;
    s.maintenanceDue01=clamp(s.maintenanceDue01 + dt/DAY*.35 + Math.max(0,s.sleepDebtHours-4)*.01 + storage*.02 - (phase==='maintenance'?.08:0));
    const ageDays=Math.max(0,(at-s.birthAt)/DAY);s.metrics.daysObserved01=clamp(ageDays/30);const total=s.totalActiveMs+s.totalSleepMs;s.metrics.activeRatio01=total?clamp(s.totalActiveMs/total):0;s.metrics.sleepRatio01=total?clamp(s.totalSleepMs/total):0;
    let suggestedAction:ActionKind='wait'; if(phase==='sleep'||phase==='wind-down'||phase==='recovering')suggestedAction='rest'; else if(phase==='maintenance')suggestedAction='defer'; else if(s.maintenanceDue01>.68)suggestedAction='defer';
    return {phase,suggestedAction,shouldSleep,maintenanceDue01:s.maintenanceDue01,continuity01:s.continuity01};
  }
  recordAction(cost01:number){this.state.recovery01=clamp(this.state.recovery01-clamp(cost01)*.01);}
  recordOutcome(success01:number,autonomyPreserved=true){const s=this.state;s.recovery01=clamp(s.recovery01+(clamp(success01)-.5)*.01);s.metrics.autonomyPreserved01=clamp(s.metrics.autonomyPreserved01*.995+(autonomyPreserved?1:0)*.005);}
  startSleep(at:number,reason='manual'){if(this.state.lastSleepAt&&this.state.phase==='sleep')return;this.state.lastSleepAt=at;this.state.phase='sleep';this.event('sleep',at,reason);}
  endSleep(at:number,startedAt:number,reason='wake',quality01=0.8){const duration=Math.max(0,at-startedAt);this.state.lastWakeAt=at;this.state.phase='recovering';this.state.sleepDebtHours=clamp(this.state.sleepDebtHours-duration/HOUR*.55);this.state.recovery01=clamp(this.state.recovery01+Math.min(.35,duration/HOUR*.05));this.state.sleepSessions.unshift({startedAt,endedAt:at,durationMs:duration,quality01:clamp(quality01),reason});this.state.sleepSessions=this.state.sleepSessions.slice(0,MAX_SLEEP);this.event('wake',at,`durationMs=${duration};reason=${reason}`);}
  completeMaintenance(input:{at:number;reason:string;compactions?:number;memoryDormantDelta?:number}){const s=this.state;s.maintenanceDue01=clamp(s.maintenanceDue01-.42);s.maintenance.runs++;s.maintenance.lastAt=input.at;s.maintenance.compactions+=Math.max(0,Math.trunc(input.compactions??0));s.maintenance.memoryDormantDelta+=Math.trunc(input.memoryDormantDelta??0);s.maintenance.lastReason=input.reason;s.metrics.selfMaintenanceCount++;s.phase='active';this.event('maintenance',input.at,`reason=${input.reason}`);}
  actionBias(action:ActionKind){const s=this.state;if(action==='rest')return clamp((s.sleepDebtHours/12)*.16+(1-s.recovery01)*.12);if(action==='defer')return clamp(s.maintenanceDue01*.10);if(action==='explore')return clamp((1-s.sleepDebtHours/12)*.02);if(action==='reflect')return clamp((1-s.recovery01)*.03);return 0;}
  private event(type:LifeEvent['type'],at:number,detail:string){pushBounded(this.state.events,{id:`p39-${at}-${this.state.events.length}`,at,type,detail},MAX_EVENTS);}
  certification(minTicks=1000){
    const s=this.state;
    const continuity=s.metrics.continuityGaps===0 ? s.continuity01 : clamp(s.continuity01*(1/(1+s.metrics.continuityGaps*.15)));
    const activity=(s.metrics.activeRatio01>0 || s.totalActiveMs>0) ? 1 : 0;
    const persistence=s.lifeTicks>0 && s.birthAt>0 && s.lastTickAt>=s.birthAt ? 1 : 0;
    const hostEvidence=s.host.history.length>0 ? 1 : 0;
    const criteria={ticks:s.lifeTicks>=minTicks,activity:activity>0,persistence:persistence>0,continuity:continuity>=.5,host:hostEvidence>0};
    const passed=Object.values(criteria).filter(Boolean).length;
    return {version:1,status:(passed===Object.keys(criteria).length?'verified':passed>=3?'partial':'insufficient') as 'verified'|'partial'|'insufficient',requiredTicks:minTicks,lifeTicks:s.lifeTicks,criteria,continuity01:Number(continuity.toFixed(3)),sessionCount:s.sessionCount,hostTransfers:s.host.transfers,continuityGaps:s.metrics.continuityGaps,warning:'This certifies runtime continuity mechanics, not subjective experience.'};
  }
  diagnostics(){const s=this.state;return {phase:s.phase,lifeTicks:s.lifeTicks,sessionCount:s.sessionCount,sleepDebtHours:Number(s.sleepDebtHours.toFixed(3)),recovery01:Number(s.recovery01.toFixed(3)),continuity01:Number(s.continuity01.toFixed(3)),maintenanceDue01:Number(s.maintenanceDue01.toFixed(3)),host:s.host.current,transfers:s.host.transfers,maintenanceRuns:s.maintenance.runs,continuityGaps:s.metrics.continuityGaps,certification:this.certification()};}
}
export const defaultP39ContinuousLife=defaultState;
