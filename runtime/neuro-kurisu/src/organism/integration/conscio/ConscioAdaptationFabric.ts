import { sha256Stable } from '../../core/StableSerialization.ts';
import { tokenizeUnicodeTerms } from '../../core/UnicodeTokenizer.ts';
import { DatabaseSync } from 'node:sqlite';

export type ConscioSourceState = 'canonical'|'research'|'legacy'|'provenance-only';
export type ConscioSkillStatus = 'quarantined'|'trial'|'approved'|'rejected';
export type ConscioPeerStatus = 'pending'|'trusted'|'revoked';
export type ConscioMessageStatus = 'queued'|'quarantined'|'delivered'|'acknowledged'|'expired';
export type ConscioMetabolicState = 'vital'|'active'|'fatigue'|'critical';

export interface ConscioSearchDocument { id:string; title:string; text:string; source:string; kind:string; updatedAt:number; }
export interface ConscioSearchHit extends ConscioSearchDocument { score:number; lexicalScore:number; semanticScore:number; rrfScore:number; matchedTerms:string[]; }
export interface ConscioSkillArtifact {
  id:string; name:string; version:string; fingerprint:string; summary:string;
  provenance:string; status:ConscioSkillStatus; trialCount:number; successes:number; failures:number;
  approvedAt?:number; rejectionReason?:string; createdAt:number;
}
export interface ConscioSkillTrial { id:string; skillId:string; ok:boolean; evidence:string; at:number; }
export interface ConscioPeerCard { id:string; label:string; role:string; capabilities:string[]; trust01:number; status:ConscioPeerStatus; createdAt:number; lastSeenAt:number; }
export interface ConscioLiaisonMessage { id:string; from:string; to:string; space:string; payload:unknown; digest:string; status:ConscioMessageStatus; createdAt:number; expiresAt:number; idempotencyKey?:string; }
export interface ConscioConfidenceObservation { id:string; key:string; predicted01:number; outcome01:number; evidenceTrust01:number; sampleCount:number; brier:number; at:number; }
export interface ConscioClaimReceipt { id:string; claim:string; expectedAction:string; supported:boolean; confidence01:number; evidence:string[]; at:number; }
export interface ConscioMetabolicAssessment { state:ConscioMetabolicState; usedTokens:number; contextWindow:number; usage01:number; advisory:string; shouldHandoff:boolean; shouldDream:boolean; }

export interface ConscioAdaptationState {
  version:1;
  source:{name:'Conscio-4.8.2'; mode:'canonical-adapter'; integratedAt:string};
  documents:ConscioSearchDocument[];
  skills:ConscioSkillArtifact[];
  skillTrials:ConscioSkillTrial[];
  peers:ConscioPeerCard[];
  messages:ConscioLiaisonMessage[];
  confidence:ConscioConfidenceObservation[];
  claims:ConscioClaimReceipt[];
  sourceBoundaries:Record<string,ConscioSourceState>;
  metrics:{documentsIndexed:number; searches:number; searchHits:number; skillsPublished:number; skillTrials:number; skillsPromoted:number; peerMessages:number; peerAcks:number; peerDenials:number; peerIdempotencyConflicts:number; confidenceObservations:number; claimsVerified:number; quarantinedArtifacts:number; sourceBoundaryChecks:number};
}

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
const sha=(value:unknown)=>sha256Stable(value, 'legacy');
const tokenize=(text:string)=>tokenizeUnicodeTerms(text);

function sourceState(path:string):ConscioSourceState {
  const p=String(path).replace(/\\/g,'/').toLocaleLowerCase();
  if(p.includes('input-archives')||p.includes('provenance')) return 'provenance-only';
  if(p.includes('research/')||p.includes('/research')) return 'research';
  if(p.includes('legacy/')||p.includes('/legacy')||p.includes('archive')||p.includes('snapshot/')) return 'legacy';
  return 'canonical';
}

export function defaultConscioAdaptationState():ConscioAdaptationState {
  return {version:1,source:{name:'Conscio-4.8.2',mode:'canonical-adapter',integratedAt:'2026-10-08'},documents:[],skills:[],skillTrials:[],peers:[],messages:[],confidence:[],claims:[],sourceBoundaries:{},metrics:{documentsIndexed:0,searches:0,searchHits:0,skillsPublished:0,skillTrials:0,skillsPromoted:0,peerMessages:0,peerAcks:0,peerDenials:0,peerIdempotencyConflicts:0,confidenceObservations:0,claimsVerified:0,quarantinedArtifacts:0,sourceBoundaryChecks:0}};
}

