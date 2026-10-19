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
const stableId=(claim:string,source:string,contentHash:string|undefined,at:number)=>{let h=2166136261>>>0;for(const c of `${claim}|${source}|${contentHash??''}|${Math.floor(at/60000)}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `fw:${h.toString(16)}`;};
const boundedTime=(raw:number,now=Date.now())=>{const value=Number.isFinite(raw)?Number(raw):now;return Math.max(0,Math.min(value,now+5*60*1000));};

export class EvidenceFirewallEngine {
  private state=defaultState();
  restore(raw?:Partial<EvidenceFirewallState>|null){
    const d=defaultState();
    this.state={...d,...(raw??{}),version:1,
      observations:Array.isArray(raw?.observations)?raw!.observations.slice(-512):[],
      claims:Array.isArray(raw?.claims)?raw!.claims.slice(-256):[]};
    this.recompute();
  }
  snapshot(){return structuredClone(this.state);}
  observe(input:{claimKey:string;sourceClass:FirewallSourceClass;sourceKey:string;contentHash?:string;confidence01?:number;trust01?:number;contradiction01?:number;at?:number}){
    const now=Date.now();
    const at=boundedTime(input.at??now,now);
    const claimKey=String(input.claimKey).slice(0,180); const sourceKey=String(input.sourceKey||'unknown').slice(0,120);
    const row:FirewallObservation={id:stableId(claimKey,sourceKey,input.contentHash,at),claimKey,sourceClass:input.sourceClass,sourceKey,contentHash:input.contentHash?.slice(0,96),confidence01:clamp(input.confidence01??.5),trust01:clamp(input.trust01??.5),contradiction01:clamp(input.contradiction01??0),observedAt:at};
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
      const sameSourceHashes=new Map<string,Set<string>>();
      for(const row of active){if(!row.contentHash)continue;const key=`${row.sourceClass}:${row.sourceKey}`;const hashes=sameSourceHashes.get(key)??new Set<string>();hashes.add(row.contentHash);sameSourceHashes.set(key,hashes);}
      const contentConflictCount=[...sameSourceHashes.values()].filter(h=>h.size>1).length;
      const contradictions=active.filter(r=>r.contradiction01>=.65).length + contentConflictCount;
      const corroborations=Math.max(0,uniqueSources.size-1);
      const trust=Math.max(...active.map(r=>clamp(r.trust01*.65+r.confidence01*.35)),0);
      const externalish=active.some(r=>r.sourceClass==='external-api');
      const minSources=externalish?2:1;
      const noStrongContradiction=contradictions<2;
      const score=clamp(trust*.48+Math.min(1,uniqueSources.size/3)*.32+Math.min(1,corroborations/2)*.20-(contradictions*.10));
      const promoted=active.length>0 && uniqueSources.size>=minSources && score>= (externalish?.72:.68) && noStrongContradiction;
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
      claims.push({claimKey,status,observations:rows.length,independentSources:uniqueSources.size,corroborations,contradictions,promotionScore01:score,promotedAt,lastObservedAt:Math.max(...rows.map(r=>r.observedAt),0),promotionReceipt: promotionReceipt ?? (status==='contested' || status==='rejected' ? prior?.promotionReceipt : undefined)});
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
