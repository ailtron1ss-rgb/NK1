import { sha256Stable } from '../core/StableSerialization.ts';

/**
 * Evidence Firewall: a quarantine boundary between external observations and
 * high-confidence epistemic state.
 *
 * An observation can be useful immediately, but it is NOT promoted to
 * validated evidence until source-independent corroboration satisfies the
 * policy. Content identity and source identity are intentionally separate.
 */
export type FirewallSourceClass = 'os'|'device'|'user'|'external-api'|'world'|'organism'|'simulator'|'unknown';
export type FirewallStatus = 'quarantine'|'promoted'|'contested'|'rejected'|'expired';
export interface FirewallObservation {
  id:string;
  claimKey:string;
  sourceClass:FirewallSourceClass;
  sourceKey:string;
  /** Canonical source document identity; distinguishes separate pages from true same-page conflicts. */
  documentKey?:string;
  /** Cross-publisher article/story cluster; prevents syndicated copies counting independently. */
  sourceLineageKey?:string;
  contentHash?:string;
  confidence01:number;
  trust01:number;
  contradiction01:number;
  observedAt:number;
}
export interface EvidencePromotionReceipt { policyVersion:'firewall-v1'; promotedAt:number; independentSources:string[]; contentHashes:string[]; score01:number; }
export interface FirewallClaimState {
  claimKey:string;
  status:FirewallStatus;
  observations:number;
  independentSources:number;
  corroborations:number;
  contradictions:number;
  promotionScore01:number;
  promotedAt?:number;
  lastObservedAt:number;
  promotionReceipt?:EvidencePromotionReceipt;
}
export interface EvidenceFirewallState {
  version:1;
  observations:FirewallObservation[];
  claims:FirewallClaimState[];
  promotedCount:number;
  rejectedCount:number;
  expiredCount:number;
  lastAt:number;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const defaultState=():EvidenceFirewallState=>({version:1,observations:[],claims:[],promotedCount:0,rejectedCount:0,expiredCount:0,lastAt:0});
const legacyStableId=(claim:string,source:string,documentKey:string,sourceLineageKey:string,contentHash:string|undefined,at:number)=>{let h=2166136261>>>0;for(const c of `${claim}|${source}|${documentKey}|${sourceLineageKey}|${contentHash??''}|${Math.floor(at/60000)}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `fw:${h.toString(16)}`;};
const stableId=(claim:string,source:string,documentKey:string,sourceLineageKey:string,contentHash:string|undefined,at:number)=>`fw:${sha256Stable({claim,source,documentKey,sourceLineageKey,contentHash:contentHash??'',minuteBucket:Math.floor(at/60000)})}`;
const boundedTime=(raw:number,now=Date.now())=>{const value=Number.isFinite(raw)?Number(raw):now;return Math.max(0,Math.min(value,now+5*60*1000));};

export class EvidenceFirewallEngine {
  private state=defaultState();
  restore(raw?:Partial<EvidenceFirewallState>|null){
    const d=defaultState();
    this.state={...d,...(raw??{}),version:1,
      observations:Array.isArray(raw?.observations)?raw!.observations.slice(-512).map((r:any)=>({
        id:String(r?.id??'').slice(0,80),
        claimKey:String(r?.claimKey??'').slice(0,180),
        sourceClass:(['os','device','user','external-api','world','organism','simulator','unknown'].includes(String(r?.sourceClass))?String(r.sourceClass):'unknown') as FirewallSourceClass,
        sourceKey:String(r?.sourceKey??'unknown').trim().toLowerCase().slice(0,120),
        documentKey:String(r?.documentKey??'').trim().slice(0,1000)||undefined,
        sourceLineageKey:String(r?.sourceLineageKey??'').trim().slice(0,100)||undefined,
        contentHash:String(r?.contentHash??'').trim().toLowerCase().slice(0,96)||undefined,
        confidence01:clamp(Number(r?.confidence01??.5)),
        trust01:clamp(Number(r?.trust01??.5)),
        contradiction01:clamp(Number(r?.contradiction01??0)),
        observedAt:Math.max(0,Number(r?.observedAt??0)||0),
      })):[],
      claims:Array.isArray(raw?.claims)?raw!.claims.slice(-256):[]};
    this.recompute();
  }
  snapshot(){return structuredClone(this.state);}
  observe(input:{claimKey:string;sourceClass:FirewallSourceClass;sourceKey:string;documentKey?:string;sourceLineageKey?:string;contentHash?:string;confidence01?:number;trust01?:number;contradiction01?:number;at?:number}){
    const now=Date.now();
    const at=boundedTime(input.at??now,now);
    const claimKey=String(input.claimKey??'').trim().slice(0,180); const sourceKey=String(input.sourceKey||'unknown').trim().toLowerCase().slice(0,120);
    const documentKey=String(input.documentKey??'').trim().slice(0,1000);
    const sourceLineageKey=String(input.sourceLineageKey??'').trim().slice(0,100);
    const contentHash=String(input.contentHash??'').trim().toLowerCase().slice(0,96)||undefined;
    const newId=stableId(claimKey,sourceKey,documentKey,sourceLineageKey,contentHash,at);
    const legacyId=legacyStableId(claimKey,sourceKey,documentKey,sourceLineageKey,contentHash,at);
    const prior=this.state.observations.find(x=>x.id===newId || x.id===legacyId || (String(x.claimKey??'').trim()===claimKey && String(x.sourceKey??'').trim().toLowerCase()===sourceKey && String(x.documentKey??'').trim()===documentKey && String(x.sourceLineageKey??'')===sourceLineageKey && String(x.contentHash??'')===String(contentHash??'') && Math.floor(x.observedAt/60000)===Math.floor(at/60000)));
    const row:FirewallObservation={id:prior?.id??newId,claimKey,sourceClass:input.sourceClass,sourceKey,documentKey:documentKey||undefined,sourceLineageKey:sourceLineageKey||undefined,contentHash,confidence01:clamp(input.confidence01??.5),trust01:clamp(input.trust01??.5),contradiction01:clamp(input.contradiction01??0),observedAt:at};
    this.state.observations=[row,...this.state.observations.filter(x=>x.id!==row.id)].slice(0,512); this.state.lastAt=at; this.recompute();
    return this.claim(claimKey);
  }
  claim(claimKey:string):FirewallClaimState{
    return structuredClone(this.state.claims.find(c=>c.claimKey===claimKey) ?? {claimKey,status:'quarantine',observations:0,independentSources:0,corroborations:0,contradictions:0,promotionScore01:0,lastObservedAt:0});
  }
  canPromote(claimKey:string){return this.claim(claimKey).status==='promoted';}
  promotionScore(claimKey:string){return this.claim(claimKey).promotionScore01;}
  private recompute(){
    const byClaim=new Map<string,FirewallObservation[]>();
    for(const row of this.state.observations){const arr=byClaim.get(row.claimKey)??[];arr.push(row);byClaim.set(row.claimKey,arr);}
    const claims:FirewallClaimState[]=[];
    for(const [claimKey,rows] of byClaim){
      const active=rows.filter(r=>Date.now()-r.observedAt<=30*24*60*60*1000 && r.sourceClass!=='simulator');
      const uniqueSources=new Set(active.map(r=>`${r.sourceClass}:${r.sourceKey}`));
      const uniqueContentHashes=new Set(active.map(r=>r.contentHash).filter((v):v is string=>Boolean(v)));
      const sameSourceDocumentHashes=new Map<string,Set<string>>();
      for(const row of active){
        if(!row.contentHash)continue;
        // Different pages from one publisher are normal research material, not a contradiction.
        // Only versions of the same document conflict; legacy observations without documentKey
        // retain conservative publisher-wide conflict behavior until they age out.
        const documentIdentity=row.documentKey?`document:${row.documentKey}`:'legacy-publisher-wide';
        const key=`${row.sourceClass}:${row.sourceKey}:${documentIdentity}`;
        const hashes=sameSourceDocumentHashes.get(key)??new Set<string>();hashes.add(row.contentHash);sameSourceDocumentHashes.set(key,hashes);
      }
      const contentConflictCount=[...sameSourceDocumentHashes.values()].filter(h=>h.size>1).length;
      const contradictions=active.filter(r=>r.contradiction01>=.65).length + contentConflictCount;
      const trust=Math.max(...active.map(r=>clamp(r.trust01*.65+r.confidence01*.35)),0);
      const externalish=active.some(r=>r.sourceClass==='external-api');
      // Count connected source-lineage families for external research. Publisher domains
      // linked by the same syndicated story become one family; unrelated publishers and
      // unrelated stories remain independent. Legacy rows without lineage use document/hash.
      const countExternalFamilies=():number=>{
        const external=active.filter(r=>r.sourceClass==='external-api');
        const graph=new Map<string,Set<string>>();
        for(const row of external){
          const source=`source:${row.sourceKey}`;
          const lineage=`lineage:${row.sourceLineageKey || (row.documentKey ? `doc:${row.documentKey}` : row.contentHash ? `hash:${row.contentHash}` : `observation:${row.id}`)}`;
          const sourceEdges=graph.get(source)??new Set<string>();sourceEdges.add(lineage);graph.set(source,sourceEdges);
          const lineageEdges=graph.get(lineage)??new Set<string>();lineageEdges.add(source);graph.set(lineage,lineageEdges);
        }
        let components=0;const visited=new Set<string>();
        for(const node of graph.keys()){
          if(visited.has(node))continue;components++;const stack=[node];visited.add(node);
          while(stack.length){const current=stack.pop()!;for(const adjacent of graph.get(current)??[])if(!visited.has(adjacent)){visited.add(adjacent);stack.push(adjacent);}}
        }
        return components;
      };
      const independentSourceCount=externalish?countExternalFamilies():uniqueSources.size;
      const corroborations=Math.max(0,independentSourceCount-1);
      const minSources=externalish?2:1;
      const noStrongContradiction=contradictions<2;
      const score=clamp(trust*.48+Math.min(1,independentSourceCount/3)*.32+Math.min(1,corroborations/2)*.20-(contradictions*.10));
      // External corroboration must vary source identity, story lineage and content. Copies
      // of the same story across publisher domains cannot satisfy the diversity threshold.
      const independentEvidence=externalish
        ? independentSourceCount>=minSources && uniqueContentHashes.size>=2
        : independentSourceCount>=minSources;
      const promoted=active.length>0 && independentEvidence && score>= (externalish?.72:.68) && noStrongContradiction;
      const prior=this.state.claims.find(c=>c.claimKey===claimKey);
      const status:FirewallStatus = contradictions>=3 ? 'rejected' : (contradictions>=1 ? 'contested' : (promoted?'promoted':'quarantine'));
      const promotedAt=promoted?(prior?.promotedAt??Date.now()):undefined;
      const promotionReceipt = status==='promoted' && promotedAt ? {
        policyVersion:'firewall-v1' as const,
        promotedAt,
        independentSources:[...uniqueSources].sort().slice(0,16),
        contentHashes:[...new Set(active.map(r=>r.contentHash).filter((v):v is string=>Boolean(v)))].sort().slice(0,32),
        score01:score,
      } : undefined;
      claims.push({claimKey,status,observations:rows.length,independentSources:independentSourceCount,corroborations,contradictions,promotionScore01:score,promotedAt,lastObservedAt:Math.max(...rows.map(r=>r.observedAt),0),promotionReceipt: promotionReceipt ?? (status==='contested' || status==='rejected' ? prior?.promotionReceipt : undefined)});
    }
    for (const claim of claims) {
      const stale = claim.lastObservedAt>0 && Date.now()-claim.lastObservedAt>30*24*60*60*1000;
      if (stale && claim.status!=='rejected') claim.status='expired';
    }
    this.state.claims=claims.slice(-256);
    this.state.promotedCount=claims.filter(c=>c.status==='promoted').length;
    this.state.rejectedCount=claims.filter(c=>c.status==='rejected').length;
    this.state.expiredCount=claims.filter(c=>c.status==='expired').length;
  }
}
