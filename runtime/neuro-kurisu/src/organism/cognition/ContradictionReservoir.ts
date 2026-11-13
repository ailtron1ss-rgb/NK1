import { randomUUID } from 'node:crypto';

export interface ContradictionClaim {
  id: string;
  claim: string;
  confidence: number;
  status: 'open'|'resolved'|'stale';
  evidenceIds: string[];
  alternatives: string[];
  createdAt: number;
  updatedAt: number;
}
export interface ContradictionReservoirState { claims: ContradictionClaim[]; unresolvedCount: number; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const STATUSES:readonly ContradictionClaim['status'][]=['open','resolved','stale'];
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?Array.from(new Set(v.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,160)))).slice(0,cap):[];
const sanitizeClaim=(v:unknown):ContradictionClaim|null=>{
  if(!v||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  if(typeof r.id!=='string'||!r.id)return null;
  const claim=typeof r.claim==='string'?r.claim.trim().slice(0,240):'';
  if(!claim)return null;
  return {id:r.id.slice(0,80),claim,confidence:clamp(finN(r.confidence,.5)),status:STATUSES.includes(r.status as ContradictionClaim['status'])?r.status as ContradictionClaim['status']:'open',evidenceIds:strArr(r.evidenceIds,32),alternatives:strArr(r.alternatives,8),createdAt:Math.max(0,finN(r.createdAt,0)),updatedAt:Math.max(0,finN(r.updatedAt,0))};
};
export const defaultContradictionReservoir=():ContradictionReservoirState=>({claims:[],unresolvedCount:0});
export class ContradictionReservoir {
  private state=defaultContradictionReservoir();
  restore(state:ContradictionReservoirState|undefined):void{const src:Record<string,unknown>=(state&&typeof state==='object')?state as unknown as Record<string,unknown>:{};let claims:ContradictionClaim[]=[];try{const raw=src.claims;if(Array.isArray(raw))claims=raw.map(sanitizeClaim).filter((x):x is ContradictionClaim=>x!==null).slice(0,256);}catch{claims=[];}this.state={claims,unresolvedCount:0};this.recount();}
  register(claim:string, alternatives:string[]=[], confidence=0.5):ContradictionClaim{
    const clean=claim.trim().slice(0,240); const existing=this.state.claims.find(c=>c.claim===clean);
    if(existing){existing.confidence=clamp(existing.confidence*.72+clamp(confidence)*.28);existing.updatedAt=Date.now();existing.alternatives=Array.from(new Set([...existing.alternatives,...alternatives])).slice(0,8);this.recount();return structuredClone(existing);}
    const c:ContradictionClaim={id:randomUUID(),claim:clean,confidence:clamp(confidence),status:'open',evidenceIds:[],alternatives:alternatives.slice(0,8),createdAt:Date.now(),updatedAt:Date.now()};
    this.state.claims=[c,...this.state.claims].slice(0,256);this.recount();return structuredClone(c);
  }
  addEvidence(id:string,evidenceId:string,weight=0.1):void{const c=this.state.claims.find(x=>x.id===id);if(!c)return;c.evidenceIds=Array.from(new Set([...c.evidenceIds,evidenceId])).slice(-32);c.confidence=clamp(c.confidence+weight);c.updatedAt=Date.now();this.recount();}
  resolve(id:string):void{const c=this.state.claims.find(x=>x.id===id);if(!c)return;c.status='resolved';c.updatedAt=Date.now();this.recount();}
  open(limit=8):ContradictionClaim[]{return structuredClone(this.state.claims.filter(c=>c.status==='open').sort((a,b)=>b.confidence-a.confidence).slice(0,limit));}
  private recount(){this.state.unresolvedCount=this.state.claims.filter(c=>c.status==='open').length;}
  snapshot(){return structuredClone(this.state);}
}