export class ConscioAdaptationFabric {
  private state=defaultConscioAdaptationState();
  private db:DatabaseSync;
  constructor(){
    this.db=new DatabaseSync(':memory:');
    try{
      this.db.exec(`CREATE VIRTUAL TABLE docs_porter USING fts5(id UNINDEXED,title,text,source,kind,updatedAt UNINDEXED,tokenize='porter unicode61'); CREATE VIRTUAL TABLE docs_trigram USING fts5(id UNINDEXED,title,text,source,kind,updatedAt UNINDEXED,tokenize='trigram');`);
    }catch{}
  }
  restore(raw?:Partial<ConscioAdaptationState>|null){
    const d=defaultConscioAdaptationState(); const value=raw??{};
    this.state={...d,...value,source:{...d.source,...(value.source??{})},documents:Array.isArray(value.documents)?value.documents.slice(-2500):[],skills:Array.isArray(value.skills)?value.skills.slice(-512):[],skillTrials:Array.isArray(value.skillTrials)?value.skillTrials.slice(-2048):[],peers:Array.isArray(value.peers)?value.peers.slice(-128):[],messages:Array.isArray(value.messages)?value.messages.slice(-2048):[],confidence:Array.isArray(value.confidence)?value.confidence.slice(-2048):[],claims:Array.isArray(value.claims)?value.claims.slice(-1024):[],sourceBoundaries:{...(value.sourceBoundaries??{})},metrics:{...d.metrics,...(value.metrics??{})}};
    this.rebuildIndex();
  }
  snapshot():ConscioAdaptationState{return structuredClone(this.state);}
  diagnostics(){
    const pending=this.state.messages.filter(m=>m.status==='queued'||m.status==='quarantined').length;
    const trustedPeers=this.state.peers.filter(p=>p.status==='trusted').length;
    const quarantined=this.state.skills.filter(s=>s.status==='quarantined'||s.status==='trial').length;
    const metabolic=this.assessMetabolic(0,1);
    return {source:this.state.source,counts:{documents:this.state.documents.length,skills:this.state.skills.length,pendingSkills:quarantined,skillTrials:this.state.skillTrials.length,peers:this.state.peers.length,trustedPeers,pendingMessages:pending,confidence:this.state.confidence.length,claims:this.state.claims.length,sourceBoundaries:Object.keys(this.state.sourceBoundaries).length},metrics:this.state.metrics,advisoryMetabolic:metabolic};
  }
  private rebuildIndex(){
    try{this.db.exec('DELETE FROM docs_porter; DELETE FROM docs_trigram;'); for(const d of this.state.documents){const q=`INSERT INTO docs_porter(id,title,text,source,kind,updatedAt) VALUES(?,?,?,?,?,?)`; this.db.prepare(q).run(d.id,d.title,d.text,d.source,d.kind,d.updatedAt); this.db.prepare(`INSERT INTO docs_trigram(id,title,text,source,kind,updatedAt) VALUES(?,?,?,?,?,?)`).run(d.id,d.title,d.text,d.source,d.kind,d.updatedAt);} }catch{}
  }
  syncDocuments(rows:Array<{id?:string;content?:string;title?:string;source?:string;kind?:string;createdAt?:number;updatedAt?:number}>){
    const incoming=rows.map((r,i)=>({id:String(r.id??sha(r).slice(0,20)),title:String(r.title??r.kind??'memory'),text:String(r.content??'').slice(0,16000),source:String(r.source??'canonical-memory'),kind:String(r.kind??'memory'),updatedAt:Number(r.updatedAt??r.createdAt??Date.now())})).filter(d=>d.text.trim());
    const byId=new Map(this.state.documents.map(d=>[d.id,d])); for(const d of incoming) byId.set(d.id,d); this.state.documents=[...byId.values()].slice(-2500); this.state.metrics.documentsIndexed+=incoming.length; this.rebuildIndex(); return {indexed:incoming.length,total:this.state.documents.length};
  }
  hybridSearch(query:string,limit=12):ConscioSearchHit[]{
    const q=String(query).trim(); if(!q)return []; this.state.metrics.searches++; const lexical=new Map<string,{score:number,rank:number,terms:string[]}>(); const trigrams=new Map<string,{score:number,rank:number}>();
    const ftsTerms=tokenize(q).slice(0,24).map(t=>`\"${t.replaceAll('\"','\"\"')}\"`);
    const matchQuery=ftsTerms.join(' OR ');
    try{
      if(matchQuery){
        const rows=this.db.prepare(`SELECT id,bm25(docs_porter) AS score FROM docs_porter WHERE docs_porter MATCH ? ORDER BY score LIMIT ?`).all(matchQuery,Math.max(limit*4,32)) as any[];
        rows.forEach((r,i)=>lexical.set(String(r.id),{score:1/(1+Math.abs(Number(r.score)||0)),rank:i+1,terms:[]}));
        const trows=this.db.prepare(`SELECT id,bm25(docs_trigram) AS score FROM docs_trigram WHERE docs_trigram MATCH ? ORDER BY score LIMIT ?`).all(matchQuery,Math.max(limit*4,32)) as any[];
        trows.forEach((r,i)=>trigrams.set(String(r.id),{score:1/(1+Math.abs(Number(r.score)||0)),rank:i+1}));
      }
    }catch{}
    const qTokens=new Set<string>(tokenize(q)); const all=this.state.documents.map(d=>{const tokens=new Set<string>(tokenize(`${d.title} ${d.text}`)); const matched=Array.from(qTokens).filter((t:string)=>tokens.has(t)); const overlap=qTokens.size?matched.length/qTokens.size:0; return {d,overlap,matched};});
    const semanticRanked=all.filter(x=>x.overlap>0).sort((a,b)=>b.overlap-a.overlap).slice(0,Math.max(limit*4,32)); const semRank=new Map(semanticRanked.map((x,i)=>[x.d.id,{score:x.overlap,rank:i+1,matched:x.matched}]));
    const ids=new Set<string>([...lexical.keys(),...trigrams.keys(),...semRank.keys()]);
    const hits=[...ids].map(id=>{const d=this.state.documents.find(x=>x.id===id)!; const l=lexical.get(id),t=trigrams.get(id),s=semRank.get(id); const rrf=(l?1/(60+l.rank):0)+(t?1/(60+t.rank):0)+(s?1/(60+s.rank):0); const lexicalScore=clamp((l?.score??0)*0.55+(t?.score??0)*0.45); const semanticScore=s?.score??0; return {...d,score:rrf*100,lexicalScore,semanticScore,rrfScore:rrf*100,matchedTerms:s?.matched??tokenize(q).filter(x=>`${d.title} ${d.text}`.toLocaleLowerCase().includes(x))};}).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(64,Math.floor(limit))));
    this.state.metrics.searchHits+=hits.length; return hits;
  }
  sourceBoundary(path:string,requested:ConscioSourceState='canonical'){
    const actual=sourceState(path); const allowed=actual==='canonical'||requested===actual; this.state.sourceBoundaries[path]=actual; this.state.metrics.sourceBoundaryChecks++; return {ok:allowed,path,state:actual,requestedState:requested,reason:allowed?'source-state-compatible':'legacy/research/provenance source cannot silently become canonical'};
  }
  publishSkill(input:{name:string;version?:string;summary:string;provenance?:string}){
    const row={id:sha({name:input.name,version:input.version??'1.0.0',summary:input.summary,provenance:input.provenance??''}).slice(0,24),name:String(input.name),version:String(input.version??'1.0.0'),fingerprint:sha({name:input.name,version:input.version??'1.0.0',summary:input.summary}),summary:String(input.summary).slice(0,20000),provenance:String(input.provenance??'external'),status:'quarantined' as const,trialCount:0,successes:0,failures:0,createdAt:Date.now()};
    this.state.skills.push(row); this.state.skills=this.state.skills.slice(-512); this.state.metrics.skillsPublished++; this.state.metrics.quarantinedArtifacts++; return row;
  }
  trialSkill(skillId:string,ok:boolean,evidence:string){
    const skill=this.state.skills.find(s=>s.id===skillId);
    if(!skill)return {ok:false,error:'skill-not-found'};
    if(skill.status==='approved'||skill.status==='rejected')return {ok:false,error:'skill-immutable-after-review',status:skill.status};
    skill.status='trial';
    const row={id:sha({skillId,ok,evidence,at:Date.now()}),skillId,ok:Boolean(ok),evidence:String(evidence).slice(0,4000),at:Date.now()};
    this.state.skillTrials.push(row); skill.trialCount++; if(ok)skill.successes++;else skill.failures++; this.state.metrics.skillTrials++; return {ok:true,skill,trial:row};
  }
  reviewSkill(skillId:string,decision:'approve'|'reject',reason=''){
    const skill=this.state.skills.find(s=>s.id===skillId);if(!skill)return {ok:false,error:'skill-not-found'};
    const rate=skill.trialCount?skill.successes/skill.trialCount:0;
    if(decision==='approve' && (skill.trialCount<2||rate<0.7)) return {ok:false,error:'evidence-gate-not-met',requiredTrials:2,successRate:rate};
    if(decision==='approve'){skill.status='approved';skill.approvedAt=Date.now();this.state.metrics.skillsPromoted++;}else{skill.status='rejected';skill.rejectionReason=String(reason).slice(0,1000);} return {ok:true,skill,evidence:{trialCount:skill.trialCount,successRate:rate}};
  }
  pairPeer(input:{id:string;label?:string;role?:string;capabilities?:string[];trust01?:number}) {
    const now=Date.now();
    const existing=this.state.peers.find(p=>p.id===input.id);
    if(existing){
      Object.assign(existing,{
        label:String(input.label??existing.label),
        role:String(input.role??existing.role),
        capabilities:Array.from(new Set([...(existing.capabilities??[]),...(input.capabilities??[])])).slice(0,32),
        trust01:clamp(Number(input.trust01??existing.trust01)),
        lastSeenAt:now,
        status:'pending',
      });
      return existing;
    }
    const row={
      id:String(input.id),
      label:String(input.label??input.id),
      role:String(input.role??'companion'),
      capabilities:Array.from(new Set((input.capabilities??[]).map(String))).slice(0,32),
      trust01:clamp(Number(input.trust01??0.5)),
      status:'pending' as const,
      createdAt:now,
      lastSeenAt:now,
    };
    this.state.peers.push(row);
    return row;
  }
  decidePeer(id:string,decision:'trust'|'revoke'){const peer=this.state.peers.find(p=>p.id===id);if(!peer)return {ok:false,error:'peer-not-found'};peer.status=decision==='trust'?'trusted':'revoked';return {ok:true,peer};}
  queuePeerMessage(input:{from:string;to:string;space?:string;payload:unknown;ttlMs?:number;idempotencyKey?:string}){
    const idempotencyKey=String(input.idempotencyKey??'').trim();
    const from=String(input.from),to=String(input.to),space=String(input.space??'default');
    const payloadDigest=sha(input.payload);
    if(idempotencyKey){
      const prior=this.state.messages.find(m=>m.idempotencyKey===idempotencyKey);
      if(prior){
        // An idempotency key identifies one logical message, not merely a slot to reuse.
        // Reusing it for another recipient/payload must never look like successful delivery.
        const sameRequest=prior.from===from&&prior.to===to&&prior.space===space&&prior.digest===payloadDigest;
        if(sameRequest)return {ok:true,reused:true,message:structuredClone(prior)};
        this.state.metrics.peerIdempotencyConflicts++;
        return {ok:false,reused:true,error:'idempotency-key-conflict',existingId:prior.id};
      }
    }
    const peer=this.state.peers.find(p=>p.id===to);const status=peer?.status==='trusted'?'queued':'quarantined'; const now=Date.now();
    const row={id:sha({from,to,space,payload:input.payload,nonce:idempotencyKey||sha(Math.random()).slice(0,12)}).slice(0,32),from,to,space,payload:structuredClone(input.payload),digest:payloadDigest,status:status as ConscioMessageStatus,createdAt:now,expiresAt:now+Math.max(1000,Math.min(7*86400000,Number(input.ttlMs??3600000))),...(idempotencyKey?{idempotencyKey}: {})};
    this.state.messages.push(row);this.state.metrics.peerMessages++;return {ok:true,reused:false,message:structuredClone(row)};
  }
  ackPeerMessage(id:string,accepted=true){const row=this.state.messages.find(m=>m.id===id);if(!row)return {ok:false,error:'message-not-found'};if(Date.now()>row.expiresAt){row.status='expired';return {ok:false,error:'message-expired'};} if(row.status==='acknowledged')return {ok:true,reused:true,message:row}; if(row.status==='delivered'&&accepted)return {ok:true,reused:true,message:row}; row.status=accepted?'acknowledged':'quarantined';if(accepted)this.state.metrics.peerAcks++;else this.state.metrics.peerDenials++;return {ok:accepted,reused:false,message:row};}
  pendingPeerMessages(limit=32){const now=Date.now();for(const m of this.state.messages)if(m.status!=='acknowledged'&&m.status!=='delivered'&&now>m.expiresAt)m.status='expired';return this.state.messages.filter(m=>m.status==='queued'||m.status==='quarantined').slice(-Math.max(1,Math.min(128,limit))).reverse();}
  observeConfidence(input:{key:string;predicted01:number;outcome01:number;evidenceTrust01?:number}){const p=clamp(input.predicted01),o=clamp(input.outcome01);const brier=(p-o)*(p-o);const row={id:sha({key:input.key,p,o,at:Date.now()}),key:String(input.key),predicted01:p,outcome01:o,evidenceTrust01:clamp(Number(input.evidenceTrust01??0.5)),sampleCount:this.state.confidence.filter(x=>x.key===input.key).length+1,brier,at:Date.now()};this.state.confidence.push(row);this.state.confidence=this.state.confidence.slice(-2048);this.state.metrics.confidenceObservations++;return row;}
  calibration(key?:string){const rows=this.state.confidence.filter(x=>!key||x.key===key);if(!rows.length)return {samples:0,brier:0,ece:0,meanPrediction:0,meanOutcome:0}; const brier=rows.reduce((a,x)=>a+x.brier,0)/rows.length; const bins=new Map<number,{p:number,o:number,n:number}>();for(const x of rows){const b=Math.min(9,Math.floor(x.predicted01*10));const r=bins.get(b)??{p:0,o:0,n:0};r.p+=x.predicted01;r.o+=x.outcome01;r.n++;bins.set(b,r);} let ece=0;for(const r of bins.values())ece+=(r.n/rows.length)*Math.abs(r.p/r.n-r.o/r.n);return {samples:rows.length,brier,ece,meanPrediction:rows.reduce((a,x)=>a+x.predicted01,0)/rows.length,meanOutcome:rows.reduce((a,x)=>a+x.outcome01,0)/rows.length};}
  recordClaim(input:{claim:string;expectedAction:string; supported:boolean;confidence01?:number;evidence?:string[]}){
    const evidence=(input.evidence??[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,12);
    if(input.supported && evidence.length===0) return {ok:false,error:'evidence-required-for-supported-claim'};
    const row={id:sha({claim:input.claim,expectedAction:input.expectedAction,evidence,at:Date.now()}),claim:String(input.claim),expectedAction:String(input.expectedAction),supported:Boolean(input.supported),confidence01:clamp(Number(input.confidence01??(input.supported?0.85:0.15))),evidence,at:Date.now()};
    this.state.claims.push(row);this.state.claims=this.state.claims.slice(-1024);this.state.metrics.claimsVerified++;return row;
  }
  assessMetabolic(usedTokens:number,contextWindow:number):ConscioMetabolicAssessment{const cw=Math.max(1,Number(contextWindow)||1);const usage01=clamp(Number(usedTokens||0)/cw);const state=usage01<.4?'vital':usage01<.5?'active':usage01<.7?'fatigue':'critical';const advisory=state==='vital'?'work freely — explore and build understanding':state==='active'?'consolidate — complete active threads':state==='fatigue'?'prepare a handoff and reduce new work':'finish the atomic task and transfer; do not start new work';return {state,usedTokens:Number(usedTokens||0),contextWindow:cw,usage01,advisory,shouldHandoff:usage01>=.5,shouldDream:usage01>=.7};}
}
