import { MemoryResidencyGovernor, type MemoryResidencyTier } from './MemoryResidencyGovernor.ts';
import { MemorySignalFusion, type MemoryFusionProfile } from './MemorySignalFusion.ts';
import { AdaptiveMemoryPolicy, type MemoryPolicyName } from './AdaptiveMemoryPolicy.ts';
import { canonicalizeMemoryContent, deriveMemoryIdentity, mergeMemoContext, mergeMemoTags, memoContentHash, stableMemoryId } from './MemoInspiredMemoryPrimitives.ts';
export type EpistemicStatus='fact'|'belief'|'hypothesis'|'unknown'|'quarantined';
export interface MemoryItem2 { id:string;
content:string;
/** Content-addressed identity adapted from Memo; stable across process restarts. */
contentHash?:string;
tags?:string[];
context?:Record<string,string>;
kind:'sensory'|'working'|'episodic'|'semantic'|'autobiographical'|'procedural'|'social'|'identity'|'dream';
createdAt:number;
lastAccessAt:number;
salience:number;
emotionalWeight:number;
identityRelevance:number;
goalRelevance:number;
socialRelevance:number;
predictionError:number;
temperature01:number;
confidence:number;
epistemicStatus:EpistemicStatus;
source:string;
entities:string[];
semanticLinks:string[];
temporalLinks:string[];
causalLinks:string[];
contradictionLinks?:string[];
revisionHistory:Array<{at:number;from:EpistemicStatus;to:EpistemicStatus;reason:string}>;
validFromAt?: number;
validUntilAt?: number|null;
observedAt?: number;
supersedesId?: string|null;
supersededById?: string|null;
revisionGroupId?: string;
revisionSequence?: number;
dormant:boolean;
retrievalCount:number;
semanticVector:number[];
residencyTier?: MemoryResidencyTier;
}
export interface MemoryOSState2 { items:MemoryItem2[];
forgetCount:number;
reconsolidations:number;
quarantined:number;
lastMaintenanceAt:number;
semanticQueries:number;
semanticHits:number;
linkUpdates:number;
adaptiveMemoryPolicy?: ReturnType<AdaptiveMemoryPolicy['snapshot']>;
version:number;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tokenize=(text:string)=>text.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu)??[];
function hashToken(token:string){let h=2166136261;for(const ch of token){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function vectorize(text:string,dim=48){const v=Array(dim).fill(0);for(const tok of tokenize(text)){const h=hashToken(tok);const i=h%dim;const j=(h>>>8)%dim;v[i]+=1;v[j]-=.35;}const norm=Math.sqrt(v.reduce((a:number,x:number)=>a+x*x,0))||1;return v.map(x=>x/norm);}
function cosine(a:number[],b:number[]){if(!a.length||!b.length)return 0;let dot=0,na=0,nb=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return na&&nb?clamp((dot/Math.sqrt(na*nb)+1)/2):0;}
function overlap(a:string[],b:string[]){if(!a.length||!b.length)return 0;const set=new Set(a);let hits=0;for(const x of b)if(set.has(x))hits++;return hits/Math.max(1,new Set([...a,...b]).size);}
function memoryTemperature(item:Pick<MemoryItem2,'salience'|'emotionalWeight'|'identityRelevance'|'goalRelevance'|'socialRelevance'|'predictionError'|'lastAccessAt'>,now=Date.now()){
  const age=Math.max(0,now-item.lastAccessAt);
  const recency=Math.exp(-Math.min(age,14*86400000)/(18*3600000));
  return clamp(.24*item.salience+.16*item.emotionalWeight+.18*item.identityRelevance+.16*item.goalRelevance+.10*item.socialRelevance+.10*item.predictionError+.16*recency);
}
function extractEntities(text:string){return [...new Set(tokenize(text).filter(t=>t.length>=4).slice(0,12))];}
const NEGATION_TOKENS=new Set(['not','no','never','without','cannot','cant','cannot','isnt','doesnt','dont','не','нет','никогда','без','нельзя','невозможно']);
function negationSignature(text:string){const tokens=tokenize(text);let hits=0;for(const t of tokens)if(NEGATION_TOKENS.has(t))hits++;return hits%2?1:0;}
function sharedEntityCount(a:string[],b:string[]){const set=new Set(a);let n=0;for(const x of b)if(set.has(x))n++;return n;}
function hasNegationPolarityDifference(a:string,b:string){return negationSignature(a)!==negationSignature(b);}
function identifierLike(text:string){return /(?:\b[A-Z]{2,}[-_/]?[0-9]{2,}\b|\b[0-9]{3,}\b|[A-F0-9]{8,})/.test(String(text));}
function normalizeBm25(score:number,max?:number){if(score<=0)return 0;if(max!==undefined)return max>0?clamp(score/max):0;return clamp(score/(score+1));}
function bm25Score(queryTokens:string[],content:string,docCount:number,documentFrequency:Map<string,number>,itemTokenLength:Map<string,number>,totalTokenLength:number,itemId?:string){
  const tokens=tokenize(content); if(!tokens.length||!queryTokens.length||!docCount)return 0;
  const tf=new Map<string,number>(); for(const t of tokens)tf.set(t,(tf.get(t)||0)+1);
  const uniqueQ=[...new Set(queryTokens)]; const avgLen=Math.max(1,totalTokenLength/docCount); const dl=Math.max(1,itemId?itemTokenLength.get(itemId)??tokens.length:tokens.length); const k1=1.2,b=.75; let score=0;
  for(const q of uniqueQ){const f=tf.get(q)||0;if(!f)continue;const df=documentFrequency.get(q)||0;const idf=Math.log(1+(docCount-df+0.5)/(df+0.5));const denom=f+k1*(1-b+b*dl/avgLen);score+=idf*((f*(k1+1))/denom);}
  return Math.max(0,score);
}
type MemoryEncodeInput=Omit<MemoryItem2,'id'|'createdAt'|'lastAccessAt'|'retrievalCount'|'revisionHistory'|'dormant'|'semanticVector'|'temperature01'|'residencyTier'> & {id?:string};
export const defaultMemoryOS2=():MemoryOSState2=>({items:[],forgetCount:0,reconsolidations:0,quarantined:0,lastMaintenanceAt:0,semanticQueries:0,semanticHits:0,linkUpdates:0,version:3});
export type MemoryTemporalMode='current'|'at'|'all';
export interface MemoryTemporalQueryOptions { temporalMode?:MemoryTemporalMode; asOfAt?:number; }
export class MemoryOS2{
 private state=defaultMemoryOS2();
 private readonly exactIndex=new Map<string,string>();
 private readonly itemIndex=new Map<string,MemoryItem2>();
 private readonly contentIndex=new Map<string,string>();
 private readonly tokenCache=new Map<string,Set<string>>();
 private readonly lowerContentCache=new Map<string,string>();
 private readonly tokenIndex=new Map<string,Set<string>>();
 private readonly documentFrequency=new Map<string,number>();
 private readonly itemTokenLength=new Map<string,number>();
 private readonly revisionGroupIndex=new Map<string,Set<string>>();
 private totalTokenLength=0;
 private lastCandidateCount=0;
 private lastHybridDiagnostics:{bm25Enabled:boolean;bm25CandidateCount:number;bm25Max:number;rrfEnabled:boolean;identifierBias:boolean;temporalMode:MemoryTemporalMode;asOfAt:number}={bm25Enabled:true,bm25CandidateCount:0,bm25Max:0,rrfEnabled:true,identifierBias:false,temporalMode:'current',asOfAt:0};
 private linkSupportCache:Map<string,number>|null=null;
 private linkSupportCacheVersion=-1;
 private readonly residencyGovernor=new MemoryResidencyGovernor();
 private readonly signalFusion:MemorySignalFusion;
 private readonly adaptivePolicy=new AdaptiveMemoryPolicy();
 private activePolicy:MemoryPolicyName='balanced';
 constructor(options:{signalFusionProfile?:MemoryFusionProfile}={}){ this.signalFusion=new MemorySignalFusion(options.signalFusionProfile??'balanced'); }
 restore(s:MemoryOSState2|undefined){
  const rawItems=Array.isArray(s?.items)?s!.items.slice(0,1600):[];
  this.state={...defaultMemoryOS2(),...(s??{}),items:rawItems.map((m:any)=>({
    ...m,
    // P2697: cold residency is allowed to remain truly cold across restore.
    // Re-materialize vectors lazily only for candidates that actually reach
    // semantic scoring; this avoids rebuilding up to 1600 vectors on startup.
    semanticVector:Array.isArray(m?.semanticVector)&&m.semanticVector.length?m.semanticVector:[],
    entities:Array.isArray(m?.entities)?m.entities:extractEntities(String(m?.content??'')),
    contentHash:String(m?.contentHash||memoContentHash(String(m?.content??''))),
    tags:Array.isArray(m?.tags)?[...new Set(m.tags.map((x:any)=>String(x)).filter(Boolean))].slice(0,24):[],
    context:m?.context&&typeof m.context==='object'?Object.fromEntries(Object.entries(m.context).filter(([k,v])=>typeof k==='string'&&typeof v==='string').slice(0,24)):undefined,
    semanticLinks:Array.isArray(m?.semanticLinks)?m.semanticLinks:[],
    temporalLinks:Array.isArray(m?.temporalLinks)?m.temporalLinks:[],
    causalLinks:Array.isArray(m?.causalLinks)?m.causalLinks:[],
    contradictionLinks:Array.isArray(m?.contradictionLinks)?m.contradictionLinks:[],
    validFromAt:Number.isFinite(Number(m?.validFromAt))?Number(m.validFromAt):Number(m?.createdAt??Date.now()),
    validUntilAt:m?.validUntilAt==null?null:(Number.isFinite(Number(m.validUntilAt))?Number(m.validUntilAt):null),
    observedAt:Number.isFinite(Number(m?.observedAt))?Number(m.observedAt):Number(m?.createdAt??Date.now()),
    supersedesId:m?.supersedesId==null?null:String(m.supersedesId),
    supersededById:m?.supersededById==null?null:String(m.supersededById),
    revisionGroupId:m?.revisionGroupId?String(m.revisionGroupId):String(m?.id??m?.contentHash??'revision'),
    revisionSequence:Math.max(1,Math.floor(Number(m?.revisionSequence??1))),
    temperature01:clamp(Number(m?.temperature01??0)),
    residencyTier:(m?.residencyTier==='hot'||m?.residencyTier==='warm'||m?.residencyTier==='cold')?m.residencyTier:(Array.isArray(m?.semanticVector)&&m.semanticVector.length?'warm':'cold'),
  }))};
  this.adaptivePolicy.restore(this.state.adaptiveMemoryPolicy);
  this.exactIndex.clear();this.contentIndex.clear();this.itemIndex.clear();this.tokenCache.clear();this.lowerContentCache.clear();this.tokenIndex.clear();this.documentFrequency.clear();this.itemTokenLength.clear();this.revisionGroupIndex.clear();this.totalTokenLength=0;this.linkSupportCache=null;this.linkSupportCacheVersion=-1;this.lastCandidateCount=0;
  for(const m of this.state.items){
    this.itemIndex.set(m.id,m);
    this.exactIndex.set(`${m.kind}|${m.source}|${canonicalizeMemoryContent(m.content)}`,m.id);
    this.contentIndex.set(`${m.kind}|${canonicalizeMemoryContent(m.content)}`,m.id);
    this.indexItem(m);
  }
 }
 private tokensFor(text:string){const key=String(text);const hit=this.tokenCache.get(key);if(hit)return hit;const value=new Set(tokenize(key));if(this.tokenCache.size>=512){const first=this.tokenCache.keys().next().value as string|undefined;if(first)this.tokenCache.delete(first);}this.tokenCache.set(key,value);return value;}
 private lowerFor(id:string,text:string){const hit=this.lowerContentCache.get(id);if(hit!==undefined)return hit;const value=text.toLocaleLowerCase();if(this.lowerContentCache.size>=512){const first=this.lowerContentCache.keys().next().value as string|undefined;if(first)this.lowerContentCache.delete(first);}this.lowerContentCache.set(id,value);return value;}
 encode(input:MemoryEncodeInput, options:{clone?:boolean}={}){
   const now=Date.now();
   const canonicalContent=canonicalizeMemoryContent(input.content);
   const identity=deriveMemoryIdentity(canonicalContent,input.kind,input.source);
   const exactId=this.exactIndex.get(`${input.kind}|${input.source}|${canonicalContent}`);
   const contentId=this.contentIndex.get(`${input.kind}|${canonicalContent}`);
   const existingId=exactId??contentId;
   const existing=existingId?this.itemIndex.get(existingId):undefined;
   if(existing){
    existing.lastAccessAt=now;
    existing.salience=clamp(existing.salience*.8+input.salience*.2);
    existing.confidence=clamp(existing.confidence*.82+input.confidence*.18);
    existing.predictionError=clamp(existing.predictionError*.75+input.predictionError*.25);
    existing.temperature01=memoryTemperature(existing);
    existing.temperature01=clamp(existing.temperature01*.82+memoryTemperature({...existing,...input,lastAccessAt:now} as MemoryItem2,now)*.18);
    existing.residencyTier='hot';
    existing.source=existing.source||input.source;
    existing.contentHash=existing.contentHash||memoContentHash(existing.content);
    existing.tags=mergeMemoTags(existing.tags,input.tags);
    existing.context=mergeMemoContext(existing.context,input.context);
    this.state.reconsolidations++;
    this.exactIndex.set(`${existing.kind}|${existing.source}|${canonicalizeMemoryContent(existing.content)}`,existing.id);
    this.contentIndex.set(`${existing.kind}|${canonicalizeMemoryContent(existing.content)}`,existing.id);
    return options.clone===false?existing:structuredClone(existing);
   }
   const semanticVector=vectorize(input.content); const entities=[...new Set([...(input.entities??[]),...extractEntities(input.content)])];
   const item={...input,id:input.id??identity.stableId,contentHash:input.contentHash??identity.contentHash,entities,createdAt:now,lastAccessAt:now,retrievalCount:0,revisionHistory:[],dormant:false,semanticVector,temperature01:0,residencyTier:'hot' as MemoryResidencyTier,validFromAt:Number.isFinite(Number(input.validFromAt))?Number(input.validFromAt):now,validUntilAt:input.validUntilAt==null?null:(Number.isFinite(Number(input.validUntilAt))?Number(input.validUntilAt):null),observedAt:Number.isFinite(Number(input.observedAt))?Number(input.observedAt):now,supersedesId:input.supersedesId??null,supersededById:input.supersededById??null,revisionGroupId:String(input.revisionGroupId??(input.id??identity.stableId)),revisionSequence:Math.max(1,Math.floor(Number(input.revisionSequence??1)))};
   item.temperature01=memoryTemperature(item,now);
   const best:Array<{x:MemoryItem2;sim:number;ent:number;rank:number}>=[];
   for(const x of this.state.items.slice(0,512)){
     if(x.dormant||x.epistemicStatus==='quarantined')continue;
     const sim=cosine(semanticVector,x.semanticVector); const ent=overlap(entities,x.entities); const rank=sim+ent*.25;
     if(sim<.50&&ent<.20)continue;
     let at=best.length; while(at>0&&best[at-1]!.rank<rank)at--;
     if(at<4)best.splice(at,0,{x,sim,ent,rank}); if(best.length>4)best.pop();
   }
   item.semanticLinks=best.filter(x=>x.sim>=.62||x.ent>=.34).map(x=>x.x.id).slice(0,4);
   const itemStart=Number(item.validFromAt??now),itemEnd=item.validUntilAt==null?Number.POSITIVE_INFINITY:Number(item.validUntilAt);
   item.temporalLinks=this.state.items.slice(0,256).filter(x=>{
     const xStart=Number(x.validFromAt??x.createdAt),xEnd=x.validUntilAt==null?Number.POSITIVE_INFINITY:Number(x.validUntilAt);
     const overlapWindow=Number.isFinite(itemStart)&&Number.isFinite(xStart)?Math.abs(itemStart-xStart)<=3*86400000||Math.max(itemStart,xStart)<=Math.min(itemEnd,xEnd):false;
     return (overlap(entities,x.entities)>=.20||best.some(b=>b.x.id===x.id&&b.sim>=.55))&&overlapWindow;
   }).slice(0,6).map(x=>x.id);
   item.causalLinks=this.state.items.slice(0,256).filter(x=>x.causalLinks.includes(item.id)).slice(0,3).map(x=>x.id);
   item.contradictionLinks=best.filter(x=>x.sim>=.64&&sharedEntityCount(entities,x.x.entities)>=2&&hasNegationPolarityDifference(item.content,x.x.content)).map(x=>x.x.id).slice(0,4);
   this.state.items.unshift(item as MemoryItem2);this.itemIndex.set(item.id,item as MemoryItem2);this.linkSupportCache=null;if(this.state.items.length>1600){const removed=this.state.items.pop();if(removed){this.removeIndexedId(removed.id);this.itemIndex.delete(removed.id);this.exactIndex.delete(`${removed.kind}|${removed.source}|${canonicalizeMemoryContent(removed.content)}`);this.contentIndex.delete(`${removed.kind}|${canonicalizeMemoryContent(removed.content)}`);}}this.exactIndex.set(`${item.kind}|${item.source}|${canonicalizeMemoryContent(item.content)}`,item.id);
   this.contentIndex.set(`${item.kind}|${canonicalizeMemoryContent(item.content)}`,item.id);this.indexItem(item);this.lowerContentCache.delete(item.id);
   for(const linkedId of item.contradictionLinks??[]){const linked=this.itemIndex.get(linkedId);if(linked){linked.contradictionLinks=[...new Set([...(linked.contradictionLinks??[]),item.id])].slice(0,6);this.state.linkUpdates++;}}
   this.state.linkUpdates+=item.semanticLinks.length+item.temporalLinks.length;
   if(item.epistemicStatus==='quarantined')this.state.quarantined++;return options.clone===false?(item as MemoryItem2):structuredClone(item as MemoryItem2);
 }
 retrieve(query:string,limit=8,goalRelevance=0,identityRelevance=0,temporalOptions:MemoryTemporalQueryOptions={}){
   const qTokens=this.tokensFor(query);
   const queryEntities=extractEntities(query);
   const qVector=vectorize(query);
   this.state.semanticQueries++;
   const now=Number.isFinite(Number(temporalOptions.asOfAt))?Number(temporalOptions.asOfAt):Date.now();
   const temporalMode:MemoryTemporalMode=temporalOptions.temporalMode??'current';
   const isValidAt=(m:MemoryItem2,at:number)=>{const from=Number(m.validFromAt??m.createdAt),until=m.validUntilAt==null?Number.POSITIVE_INFINITY:Number(m.validUntilAt);return from<=at&&at<until;};
   const contextCausal=/\b(why|cause|causal|because|reason|effect|причин|почему|следств)/iu.test(query)?1:clamp(this.state.linkUpdates/100);
  const contextTemporal=/\b(today|now|yesterday|recent|recently|last|earlier|week|month|year|сегодня|сейчас|вчера|недав|послед|раньше|недел|месяц|год)/iu.test(query)?1:clamp(this.state.semanticQueries/100);
  this.activePolicy=this.adaptivePolicy.choose({pressure01:clamp(this.state.items.length/1600),goal01:clamp(goalRelevance),causal01:contextCausal,temporal01:contextTemporal,mobile:true},now);
   const queryLower=query.toLocaleLowerCase();
   if(this.linkSupportCacheVersion!==this.state.linkUpdates||!this.linkSupportCache){
     const support=new Map<string,number>();
     for(const source of this.state.items){
       for(const linkedId of source.semanticLinks.slice(0,8)) support.set(linkedId,(support.get(linkedId)||0)+source.salience/6);
       for(const linkedId of source.causalLinks.slice(0,8)) support.set(linkedId,(support.get(linkedId)||0)+source.predictionError/5);
     }
     this.linkSupportCache=support;this.linkSupportCacheVersion=this.state.linkUpdates;
   }
   const linkSupport=this.linkSupportCache;
   const rows:Array<{m:MemoryItem2;score:number;semantic:number;bm25:number;entity:number;lexical:number}> = [];
   const candidateIds=new Set<string>();
   for(const token of qTokens){
     const ids=this.tokenIndex.get(token);
     if(!ids)continue;
     for(const id of ids){candidateIds.add(id);if(candidateIds.size>=192)break;}
     if(candidateIds.size>=192)break;
   }
   if(candidateIds.size<96){
     for(const m of this.state.items.slice(0,128)){candidateIds.add(m.id);if(candidateIds.size>=192)break;}
   }
   // Revision-aware recall: a lexical hit on one revision should be able to
   // surface the rest of the bounded revision chain before temporal filtering.
   // This prevents a renamed/corrected fact from becoming unreachable only
   // because its newest wording changed.
   for(const seedId of [...candidateIds].slice(0,96)){
     const seed=this.itemIndex.get(seedId);
     if(!seed)continue;
     const group=seed.revisionGroupId??seed.id;
     const revisionIds=this.revisionGroupIndex.get(group);
     if(revisionIds)for(const revisionId of revisionIds){
       candidateIds.add(revisionId);
       if(candidateIds.size>=192)break;
     }
     if(candidateIds.size>=192)break;
   }
   // Native graph-memory adaptation: existing semantic/causal links expand recall
   // without introducing a separate graph database. Only one bounded hop is
   // traversed so mobile candidate growth remains predictable.
   const graphSeeds=[...candidateIds].slice(0,96);
   for(const seedId of graphSeeds){
     const seed=this.itemIndex.get(seedId);
     if(!seed)continue;
     for(const linkedId of [...(seed.semanticLinks??[]),...(seed.causalLinks??[])].slice(0,6)){
       candidateIds.add(linkedId);
       if(candidateIds.size>=192)break;
     }
     if(candidateIds.size>=192)break;
   }
   this.lastCandidateCount=candidateIds.size;
   const identifierBias=identifierLike(query);
   const rawRows:Array<{m:MemoryItem2;semantic:number;bm25:number;entity:number;lexical:number;temporal:number;causal:number;identity:number;goal:number;recency:number}> = [];
   for(const id of candidateIds){
     const m=this.itemIndex.get(id);
     if(!m||m.dormant||m.epistemicStatus==='quarantined')continue;
     const temporalValid=temporalMode==='all'?true:isValidAt(m,now);
     if(!temporalValid)continue;
     if(!m.semanticVector.length){m.semanticVector=vectorize(m.content);m.residencyTier='warm';}
     m.temperature01=memoryTemperature(m,now);
     const lexicalTokens=this.tokensFor(m.content);
     const exact=this.lowerFor(m.id,m.content).includes(queryLower)?1:0;
     const tokenOverlap=overlap([...qTokens],[...lexicalTokens]);
     const semantic=cosine(qVector,m.semanticVector);
     const bm25=bm25Score([...qTokens],m.content,this.state.items.length,this.documentFrequency,this.itemTokenLength,this.totalTokenLength,m.id);
     const lexical=clamp(.30*tokenOverlap+.20*exact+.50*normalizeBm25(bm25));
     const entity=overlap(queryEntities,m.entities);
     const recency=clamp(1-(now-m.lastAccessAt)/(1000*60*60*24*21));
     const causal=clamp(linkSupport?.get(m.id)||0);
     const temporalBase=this.signalFusion.temporalHint(query,m.validFromAt??m.createdAt,now); const validity=temporalMode==='all'?1:(isValidAt(m,now)?1:0); const temporal=clamp(.72*validity+.28*temporalBase);
     const identity=clamp(m.identityRelevance*clamp(identityRelevance));
     const goal=clamp(m.goalRelevance*clamp(goalRelevance));
     rawRows.push({m,semantic,bm25,entity,lexical,temporal,causal,identity,goal,recency});
   }
   const semanticOrder=rawRows.slice().sort((a,b)=>b.semantic-a.semantic);
   const bm25Order=rawRows.slice().sort((a,b)=>b.bm25-a.bm25);
   const rrfK=60;
   const semanticRank=new Map(semanticOrder.map((row,index)=>[row.m.id,index+1]));
   const bm25Rank=new Map(bm25Order.map((row,index)=>[row.m.id,index+1]));
   const maxRrf=1/(rrfK+1)+1/(rrfK+1);
   const maxBm25=Math.max(0,...rawRows.map(x=>x.bm25));
   const topRows=rawRows.map(row=>{
     const rrfNorm=clamp(((1/(rrfK+(semanticRank.get(row.m.id)??rawRows.length+1)))+(1/(rrfK+(bm25Rank.get(row.m.id)??rawRows.length+1))))/maxRrf);
     const bm25Norm=maxBm25>0?normalizeBm25(row.bm25,maxBm25):0;
     const lexical=clamp(.22*row.lexical+.55*bm25Norm+.23*rrfNorm);
     const fused=this.signalFusion.score({semantic01:row.semantic,lexical01:identifierBias?clamp(lexical+.10*row.lexical):lexical,entity01:row.entity,temporal01:row.temporal,causal01:row.causal,recency01:row.recency,salience01:row.m.salience,identity01:row.identity,goal01:row.goal,predictionError01:row.m.predictionError,temperature01:row.m.temperature01});
     const policyBias=this.activePolicy==='semantic'?row.semantic*.08:this.activePolicy==='causal'?row.causal*.10:this.activePolicy==='temporal'?row.temporal*.10:this.activePolicy==='hybrid'?(rrfNorm+row.entity)*.06:(row.identity+row.goal)*.04;
     fused.score01=clamp(fused.score01+policyBias);
     return {m:row.m,score:fused.score01,semantic:row.semantic,bm25:row.bm25,entity:row.entity,lexical};
   }).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit));
   rows.push(...topRows);
   this.lastHybridDiagnostics={...this.lastHybridDiagnostics,bm25Enabled:true,bm25CandidateCount:rawRows.filter(x=>x.bm25>0).length,bm25Max:maxBm25,rrfEnabled:true,identifierBias,temporalMode,asOfAt:now};
   this.state.semanticHits+=rows.filter(x=>x.semantic>=.58).length;
   // P2697: only retained/hot results keep their vector materialized. Other
   // candidates can return to cold residency immediately, bounding RSS after
   // broad retrievals on mobile devices.
   const retained=new Set(rows.map(x=>x.m.id));
   for(const id of candidateIds){const m=this.itemIndex.get(id);if(m&&m.residencyTier==='cold'&&!retained.has(id))m.semanticVector=[];}
   this.state.adaptiveMemoryPolicy=this.adaptivePolicy.snapshot();
   return rows.map(({m})=>{m.lastAccessAt=now;m.retrievalCount++;return structuredClone(m);});
 }
 reconcile(inputs:MemoryEncodeInput[],options:{clone?:boolean}={}):{created:number;reused:number;ids:string[]}{
  let created=0,reused=0;
  const ids:string[]=[];
  for(const input of inputs.slice(0,256)){
   const canonical=canonicalizeMemoryContent(input.content);
   const before=this.contentIndex.get(`${input.kind}|${canonical}`);
   const item=this.encode(input,{clone:false});
   if(before)reused++;else created++;
   ids.push(item.id);
  }
  return {created,reused,ids:options.clone===false?ids:ids.slice()};
 }
 observeRetrievalOutcome(reward01:number, policy?:MemoryPolicyName){ this.adaptivePolicy.observe(policy??this.activePolicy,clamp(reward01)); this.state.adaptiveMemoryPolicy=this.adaptivePolicy.snapshot(); }
 observeRetrievalOutcomeV2(outcome:{quality01:number;retention01?:number;transfer01?:number;interference01?:number;computeCost01?:number;delayed01?:number}, policy?:MemoryPolicyName){ const reward=this.adaptivePolicy.observeOutcome(policy??this.activePolicy,outcome); this.state.adaptiveMemoryPolicy=this.adaptivePolicy.snapshot(); return reward; }
 adaptivePolicyDiagnostics(){ return this.adaptivePolicy.diagnostics(); }
 revise(id:string,to:EpistemicStatus,reason:string){const m=this.state.items.find(x=>x.id===id);if(!m||m.epistemicStatus===to)return;const from=m.epistemicStatus;m.revisionHistory.unshift({at:Date.now(),from,to,reason});m.epistemicStatus=to;m.lastAccessAt=Date.now();this.state.reconsolidations++;if(to==='quarantined')this.state.quarantined++;}
 reviseContent(id:string,newContent:string,options:{reason?:string;validAt?:number;source?:string;epistemicStatus?:EpistemicStatus;salience?:number;confidence?:number}={}){
   const old=this.itemIndex.get(id); if(!old||!String(newContent).trim()) return null;
   const at=Number.isFinite(Number(options.validAt))?Number(options.validAt):Date.now();
   const group=old.revisionGroupId??old.id;
   const nextSeq=Math.max(1,Math.floor(Number(old.revisionSequence??1))+1);
   const replacement=this.encode({
     content:String(newContent),kind:old.kind,source:String(options.source??old.source),tags:old.tags,context:old.context,
     salience:options.salience??old.salience,emotionalWeight:old.emotionalWeight,identityRelevance:old.identityRelevance,goalRelevance:old.goalRelevance,socialRelevance:old.socialRelevance,predictionError:old.predictionError,confidence:options.confidence??old.confidence,epistemicStatus:options.epistemicStatus??old.epistemicStatus,entities:old.entities,semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],
     validFromAt:at,validUntilAt:null,observedAt:Date.now(),supersedesId:old.id,supersededById:null,revisionGroupId:group,revisionSequence:nextSeq
   },{clone:false});
   old.validUntilAt=at;old.supersededById=replacement.id;old.lastAccessAt=at;old.revisionHistory.unshift({at,from:old.epistemicStatus,to:old.epistemicStatus,reason:String(options.reason??'content-revision').slice(0,240)});
   replacement.temporalLinks=[...new Set([...(replacement.temporalLinks??[]),old.id])].slice(0,6);
   this.state.reconsolidations++;
   return structuredClone(replacement);
 }
 updateSignals(id:string, patch:Partial<Pick<MemoryItem2,'salience'|'emotionalWeight'|'identityRelevance'|'goalRelevance'|'socialRelevance'|'predictionError'|'confidence'|'dormant'>>, reason='reconsolidation') {
   const m=this.state.items.find(x=>x.id===id); if(!m) return null;
   const fromStatus=m.epistemicStatus;
   const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
   if(patch.salience!==undefined)m.salience=c(patch.salience);
   if(patch.emotionalWeight!==undefined)m.emotionalWeight=c(patch.emotionalWeight);
   if(patch.identityRelevance!==undefined)m.identityRelevance=c(patch.identityRelevance);
   if(patch.goalRelevance!==undefined)m.goalRelevance=c(patch.goalRelevance);
   if(patch.socialRelevance!==undefined)m.socialRelevance=c(patch.socialRelevance);
   if(patch.predictionError!==undefined)m.predictionError=c(patch.predictionError);
   if(patch.confidence!==undefined)m.confidence=c(patch.confidence);
   if(patch.dormant!==undefined)m.dormant=Boolean(patch.dormant);
   m.lastAccessAt=Date.now();
   m.temperature01=memoryTemperature(m);
   if(reason){m.revisionHistory.unshift({at:m.lastAccessAt,from:fromStatus,to:fromStatus,reason});}
   this.state.reconsolidations++;
   return structuredClone(m);
 }
 get(id:string){const m=this.state.items.find(x=>x.id===id); if(!m)return null; if(!m.semanticVector.length)m.semanticVector=vectorize(m.content); m.lastAccessAt=Date.now(); m.temperature01=memoryTemperature(m); m.residencyTier='hot'; return structuredClone(m);}
 markDormant(id:string,dormant=true,reason='memory-economy'){return this.updateSignals(id,{dormant},reason);}
 forgetById(id:string,reason='memory-knockout'){
   const i=this.state.items.findIndex(x=>x.id===id);
   if(i<0)return false;
   const m=this.state.items[i]!;
   if(m.epistemicStatus==='quarantined'||m.kind==='identity'||m.kind==='autobiographical')return false;
   this.removeIndexedId(id);
   this.state.items.splice(i,1);
   for(const [key,value] of this.exactIndex)if(value===id)this.exactIndex.delete(key);
   for(const [key,value] of this.contentIndex)if(value===id)this.contentIndex.delete(key);
   this.itemIndex.delete(id);
   this.lowerContentCache.delete(id);
   for(const x of this.state.items){
     if(x.contradictionLinks?.includes(id))x.contradictionLinks=x.contradictionLinks.filter(v=>v!==id);
     if(x.temporalLinks?.includes(id))x.temporalLinks=x.temporalLinks.filter(v=>v!==id);
     if(x.semanticLinks?.includes(id))x.semanticLinks=x.semanticLinks.filter(v=>v!==id);
     if(x.causalLinks?.includes(id))x.causalLinks=x.causalLinks.filter(v=>v!==id);
     if(x.supersedesId===id)x.supersedesId=null;
     if(x.supersededById===id)x.supersededById=null;
   }
   this.state.forgetCount++;
   this.state.reconsolidations++;
   void reason;
   return true;
 }
 maintain(options:{pressure01?:number;maxItems?:number}={}){
   const now=Date.now();
   const pressure=clamp(options.pressure01??0);
   for(const m of this.state.items){
     const ageDays=Math.max(0,(now-m.lastAccessAt)/(1000*60*60*24));
     const durability=m.salience*.25+m.identityRelevance*.18+m.goalRelevance*.16+m.socialRelevance*.1+m.predictionError*.1+m.confidence*.12+Math.min(.1,m.retrievalCount*.006)+Math.min(.09,m.semanticLinks.length*.02);
     m.temperature01=memoryTemperature(m,now);
     const invalidHistorical=m.validUntilAt!=null&&Number(m.validUntilAt)<=now;
     if((ageDays>21&&durability<.3)||invalidHistorical&&ageDays>7){if(!m.dormant){m.dormant=true;this.state.forgetCount++;}}
     if(ageDays<7&&m.dormant&&durability>.42&&!invalidHistorical)m.dormant=false;
   }
   const hardCap=Math.max(128,Math.min(1600,Math.floor(options.maxItems??1600)));
   if(this.state.items.length>hardCap){
     const score=(m:MemoryItem2)=>m.salience*.5+m.confidence*.2+m.goalRelevance*.12+m.identityRelevance*.1+Math.min(.08,m.retrievalCount*.01);
     const removable=this.state.items.filter(m=>m.epistemicStatus!=='quarantined'&&m.kind!=='identity'&&m.kind!=='autobiographical').sort((a,b)=>score(a)-score(b));
     const removeCount=Math.min(this.state.items.length-hardCap,removable.length);
     for(const m of removable.slice(0,removeCount))this.forgetById(m.id,'capacity');
   }
   if(pressure>=.85){
     const pressureCandidates=this.state.items.filter(m=>m.epistemicStatus!=='quarantined'&&m.kind!=='identity'&&m.kind!=='autobiographical'&&m.dormant).sort((a,b)=>memoryTemperature(a,now)-memoryTemperature(b,now));
     const removeCount=Math.min(pressureCandidates.length,Math.max(0,Math.floor(this.state.items.length*.12)));
     for(const m of pressureCandidates.slice(0,removeCount))this.forgetById(m.id,'pressure');
   }
   this.state.items=this.state.items.slice(0,1600);
   this.state.lastMaintenanceAt=now;
 }

 applyResidencyPlan(input:{hotBudget?:number;warmBudget?:number;coldBudget?:number;pressure01?:number;identityTension01?:number}={}){
   const defaultPlan=this.residencyGovernor.plan({hotBudget:input.hotBudget??32,warmBudget:input.warmBudget??192,coldBudget:input.coldBudget??768,pressure01:input.pressure01??0,identityTension01:input.identityTension01??0});
   const protectedKinds=(m:MemoryItem2)=>m.kind==='identity'||m.kind==='autobiographical';
   const ranked=this.state.items.slice().sort((a,b)=>{
     const pa=protectedKinds(a)?1:0,pb=protectedKinds(b)?1:0;
     if(pa!==pb)return pb-pa;
     return (b.temperature01+b.salience*.25+b.confidence*.15)-(a.temperature01+a.salience*.25+a.confidence*.15);
   });
   const hotSet=new Set(ranked.filter(m=>!m.dormant).slice(0,defaultPlan.hotBudget).map(m=>m.id));
   const warmSet=new Set(ranked.filter(m=>!hotSet.has(m.id)&&!m.dormant).slice(0,defaultPlan.warmBudget).map(m=>m.id));
   for(const item of this.state.items){
     item.residencyTier=hotSet.has(item.id)?'hot':warmSet.has(item.id)?'warm':'cold';
     if(item.residencyTier==='cold' && item.semanticVector.length && item.semanticVector.every(x=>Number.isFinite(x))) item.semanticVector=[];
   }
   return {...defaultPlan,tierCounts:{hot:this.state.items.filter(m=>m.residencyTier==='hot').length,warm:this.state.items.filter(m=>m.residencyTier==='warm').length,cold:this.state.items.filter(m=>m.residencyTier==='cold').length}};
 }

 residencyDiagnostics(){
   const counts:{hot:number;warm:number;cold:number}={hot:0,warm:0,cold:0};
   for(const item of this.state.items)counts[item.residencyTier??'cold']++;
   return {counts,targetItems:this.state.items.length,materializedVectors:this.state.items.reduce((n,m)=>n+(m.semanticVector.length?1:0),0)};
 }

 private indexItem(item:MemoryItem2){
   const group=item.revisionGroupId??item.id;
   let revisions=this.revisionGroupIndex.get(group);
   if(!revisions){revisions=new Set<string>();this.revisionGroupIndex.set(group,revisions);}
   revisions.add(item.id);
   const uniqueTokens=[...this.tokensFor(item.content)];
   this.itemTokenLength.set(item.id,uniqueTokens.length);
   this.totalTokenLength+=uniqueTokens.length;
   for(const token of uniqueTokens){
     this.documentFrequency.set(token,(this.documentFrequency.get(token)||0)+1);
     let ids=this.tokenIndex.get(token);
     if(!ids){ids=new Set<string>();this.tokenIndex.set(token,ids);}
     if(!ids.has(item.id)&&ids.size<96)ids.add(item.id);
   }
 }
 private removeIndexedId(id:string){
   const item=this.itemIndex.get(id);
   if(item){
     const group=item.revisionGroupId??item.id;
     const revisions=this.revisionGroupIndex.get(group);
     if(revisions){revisions.delete(id);if(revisions.size===0)this.revisionGroupIndex.delete(group);}
     const uniqueTokens=[...this.tokensFor(item.content)];
     this.totalTokenLength=Math.max(0,this.totalTokenLength-(this.itemTokenLength.get(id)||uniqueTokens.length));
     this.itemTokenLength.delete(id);
     for(const token of uniqueTokens){
       const df=(this.documentFrequency.get(token)||0)-1;
       if(df>0)this.documentFrequency.set(token,df);else this.documentFrequency.delete(token);
     }
   }
   for(const [token,ids] of this.tokenIndex){
     if(ids.delete(id)&&ids.size===0)this.tokenIndex.delete(token);
   }
 }

 temporalDiagnostics(){
   const now=Date.now(); const current=this.state.items.filter(m=>{const from=Number(m.validFromAt??m.createdAt),until=m.validUntilAt==null?Infinity:Number(m.validUntilAt);return from<=now&&now<until;}).length;
   const historical=this.state.items.filter(m=>m.validUntilAt!=null).length;
   const chains=new Map<string,number>(); for(const m of this.state.items)chains.set(m.revisionGroupId??m.id,Math.max(chains.get(m.revisionGroupId??m.id)??0,Number(m.revisionSequence??1)));
   const maxRevision=Math.max(0,...chains.values());
   return {current,historical,revisedItems:historical,revisionGroups:chains.size,maxRevision,validityCoverage01:this.state.items.length?clamp((current+historical)/this.state.items.length):1};
 }
 temporalChain(id:string){const m=this.itemIndex.get(id);if(!m)return [];const group=m.revisionGroupId??m.id;return this.state.items.filter(x=>(x.revisionGroupId??x.id)===group).sort((a,b)=>(a.revisionSequence??1)-(b.revisionSequence??1)).map(x=>structuredClone(x));}
 temperatureSummary(limit=16){return this.state.items.slice().sort((a,b)=>b.temperature01-a.temperature01).slice(0,Math.max(1,Math.min(32,Math.floor(limit)))).map(m=>({id:m.id,residencyTier:m.residencyTier??'cold',temperature01:m.temperature01,salience:m.salience,emotionalWeight:m.emotionalWeight,identityRelevance:m.identityRelevance,goalRelevance:m.goalRelevance,socialRelevance:m.socialRelevance,predictionError:m.predictionError,lastAccessAt:m.lastAccessAt}));}

 inspectRecent(limit=24){
   const n=Math.max(1,Math.min(64,Math.floor(limit)));
   return this.state.items.slice(0,n).map(m=>({
     id:m.id,kind:m.kind,content:m.content.slice(0,220),
     salience:m.salience,confidence:m.confidence,identityRelevance:m.identityRelevance,
     goalRelevance:m.goalRelevance,socialRelevance:m.socialRelevance,predictionError:m.predictionError,temperature01:m.temperature01,
     retrievalCount:m.retrievalCount,dormant:m.dormant,epistemicStatus:m.epistemicStatus,
     createdAt:m.createdAt,lastAccessAt:m.lastAccessAt
   }));
 }

 size(){return this.state.items.length;}
 retrievalDiagnostics(){return {candidateCount:this.lastCandidateCount,totalItems:this.state.items.length,pruning01:this.state.items.length?Math.max(0,1-this.lastCandidateCount/this.state.items.length):0,signalFusion:true,hybridRetrieval:true,...this.lastHybridDiagnostics};}
 indexDiagnostics(){
   let staleItemIndex=0,missingItemIndex=0,staleExact=0,staleContent=0,dfMismatch=0;
   const ids=new Set(this.state.items.map(m=>m.id));
   for(const id of this.itemIndex.keys())if(!ids.has(id))staleItemIndex++;
   for(const id of ids)if(!this.itemIndex.has(id))missingItemIndex++;
   for(const id of this.exactIndex.values())if(!ids.has(id))staleExact++;
   for(const id of this.contentIndex.values())if(!ids.has(id))staleContent++;
   const expectedDf=new Map<string,number>(); let expectedTotal=0;
   for(const m of this.state.items){const tokens=this.tokensFor(m.content);expectedTotal+=tokens.size;for(const token of tokens)expectedDf.set(token,(expectedDf.get(token)||0)+1);}
   if(expectedTotal!==this.totalTokenLength)dfMismatch++;
   if(expectedDf.size!==this.documentFrequency.size)dfMismatch++;
   else for(const [token,count] of expectedDf)if(this.documentFrequency.get(token)!==count){dfMismatch++;break;}
   return {pass:staleItemIndex===0&&missingItemIndex===0&&staleExact===0&&staleContent===0&&dfMismatch===0,items:this.state.items.length,itemIndexSize:this.itemIndex.size,staleItemIndex,missingItemIndex,staleExact,staleContent,dfMismatch};
 }
 statsLight(){return {items:this.state.items.length,dormant:this.state.items.reduce((n,m)=>n+(m.dormant?1:0),0),forgetCount:this.state.forgetCount,reconsolidations:this.state.reconsolidations,quarantined:this.state.quarantined};}
 contradictionDiagnostics(){const linked=this.state.items.reduce((n,m)=>n+(m.contradictionLinks?.length??0),0);const withContradictions=this.state.items.filter(m=>(m.contradictionLinks?.length??0)>0).length;return {linkedPairs:linked,itemsWithContradictions:withContradictions,contradictionItemRate01:this.state.items.length?withContradictions/this.state.items.length:0};}
 memoIdentityDiagnostics(){const ids=this.state.items.map(m=>m.id);const stable=this.state.items.filter(m=>m.id===stableMemoryId(m.content,m.kind,m.source)).length;const hashes=this.state.items.filter(m=>m.contentHash===memoContentHash(m.content)).length;const uniqueHashes=new Set(this.state.items.map(m=>m.contentHash)).size;return {items:this.state.items.length,stableIds:stable,stableIdRate01:this.state.items.length?stable/this.state.items.length:1,contentHashes:hashes,contentHashRate01:this.state.items.length?hashes/this.state.items.length:1,uniqueContentHashes:uniqueHashes,hashCollisionFree01:this.state.items.length?uniqueHashes/this.state.items.length:1};}
 snapshot(options:{clone?:boolean}={}){return options.clone===false?this.state:structuredClone(this.state);}
}
