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
export const defaultContradictionReservoir=():ContradictionReservoirState=>({claims:[],unresolvedCount:0});
export class ContradictionReservoir {
  private state=defaultContradictionReservoir();
  restore(state:ContradictionReservoirState|undefined):void{this.state={...defaultContradictionReservoir(),...(state??{}),claims:Array.isArray(state?.claims)?state!.claims.slice(0,256):[]};this.recount();}
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
