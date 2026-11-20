/** B202 — physical-device evidence provenance ledger. */
import type { AndroidTelemetrySample, TermuxCapabilities } from './AndroidEmbodimentBridge.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

export interface DeviceEvidenceRecord { id:string; at:number; status:'REAL_DEVICE_VERIFIED'|'HOST_PROBE'|'UNAVAILABLE'; capabilityDigest:string; telemetryFresh:boolean; commandSuccessRate01:number; source:string; }
export interface DeviceEvidenceState { version:1; probes:number; verifiedProbes:number; hostProbes:number; unavailableProbes:number; lastStatus:DeviceEvidenceRecord['status']; records:DeviceEvidenceRecord[]; }
const dState=():DeviceEvidenceState=>({version:1,probes:0,verifiedProbes:0,hostProbes:0,unavailableProbes:0,lastStatus:'UNAVAILABLE',records:[]});
export const defaultDeviceEvidence=dState;
const STATUSES:ReadonlySet<DeviceEvidenceRecord['status']>=new Set(['REAL_DEVICE_VERIFIED','HOST_PROBE','UNAVAILABLE']);

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function safeCount(value:unknown):number|null{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}

function restoreRecord(value:unknown):DeviceEvidenceRecord|null{
  if(!isRecord(value)) return null;
  const {id,at,status,capabilityDigest,telemetryFresh,commandSuccessRate01,source}=value;
  if(typeof id!=='string'||!id.trim()||id.length>128) return null;
  if(typeof at!=='number'||!Number.isSafeInteger(at)||at<0) return null;
  if(typeof status!=='string'||!STATUSES.has(status as DeviceEvidenceRecord['status'])) return null;
  if(typeof capabilityDigest!=='string'||capabilityDigest.length>512) return null;
  if(typeof telemetryFresh!=='boolean') return null;
  if(typeof commandSuccessRate01!=='number'||!Number.isFinite(commandSuccessRate01)||commandSuccessRate01<0||commandSuccessRate01>1) return null;
  if(typeof source!=='string'||source.length>128) return null;
  return {id,at,status:status as DeviceEvidenceRecord['status'],capabilityDigest,telemetryFresh,commandSuccessRate01,source};
}

function stableCaps(c:TermuxCapabilities){return ['battery','sensors','tts','stt','camera','wifi'].map(k=>`${k}:${c[k as keyof TermuxCapabilities]?'1':'0'}`).join('|');}

export class DeviceEvidenceLedger {
  private state=dState();

  restore(raw?:Partial<DeviceEvidenceState>|null){
    const defaults=dState();
    if(raw===undefined||raw===null){this.state=defaults;return;}
    let candidate:unknown;
    try{
      candidate=snapshotPlainData(raw,{maxDepth:8,maxNodes:2048,maxStringUnits:65536,allowNonFiniteNumbers:true});
    }catch{
      this.state=defaults;
      return;
    }
    if(!isRecord(candidate)||(candidate.version!==undefined&&candidate.version!==1)){
      this.state=defaults;
      return;
    }
    const probes=safeCount(candidate.probes??defaults.probes);
    const verifiedProbes=safeCount(candidate.verifiedProbes??defaults.verifiedProbes);
    const hostProbes=safeCount(candidate.hostProbes??defaults.hostProbes);
    const unavailableProbes=safeCount(candidate.unavailableProbes??defaults.unavailableProbes);
    if(probes===null||verifiedProbes===null||hostProbes===null||unavailableProbes===null||
      verifiedProbes+hostProbes+unavailableProbes>probes){
      this.state=defaults;
      return;
    }
    const lastStatus=candidate.lastStatus===undefined?defaults.lastStatus:candidate.lastStatus;
    if(typeof lastStatus!=='string'||!STATUSES.has(lastStatus as DeviceEvidenceRecord['status'])){
      this.state=defaults;
      return;
    }
    const records=Array.isArray(candidate.records)?candidate.records.slice(0,64).map(restoreRecord).filter((item):item is DeviceEvidenceRecord=>item!==null):[];
    this.state={version:1,probes,verifiedProbes,hostProbes,unavailableProbes,lastStatus:lastStatus as DeviceEvidenceRecord['status'],records};
  }

  snapshot(){return structuredClone(this.state);}

  record(input:{at:number;status:DeviceEvidenceRecord['status'];capabilities:TermuxCapabilities;telemetry:AndroidTelemetrySample|null}){
    const diag=input.telemetry?.diagnostics;
    const successes=Number(diag?.commandsSucceeded??0), attempted=Number(diag?.commandsAttempted??0);
    const rec={id:`device-evidence-${input.at}-${this.state.probes}`,at:input.at,status:input.status,capabilityDigest:stableCaps(input.capabilities),telemetryFresh:Boolean(input.telemetry?.telemetry.source==='android-termux'&&input.telemetry?.telemetry.staleMs===0),commandSuccessRate01:attempted?Math.max(0,Math.min(1,successes/attempted)):0,source:String(input.telemetry?.telemetry.source??'none')};
    this.state.probes++;
    if(input.status==='REAL_DEVICE_VERIFIED')this.state.verifiedProbes++;
    else if(input.status==='HOST_PROBE')this.state.hostProbes++;
    else this.state.unavailableProbes++;
    this.state.lastStatus=input.status;
    this.state.records=[rec,...this.state.records].slice(0,64);
    return structuredClone(rec);
  }

  certification(minVerifiedProbes=2){
    const s=this.state;
    const verified=s.verifiedProbes>=minVerifiedProbes;
    const fresh=s.records.filter(r=>r.status==='REAL_DEVICE_VERIFIED'&&r.telemetryFresh).length>=minVerifiedProbes;
    return {version:1,status:verified&&fresh?'verified':s.hostProbes>0?'host-probe':'unavailable',requiredVerifiedProbes:minVerifiedProbes,criteria:{verifiedProbes:verified,freshTelemetry:fresh},probes:s.probes,verifiedProbes:s.verifiedProbes,hostProbes:s.hostProbes,warning:'Only live Termux Android evidence can satisfy REAL_DEVICE_VERIFIED; host probes never count as physical-device certification.'};
  }

  diagnostics(){return {...this.snapshot(),certification:this.certification()};}
}
