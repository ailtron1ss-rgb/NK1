import { createHash } from 'node:crypto';
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const SOURCES:readonly EpistemicSource[]=['observed','model-output','derived','unresolved'];
const strList=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,180)).slice(0,cap):[];
const sanClaim=(x:unknown):EvidenceClaim|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id||typeof r.claim!=='string'||!r.claim)return null;return {id:r.id.slice(0,180),at:Math.max(0,finN(r.at,0)),modality:typeof r.modality==='string'?r.modality.slice(0,64):'',claim:r.claim.slice(0,360),source:SOURCES.includes(r.source as EpistemicSource)?r.source as EpistemicSource:'unresolved',confidence01:clamp(finN(r.confidence01,0)),targetIds:strList(r.targetIds,16),supersedes:typeof r.supersedes==='string'&&r.supersedes?r.supersedes.slice(0,180):undefined};};
export type EpistemicSource='observed'|'model-output'|'derived'|'unresolved';
export interface EvidenceClaim { id:string; at:number; modality:string; claim:string; source:EpistemicSource; confidence01:number; targetIds:string[]; supersedes?:string; }
export interface EpistemicState { version:1; claims:EvidenceClaim[]; contradictionPairs:number; resolvedPairs:number; corroboratedPairs:number; meanConfidence01:number; lastAt:number; }
export const defaultEpistemicState=():EpistemicState=>({version:1,claims:[],contradictionPairs:0,resolvedPairs:0,corroboratedPairs:0,meanConfidence01:.5,lastAt:0});
function idFor(modality:string,claim:string,at:number){return `evidence-${createHash('sha256').update(`${modality}|${claim}|${at}`).digest('hex').slice(0,16)}`;}
export class PerceptualEpistemicGraph {
  private state=defaultEpistemicState();
  restore(raw?:Partial<EpistemicState>|null){const d=defaultEpistemicState();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let claims:EvidenceClaim[]=[];try{const c=read('claims');if(Array.isArray(c))claims=c.slice(-256).map(sanClaim).filter((x):x is EvidenceClaim=>x!==null);}catch{claims=[];}this.state={version:1,claims,contradictionPairs:cnt(read('contradictionPairs'),d.contradictionPairs),resolvedPairs:cnt(read('resolvedPairs'),d.resolvedPairs),corroboratedPairs:cnt(read('corroboratedPairs'),d.corroboratedPairs),meanConfidence01:clamp(finN(read('meanConfidence01'),d.meanConfidence01)),lastAt:Math.max(0,finN(read('lastAt'),d.lastAt))};}
  snapshot(){return structuredClone(this.state);}
  add(input:{at:number;modality:string;claim:string;source:EpistemicSource;confidence01:number;targetIds?:string[];supersedes?:string}){
    const claim=input.claim.trim().slice(0,360); if(!claim)return null;
    const confidence01=clamp(input.confidence01);
    const c:EvidenceClaim={id:idFor(input.modality,claim,input.at),at:input.at,modality:input.modality,claim,source:input.source,confidence01,targetIds:(input.targetIds??[]).slice(0,16),supersedes:input.supersedes};
    const replayed=this.state.claims.find(x=>x.id===c.id);
    if(replayed)return structuredClone(replayed);
    const superseded=input.supersedes
      ? this.state.claims.find(x=>x.id===input.supersedes&&x.id!==c.id)
      : undefined;
    const similar=this.state.claims.filter(x=>x.claim===claim&&x.id!==c.id);
    const independentCorroboration=similar.filter(x=>x.modality!==input.modality);
    // Repeating the same proposition from the same modality is persistence,
    // not independent corroboration. Resolution needs an explicit supersedes edge.
    if(superseded)this.state.resolvedPairs++;
    else if(independentCorroboration.length)this.state.corroboratedPairs+=independentCorroboration.length;
    this.state.claims.unshift(c); this.state.claims=this.state.claims.slice(0,256);
    this.state.meanConfidence01=clamp(this.state.claims.reduce((s,x)=>s+x.confidence01,0)/Math.max(1,this.state.claims.length));
    this.state.lastAt=input.at; return structuredClone(c);
  }
  recent(limit=32){return this.state.claims.slice(0,Math.max(1,Math.min(64,Math.floor(limit)))).map(x=>structuredClone(x));}
  summary(){return {version:1,claims:this.state.claims.length,contradictionPairs:this.state.contradictionPairs,resolvedPairs:this.state.resolvedPairs,corroboratedPairs:this.state.corroboratedPairs,meanConfidence01:this.state.meanConfidence01,lastAt:this.state.lastAt};}
}
