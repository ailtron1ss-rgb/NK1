/** B202 — physical-device evidence provenance ledger. */
import type { AndroidTelemetrySample, TermuxCapabilities } from './AndroidEmbodimentBridge.ts';
export interface DeviceEvidenceRecord { id:string; at:number; status:'REAL_DEVICE_VERIFIED'|'HOST_PROBE'|'UNAVAILABLE'; capabilityDigest:string; telemetryFresh:boolean; commandSuccessRate01:number; source:string; }
export interface DeviceEvidenceState { version:1; probes:number; verifiedProbes:number; hostProbes:number; unavailableProbes:number; lastStatus:DeviceEvidenceRecord['status']; records:DeviceEvidenceRecord[]; }
const dState=():DeviceEvidenceState=>({version:1,probes:0,verifiedProbes:0,hostProbes:0,unavailableProbes:0,lastStatus:'UNAVAILABLE',records:[]});
export const defaultDeviceEvidence=dState;
const STATUSES:readonly DeviceEvidenceRecord['status'][]=['REAL_DEVICE_VERIFIED','HOST_PROBE','UNAVAILABLE'];
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const clamp01=(v:unknown,f=0):number=>Math.max(0,Math.min(1,finN(v,f)));
const sanRecord=(x:unknown):DeviceEvidenceRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,180),at:Math.max(0,finN(r.at,0)),status:STATUSES.includes(r.status as DeviceEvidenceRecord['status'])?r.status as DeviceEvidenceRecord['status']:'UNAVAILABLE',capabilityDigest:typeof r.capabilityDigest==='string'?r.capabilityDigest.slice(0,240):'',telemetryFresh:r.telemetryFresh===true,commandSuccessRate01:clamp01(r.commandSuccessRate01),source:typeof r.source==='string'?r.source.slice(0,120):''};};
function stableCaps(c:TermuxCapabilities){return ['battery','sensors','tts','stt','camera','wifi'].map(k=>`${k}:${c[k as keyof TermuxCapabilities]?'1':'0'}`).join('|');}
export class DeviceEvidenceLedger {
  private state=dState();
  restore(raw?:Partial<DeviceEvidenceState>|null){const d=dState();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let records:DeviceEvidenceRecord[]=[];try{const r=read('records');if(Array.isArray(r))records=r.map(sanRecord).filter((x):x is DeviceEvidenceRecord=>x!==null).slice(0,64);}catch{records=[];}const ls=read('lastStatus');this.state={version:1,probes:cnt(read('probes'),d.probes),verifiedProbes:cnt(read('verifiedProbes'),d.verifiedProbes),hostProbes:cnt(read('hostProbes'),d.hostProbes),unavailableProbes:cnt(read('unavailableProbes'),d.unavailableProbes),lastStatus:STATUSES.includes(ls as DeviceEvidenceRecord['status'])?ls as DeviceEvidenceRecord['status']:'UNAVAILABLE',records};}
  snapshot(){return structuredClone(this.state);}
  record(input:{at:number;status:DeviceEvidenceRecord['status'];capabilities:TermuxCapabilities;telemetry:AndroidTelemetrySample|null}){
    const diag=input.telemetry?.diagnostics; const successes=Number(diag?.commandsSucceeded??0), attempted=Number(diag?.commandsAttempted??0); const rec={id:`device-evidence-${input.at}-${this.state.probes}`,at:input.at,status:input.status,capabilityDigest:stableCaps(input.capabilities),telemetryFresh:Boolean(input.telemetry?.telemetry.source==='android-termux'&&input.telemetry?.telemetry.staleMs===0),commandSuccessRate01:attempted?Math.max(0,Math.min(1,successes/attempted)):0,source:String(input.telemetry?.telemetry.source??'none')};
    this.state.probes++; if(input.status==='REAL_DEVICE_VERIFIED')this.state.verifiedProbes++; else if(input.status==='HOST_PROBE')this.state.hostProbes++; else this.state.unavailableProbes++; this.state.lastStatus=input.status; this.state.records=[rec,...this.state.records].slice(0,64); return structuredClone(rec);
  }
  certification(minVerifiedProbes=2){const s=this.state; const verified=s.verifiedProbes>=minVerifiedProbes; const fresh=s.records.filter(r=>r.status==='REAL_DEVICE_VERIFIED'&&r.telemetryFresh).length>=minVerifiedProbes; return {version:1,status:verified&&fresh?'verified':s.hostProbes>0?'host-probe':'unavailable',requiredVerifiedProbes:minVerifiedProbes,criteria:{verifiedProbes:verified,freshTelemetry:fresh},probes:s.probes,verifiedProbes:s.verifiedProbes,hostProbes:s.hostProbes,warning:'Only live Termux Android evidence can satisfy REAL_DEVICE_VERIFIED; host probes never count as physical-device certification.'};}
  diagnostics(){return {...this.snapshot(),certification:this.certification()};}
}
