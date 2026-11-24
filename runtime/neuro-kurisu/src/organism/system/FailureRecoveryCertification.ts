import { createHash } from 'node:crypto';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export interface RecoveryCertificationState{version:1;checkpoints:number;recoveries:number;failedRecoveries:number;lastCheckpointHash:string;lastRecoveryHash:string;lastAt:number;lastCheckpointSequence:number;history:Array<{phase:'checkpoint'|'recovery';ok:boolean;hash:string;at:number;sequence:number}>;}
export const defaultFailureRecoveryCertification=():RecoveryCertificationState=>({version:1,checkpoints:0,recoveries:0,failedRecoveries:0,lastCheckpointHash:'',lastRecoveryHash:'',lastAt:0,lastCheckpointSequence:0,history:[]});
export class FailureRecoveryCertification{
 private state=defaultFailureRecoveryCertification();
 restore(raw?:Partial<RecoveryCertificationState>|null){const d=defaultFailureRecoveryCertification(),r=raw??{};this.state={...d,...r,version:1,lastCheckpointSequence:Number((r as any).lastCheckpointSequence??r.checkpoints??0),history:Array.isArray(r.history)?r.history.slice(-128).map((h:any)=>({...h,sequence:Number(h?.sequence??0)})):[]};}
 snapshot(){return structuredClone(this.state);}
 checkpoint(payload:unknown,at=Date.now(),precomputedHash?:string){const hash=precomputedHash??digest(payload);this.state.checkpoints++;this.state.lastCheckpointSequence++;this.state.lastCheckpointHash=hash;this.state.lastAt=at;this.state.history=[{phase:'checkpoint' as const,ok:true,hash,at,sequence:this.state.lastCheckpointSequence},...this.state.history].slice(0,128);return hash;}
 recoverAndVerify(payload:unknown,at=Date.now(),precomputedHash?:string){const hash=precomputedHash??digest(payload),ok=Boolean(this.state.lastCheckpointHash)&&hash===this.state.lastCheckpointHash;this.state.recoveries+=ok?1:0;this.state.failedRecoveries+=ok?0:1;this.state.lastRecoveryHash=hash;this.state.lastAt=at;this.state.history=[{phase:'recovery' as const,ok,hash,at,sequence:this.state.lastCheckpointSequence},...this.state.history].slice(0,128);return ok;}
}
