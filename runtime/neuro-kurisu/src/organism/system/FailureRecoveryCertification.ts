import { createHash } from 'node:crypto';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export interface RecoveryCertificationState{version:1;checkpoints:number;recoveries:number;failedRecoveries:number;lastCheckpointHash:string;lastRecoveryHash:string;lastAt:number;lastCheckpointSequence:number;history:Array<{phase:'checkpoint'|'recovery';ok:boolean;hash:string;at:number;sequence:number}>;}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const numOrNull=(v:unknown):number|null=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null;};
const PHASES:Array<'checkpoint'|'recovery'>=['checkpoint','recovery'];
const sanHist=(x:unknown):RecoveryCertificationState['history'][number]|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {phase:PHASES.includes(r.phase as 'checkpoint'|'recovery')?r.phase as 'checkpoint'|'recovery':'checkpoint',ok:r.ok===true,hash:str(r.hash,''),at:finN(r.at,0),sequence:cnt(r.sequence,0)};};
export const defaultFailureRecoveryCertification=():RecoveryCertificationState=>({version:1,checkpoints:0,recoveries:0,failedRecoveries:0,lastCheckpointHash:'',lastRecoveryHash:'',lastAt:0,lastCheckpointSequence:0,history:[]});
export class FailureRecoveryCertification{
 private state=defaultFailureRecoveryCertification();
 restore(raw?:Partial<RecoveryCertificationState>|null){const d=defaultFailureRecoveryCertification();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const hRaw=read('history');const cp=cnt(read('checkpoints'),d.checkpoints);this.state={version:1,checkpoints:cp,recoveries:cnt(read('recoveries'),d.recoveries),failedRecoveries:cnt(read('failedRecoveries'),d.failedRecoveries),lastCheckpointHash:str(read('lastCheckpointHash'),''),lastRecoveryHash:str(read('lastRecoveryHash'),''),lastAt:finN(read('lastAt'),d.lastAt),lastCheckpointSequence:cnt(read('lastCheckpointSequence'),cp),history:Array.isArray(hRaw)?(hRaw as unknown[]).slice(-128).map(sanHist).filter((x):x is RecoveryCertificationState['history'][number]=>x!==null):[]};}
 snapshot(){return structuredClone(this.state);}
 checkpoint(payload:unknown,at=Date.now(),precomputedHash?:string){const hash=precomputedHash??digest(payload);this.state.checkpoints++;this.state.lastCheckpointSequence++;this.state.lastCheckpointHash=hash;this.state.lastAt=at;this.state.history=[{phase:'checkpoint' as const,ok:true,hash,at,sequence:this.state.lastCheckpointSequence},...this.state.history].slice(0,128);return hash;}
 recoverAndVerify(payload:unknown,at=Date.now(),precomputedHash?:string){const hash=precomputedHash??digest(payload),ok=Boolean(this.state.lastCheckpointHash)&&hash===this.state.lastCheckpointHash;this.state.recoveries+=ok?1:0;this.state.failedRecoveries+=ok?0:1;this.state.lastRecoveryHash=hash;this.state.lastAt=at;this.state.history=[{phase:'recovery' as const,ok,hash,at,sequence:this.state.lastCheckpointSequence},...this.state.history].slice(0,128);return ok;}
}
