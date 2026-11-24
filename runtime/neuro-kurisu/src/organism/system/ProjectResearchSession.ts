import { createHash } from 'node:crypto';
import { publisherIndependenceKey, type ExternalProjectResearchResult } from './ExternalProjectResearchTool.ts';
import { EvidenceFirewallEngine, type FirewallSourceClass, type FirewallStatus } from './EvidenceFirewall.ts';
import { aggregateClaimEvidence, assessClaimAgainstExcerpt, type ClaimEvidenceAssessment, type ClaimVerificationSummary } from './ResearchClaimAssessment.ts';
import { resolveResearchSourceLineage, type ResearchLineageRelation } from './ResearchSourceLineage.ts';
import { assessClaimWithSemanticEntailment, type ResearchNliBackend } from './ResearchSemanticEntailment.ts';

export interface ResearchSessionState {
  version:1;
  projectId:string|null;
  claimKey:string;
  results:Array<{url:string;sourceKey:string;sourceHost:string;documentKey:string;contentHash:string;sourceLineageKey:string;lineageRelation:ResearchLineageRelation;lineageSimilarity01:number;title:string;snippet:string;contentType:string;trust01:number;relevance01:number;queryHash:string;fetchedAt:number;ok:boolean;claim?:string;claimAssessment?:ClaimEvidenceAssessment}>;
  /** Explicit claim is separate from the broad research query; legacy query-only sessions remain unknown. */
  claimText:string|null;
  claimVerification:ClaimVerificationSummary;
  independentSources:number;
  promoted:boolean;
  /** Firewall promotion means source diversity, not semantic proof of a claim. */
  firewallStatus:FirewallStatus;
  promotionScore01:number;
  uniqueContentHashes:number;
  distinctSourceKeys:number;
  duplicateContentCount:number;
  duplicateLineageCount:number;
  lastAt:number;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clean=(value:unknown,max=120)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const emptyClaimVerification=():ClaimVerificationSummary=>({version:1,claimId:null,claim:null,verdict:'unknown',method:'exact-text-anchor-v1',scope:'textual-anchor-only',calibratedProbability:null,independentSupportSources:0,independentRefuteSources:0,semanticSupportSources:0,semanticRefuteSources:0,modelVersions:[],evidence:[],reason:'no-explicit-assertive-claim-provided'});
function retainValidStoredSemanticAssessment(raw:any, claim:string, candidate:{url:string;contentHash:string;snippet:string}): ClaimEvidenceAssessment | null {
  if(!raw || raw.method!=='nli-cross-encoder-v1' || raw.scope!=='model-assisted-entailment' || String(raw.claim??'').normalize('NFKC').trim().toLocaleLowerCase()!==claim.normalize('NFKC').trim().toLocaleLowerCase() || !String(raw.modelId??'').trim() || !Array.isArray(raw.atomAssessments) || raw.atomAssessments.length<1 || raw.atomAssessments.length>6) return null;
  const validModelId=(value:unknown)=>typeof value==='string'&&value.trim().length>0&&value.length<=200;
  const validModelRevision=(value:unknown)=>value===undefined||(typeof value==='string'&&value.trim().length>0&&value.length<=200);
  if(raw.modelRevision!==undefined&&!validModelRevision(raw.modelRevision)) return null;
  const validCalibration=(value:any)=>Boolean(value && value.method==='temperature-scaling-from-softmax-v1' && typeof value.datasetSha256==='string' && /^[a-f0-9]{64}$/.test(value.datasetSha256) && Number.isInteger(value.sampleCount) && value.sampleCount>=90 && Number.isFinite(value.temperature) && value.temperature>=.05 && value.temperature<=20);
  if(raw.calibration!==undefined&&!validCalibration(raw.calibration)) return null;
  const sameCalibration=(a:any,b:any)=>Boolean(a&&b&&a.method===b.method&&a.datasetSha256===b.datasetSha256&&a.sampleCount===b.sampleCount&&a.temperature===b.temperature);
  const digest=createHash('sha256').update(claim.normalize('NFKC').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase()).digest('hex').slice(0,32);
  if(String(raw.claimId??'')!==`claim:${digest}` || !['support','refute','mixed','unknown'].includes(raw.verdict)) return null;
  for(const atom of raw.atomAssessments){
    if(!atom || !String(atom.claimId??'').startsWith('atom:') || !['support','refute','mixed','unknown'].includes(atom.verdict)) return null;
    if(atom.modelId!==undefined&&(!validModelId(atom.modelId)||atom.modelId!==raw.modelId)) return null;
    if(!validModelRevision(atom.modelRevision)) return null;
    if(raw.modelRevision!==undefined&&atom.modelRevision!==undefined&&atom.modelRevision!==raw.modelRevision) return null;
    if(atom.scores && !['entailment','contradiction','neutral'].every(k=>Number.isFinite(Number(atom.scores[k]))&&Number(atom.scores[k])>=0&&Number(atom.scores[k])<=1)) return null;
    if(atom.calibration!==undefined&&!validCalibration(atom.calibration)) return null;
    if(atom.calibrated===true&&(!raw.calibration||!sameCalibration(atom.calibration,raw.calibration))) return null;
    if(raw.calibration&&atom.calibrated!==true) return null;
  }
  if(!Array.isArray(raw.quotes) || raw.quotes.length>12) return null;
  for(const quote of raw.quotes){
    const start=Number(quote?.start), end=Number(quote?.end), semantic=quote?.semantic;
    if(!semantic || quote.url!==candidate.url || quote.contentHash!==candidate.contentHash || !Number.isInteger(start) || !Number.isInteger(end) || start<0 || end<=start || candidate.snippet.slice(start,end)!==quote.quote) return null;
    if(!['support','refute'].includes(quote.verdict) || !['modelId','entailmentScore','contradictionScore','neutralScore','threshold'].every(k=>semantic[k]!==undefined)) return null;
    if(!validModelId(semantic.modelId)||semantic.modelId!==raw.modelId||!validModelRevision(semantic.modelRevision)) return null;
    if(raw.modelRevision!==undefined&&semantic.modelRevision!==undefined&&semantic.modelRevision!==raw.modelRevision) return null;
    if(semantic.calibration!==undefined&&!validCalibration(semantic.calibration)) return null;
    if(semantic.calibrated===true&&(!raw.calibration||!sameCalibration(semantic.calibration,raw.calibration))) return null;
    if(raw.calibration&&semantic.calibrated!==true) return null;
  }
  return structuredClone(raw) as ClaimEvidenceAssessment;
}
export class ProjectResearchSession {
  private readonly firewall:EvidenceFirewallEngine;
  private state:ResearchSessionState={version:1,projectId:null,claimKey:'',results:[],claimText:null,claimVerification:emptyClaimVerification(),independentSources:0,promoted:false,firewallStatus:'quarantine',promotionScore01:0,uniqueContentHashes:0,distinctSourceKeys:0,duplicateContentCount:0,duplicateLineageCount:0,lastAt:0};
  constructor(firewall:EvidenceFirewallEngine){this.firewall=firewall;}
  restore(raw?:Partial<ResearchSessionState>|null){
    const incoming=Array.isArray(raw?.results)?raw!.results.slice(-24):[];
    const restoredClaim=clean((raw as any)?.claimText || incoming.find((row:any)=>String(row?.claim??'').trim())?.claim || '',600) || null;
    // Rebuild lineage oldest→newest; never trust a persisted cluster label without
    // recomputing it from bounded source metadata and actual extracted content.
    const rebuilt:Array<ResearchSessionState['results'][number]> = [];
    for (const row of incoming.slice().reverse() as any[]) {
      const url=clean(row?.url,1000);
      let sourceHost='';
      try{sourceHost=new URL(url).hostname.toLowerCase();}catch{sourceHost=clean(row?.sourceHost||'',255).toLowerCase();}
      const canonicalPublisher=sourceHost?publisherIndependenceKey(sourceHost):'unknown';
      let documentKey='';try{const u=new URL(url);u.hash='';u.search='';documentKey=`${u.protocol}//${u.host}${u.pathname}`.slice(0,1000);}catch{/* Unparseable legacy URLs cannot support document-level matching. */}
      const claim=clean(row?.claim,600) || undefined;
      const candidate={url,sourceHost,documentKey,contentHash:clean(row?.contentHash,96).toLowerCase(),title:clean(row?.title,240),snippet:clean(row?.snippet,1200),sourceKey:clean(canonicalPublisher||'unknown',120).toLowerCase(),fetchedAt:Math.max(0,Number(row?.fetchedAt??0)),claim};
      const lineage=resolveResearchSourceLineage(candidate,rebuilt);
      const normalized={
        ...candidate,sourceLineageKey:lineage.sourceLineageKey,lineageRelation:lineage.relation,lineageSimilarity01:lineage.similarity01,
        contentType:clean(row?.contentType,120),trust01:clamp(Number(row?.trust01??0)),relevance01:clamp(Number(row?.relevance01??1)),queryHash:clean(row?.queryHash,96).toLowerCase(),ok:Boolean(row?.ok),
        claimAssessment:claim?(retainValidStoredSemanticAssessment(row?.claimAssessment,claim,{url,contentHash:candidate.contentHash,snippet:candidate.snippet}) ?? assessClaimAgainstExcerpt(claim,{...candidate,sourceLineageKey:lineage.sourceLineageKey})):undefined,
      } as ResearchSessionState['results'][number];
      rebuilt.push(normalized);
    }
    const results=rebuilt.reverse();
    this.state={...this.state,...(raw??{}),version:1,claimText:restoredClaim,results};
    this.state.uniqueContentHashes=new Set(this.state.results.map(r=>r.contentHash).filter(Boolean)).size;
    this.state.distinctSourceKeys=new Set(this.state.results.map(r=>String(r.sourceKey||'unknown').toLowerCase())).size;
    this.state.duplicateLineageCount=Math.max(0,this.state.results.length-new Set(this.state.results.map(r=>r.sourceLineageKey).filter(Boolean)).size);
    const claim=this.state.claimKey?this.firewall.claim(this.state.claimKey):null;
    if(claim){this.state.independentSources=claim.independentSources;this.state.promoted=claim.status==='promoted';this.state.firewallStatus=claim.status;this.state.promotionScore01=claim.promotionScore01;}
    else {this.state.independentSources=0;this.state.promoted=false;this.state.firewallStatus='quarantine';this.state.promotionScore01=0;}
    this.recomputeClaimVerification();
  }
  snapshot(){return structuredClone(this.state);}
  begin(projectId:string,claimKey=`project:${projectId}:research`){const nextId=String(projectId);const nextClaim=String(claimKey??'').slice(0,180);if(this.state.projectId!==nextId || this.state.claimKey!==nextClaim){this.state.results=[];this.state.claimText=null;this.state.claimVerification=emptyClaimVerification();this.state.independentSources=0;this.state.promoted=false;this.state.firewallStatus='quarantine';this.state.promotionScore01=0;this.state.uniqueContentHashes=0;this.state.distinctSourceKeys=0;this.state.duplicateContentCount=0;this.state.duplicateLineageCount=0;}this.state.projectId=nextId;this.state.claimKey=nextClaim;this.state.lastAt=Date.now();}
  ingest(result:ExternalProjectResearchResult, sourceClass:FirewallSourceClass='external-api'){
    if(!result.ok || !result.verified || !result.externalEvidence) return this.snapshot();
    const relevance=clamp(Number(result.relevance01??1));
    const queryHash=clean(result.queryHash??'',96).toLowerCase();
    const duplicate=this.state.results.some(r=>r.contentHash===result.contentHash);
    let parsedHost='';try{parsedHost=new URL(result.finalUrl||result.url).hostname;}catch{/* Invalid URLs cannot prove publisher identity. */}
    const sourceHost=clean(parsedHost||'',255).toLowerCase();
    // Derive identity from the URL's actual serving host rather than trusting either
    // a caller-supplied independence key or a conflicting sourceHost field.
    const sourceKey=String(sourceHost?publisherIndependenceKey(sourceHost):'unknown').slice(0,120).toLowerCase();
    let documentKey='';try{const u=new URL(result.finalUrl||result.url);documentKey=`${u.protocol}//${u.host}${u.pathname}`.slice(0,1000);}catch{/* Invalid URLs are not given document-level identity. */}
    const contentHash=String(result.contentHash||'').toLowerCase();
    const claim=clean(result.claim,600) || undefined;
    // The first explicit claim owns the session. A changed claim must start a new
    // session/key; silently mixing propositions would corrupt its evidence trail.
    if(claim && !this.state.claimText) this.state.claimText=claim;
    const candidate={url:result.finalUrl||result.url,sourceKey,sourceHost,documentKey,contentHash,title:clean(result.title,240),snippet:clean(result.snippet,1200),fetchedAt:Math.max(0,Number(result.fetchedAt)||0),claim};
    const lineage=resolveResearchSourceLineage(candidate,this.state.results);
    const lineageCandidate={...candidate,sourceLineageKey:lineage.sourceLineageKey};
    const claimAssessment=claim?assessClaimAgainstExcerpt(claim,lineageCandidate):undefined;
    this.state.results=[{...candidate,sourceLineageKey:lineage.sourceLineageKey,lineageRelation:lineage.relation,lineageSimilarity01:lineage.similarity01,contentType:clean(result.contentType,120),trust01:clamp(result.trust01),relevance01:relevance,queryHash,fetchedAt:result.fetchedAt,ok:true,claimAssessment},...this.state.results.filter(r=>r.contentHash!==contentHash||r.sourceKey!==sourceKey||r.documentKey!==documentKey)].slice(0,24);
    this.state.duplicateContentCount += duplicate ? 1 : 0;
    this.state.uniqueContentHashes=new Set(this.state.results.map(r=>r.contentHash).filter(Boolean)).size;
    this.state.distinctSourceKeys=new Set(this.state.results.map(r=>String(r.sourceKey||'unknown').toLowerCase())).size;
    this.state.duplicateLineageCount=Math.max(0,this.state.results.length-new Set(this.state.results.map(r=>r.sourceLineageKey).filter(Boolean)).size);
    // Topical relevance attenuates transport confidence. A successful HTTPS fetch
    // is an observation, not proof that the page supports the proposition.
    const evidenceConfidence=clamp(result.trust01*relevance);
    const claimState=this.firewall.observe({claimKey:this.state.claimKey,sourceClass,sourceKey,documentKey,sourceLineageKey:lineage.sourceLineageKey,contentHash,confidence01:evidenceConfidence,trust01:clamp(result.trust01),at:result.fetchedAt});
    this.state.independentSources=claimState.independentSources;this.state.promoted=claimState.status==='promoted';this.state.firewallStatus=claimState.status;this.state.promotionScore01=claimState.promotionScore01;this.state.lastAt=Date.now();
    this.recomputeClaimVerification();
    return this.snapshot();
  }
  /**
   * Enrich the newest captured result with model-based NLI when an explicit backend is
   * configured. Ingestion remains usable offline; a missing/failing backend falls back
   * to the conservative exact-text assessment and can never promote a fact.
   */
  async assessLatestSemantically(backend: ResearchNliBackend | null){
    if(!backend || !this.state.claimText || !this.state.results.length) return this.snapshot();
    const row=this.state.results[0]!;
    if(!row.claim || row.claim.normalize('NFKC').trim().toLocaleLowerCase()!==this.state.claimText.normalize('NFKC').trim().toLocaleLowerCase()) return this.snapshot();
    const candidate={url:row.url,title:row.title,documentKey:row.documentKey,contentHash:row.contentHash,sourceKey:row.sourceKey,sourceLineageKey:row.sourceLineageKey,snippet:row.snippet,fetchedAt:row.fetchedAt,claim:row.claim};
    row.claimAssessment=await assessClaimWithSemanticEntailment(this.state.claimText,candidate,backend);
    this.recomputeClaimVerification();
    return this.snapshot();
  }
  private recomputeClaimVerification(){
    const candidates=this.state.results.map(row=>({url:row.url,title:row.title,documentKey:row.documentKey,contentHash:row.contentHash,sourceKey:row.sourceKey,sourceLineageKey:row.sourceLineageKey,snippet:row.snippet,fetchedAt:row.fetchedAt,claim:row.claim}));
    const assessments=this.state.results.map(row=>row.claimAssessment);
    this.state.claimVerification=this.state.claimText
      ? aggregateClaimEvidence(this.state.claimText,candidates,assessments)
      : emptyClaimVerification();
  }
  ready(){return this.state.promoted;}
}
