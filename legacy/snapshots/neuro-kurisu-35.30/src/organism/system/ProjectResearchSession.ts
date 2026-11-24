import type { ExternalProjectResearchResult } from './ExternalProjectResearchTool.ts';
import { EvidenceFirewallEngine, type FirewallSourceClass } from './EvidenceFirewall.ts';

export interface ResearchSessionState {
  version:1;
  projectId:string|null;
  claimKey:string;
  results:Array<{url:string;sourceKey:string;contentHash:string;trust01:number;fetchedAt:number;ok:boolean}>;
  independentSources:number;
  promoted:boolean;
  promotionScore01:number;
  uniqueContentHashes:number;
  duplicateContentCount:number;
  lastAt:number;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export class ProjectResearchSession {
  private readonly firewall:EvidenceFirewallEngine;
  private state:ResearchSessionState={version:1,projectId:null,claimKey:'',results:[],independentSources:0,promoted:false,promotionScore01:0,uniqueContentHashes:0,duplicateContentCount:0,lastAt:0};
  constructor(firewall:EvidenceFirewallEngine){this.firewall=firewall;}
  restore(raw?:Partial<ResearchSessionState>|null){this.state={...this.state,...(raw??{}),version:1,results:Array.isArray(raw?.results)?raw!.results.slice(-24):[]};}
  snapshot(){return structuredClone(this.state);}
  begin(projectId:string,claimKey=`project:${projectId}:research`){const nextId=String(projectId);const nextClaim=claimKey.slice(0,180);if(this.state.projectId!==nextId || this.state.claimKey!==nextClaim){this.state.results=[];this.state.independentSources=0;this.state.promoted=false;this.state.promotionScore01=0;this.state.uniqueContentHashes=0;this.state.duplicateContentCount=0;}this.state.projectId=nextId;this.state.claimKey=nextClaim;this.state.lastAt=Date.now();}
  ingest(result:ExternalProjectResearchResult, sourceClass:FirewallSourceClass='external-api'){
    if(!result.ok) return this.snapshot();
    const sourceKey=String(result.independenceKey||'unknown').slice(0,120);
    const duplicate=this.state.results.some(r=>r.contentHash===result.contentHash);
    this.state.results=[{url:result.finalUrl||result.url,sourceKey,contentHash:result.contentHash,trust01:clamp(result.trust01),fetchedAt:result.fetchedAt,ok:true},...this.state.results.filter(r=>r.contentHash!==result.contentHash||r.sourceKey!==sourceKey)].slice(0,24);
    this.state.duplicateContentCount += duplicate ? 1 : 0;
    this.state.uniqueContentHashes=new Set(this.state.results.map(r=>r.contentHash)).size;
    const claim=this.firewall.observe({claimKey:this.state.claimKey,sourceClass,sourceKey,contentHash:result.contentHash,confidence01:clamp(result.trust01),trust01:clamp(result.trust01),at:result.fetchedAt});
    this.state.independentSources=claim.independentSources;this.state.promoted=claim.status==='promoted';this.state.promotionScore01=claim.promotionScore01;this.state.lastAt=Date.now();
    return this.snapshot();
  }
  ready(){return this.state.promoted;}
}
