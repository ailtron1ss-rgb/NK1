/** B202 — physical-device evidence provenance ledger. */
import type { AndroidTelemetrySample, TermuxCapabilities } from './AndroidEmbodimentBridge.ts';
export interface DeviceEvidenceRecord { id:string; at:number; status:'REAL_DEVICE_VERIFIED'|'HOST_PROBE'|'UNAVAILABLE'; capabilityDigest:string; telemetryFresh:boolean; commandSuccessRate01:number; source:string; }
export interface DeviceEvidenceState { version:1; probes:number; verifiedProbes:number; hostProbes:number; unavailableProbes:number; lastStatus:DeviceEvidenceRecord['status']; records:DeviceEvidenceRecord[]; }
const dState=():DeviceEvidenceState=>({version:1,probes:0,verifiedProbes:0,hostProbes:0,unavailableProbes:0,lastStatus:'UNAVAILABLE',records:[]});
export const defaultDeviceEvidence=dState;
function stableCaps(c:TermuxCapabilities){return ['battery','sensors','tts','stt','camera','wifi'].map(k=>`${k}:${c[k as keyof TermuxCapabilities]?'1':'0'}`).join('|');}
export class DeviceEvidenceLedger {
  private state=dState();
  restore(raw?:Partial<DeviceEvidenceState>|null){const d=dState(),r=raw??{};this.state={...d,...r,records:Array.isArray(r.records)?r.records.slice(0,64):[]};}
  snapshot(){return structuredClone(this.state);}
  record(input:{at:number;status:DeviceEvidenceRecord['status'];capabilities:TermuxCapabilities;telemetry:AndroidTelemetrySample|null}){
    const diag=input.telemetry?.diagnostics; const successes=Number(diag?.commandsSucceeded??0), attempted=Number(diag?.commandsAttempted??0); const rec={id:`device-evidence-${input.at}-${this.state.probes}`,at:input.at,status:input.status,capabilityDigest:stableCaps(input.capabilities),telemetryFresh:Boolean(input.telemetry?.telemetry.source==='android-termux'&&input.telemetry?.telemetry.staleMs===0),commandSuccessRate01:attempted?Math.max(0,Math.min(1,successes/attempted)):0,source:String(input.telemetry?.telemetry.source??'none')};
    this.state.probes++; if(input.status==='REAL_DEVICE_VERIFIED')this.state.verifiedProbes++; else if(input.status==='HOST_PROBE')this.state.hostProbes++; else this.state.unavailableProbes++; this.state.lastStatus=input.status; this.state.records=[rec,...this.state.records].slice(0,64); return structuredClone(rec);
  }
  certification(minVerifiedProbes=2){const s=this.state; const verified=s.verifiedProbes>=minVerifiedProbes; const fresh=s.records.filter(r=>r.status==='REAL_DEVICE_VERIFIED'&&r.telemetryFresh).length>=minVerifiedProbes; return {version:1,status:verified&&fresh?'verified':s.hostProbes>0?'host-probe':'unavailable',requiredVerifiedProbes:minVerifiedProbes,criteria:{verifiedProbes:verified,freshTelemetry:fresh},probes:s.probes,verifiedProbes:s.verifiedProbes,hostProbes:s.hostProbes,warning:'Only live Termux Android evidence can satisfy REAL_DEVICE_VERIFIED; host probes never count as physical-device certification.'};}
  diagnostics(){return {...this.snapshot(),certification:this.certification()};}
}
