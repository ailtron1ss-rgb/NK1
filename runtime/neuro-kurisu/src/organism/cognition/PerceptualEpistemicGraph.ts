import { createHash } from 'node:crypto';
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export type EpistemicSource='observed'|'model-output'|'derived'|'unresolved';
export interface EvidenceClaim { id:string; at:number; modality:string; claim:string; source:EpistemicSource; confidence01:number; targetIds:string[]; supersedes?:string; }
export interface EpistemicState { version:1; claims:EvidenceClaim[]; contradictionPairs:number; resolvedPairs:number; corroboratedPairs:number; meanConfidence01:number; lastAt:number; }
export const defaultEpistemicState=():EpistemicState=>({version:1,claims:[],contradictionPairs:0,resolvedPairs:0,corroboratedPairs:0,meanConfidence01:.5,lastAt:0});
function idFor(modality:string,claim:string,at:number){return `evidence-${createHash('sha256').update(`${modality}|${claim}|${at}`).digest('hex').slice(0,16)}`;}
export class PerceptualEpistemicGraph {
  private state=defaultEpistemicState();
  restore(raw?:Partial<EpistemicState>|null){const d=defaultEpistemicState();const r=raw??{};this.state={...d,...r,claims:Array.isArray(r.claims)?r.claims.slice(-256):[]};}
  snapshot(){return structuredClone(this.state);}
  add(input:{at:number;modality:string;claim:string;source:EpistemicSource;confidence01:number;targetIds?:string[];supersedes?:string}){
    const claim=input.claim.trim().slice(0,360); if(!claim)return null;
    const confidence01=clamp(input.confidence01);
    const c:EvidenceClaim={id:idFor(input.modality,claim,input.at),at:input.at,modality:input.modality,claim,source:input.source,confidence01,targetIds:(input.targetIds??[]).slice(0,16),supersedes:input.supersedes};
    const superseded=input.supersedes
      ? this.state.claims.find(x=>x.id===input.supersedes&&x.id!==c.id)
      : undefined;
    const similar=this.state.claims.filter(x=>x.claim===claim&&x.id!==c.id);
    // Repeating the same proposition is corroboration, not contradiction
    // resolution. Resolution requires an explicit supersedes edge.
    if(superseded)this.state.resolvedPairs++;
    else if(similar.length)this.state.corroboratedPairs+=similar.length;
    this.state.claims.unshift(c); this.state.claims=this.state.claims.slice(0,256);
    this.state.meanConfidence01=clamp(this.state.claims.reduce((s,x)=>s+x.confidence01,0)/Math.max(1,this.state.claims.length));
    this.state.lastAt=input.at; return structuredClone(c);
  }
  recent(limit=32){return this.state.claims.slice(0,Math.max(1,Math.min(64,Math.floor(limit)))).map(x=>structuredClone(x));}
  summary(){return {version:1,claims:this.state.claims.length,contradictionPairs:this.state.contradictionPairs,resolvedPairs:this.state.resolvedPairs,corroboratedPairs:this.state.corroboratedPairs,meanConfidence01:this.state.meanConfidence01,lastAt:this.state.lastAt};}
}
