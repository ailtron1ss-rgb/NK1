import { MemoryResidencyGovernor, type MemoryResidencyTier } from './MemoryResidencyGovernor.ts';
import { MemorySignalFusion, type MemoryFusionProfile } from './MemorySignalFusion.ts';
import { AdaptiveMemoryPolicy, type MemoryPolicyName } from './AdaptiveMemoryPolicy.ts';
import { canonicalizeMemoryContent, deriveMemoryIdentity, mergeMemoContext, mergeMemoTags, memoContentHash, stableMemoryId } from './MemoInspiredMemoryPrimitives.ts';
import { LocalEmbeddingProvider, type TextEmbeddingProvider } from './LocalEmbeddingProvider.ts';
import { cosineSimilarity, fnv1a32 } from '../core/NumericPrimitives.ts';
function normalizeValidatedEmbeddingVector(value:unknown,expectedDimensions?:number):number[]|null{
 if(!Array.isArray(value)||value.length===0||value.length>4096||
    (expectedDimensions!==undefined&&value.length!==expectedDimensions))return null;
 const vector:number[]=[];let normSquared=0;
 for(const component of value){
  if(typeof component!=='number'||!Number.isFinite(component))return null;
  vector.push(component);normSquared+=component*component;
 }
 const norm=Math.sqrt(normSquared);
 if(!Number.isFinite(norm)||norm<=1e-12)return null;
 return vector.map(component=>component/norm);
}
export type EpistemicStatus='fact'|'belief'|'hypothesis'|'unknown'|'quarantined';
export type MemoryProvenanceClass='device'|'external'|'user'|'agent'|'derived'|'simulation'|'unknown';
export interface MemoryEvidenceSource {
 source:string;
 provenanceClass:MemoryProvenanceClass;
 sourceAuthority01:number;
 independenceKey?:string;
 observedAt:number;
 evidenceFreshnessAt:number;
}
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
provenanceClass?: MemoryProvenanceClass;
sourceAuthority01?: number;
independenceKey?: string;
evidenceFreshnessAt?: number;
/** Bounded independent provenance trail; canonical MemoryOS2 remains the sole writable owner. */
evidenceSources?:MemoryEvidenceSource[];
/** Compact replay guard for lineages trimmed from the visible eight-source trail. */
evidenceLineageKeys?:string[];
dormant:boolean;
retrievalCount:number;
semanticVector:number[];
residencyTier?: MemoryResidencyTier;
}
export type MemoryQueryIntent='episodic'|'procedural'|'identity'|'goal'|'causal'|'factual'|'general';
/** Lightweight bilingual intent detection; type preference supplements, never replaces, evidence ranking. */
export function detectMemoryQueryIntent(query:string):MemoryQueryIntent{
 const q=String(query??'').normalize('NFKC').toLocaleLowerCase();
 if(/\b(why|cause|causal|because|reason|effect|consequence)\b|почему|из-за чего|причин|последств|к чему привел|что повлиял/iu.test(q))return 'causal';
 // Explicit profile questions outrank broad recollection markers such as "remember".
 if(/\b(what do you remember about me|what do you remember about my (?:interests|preferences|personality|profile|goals)|what have you learned about me)\b|что ты помнишь (?:обо мне|про меня|о моих (?:интерес|предпочт|чертах|целях))|что ты запомнил[аи]? (?:обо мне|про меня)|что тебе известно обо мне/iu.test(q))return 'identity';
 if(/\b(what happened|when did|remember when|what did i do|what did we do|how did it go|what did we discuss|what did we talk about|what did you tell me|what did i tell you|can you remind me what we (?:discussed|talked about)|remind me what we (?:discussed|talked about)|recall (?:our|the) (?:last|previous|earlier) (?:conversation|discussion|chat|session)|remember (?:our|the) (?:last|previous|earlier) (?:conversation|discussion|chat|session)|what do you remember about|what do you remember from|what are my memories of|memories? (?:of|about)|our last conversation|previous conversation|earlier discussion|last time)\b|что произошло|что случилось|что мы делали|что мы обсуждали|о ч[её]м мы говорили|напомни(?:те)?(?: мне)?[,\s]{0,12}(?:о ч[её]м|что мы (?:обсуждали|говорили|делали)|наш(?:ем|у) (?:прошл(?:ом|ый)|последн(?:ем|ий)) (?:разговор|диалог|чат))|восстанови(?:ть)? контекст (?:нашего|последнего|прошлого) (?:чата|разговора|диалога|обсуждения)|(?:^|[^\p{L}\p{N}])(?:воспомин|вспомин|припомн)\p{L}*|вспомни|когда я|когда мы|как прошло|какое событие|какой эпизод|что было (?:в )?(?:прошлый раз|тогда)|прошл(?:ый|ая|ое|ые|ую|ых|ом|ей) (?:раз|разговор|обсужден\p{L}*|сесси\p{L}*|встреч\p{L}*)/iu.test(q))return 'episodic';
 if(/\b(how to|steps|instructions|how do i|procedure|configure|install|implement)\b|как сделать|как настроить|инструкц|шаги|пошагово|как реализовать|как установить/iu.test(q))return 'procedural';
 if(/\b(what do i like|what do i love|what am i interested in|what topics am i curious about|what do i find interesting|what are my hobbies|what do i enjoy|what do i enjoy exploring|my interests|my preferences|who am i|my personality|what do you know about me|what are my personality traits)\b|что мне нравит|что мне интересно|чем я интересуюсь|что меня интересует|что я люблю|что мне любопытно|чем я увлекаюсь|какие у меня интересы|какой я|мои интересы|мои предпочт|что ты знаешь обо мне|какие у меня черты характера|какие мои устойчивые черты|что за человек я|мой характер|моя личность/iu.test(q))return 'identity';
 if(/\b(what is next|what remains|unfinished|current goals|next step|what did i want|what did i intend|what was i planning|next goal|my intention)\b|что (?:мне )?осталось|что я хотел|что я намеревал|что я собирался|что я планировал|мои цели|незаверш|следующий шаг|какие планы|что дальше|текущие цели/iu.test(q))return 'goal';
 if(/\b(what is|define|definition|explain the concept)\b|что такое|определение|дай определение|объясни понятие/iu.test(q))return 'factual';
 return 'general';
}
export function isConversationMemory(item:Pick<MemoryItem2,'context'|'source'>):boolean{
 const context=item.context??{};
 const normalizeKey=(key:string)=>key.normalize('NFKC').replace(/[-_\s]/gu,'').toLocaleLowerCase();
 const hasValue=(value:unknown)=>typeof value==='string'&&value.trim().length>0&&!/^(?:0|false|no|off|none|unknown)$/iu.test(value.trim());
 // Stable lineage is strongest evidence. A relationship, speaker role, message index,
 // turn sequence or arbitrary context value must never impersonate a conversation ID.
 const hasConversationIdentity=Object.entries(context).some(([key,value])=>
  /^(?:conversation|dialogue|chat|thread|transcript|session)(?:id|key)$/u.test(normalizeKey(key))&&hasValue(value));
 if(hasConversationIdentity)return true;

 // Accept explicit, typed conversation-history markers. Do not scan every context value:
 // imported metadata such as relationshipId="conversation-17" is not a conversation ID.
 const historyField=/^(?:(?:conversation|dialogue|chat|thread|transcript|session|message|discussion)(?:history|summary|record|transcript|log|archive))$/u;
 const classificationFields=new Set(['type','kind','memorytype','contenttype','sourcetype','recordtype','category','modality','entrytype']);
 const explicitHistoryLabel=(value:unknown)=>{
  if(typeof value!=='string')return false;
  const normalized=value.normalize('NFKC').toLocaleLowerCase().trim().replace(/[_\s]+/gu,'-');
  return /^(?:(?:conversation|dialogue|chat|session|transcript|message|discussion)(?:-(?:history|summary|record|transcript|log|import|archive))?|история-(?:бесед|диалога|чата|сессии)|транскрипт(?:-(?:диалога|чата|сессии))?|сводка-разговора|запись-(?:диалога|беседы|чата))$/iu.test(normalized);
 };
 for(const [key,value] of Object.entries(context)){
  if(!hasValue(value))continue;
  const normalizedKey=normalizeKey(key);
  if(historyField.test(normalizedKey))return true;
  if(classificationFields.has(normalizedKey)&&explicitHistoryLabel(value))return true;
 }
 // Source labels can identify a conversation-history import, but generic values from
 // unrelated context fields are not evidence of dialogue lineage.
 const source=String(item.source??'').normalize('NFKC').toLocaleLowerCase().replace(/[_\s]+/gu,'-');
 return /(?:^|-)(?:conversation|dialogue|chat|session|transcript|message|discussion)-(?:history|summary|record|transcript|log|import|archive)(?:-|$)/u.test(source)||
  /(?:^|-)(?:история-бесед|история-диалога|история-чата|история-сессии|транскрипт-диалога|сводка-разговора)(?:-|$)/u.test(source);
}
function memoryIntentFit(intent:MemoryQueryIntent,item:MemoryItem2):number{
 const hasGoal=Boolean(String(item.context?.goalId??'').trim())||item.goalRelevance>=.65;
 switch(intent){
  case 'episodic': return item.kind==='episodic'?(item.context?.observationId&&item.context?.decisionId?.trim()?1:.94):item.kind==='autobiographical'?.92:item.kind==='social'?(isConversationMemory(item) ? 0.90 : 0.32):item.kind==='working'?.18:0;
  case 'procedural': return item.kind==='procedural'?1:item.kind==='episodic'?.18:item.kind==='semantic'?.08:0;
  case 'identity': return item.kind==='identity'?1:item.kind==='autobiographical'?.82:item.kind==='social'?.56:item.kind==='semantic'?.18:0;
  case 'goal': return hasGoal?.96:item.kind==='working'?.82:item.kind==='autobiographical'?.48:item.kind==='identity'?.34:item.kind==='procedural'?.28:item.kind==='episodic'?.24:0;
  case 'causal': return item.context?.decisionId&&item.context?.observationId&&item.context?.outcomeDirection?(item.kind==='episodic'?.98:.82):item.causalLinks.length>0?(item.kind==='episodic'?.96:item.kind==='autobiographical'?.90:.72):item.kind==='episodic'?.68:item.kind==='autobiographical'?.58:item.kind==='semantic'?.16:0;
  case 'factual': return item.kind==='semantic'?1:item.kind==='procedural'?.34:item.kind==='episodic'?.18:0;
  default:return 0;
 }
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
implicitConflictCandidates:number;
implicitConflictsResolved:number;
staleRetrievalsAvoided:number;
lastConflictScanAt:number;
implicitConflictsDeferred:number;
provenanceProtected:number;
estimatedBytes:number;
byteBudget:number;
budgetEvictions:number;
budgetMisses:number;
meanEvictionRegret01:number;
evictionWitnesses:MemoryEvictionWitness[];
}
export interface MemoryEvictionWitness {
 id:string; kind:MemoryItem2['kind']; at:number; tick:number; bytes:number; value01:number; netValuePerByte01:number; reason:string; tokens:string[]; matchedQueries:number; realizedRegret01:number; counterfactualRegret01:number;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
// Keep single-digit numeric tokens: status codes, ratings, short versions and measured values are meaningful retrieval terms. Single-letter words remain excluded.
const tokenize=(text:string)=>text.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}|\p{N}/gu)??[];
const characterGramCache=new Map<string,Set<string>>();
function charTrigrams(token:string):Set<string>{
 const key=String(token).toLocaleLowerCase().normalize('NFKC');
 const cached=characterGramCache.get(key);if(cached)return cached;
 const chars=[...key];const grams=new Set<string>();
 if(chars.length>=3){const padded=['^',...chars,'$'];for(let i=0;i+2<padded.length;i++)grams.add(padded.slice(i,i+3).join(''));}
 // Shared n-gram cache is deliberately small: the 1600-item memory cap can
 // still produce a large vocabulary on long technical notes or source code.
 if(characterGramCache.size>=4096){const oldest=characterGramCache.keys().next().value as string|undefined;if(oldest)characterGramCache.delete(oldest);}
 characterGramCache.set(key,grams);return grams;
}
function charDiceSimilarity(a:string,b:string):number{
 if(a===b)return 1;
 if([...a].length<4||[...b].length<4)return 0;
 const ga=charTrigrams(a),gb=charTrigrams(b);if(!ga.size||!gb.size)return 0;
 let common=0;for(const gram of ga)if(gb.has(gram))common++;
 return clamp(2*common/(ga.size+gb.size));
}

/**
 * Compact bilingual concept bridge for retrieval. This is a low-weight candidate/ranking
 * signal layered onto MemoryOS2's existing inverted index; it does not create another
 * memory store and never overrides temporal or epistemic eligibility. The groups are
 * deliberately domain-specific and small rather than an unbounded synonym expansion.
 */
const MEMORY_RETRIEVAL_CONCEPT_GROUPS:ReadonlyArray<ReadonlyArray<string>>=[
 ['memory','memories','recollection','remember','recall','recalled','past','воспоминание','воспоминания','вспомнить','вспомни','память','прошлое'],
 ['goal','objective','plan','intention','unfinished','next-step','цель','план','намерение','незавершенное','следующий-шаг'],
 ['interest','interested','interesting','curiosity','curious','preference','like','likes','liked','enjoy','enjoys','interests','hobby','hobbies','passion','passionate','explore','exploring','interested-in','интерес','интересно','интересуюсь','интересуется','заинтересован','любопытство','любопытный','увлекаться','увлекаюсь','увлечение','хобби','предпочтение','нравиться','нравится'],
 ['emotion','feeling','feelings','mood','affect','anger','angry','frustration','irritated','sadness','joy','эмоция','чувство','чувства','настроение','злость','злой','раздражение','раздражённый','грусть','радость'],
 ['action','actions','execution','execute','operation','performed','tool','tool-call','действие','действия','выполнение','выполнить','операция','выполнено','инструмент'],
 ['outcome','result','results','consequence','effect','response','receipt','результат','результаты','исход','последствие','эффект','ответ','квитанция','подтверждение'],
 ['error','failure','failed','fail','mistake','incident','unsuccessful','ошибка','сбой','неудача','неудачей','провал','инцидент'],
 ['cause','reason','because','why','causal','causes','почему','причина','причины','причин','из-за','поскольку','причинный'],
 ['code','source','script','repository','implementation','program','код','исходник','исходники','скрипт','репозиторий','реализация','программа'],
 ['avatar','body','gesture','pose','motion','embodiment','аватар','тело','жест','поза','движение','воплощение'],
 ['permission','approval','consent','authorize','allow','разрешение','согласие','одобрение','допуск','разрешить'],
 ['conversation','dialogue','discuss','talk','topic','разговор','диалог','обсудить','общение','тема'],
 ['self','identity','personality','character','trait','traits','temperament','worldview','autobiography','self-model','я-образ','личность','характер','черта','черты','темперамент','мировоззрение','автобиография','самомодель','самовосприятие'],
 ['relationship','relationships','social','friend','trust','reciprocity','response','person','bond','отношение','отношения','социальный','друг','доверие','взаимность','реакция','собеседник','связь'],
 ['learning','learn','improve','improvement','skill','skills','correction','lesson','practice','training','обучение','учиться','учусь','улучшение','навык','навыки','исправление','урок','практика','тренировка'],
 ['hypothesis','belief','uncertain','uncertainty','confidence','evidence','assumption','source','fact','гипотеза','убеждение','неуверенность','неопределенность','уверенность','доказательство','предположение','источник','факт','свидетельство'],
 ['image','visual','vision','see','saw','hear','heard','observe','observation','camera','sound','perception','изображение','визуальный','зрение','видеть','видел','слышать','услышал','наблюдение','камера','звук','восприятие'],
 ['yesterday','earlier','later','before','after','last-time','sequence','timeline','when','вчера','раньше','позже','до','после','в-прошлый-раз','последовательность','хронология','когда','время','дата'],
];
// Pre-tokenize the compact concept dictionary once. The old path re-tokenized every
// alias for every candidate memory; with 192 candidates this repeated allocation was
// pure overhead on mobile and after broad retrievals.
const MEMORY_RETRIEVAL_CONCEPT_TERM_GROUPS:ReadonlyArray<ReadonlyArray<ReadonlyArray<string>>>=MEMORY_RETRIEVAL_CONCEPT_GROUPS.map(group=>group.map(alias=>tokenize(alias.replace(/-/g,' '))));
function conceptAliasMatchScore(token:string,alias:string):number{
 if(token===alias)return 1;
 if(token.length>=5&&alias.length>=5&&(token.startsWith(alias.slice(0,5))||alias.startsWith(token.slice(0,5))))return .86;
 const similarity=charDiceSimilarity(token,alias);
 return similarity>=.72?similarity:0;
}
function expandMemoryQueryConcepts(tokens:Iterable<string>):{weights:Map<string,number>;groups:ReadonlyArray<number>}{
 const originals=[...new Set(tokens)].filter(Boolean);const weights=new Map<string,number>(originals.map(token=>[token,1]));
 const active:Array<{index:number;matchScore:number;terms:string[]}>=[];
 for(let groupIndex=0;groupIndex<MEMORY_RETRIEVAL_CONCEPT_GROUPS.length;groupIndex++){
  const aliases=MEMORY_RETRIEVAL_CONCEPT_GROUPS[groupIndex];let matchScore=0;
  for(const token of originals)for(const alias of aliases)matchScore=Math.max(matchScore,conceptAliasMatchScore(token,alias));
  if(matchScore===0)continue;
  const terms=[...new Set(MEMORY_RETRIEVAL_CONCEPT_TERM_GROUPS[groupIndex].flat())].filter(term=>!weights.has(term)).sort((a,b)=>a.localeCompare(b));
  active.push({index:groupIndex,matchScore,terms});
 }
 // Prioritize groups that directly match a query token, then round-robin expansion
 // across active groups. Alphabetical truncation used to starve later concept groups
 // on mixed queries (e.g. an interest question that also mentions an unfinished goal).
 active.sort((a,b)=>b.matchScore-a.matchScore||a.index-b.index);
 const selectedGroups=active.slice(0,6);
 const cursor=new Array(selectedGroups.length).fill(0);let added=0;
 while(added<36){let madeProgress=false;
  for(let groupIndex=0;groupIndex<selectedGroups.length&&added<36;groupIndex++){
   const entry=selectedGroups[groupIndex];
   while(cursor[groupIndex]<entry.terms.length&&weights.has(entry.terms[cursor[groupIndex]]))cursor[groupIndex]++;
   const term=entry.terms[cursor[groupIndex]++];if(!term)continue;
   weights.set(term,.34);added++;madeProgress=true;
  }
  if(!madeProgress)break;
 }
 return {weights,groups:selectedGroups.map(entry=>entry.index)};
}
function conceptGroupCoverage(groups:ReadonlyArray<number>,documentTokens:Set<string>):number{
 if(!groups.length)return 0;
 let hits=0;
 for(const groupIndex of groups){
  const terms=MEMORY_RETRIEVAL_CONCEPT_TERM_GROUPS[groupIndex]??[];
  if(terms.some(aliasTerms=>aliasTerms.some(token=>documentTokens.has(token))))hits++;
 }
 return clamp(hits/groups.length);
}
function fuzzyTokenCoverage(queryTokens:string[],documentTokens:Set<string>):number{
 if(!queryTokens.length||!documentTokens.size)return 0;
 let total=0;
 for(const queryToken of queryTokens){
  if(documentTokens.has(queryToken)){total++;continue;}
  if([...queryToken].length<4)continue;
  let best=0;
  for(const token of documentTokens){
   if([...token].length<4||Math.abs([...token].length-[...queryToken].length)>Math.max(2,Math.floor([...queryToken].length*.4)))continue;
   const similarity=charDiceSimilarity(queryToken,token);if(similarity>best)best=similarity;
  }
  total+=best>=.38?best:0;
 }
 return clamp(total/queryTokens.length);
}
const hashToken = fnv1a32;
function vectorize(text:string,dim=48){const v=Array(dim).fill(0);for(const tok of tokenize(text)){const h=hashToken(tok);const i=h%dim;const j=(h>>>8)%dim;v[i]+=1;v[j]-=.35;}const norm=Math.sqrt(v.reduce((a:number,x:number)=>a+x*x,0))||1;return v.map(x=>x/norm);}
const cosine = (a:number[],b:number[]) => clamp(cosineSimilarity(a,b)); // Retrieval scores are non-negative; zero similarity is not evidence.
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
export const defaultMemoryOS2=():MemoryOSState2=>({items:[],forgetCount:0,reconsolidations:0,quarantined:0,lastMaintenanceAt:0,semanticQueries:0,semanticHits:0,linkUpdates:0,version:7,implicitConflictCandidates:0,implicitConflictsResolved:0,staleRetrievalsAvoided:0,lastConflictScanAt:0,implicitConflictsDeferred:0,provenanceProtected:0,estimatedBytes:0,byteBudget:524288,budgetEvictions:0,budgetMisses:0,meanEvictionRegret01:0,evictionWitnesses:[]});
const MAX_MEMORY_REVISION_HISTORY=64;
const EPISTEMIC_STATUSES=new Set<EpistemicStatus>(['fact','belief','hypothesis','unknown','quarantined']);
function normalizeRevisionHistory(value:unknown):MemoryItem2['revisionHistory']{
 if(!Array.isArray(value))return [];
 return value.slice(0,MAX_MEMORY_REVISION_HISTORY).flatMap((row:any)=>{
  if(!row||typeof row!=='object')return [];
  const at=Number(row.at);if(!Number.isFinite(at)||!EPISTEMIC_STATUSES.has(row.from)||!EPISTEMIC_STATUSES.has(row.to))return [];
  return [{at,from:row.from as EpistemicStatus,to:row.to as EpistemicStatus,reason:String(row.reason??'').slice(0,240)}];
 });
}
type MemoryEstimateShape=Pick<MemoryItem2,'content'|'tags'|'context'|'semanticLinks'|'temporalLinks'|'causalLinks'|'contradictionLinks'|'evidenceSources'|'evidenceLineageKeys'> & Partial<Pick<MemoryItem2,'revisionHistory'>>;
const estimateMemoryBytes=(m:MemoryEstimateShape)=>Math.max(96,new TextEncoder().encode(JSON.stringify({content:m.content,tags:m.tags,context:m.context,s:m.semanticLinks,t:m.temporalLinks,c:m.causalLinks,k:m.contradictionLinks,e:m.evidenceSources,ek:m.evidenceLineageKeys,r:normalizeRevisionHistory(m.revisionHistory)})).byteLength);
export type MemoryTemporalMode='current'|'at'|'all';
export interface MemoryTemporalQueryOptions { temporalMode?:MemoryTemporalMode; asOfAt?:number; }
export interface SemanticMemoryPreview { items:MemoryItem2[]; semantic:{enabled:boolean;provider:string;model:string;indexedItems:number;corpusItems:number;coverage01:number;newlyIndexed:number;fallbackReason:string|null;cacheEntries:number;requests:number;failures:number;lastLatencyMs:number}; }
export interface SemanticRetrievalPerformanceOptions { maxIndexItems?:number; maxLexicalPool?:number; providerTimeoutMs?:number; }
export interface SemanticIndexMaintenanceResult {
 enabled:boolean; provider:string; model:string; considered:number; indexed:number; failed:number; staleSkipped:number;
 indexedItems:number; corpusItems:number; remaining:number; waitingForRetry:number; nextRetryAt:number|null;
 lastRunAt:number; lastDurationMs:number; lastErrorCode:string|null; redactedInputs:number;
}
/** Diagnostics for defensive snapshot restore; never includes memory contents. */
export interface MemoryRestoreDiagnostics {
 sourceRows:number;
 acceptedRows:number;
 duplicateIdsResolved:number;
 invalidRowsDropped:number;
 truncatedRows:number;
 identityConflictsQuarantined:number;
}

function stableMemoryJson(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(stableMemoryJson).join(',')}]`;
 if(value&&typeof value==='object'){
  const row=value as Record<string,unknown>;
  return `{${Object.keys(row).filter(key=>row[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${stableMemoryJson(row[key])}`).join(',')}}`;
 }
 const encoded=JSON.stringify(value);
 return encoded===undefined?'null':encoded;
}

export class MemoryOS2{
 private state=defaultMemoryOS2();
 private lastRestoreDiagnosticsData:MemoryRestoreDiagnostics={sourceRows:0,acceptedRows:0,duplicateIdsResolved:0,invalidRowsDropped:0,truncatedRows:0,identityConflictsQuarantined:0};
 private readonly exactIndex=new Map<string,string>();
 private readonly itemIndex=new Map<string,MemoryItem2>();
 private readonly contentIndex=new Map<string,string>();
 private readonly tokenCache=new Map<string,Set<string>>();
 private readonly lowerContentCache=new Map<string,string>();
 private readonly tokenIndex=new Map<string,Set<string>>();
 /** Separate bounded postings for curated tags/entities/topic metadata. */
 private readonly metadataTokenIndex=new Map<string,Set<string>>();
 /** Token-level character n-gram inverted index for typo/inflection-tolerant candidate discovery. */
 private readonly characterGramIndex=new Map<string,Set<string>>();
 private readonly documentFrequency=new Map<string,number>();
 private readonly itemTokenLength=new Map<string,number>();
 private readonly revisionGroupIndex=new Map<string,Set<string>>();
 private totalTokenLength=0;
 private lastCandidateCount=0;
 private lastHybridDiagnostics:{bm25Enabled:boolean;bm25CandidateCount:number;bm25Max:number;rrfEnabled:boolean;identifierBias:boolean;temporalMode:MemoryTemporalMode;asOfAt:number;queryIntentMode:MemoryQueryIntent;maxQueryIntentBoost01:number;candidateSelection:'idf-coverage-fuzzy-concept-rrf-stable-id'|'idf-coverage-fuzzy-concept-metadata-rrf-stable-id';candidateSelectionLimit:number;fuzzyEnabled:boolean;fuzzyCandidateCount:number;semanticVectorUsedForRanking:boolean;semanticEmbeddingProvider:string;rrfSignals:string[];answerabilityGate:'direct-evidence-or-typed-recall-v1';rankedBeforeGate:number;groundedAfterGate:number;abstained:boolean;abstentionReason:'no-grounded-evidence'|null}={bm25Enabled:true,bm25CandidateCount:0,bm25Max:0,rrfEnabled:true,identifierBias:false,temporalMode:'current',asOfAt:0,queryIntentMode:'general',maxQueryIntentBoost01:0,candidateSelection:'idf-coverage-fuzzy-concept-rrf-stable-id',candidateSelectionLimit:192,fuzzyEnabled:true,fuzzyCandidateCount:0,semanticVectorUsedForRanking:false,semanticEmbeddingProvider:'none',rrfSignals:['bm25','token-coverage','character-fuzzy','entity','graph-temporal'],answerabilityGate:'direct-evidence-or-typed-recall-v1',rankedBeforeGate:0,groundedAfterGate:0,abstained:false,abstentionReason:null};
 private linkSupportCache:Map<string,number>|null=null;
 private linkSupportCacheVersion=-1;
 private readonly residencyGovernor=new MemoryResidencyGovernor();
 /** Derived bounded embedding index; canonical facts remain exclusively in MemoryOS2 state. */
 private readonly semanticEmbeddingIndex=new Map<string,{contentHash:string;providerId:string;vector:number[];lastUsedAt:number}>();
 /** Content-bound retry state only; no memory text is copied into a queue or retry ledger. */
 private readonly semanticEmbeddingRetry=new Map<string,{contentHash:string;attempts:number;retryAt:number}>();
 private lastSemanticIndexMaintenance={lastRunAt:0,lastDurationMs:0,lastIndexed:0,lastFailed:0,lastStaleSkipped:0,lastErrorCode:null as string|null};
 private readonly embeddingProvider:TextEmbeddingProvider|undefined;
 private readonly signalFusion:MemorySignalFusion;
 private readonly signalFusionProfile:MemoryFusionProfile;
 /** Candidate metadata recall stays opt-in until independent holdout uplift is demonstrated. */
 private readonly metadataRecallEnabled:boolean;
 private readonly adaptivePolicy=new AdaptiveMemoryPolicy();
 private activePolicy:MemoryPolicyName='balanced';
 constructor(options:{signalFusionProfile?:MemoryFusionProfile;embeddingProvider?:TextEmbeddingProvider|null;metadataRecallEnabled?:boolean}={}){ this.signalFusionProfile=options.signalFusionProfile??'balanced'; this.signalFusion=new MemorySignalFusion(this.signalFusionProfile); this.embeddingProvider=options.embeddingProvider===null?undefined:(options.embeddingProvider??LocalEmbeddingProvider.fromEnvironment()); this.metadataRecallEnabled=options.metadataRecallEnabled===true; }
 embeddingConfigured(){return Boolean(this.embeddingProvider); }

  restoreDiagnostics():MemoryRestoreDiagnostics{return {...this.lastRestoreDiagnosticsData};}
  private restoredIdentityRank(item:MemoryItem2,at:number):number[]{
   return [
    Number(this.validAt(item,at)),
    Number(item.epistemicStatus!=='quarantined'&&!item.dormant),
    Number(Number(item.validFromAt??item.createdAt)<=at),
    Number.isFinite(Number(item.revisionSequence))?Number(item.revisionSequence):1,
    Number.isFinite(Number(item.observedAt??item.createdAt))?Number(item.observedAt??item.createdAt):0,
    Number.isFinite(Number(item.createdAt))?Number(item.createdAt):0,
   ];
  }
  private restoredIdentityFingerprint(item:MemoryItem2):string{
   return stableMemoryJson({
    id:item.id,content:item.content,kind:item.kind,source:item.source,epistemicStatus:item.epistemicStatus,
    validFromAt:item.validFromAt,validUntilAt:item.validUntilAt,observedAt:item.observedAt,
    supersedesId:item.supersedesId,supersededById:item.supersededById,
    revisionGroupId:item.revisionGroupId,revisionSequence:item.revisionSequence,
    evidenceLineageKeys:[...(item.evidenceLineageKeys??[])].sort(),
   });
  }
  private dedupeRestoredItems(rows:MemoryItem2[]):MemoryItem2[]{
   const groups=new Map<string,MemoryItem2[]>();
   for(const item of rows){const group=groups.get(item.id)??[];group.push(item);groups.set(item.id,group);}
   const at=Date.now();const result:MemoryItem2[]=[];let identityConflictsQuarantined=0;
   for(const group of groups.values()){
    if(group.length===1){result.push(group[0]!);continue;}
    const rank=(item:MemoryItem2)=>this.restoredIdentityRank(item,at);
    const compareRank=(left:MemoryItem2,right:MemoryItem2)=>{
     const a=rank(left),b=rank(right);
     for(let index=0;index<a.length;index++)if(a[index]!==b[index])return Number(b[index])-Number(a[index]);
     return stableMemoryJson(left).localeCompare(stableMemoryJson(right));
    };
    const ordered=[...group].sort(compareRank);const selected=ordered[0]!;const selectedRank=rank(selected);
    const tied=ordered.filter(item=>rank(item).every((value,index)=>value===selectedRank[index]));
    const tiedFingerprints=new Set(tied.map(item=>this.restoredIdentityFingerprint(item)));
    if(tiedFingerprints.size>1){
     // Array order and confidence are not authority when equally-ranked records reuse
     // an ID for different facts. Preserve an audit row, but disable recall as fact.
     const from=selected.epistemicStatus;
     result.push({...selected,epistemicStatus:'quarantined',confidence:0,revisionHistory:normalizeRevisionHistory([
      ...selected.revisionHistory,{at,from,to:'quarantined',reason:'restore-duplicate-id-conflict'},
     ])});
     identityConflictsQuarantined++;
    }else result.push(selected);
   }
   this.lastRestoreDiagnosticsData={...this.lastRestoreDiagnosticsData,acceptedRows:result.length,duplicateIdsResolved:rows.length-result.length,identityConflictsQuarantined};
   return result;
  }

 private validAt(item:MemoryItem2,at:number){const from=Number(item.validFromAt??item.createdAt),until=item.validUntilAt==null?Number.POSITIVE_INFINITY:Number(item.validUntilAt);return Number.isFinite(from)&&from<=at&&at<until;}
 private preferIndexRecord(candidate:MemoryItem2,incumbent:MemoryItem2,at:number){
  const currentDelta=Number(this.validAt(candidate,at))-Number(this.validAt(incumbent,at));if(currentDelta)return currentDelta>0;
  const trustDelta=Number(candidate.epistemicStatus!=='quarantined'&&!candidate.dormant)-Number(incumbent.epistemicStatus!=='quarantined'&&!incumbent.dormant);if(trustDelta)return trustDelta>0;
  const startedDelta=Number(Number(candidate.validFromAt??candidate.createdAt)<=at)-Number(Number(incumbent.validFromAt??incumbent.createdAt)<=at);if(startedDelta)return startedDelta>0;
  const sequenceDelta=Number(candidate.revisionSequence??1)-Number(incumbent.revisionSequence??1);if(sequenceDelta)return sequenceDelta>0;
  const observedDelta=Number(candidate.observedAt??candidate.createdAt)-Number(incumbent.observedAt??incumbent.createdAt);if(observedDelta)return observedDelta>0;
  const createdDelta=Number(candidate.createdAt)-Number(incumbent.createdAt);if(createdDelta)return createdDelta>0;
  return candidate.id.localeCompare(incumbent.id)<0;
 }
 private rebuildDedupIndexesFor(item:Pick<MemoryItem2,'kind'|'source'|'content'>,at=Date.now()){
  const canonical=canonicalizeMemoryContent(item.content);
  const exactKey=`${item.kind}|${item.source}|${canonical}`;
  const contentKey=`${item.kind}|${canonical}`;
  let bestExact:MemoryItem2|undefined,bestContent:MemoryItem2|undefined;
  for(const candidate of this.state.items){
   if(candidate.kind!==item.kind||canonicalizeMemoryContent(candidate.content)!==canonical)continue;
   if(candidate.source===item.source&&(!bestExact||this.preferIndexRecord(candidate,bestExact,at)))bestExact=candidate;
   if(!bestContent||this.preferIndexRecord(candidate,bestContent,at))bestContent=candidate;
  }
  if(bestExact)this.exactIndex.set(exactKey,bestExact.id);else this.exactIndex.delete(exactKey);
  if(bestContent)this.contentIndex.set(contentKey,bestContent.id);else this.contentIndex.delete(contentKey);
 }
 /**
  * Query an isolated snapshot for diagnostics/inspection. Unlike retrieve(), this
  * method never changes live access timestamps, retrieval counts, adaptive policy,
  * memory temperature, stale counters, or retrieval diagnostics on this instance.
  */
 previewRetrieveWithDiagnostics(query:string,limit=8,goalRelevance=0,identityRelevance=0,temporalOptions:MemoryTemporalQueryOptions={}){
   const isolated=new MemoryOS2({signalFusionProfile:this.signalFusionProfile,metadataRecallEnabled:this.metadataRecallEnabled});
   isolated.restore(this.snapshot());
   const items=isolated.retrieve(query,limit,goalRelevance,identityRelevance,temporalOptions,true) as MemoryItem2[];
   return {items,diagnostics:isolated.retrievalDiagnostics(),policy:isolated.adaptivePolicyDiagnostics()};
 }
 previewRetrieve(query:string,limit=8,goalRelevance=0,identityRelevance=0,temporalOptions:MemoryTemporalQueryOptions={}){
   return this.previewRetrieveWithDiagnostics(query,limit,goalRelevance,identityRelevance,temporalOptions).items;
 }
 /**
  * Low-priority, bounded semantic-index maintenance. Adapts the deferred embedding-worker
  * pattern in retained Hexis MIT source `services/memory_embeddings.py` to the canonical
  * MemoryOS2 store: memory writes never wait, derived vectors are cached, failures back off,
  * and lexical recall remains available throughout.
  */
 async maintainSemanticIndexBatch(options:{maxItems?:number;providerTimeoutMs?:number;now?:number}={}):Promise<SemanticIndexMaintenanceResult>{
  const now=Number.isFinite(Number(options.now))?Number(options.now):Date.now();
  const provider=this.embeddingProvider;
  const providerDiag=provider?.diagnostics();
  const baseDiag=(enabled:boolean,code:string|null=null):SemanticIndexMaintenanceResult=>({
   enabled,provider:providerDiag?.provider??'none',model:providerDiag?.model??'',considered:0,indexed:0,failed:0,staleSkipped:0,
   indexedItems:this.semanticEmbeddingIndex.size,corpusItems:this.state.items.length,remaining:this.state.items.length,waitingForRetry:0,nextRetryAt:null,
   lastRunAt:this.lastSemanticIndexMaintenance.lastRunAt,lastDurationMs:this.lastSemanticIndexMaintenance.lastDurationMs,
   lastErrorCode:code??this.lastSemanticIndexMaintenance.lastErrorCode,redactedInputs:Number(providerDiag?.redactedInputs??0),
  });
  if(!provider)return baseDiag(false,'embedding-provider-disabled');
  const maxItems=Math.max(1,Math.min(16,Math.floor(Number.isFinite(options.maxItems)?Number(options.maxItems):8)));
  const timeoutMs=Math.max(500,Math.min(5000,Math.floor(Number.isFinite(options.providerTimeoutMs)?Number(options.providerTimeoutMs):2200)));
  const corpus=this.state.items.filter(item=>!item.dormant&&item.epistemicStatus!=='quarantined'&&Number(item.validFromAt??item.createdAt)<=now&&(item.validUntilAt==null||now<Number(item.validUntilAt)));
  const corpusById=new Map(corpus.map(item=>[item.id,item]));
  const currentVector=(item:MemoryItem2)=>{const row=this.semanticEmbeddingIndex.get(item.id);return Boolean(row&&row.providerId===provider.providerId&&row.contentHash===memoContentHash(item.content)&&row.vector.length>0);};
  for(const [id,row] of this.semanticEmbeddingIndex){const item=corpusById.get(id);if(!item||row.providerId!==provider.providerId||row.contentHash!==memoContentHash(item.content))this.semanticEmbeddingIndex.delete(id);}
  for(const [id,retry] of this.semanticEmbeddingRetry){const item=corpusById.get(id);if(!item||retry.contentHash!==memoContentHash(item.content))this.semanticEmbeddingRetry.delete(id);}
  const missing=corpus.filter(item=>!currentVector(item)).filter(item=>(this.semanticEmbeddingRetry.get(item.id)?.retryAt??0)<=now);
  const priority=(item:MemoryItem2)=>{
   const age=Math.max(0,now-Number(item.createdAt??now));
   const freshness=Math.max(0,1-Math.min(1,age/(45*86400000)));
   const retrieval=Math.min(1,Math.max(0,Number(item.retrievalCount??0))/12);
   return .38*clamp(Number(item.salience))+.22*clamp(Number(item.identityRelevance))+.16*clamp(Number(item.goalRelevance))+.14*retrieval+.10*freshness;
  };
  missing.sort((a,b)=>priority(b)-priority(a)||Number(b.createdAt)-Number(a.createdAt)||a.id.localeCompare(b.id));
  const candidates=missing.slice(0,maxItems);
  const waiting=corpus.map(item=>this.semanticEmbeddingRetry.get(item.id)).filter((row):row is {contentHash:string;attempts:number;retryAt:number}=>Boolean(row&&row.retryAt>now));
  if(!candidates.length){
   this.lastSemanticIndexMaintenance={...this.lastSemanticIndexMaintenance,lastRunAt:now,lastDurationMs:0,lastIndexed:0,lastFailed:0,lastStaleSkipped:0,lastErrorCode:null};
   const indexedItems=corpus.filter(currentVector).length;
   return {...baseDiag(true,null),indexedItems,corpusItems:corpus.length,remaining:Math.max(0,corpus.length-indexedItems),waitingForRetry:waiting.length,nextRetryAt:waiting.length?Math.min(...waiting.map(row=>row.retryAt)):null,lastRunAt:now,lastDurationMs:0,lastErrorCode:null};
  }
  const started=Date.now();let indexed=0,failed=0,staleSkipped=0;let errorCode:string|null=null;
  const failRow=(item:MemoryItem2)=>{
   const contentHash=memoContentHash(item.content);const old=this.semanticEmbeddingRetry.get(item.id);
   const attempts=Math.min(8,(old?.contentHash===contentHash?old.attempts:0)+1);
   const backoffMs=Math.min(5*60_000,3000*(2**Math.min(7,attempts-1)));
   this.semanticEmbeddingRetry.set(item.id,{contentHash,attempts,retryAt:now+backoffMs});failed++;
  };
  try{
   // The local provider enforces bounded payloads, timeout, host policy and an LRU vector cache.
   const vectors=await provider.embedBatch(candidates.map(item=>item.content),{timeoutMs});
   if(!Array.isArray(vectors)||vectors.length!==candidates.length)throw new Error('embedding-vector-count-mismatch');
   const dimensions=Number(vectors[0]?.length??0);
   for(let index=0;index<candidates.length;index++){
    const item=candidates[index],raw=vectors[index];
    if(!Array.isArray(raw)||!dimensions||dimensions>4096||raw.length!==dimensions||raw.some(value=>!Number.isFinite(Number(value)))){failRow(item);continue;}
    const clean=raw.map(Number);const norm=Math.sqrt(clean.reduce((sum,value)=>sum+value*value,0));
    if(!(norm>1e-12)){failRow(item);continue;}
    const current=this.state.items.find(row=>row.id===item.id);
    if(!current||current.dormant||current.epistemicStatus==='quarantined'||memoContentHash(current.content)!==memoContentHash(item.content)){staleSkipped++;continue;}
    this.semanticEmbeddingIndex.set(item.id,{contentHash:memoContentHash(current.content),providerId:provider.providerId,vector:clean.map(value=>value/norm),lastUsedAt:now});
    this.semanticEmbeddingRetry.delete(item.id);indexed++;
   }
   while(this.semanticEmbeddingIndex.size>1600){
    let oldestId:string|undefined,oldestAt=Number.POSITIVE_INFINITY;
    for(const [id,row] of this.semanticEmbeddingIndex)if(row.lastUsedAt<oldestAt){oldestAt=row.lastUsedAt;oldestId=id;}
    if(!oldestId)break;this.semanticEmbeddingIndex.delete(oldestId);
   }
  }catch(error){
   for(const item of candidates)failRow(item);
   const message=String(error instanceof Error?error.message:'embedding-provider-error').toLocaleLowerCase();
   errorCode=/timeout|deadline/.test(message)?'provider-timeout':/http \d+/.test(message)?'provider-http-error':/vector|dimension|response/.test(message)?'invalid-provider-response':'provider-error';
  }
  const duration=Math.max(0,Date.now()-started);this.lastSemanticIndexMaintenance={lastRunAt:now,lastDurationMs:duration,lastIndexed:indexed,lastFailed:failed,lastStaleSkipped:staleSkipped,lastErrorCode:errorCode};
  const indexedItems=corpus.filter(currentVector).length;
  const retryRows=corpus.map(item=>this.semanticEmbeddingRetry.get(item.id)).filter((row):row is {contentHash:string;attempts:number;retryAt:number}=>Boolean(row&&row.retryAt>now));
  return {enabled:true,provider:providerDiag?.provider??'unknown',model:providerDiag?.model??'',considered:candidates.length,indexed,failed,staleSkipped,indexedItems,corpusItems:corpus.length,remaining:Math.max(0,corpus.length-indexedItems),waitingForRetry:retryRows.length,nextRetryAt:retryRows.length?Math.min(...retryRows.map(row=>row.retryAt)):null,lastRunAt:now,lastDurationMs:duration,lastErrorCode:errorCode,redactedInputs:Number(providerDiag?.redactedInputs??0)};
 }

 semanticEmbeddingMaintenanceDiagnostics():SemanticIndexMaintenanceResult{
  const providerDiag=this.embeddingProvider?.diagnostics();const now=Date.now();
  const corpus=this.state.items.filter(item=>!item.dormant&&item.epistemicStatus!=='quarantined'&&Number(item.validFromAt??item.createdAt)<=now&&(item.validUntilAt==null||now<Number(item.validUntilAt)));
  const indexed=corpus.filter(item=>{const row=this.semanticEmbeddingIndex.get(item.id);return Boolean(row&&row.providerId===this.embeddingProvider?.providerId&&row.contentHash===memoContentHash(item.content)&&row.vector.length>0);}).length;
  const pending=corpus.filter(item=>{const row=this.semanticEmbeddingIndex.get(item.id);return !row||row.providerId!==this.embeddingProvider?.providerId||row.contentHash!==memoContentHash(item.content)||!row.vector.length;});
  const retries=pending.map(item=>this.semanticEmbeddingRetry.get(item.id)).filter((row):row is {contentHash:string;attempts:number;retryAt:number}=>Boolean(row&&row.retryAt>now));
  return {enabled:Boolean(this.embeddingProvider),provider:providerDiag?.provider??'none',model:providerDiag?.model??'',considered:0,indexed:0,failed:this.lastSemanticIndexMaintenance.lastFailed,staleSkipped:this.lastSemanticIndexMaintenance.lastStaleSkipped,indexedItems:indexed,corpusItems:corpus.length,remaining:Math.max(0,corpus.length-indexed),waitingForRetry:retries.length,nextRetryAt:retries.length?Math.min(...retries.map(row=>row.retryAt)):null,lastRunAt:this.lastSemanticIndexMaintenance.lastRunAt,lastDurationMs:this.lastSemanticIndexMaintenance.lastDurationMs,lastErrorCode:this.lastSemanticIndexMaintenance.lastErrorCode,redactedInputs:Number(providerDiag?.redactedInputs??0)};
 }

 /**
  * Read-only semantic retrieval preview. It layers real local embeddings over the existing
  * canonical corpus; embeddings are a bounded derived cache, never another memory store.
  * Only a bounded number of missing rows are backfilled per call so a cold start remains
  * responsive; repeated calls progressively cover the corpus. Provider failure falls back
  * to the deterministic BM25/fuzzy/graph retrieval path.
  */
 async previewRetrieveWithEmbeddings(query:string,limit=8,goalRelevance=0,identityRelevance=0,temporalOptions:MemoryTemporalQueryOptions={},performanceOptions:SemanticRetrievalPerformanceOptions={}):Promise<SemanticMemoryPreview>{
   const safeLimit=Math.max(1,Math.min(32,Math.floor(Number.isFinite(limit)?limit:8)));
   const fallbackItems=this.previewRetrieve(query,safeLimit,goalRelevance,identityRelevance,temporalOptions);
   const provider=this.embeddingProvider;
   const providerDiag=provider?.diagnostics();
   if(!provider||!String(query??'').trim()){
     return {items:fallbackItems,semantic:{enabled:false,provider:providerDiag?.provider??'none',model:providerDiag?.model??'',indexedItems:0,corpusItems:this.state.items.length,coverage01:0,newlyIndexed:0,fallbackReason:!provider?'embedding-provider-disabled':'empty-query',cacheEntries:providerDiag?.cacheEntries??0,requests:providerDiag?.requests??0,failures:providerDiag?.failures??0,lastLatencyMs:providerDiag?.lastLatencyMs??0}};
   }
   const now=typeof temporalOptions.asOfAt==='number'&&Number.isFinite(temporalOptions.asOfAt)?temporalOptions.asOfAt:Date.now();
   const temporalMode=temporalOptions.temporalMode??'current';
   const eligible=(item:MemoryItem2)=>!item.dormant&&item.epistemicStatus!=='quarantined'&&(temporalMode==='all'||(Number(item.validFromAt??item.createdAt)<=now&&(item.validUntilAt==null||now<Number(item.validUntilAt))));
   const corpus=this.state.items.filter(eligible);
   const corpusById=new Map(corpus.map(item=>[item.id,item]));
   for(const [id,row] of this.semanticEmbeddingIndex){
     const current=corpusById.get(id);
     if(!current||row.providerId!==provider.providerId||row.contentHash!==memoContentHash(current.content)||!row.vector.length||row.vector.some(value=>!Number.isFinite(value)))this.semanticEmbeddingIndex.delete(id);
   }
   const lexicalPoolLimit=Math.max(8,Math.min(96,Math.floor(performanceOptions.maxLexicalPool??Math.max(24,Math.min(64,safeLimit*8)))));
   const lexicalPool=this.previewRetrieve(query,lexicalPoolLimit,goalRelevance,identityRelevance,temporalOptions).filter(eligible);
   const hasCurrentVector=(item:MemoryItem2)=>{const row=this.semanticEmbeddingIndex.get(item.id);return Boolean(row&&row.providerId===provider.providerId&&row.contentHash===memoContentHash(item.content)&&row.vector.length>0);};
   const missingSet=new Map<string,MemoryItem2>();
   // Prioritize lexical/fuzzy candidates but reserve part of a cold-start batch for
   // recent rows with different wording; otherwise the derived index can never discover
   // vocabulary-distant memories on a small per-turn budget.
   const backfillBudget=Math.max(1,Math.min(96,Math.floor(performanceOptions.maxIndexItems??96)));
   const lexicalBudget=Math.max(1,Math.min(backfillBudget,Math.ceil(backfillBudget*.7)));
   for(const item of lexicalPool){if(hasCurrentVector(item))continue;missingSet.set(item.id,item);if(missingSet.size>=lexicalBudget)break;}
   for(const item of [...corpus].sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)||a.id.localeCompare(b.id))){
     if(missingSet.size>=backfillBudget)break;
     if(hasCurrentVector(item)||missingSet.has(item.id))continue;
     missingSet.set(item.id,item);
   }
   const missing=[...missingSet.values()].slice(0,backfillBudget);
   // Capture the exact text identity sent to the provider. Memory may be revised
   // while embedBatch is pending; a late vector must never be labelled with a new
   // content hash or be inserted for an evicted/invalidated record.
   const requestedMissing=missing.map(item=>({item,content:item.content,contentHash:memoContentHash(item.content)}));
   let newlyIndexed=0;
   try{
     const vectors=await provider.embedBatch([query,...requestedMissing.map(row=>row.content)],performanceOptions.providerTimeoutMs?{timeoutMs:performanceOptions.providerTimeoutMs}:undefined);
     if(!Array.isArray(vectors)||vectors.length!==requestedMissing.length+1)throw new Error('embedding-vector-count-mismatch');
     const queryVector=normalizeValidatedEmbeddingVector(vectors[0]);
     if(!queryVector)throw new Error('invalid-query-embedding-vector');
     for(let index=0;index<requestedMissing.length;index++){
       const requested=requestedMissing[index],vector=normalizeValidatedEmbeddingVector(vectors[index+1],queryVector.length);
       // A malformed candidate must never enter the derived index. The valid lexical
       // retrieval path remains available for this row and future requests.
       if(!vector)continue;
       const current=this.state.items.find(row=>row.id===requested.item.id);
       if(!current||!eligible(current)||memoContentHash(current.content)!==requested.contentHash)continue;
       this.semanticEmbeddingIndex.set(current.id,{contentHash:requested.contentHash,providerId:provider.providerId,vector,lastUsedAt:now});newlyIndexed++;
     }
     // Keep one compact index for the canonical memory's maximum 1600 rows.
     while(this.semanticEmbeddingIndex.size>1600){
       let oldestId:string|undefined,oldestAt=Number.POSITIVE_INFINITY;
       for(const [id,row] of this.semanticEmbeddingIndex)if(row.lastUsedAt<oldestAt){oldestAt=row.lastUsedAt;oldestId=id;}
       if(!oldestId)break;this.semanticEmbeddingIndex.delete(oldestId);
     }
     const lexicalRank=new Map(lexicalPool.map((item,index)=>[item.id,index]));
     const queryTokens=this.tokensFor(query);
     const queryEntities=extractEntities(query);
     const semanticRows:Array<{item:MemoryItem2;score:number;similarity:number;lexicalRank:number}> = [];
     for(const item of corpus){
       const cached=this.semanticEmbeddingIndex.get(item.id);
       if(!cached||cached.providerId!==provider.providerId||cached.contentHash!==memoContentHash(item.content)||cached.vector.length!==queryVector.length)continue;
       let dot=0,normA=0,normB=0;for(let i=0;i<queryVector.length;i++){dot+=queryVector[i]*cached.vector[i];normA+=queryVector[i]*queryVector[i];normB+=cached.vector[i]*cached.vector[i];}
       const similarity=normA&&normB?Math.max(0,Math.min(1,dot/Math.sqrt(normA*normB))):0;
       const rank=lexicalRank.get(item.id);const lexicalScore=rank===undefined?0:1-rank/Math.max(1,lexicalPool.length);
       const itemTokens=this.tokensFor(item.content);let covered=0;for(const token of queryTokens)if(itemTokens.has(token))covered++;
       const coverage=queryTokens.size?covered/queryTokens.size:0;const entity=overlap(queryEntities,item.entities);
       const temporalHint=this.signalFusion.temporalHint(query,item.validFromAt??item.createdAt,now);
       const score=clamp(.68*similarity+.20*lexicalScore+.06*coverage+.03*entity+.02*temporalHint+.01*clamp(item.salience));
       cached.lastUsedAt=now;semanticRows.push({item,score,similarity,lexicalRank:rank??Number.MAX_SAFE_INTEGER});
     }
     semanticRows.sort((a,b)=>b.score-a.score||b.similarity-a.similarity||a.lexicalRank-b.lexicalRank||a.item.id.localeCompare(b.item.id));
     if(!semanticRows.length){
       const diag=provider.diagnostics();
       return {items:fallbackItems,semantic:{enabled:false,provider:diag.provider,model:diag.model,indexedItems:this.semanticEmbeddingIndex.size,corpusItems:corpus.length,coverage01:corpus.length?clamp(this.semanticEmbeddingIndex.size/corpus.length):0,newlyIndexed:0,fallbackReason:'no-valid-semantic-candidates',cacheEntries:diag.cacheEntries,requests:diag.requests,failures:diag.failures,lastLatencyMs:diag.lastLatencyMs}};
     }
     const items=semanticRows.slice(0,safeLimit).map(row=>structuredClone(row.item));
     const diag=provider.diagnostics();
     return {items,semantic:{enabled:true,provider:diag.provider,model:diag.model,indexedItems:this.semanticEmbeddingIndex.size,corpusItems:corpus.length,coverage01:corpus.length?clamp(this.semanticEmbeddingIndex.size/corpus.length):0,newlyIndexed,fallbackReason:null,cacheEntries:diag.cacheEntries,requests:diag.requests,failures:diag.failures,lastLatencyMs:diag.lastLatencyMs}};
   }catch(error){
     const diag=provider.diagnostics();
     return {items:fallbackItems,semantic:{enabled:false,provider:diag.provider,model:diag.model,indexedItems:this.semanticEmbeddingIndex.size,corpusItems:corpus.length,coverage01:corpus.length?clamp(this.semanticEmbeddingIndex.size/corpus.length):0,newlyIndexed:0,fallbackReason:String(error instanceof Error?error.message:error).slice(0,200),cacheEntries:diag.cacheEntries,requests:diag.requests,failures:diag.failures,lastLatencyMs:diag.lastLatencyMs}};
   }
 }
 restore(s:MemoryOSState2|undefined){
  const sourceItems=Array.isArray(s?.items)?s!.items:[];
  const boundedItems=sourceItems.slice(0,1600);
  const rawItems:any[]=[];
  for(const candidate of boundedItems){
   if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||typeof candidate.id!=='string'||!candidate.id.trim())continue;
   const id=candidate.id.trim();rawItems.push(id===candidate.id?candidate:{...candidate,id});
  }
  this.lastRestoreDiagnosticsData={sourceRows:sourceItems.length,acceptedRows:0,duplicateIdsResolved:0,invalidRowsDropped:boundedItems.length-rawItems.length,truncatedRows:sourceItems.length-boundedItems.length,identityConflictsQuarantined:0};
  const legacyEstimate=rawItems.reduce((n:any,m:any)=>n+estimateMemoryBytes({
    content:String(m?.content??''),tags:Array.isArray(m?.tags)?m.tags:[],context:m?.context,
    semanticLinks:Array.isArray(m?.semanticLinks)?m.semanticLinks:[],
    temporalLinks:Array.isArray(m?.temporalLinks)?m.temporalLinks:[],
    causalLinks:Array.isArray(m?.causalLinks)?m.causalLinks:[],
    contradictionLinks:Array.isArray(m?.contradictionLinks)?m.contradictionLinks:[],
  }),0);
  const savedEstimate=Math.max(0,Math.floor(Number((s as any)?.estimatedBytes??legacyEstimate)));
  this.state={
   ...defaultMemoryOS2(),...(s??{}),version:7,
   implicitConflictCandidates:Math.max(0,Math.floor(Number((s as any)?.implicitConflictCandidates??0))),
   implicitConflictsResolved:Math.max(0,Math.floor(Number((s as any)?.implicitConflictsResolved??0))),
   staleRetrievalsAvoided:Math.max(0,Math.floor(Number((s as any)?.staleRetrievalsAvoided??0))),
   lastConflictScanAt:Number((s as any)?.lastConflictScanAt??0),
   implicitConflictsDeferred:Math.max(0,Math.floor(Number((s as any)?.implicitConflictsDeferred??0))),
   provenanceProtected:Math.max(0,Math.floor(Number((s as any)?.provenanceProtected??0))),
   estimatedBytes:savedEstimate,
   byteBudget:Math.max(16384,Math.floor(Number((s as any)?.byteBudget??524288))),
   budgetEvictions:Math.max(0,Math.floor(Number((s as any)?.budgetEvictions??0))),
   budgetMisses:Math.max(0,Math.floor(Number((s as any)?.budgetMisses??0))),
   meanEvictionRegret01:clamp(Number((s as any)?.meanEvictionRegret01??0)),
   evictionWitnesses:Array.isArray((s as any)?.evictionWitnesses)?(s as any).evictionWitnesses.slice(-256):[],
   items:this.dedupeRestoredItems(rawItems.map((m:any)=>({
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
    revisionHistory:normalizeRevisionHistory(m?.revisionHistory),
    revisionGroupId:m?.revisionGroupId?String(m.revisionGroupId):String(m?.id??m?.contentHash??'revision'),
    revisionSequence:Math.max(1,Math.floor(Number(m?.revisionSequence??1))),
    provenanceClass:(['device','external','user','agent','derived','simulation','unknown'].includes(m?.provenanceClass)?m.provenanceClass:'unknown') as MemoryProvenanceClass,
    sourceAuthority01:clamp(Number(m?.sourceAuthority01??.5)),
    independenceKey:m?.independenceKey==null?undefined:String(m.independenceKey).slice(0,96),
    evidenceFreshnessAt:Number.isFinite(Number(m?.evidenceFreshnessAt))?Number(m.evidenceFreshnessAt):Number(m?.observedAt??m?.createdAt??Date.now()),
    evidenceSources:this.normalizeEvidenceSources(m),
    evidenceLineageKeys:[...new Set([...(Array.isArray(m?.evidenceLineageKeys)?m.evidenceLineageKeys.map((x:any)=>String(x).slice(0,160)).filter(Boolean):[]),...this.normalizeEvidenceSources(m).map(row=>this.evidenceKey(row))])].slice(-32),
    temperature01:clamp(Number(m?.temperature01??0)),
    residencyTier:(m?.residencyTier==='hot'||m?.residencyTier==='warm'||m?.residencyTier==='cold')?m.residencyTier:(Array.isArray(m?.semanticVector)&&m.semanticVector.length?'warm':'cold'),
  }))) };
  // Recompute serialized footprint because older snapshots did not count provenance trails.
  this.state.estimatedBytes=this.state.items.reduce((total,item)=>total+estimateMemoryBytes(item),0);
  this.adaptivePolicy.restore(this.state.adaptiveMemoryPolicy);
  this.exactIndex.clear();this.contentIndex.clear();this.itemIndex.clear();this.tokenCache.clear();this.lowerContentCache.clear();this.tokenIndex.clear();this.metadataTokenIndex.clear();this.characterGramIndex.clear();this.documentFrequency.clear();this.itemTokenLength.clear();this.revisionGroupIndex.clear();this.totalTokenLength=0;this.linkSupportCache=null;this.linkSupportCacheVersion=-1;this.lastCandidateCount=0;
  const indexAt=Date.now();
  for(const m of this.state.items){
    const exactKey=`${m.kind}|${m.source}|${canonicalizeMemoryContent(m.content)}`;
    const contentKey=`${m.kind}|${canonicalizeMemoryContent(m.content)}`;
    const previousExactId=this.exactIndex.get(exactKey),previousContentId=this.contentIndex.get(contentKey);
    const previousExact=previousExactId?this.itemIndex.get(previousExactId):undefined;
    const previousContent=previousContentId?this.itemIndex.get(previousContentId):undefined;
    this.itemIndex.set(m.id,m);
    // State snapshots are normally newest-first, but import/restore order is not
    // an authority. Rebuild de-dup indexes by validity/revision time, not row order.
    if(!previousExact||this.preferIndexRecord(m,previousExact,indexAt))this.exactIndex.set(exactKey,m.id);
    if(!previousContent||this.preferIndexRecord(m,previousContent,indexAt))this.contentIndex.set(contentKey,m.id);
    this.indexItem(m);
  }
 }
 private tokensFor(text:string){const key=String(text);const hit=this.tokenCache.get(key);if(hit)return hit;const value=new Set(tokenize(key));if(this.tokenCache.size>=512){const first=this.tokenCache.keys().next().value as string|undefined;if(first)this.tokenCache.delete(first);}this.tokenCache.set(key,value);return value;}
 /** Curated metadata is indexed independently: it must not affect content-only BM25 statistics. */
 private metadataTokens(item:MemoryItem2):Set<string>{
  const parts:string[]=[];
  for(const value of (Array.isArray(item.tags)?item.tags:[]).slice(0,24))if(typeof value==='string'&&value.trim())parts.push(value.trim().slice(0,160));
  for(const value of (Array.isArray(item.entities)?item.entities:[]).slice(0,24))if(typeof value==='string'&&value.trim())parts.push(value.trim().slice(0,160));
  const allowedContextKeys=/^(topic|category|subject|project|domain|title|label|goal|intent|location|relationship|type|environment|language|preference|person|organization)$/i;
  for(const [key,value] of Object.entries(item.context??{}).slice(0,32))if(allowedContextKeys.test(key)&&typeof value==='string'&&value.trim())parts.push(value.trim().slice(0,160));
  return this.tokensFor(parts.join(' '));
 }
 private lowerFor(id:string,text:string){const hit=this.lowerContentCache.get(id);if(hit!==undefined)return hit;const value=text.toLocaleLowerCase();if(this.lowerContentCache.size>=512){const first=this.lowerContentCache.keys().next().value as string|undefined;if(first)this.lowerContentCache.delete(first);}this.lowerContentCache.set(id,value);return value;}
 private provenanceStrength(m:MemoryItem2){const authority=clamp(Number(m.sourceAuthority01??.5));const reliability=clamp(Number(m.confidence??.5));const independence=m.independenceKey?1:0;const classBonus=m.provenanceClass==='device'?1:m.provenanceClass==='external'?.92:m.provenanceClass==='user'?.86:m.provenanceClass==='agent'?.68:m.provenanceClass==='derived'?.52:m.provenanceClass==='simulation'?.28:.5;const independentWitnesses=Math.max(0,this.independentEvidenceCount(m)-1);return clamp(authority*.50+reliability*.24+independence*.06+classBonus*.10+Math.min(.10,independentWitnesses*.025));}
 private provenanceClassFor(source:string,explicit?:MemoryProvenanceClass):MemoryProvenanceClass{if(explicit&&['device','external','user','agent','derived','simulation','unknown'].includes(explicit))return explicit;const s=String(source).toLowerCase();if(s.includes('device')||s.includes('android'))return 'device';if(s.includes('external')||s.includes('api')||s.includes('os'))return 'external';if(s.includes('user'))return 'user';if(s.includes('simulation')||s.includes('synthetic'))return 'simulation';if(s.includes('agent')||s.includes('model')||s.includes('llm'))return 'agent';if(s.includes('derived'))return 'derived';return 'unknown';}
 private sourceAuthorityDefault(provenanceClass:MemoryProvenanceClass){return ({device:.95,external:.9,user:.86,agent:.68,derived:.52,simulation:.28,unknown:.5} as Record<MemoryProvenanceClass,number>)[provenanceClass]??.5;}
 private evidenceKey(evidence:Pick<MemoryEvidenceSource,'source'|'provenanceClass'|'independenceKey'>){
  const independent=String(evidence.independenceKey??'').trim().normalize('NFKC').toLocaleLowerCase();
  if(independent)return `lineage:${independent}`;
  return `source:${String(evidence.provenanceClass)}:${String(evidence.source??'').trim().normalize('NFKC').toLocaleLowerCase()}`;
 }
 private normalizeEvidenceSources(item:any):MemoryEvidenceSource[]{
  const source=String(item?.source??'unknown').slice(0,240)||'unknown';
  const provenanceClass=this.provenanceClassFor(source,item?.provenanceClass);
  const observedAt=Number.isFinite(Number(item?.observedAt))?Number(item.observedAt):Number(item?.createdAt??Date.now());
  const evidenceFreshnessAt=Number.isFinite(Number(item?.evidenceFreshnessAt))?Number(item.evidenceFreshnessAt):observedAt;
  const primary:MemoryEvidenceSource={source,provenanceClass,sourceAuthority01:clamp(Number(item?.sourceAuthority01??this.sourceAuthorityDefault(provenanceClass))),independenceKey:item?.independenceKey==null?undefined:String(item.independenceKey).trim().slice(0,96)||undefined,observedAt,evidenceFreshnessAt};
  const raw=Array.isArray(item?.evidenceSources)?item.evidenceSources.slice(0,32):[];
  const normalizedRaw:MemoryEvidenceSource[]=raw.map((row:any)=>{
   const cls=this.provenanceClassFor(String(row?.source??source),row?.provenanceClass);
   const obs=Number.isFinite(Number(row?.observedAt))?Number(row.observedAt):observedAt;
   return {source:String(row?.source??source).slice(0,240)||source,provenanceClass:cls,sourceAuthority01:clamp(Number(row?.sourceAuthority01??this.sourceAuthorityDefault(cls))),independenceKey:row?.independenceKey==null?undefined:String(row.independenceKey).trim().slice(0,96)||undefined,observedAt:obs,evidenceFreshnessAt:Number.isFinite(Number(row?.evidenceFreshnessAt))?Number(row.evidenceFreshnessAt):obs};
  });
  // When the serialized trail already contains the primary lineage, prefer its
  // publisher-bound source label to the generic owning subsystem label.
  const hasPrimary=normalizedRaw.some(row=>this.evidenceKey(row)===this.evidenceKey(primary));
  const rows:MemoryEvidenceSource[]=[...normalizedRaw,...(hasPrimary?[]:[primary])];
  const dedup=new Map<string,MemoryEvidenceSource>();
  for(const row of rows){const key=this.evidenceKey(row);const previous=dedup.get(key);if(!previous){dedup.set(key,row);continue;}
   const useNew=row.evidenceFreshnessAt>previous.evidenceFreshnessAt || (row.evidenceFreshnessAt===previous.evidenceFreshnessAt&&row.sourceAuthority01>previous.sourceAuthority01);
   const chosen=useNew?row:previous;
   dedup.set(key,{...chosen,sourceAuthority01:Math.max(previous.sourceAuthority01,row.sourceAuthority01),observedAt:Math.max(previous.observedAt,row.observedAt),evidenceFreshnessAt:Math.max(previous.evidenceFreshnessAt,row.evidenceFreshnessAt)});
  }
  // Keep the highest-quality/freshest independent lineages within the same
  // byte-bounded canonical record. Replays of one lineage never multiply votes.
  return [...dedup.values()].sort((a,b)=>{
   const score=(x:MemoryEvidenceSource)=>x.sourceAuthority01*.65+clamp(1-Math.max(0,Date.now()-x.evidenceFreshnessAt)/(180*86400000))*.35;
   return score(b)-score(a)||b.observedAt-a.observedAt||this.evidenceKey(a).localeCompare(this.evidenceKey(b));
  }).slice(0,8);
 }
 private mergeIncomingEvidence(item:MemoryItem2,input:MemoryEncodeInput,now:number):{addedIndependentSource:boolean;independentSources:number}{
  const previous=this.normalizeEvidenceSources(item);
  const incoming=this.normalizeEvidenceSources({...input,observedAt:input.observedAt??now,evidenceFreshnessAt:input.evidenceFreshnessAt??input.observedAt??now});
  const previousSeenKeys=new Set([...(Array.isArray(item.evidenceLineageKeys)?item.evidenceLineageKeys:[]),...previous.map(e=>this.evidenceKey(e))]);
  const combined=this.normalizeEvidenceSources({...item,evidenceSources:[...previous,...incoming]});
  item.evidenceSources=combined;
  const incomingKeys=incoming.map(e=>this.evidenceKey(e));
  item.evidenceLineageKeys=[...new Set([...(item.evidenceLineageKeys??[]),...previous.map(e=>this.evidenceKey(e)),...incomingKeys])].slice(-32);
  const newKeys=incomingKeys.filter(key=>!previousSeenKeys.has(key));
  const retainedKeys=new Set(combined.map(e=>this.evidenceKey(e)));
  const addedIndependentSource=newKeys.some(key=>retainedKeys.has(key));
  return {addedIndependentSource,independentSources:combined.length};
 }
 private independentEvidenceCount(item:MemoryItem2){return this.normalizeEvidenceSources(item).length;}
 private implicitConflictSignals(newer:MemoryItem2, older:MemoryItem2){
  if(newer.id===older.id)return {score:0,contextConflict:false,polarityConflict:false,entityOverlap:0,semantic:0};
  const semantic=cosine(newer.semanticVector.length?newer.semanticVector:vectorize(newer.content),older.semanticVector.length?older.semanticVector:vectorize(older.content));
  const entityOverlap=overlap(newer.entities,older.entities); const newCtx=newer.context??{}; const oldCtx=older.context??{};
  let contextConflict=false; for(const key of Object.keys(newCtx)){if(!(key in oldCtx))continue;const nv=String(newCtx[key]??'').trim().toLocaleLowerCase();const ov=String(oldCtx[key]??'').trim().toLocaleLowerCase();if(nv&&ov&&nv!==ov){contextConflict=true;break;}}
  const polarityConflict=sharedEntityCount(newer.entities,older.entities)>=2&&hasNegationPolarityDifference(newer.content,older.content);
  const identifierShift=identifierLike(newer.content)!==identifierLike(older.content)&&entityOverlap>=.18;
  const score=Math.max(contextConflict&&semantic>=.55?.90:0,polarityConflict&&semantic>=.64?.82:0,identifierShift&&semantic>=.70?.76:0);
  return {score,contextConflict,polarityConflict,entityOverlap,semantic};
 }
 adjudicateImplicitConflicts(input:{limit?:number;pairBudget?:number;at?:number}={}):{candidates:number;resolved:number;at:number}{
  const at=Number(input.at??Date.now()); const newerRows=this.state.items.slice().filter(m=>m.validUntilAt==null&&m.epistemicStatus!=='quarantined').sort((a,b)=>Number(b.observedAt??b.createdAt)-Number(a.observedAt??a.createdAt)).slice(0,Math.max(8,Math.min(64,Math.floor(input.limit??32))));
  let candidates=0,resolved=0,pairs=0; const pairBudget=Math.max(16,Math.min(512,Math.floor(input.pairBudget??192)));
  for(let ni=0;ni<newerRows.length&&pairs<pairBudget;ni++){const newer=newerRows[ni]!;const newerAt=Number(newer.observedAt??newer.createdAt);
   for(let oi=ni+1;oi<this.state.items.length&&pairs<pairBudget;oi++){const older=this.state.items[oi]!;if(older.id===newer.id||older.validUntilAt!=null||older.epistemicStatus==='quarantined')continue;const olderAt=Number(older.observedAt??older.createdAt);if(!(olderAt<newerAt))continue;if(newer.revisionGroupId&&older.revisionGroupId&&newer.revisionGroupId===older.revisionGroupId)continue;pairs++;const signal=this.implicitConflictSignals(newer,older);if(signal.score<.75)continue;candidates++;
    const newerProv=this.provenanceStrength(newer),olderProv=this.provenanceStrength(older);
    if(olderProv-newerProv>.18){
      newer.epistemicStatus='quarantined'; this.recordRevision(newer,{at:newerAt,from:'fact',to:'quarantined',reason:'implicit-conflict-provenance-protection'});
      this.state.implicitConflictsDeferred++; this.state.provenanceProtected++; this.state.quarantined++; continue;
    }
    const group=older.revisionGroupId??older.id; const previousNewGroup=this.revisionGroupIndex.get(newer.revisionGroupId??newer.id); if(previousNewGroup)previousNewGroup.delete(newer.id); newer.revisionGroupId=group; newer.revisionSequence=Math.max(Number(older.revisionSequence??1)+1,Number(newer.revisionSequence??1)); let groupSet=this.revisionGroupIndex.get(group); if(!groupSet){groupSet=new Set<string>();this.revisionGroupIndex.set(group,groupSet);} groupSet.add(older.id);groupSet.add(newer.id);
    older.validUntilAt=newerAt;older.supersededById=newer.id;this.recordRevision(older,{at:newerAt,from:older.epistemicStatus,to:older.epistemicStatus,reason:signal.contextConflict?'implicit-state-conflict-context':'implicit-state-conflict'});newer.supersedesId=older.id;older.contradictionLinks=[...new Set([...(older.contradictionLinks??[]),newer.id])].slice(0,6);newer.contradictionLinks=[...new Set([...(newer.contradictionLinks??[]),older.id])].slice(0,6);this.state.implicitConflictsResolved++;this.state.reconsolidations++;resolved++;
   }
  }
  this.state.implicitConflictCandidates+=candidates;this.state.lastConflictScanAt=at;return {candidates,resolved,at};
 }

 private buildMemoryItem(input:MemoryEncodeInput,identity:{stableId:string;contentHash:string},entities:string[],semanticVector:number[],now:number):MemoryItem2{
  const provenanceClass=this.provenanceClassFor(input.source,input.provenanceClass);
  const defaults={device:.95,external:.9,user:.86,agent:.68,derived:.52,simulation:.28,unknown:.5} as Record<MemoryProvenanceClass,number>;
  const evidenceSources=this.normalizeEvidenceSources({...input,sourceAuthority01:input.sourceAuthority01??defaults[provenanceClass],provenanceClass,observedAt:input.observedAt??now,evidenceFreshnessAt:input.evidenceFreshnessAt??input.observedAt??now});
  const evidenceLineageKeys=[...new Set([...(Array.isArray(input.evidenceLineageKeys)?input.evidenceLineageKeys:[]),...evidenceSources.map(row=>this.evidenceKey(row))])].slice(-32);
  return {
    ...input,
    id:input.id??identity.stableId,
    contentHash:input.contentHash??identity.contentHash,
    entities,
    createdAt:now,lastAccessAt:now,retrievalCount:0,revisionHistory:[],dormant:false,
    semanticVector,temperature01:0,residencyTier:'hot',
    validFromAt:Number.isFinite(Number(input.validFromAt))?Number(input.validFromAt):now,
    validUntilAt:input.validUntilAt==null?null:(Number.isFinite(Number(input.validUntilAt))?Number(input.validUntilAt):null),
    observedAt:Number.isFinite(Number(input.observedAt))?Number(input.observedAt):now,
    supersedesId:input.supersedesId??null,supersededById:input.supersededById??null,
    revisionGroupId:String(input.revisionGroupId??(input.id??identity.stableId)),
    revisionSequence:Math.max(1,Math.floor(Number(input.revisionSequence??1))),
    provenanceClass,
    sourceAuthority01:clamp(Number(input.sourceAuthority01??defaults[provenanceClass]??.5)),
    independenceKey:input.independenceKey?.slice(0,96),
    evidenceFreshnessAt:Number.isFinite(Number(input.evidenceFreshnessAt))?Number(input.evidenceFreshnessAt):Number(input.observedAt??now),
    evidenceSources, evidenceLineageKeys,
  };
 }

 encode(input:MemoryEncodeInput, options:{clone?:boolean;forceDistinct?:boolean}={}){
   const now=Date.now();
   const canonicalContent=canonicalizeMemoryContent(input.content);
   const identity=deriveMemoryIdentity(canonicalContent,input.kind,input.source);
   if(options.forceDistinct&&input.id){
     const forced=this.itemIndex.get(input.id);
     if(forced&&canonicalizeMemoryContent(forced.content)===canonicalContent)return options.clone===false?forced:structuredClone(forced);
   }
   const exactId=options.forceDistinct?undefined:this.exactIndex.get(`${input.kind}|${input.source}|${canonicalContent}`);
   const contentId=options.forceDistinct?undefined:this.contentIndex.get(`${input.kind}|${canonicalContent}`);
   const indexedCandidates=[...new Set([exactId,contentId].filter((id):id is string=>Boolean(id)))].map(id=>this.itemIndex.get(id)).filter((m):m is MemoryItem2=>Boolean(m));
   const existing=indexedCandidates.filter(m=>this.validAt(m,now)&&m.epistemicStatus!=='quarantined'&&!m.dormant).sort((a,b)=>this.preferIndexRecord(a,b,now)?-1:this.preferIndexRecord(b,a,now)?1:0)[0];
   if(existing){
    const priorBytes=estimateMemoryBytes(existing);
    const evidenceMerge=this.mergeIncomingEvidence(existing,input,now);
    existing.lastAccessAt=now;
    existing.salience=clamp(existing.salience*.8+input.salience*.2);
    // A repeated import from the same source/lineage is not independent evidence
    // and must not drive confidence towards 1 by replaying the same observation.
    if(evidenceMerge.addedIndependentSource)existing.confidence=clamp(existing.confidence*.82+input.confidence*.18);
    existing.predictionError=clamp(existing.predictionError*.75+input.predictionError*.25);
    existing.temperature01=memoryTemperature(existing);
    existing.temperature01=clamp(existing.temperature01*.82+memoryTemperature({...existing,...input,lastAccessAt:now} as MemoryItem2,now)*.18);
    existing.residencyTier='hot';
    existing.source=existing.source||input.source;
    existing.contentHash=existing.contentHash||memoContentHash(existing.content);
    existing.tags=mergeMemoTags(existing.tags,input.tags);
    existing.context=mergeMemoContext(existing.context,input.context);
    this.state.estimatedBytes=Math.max(0,this.state.estimatedBytes-priorBytes+estimateMemoryBytes(existing));
    this.state.reconsolidations++;
    this.exactIndex.set(`${existing.kind}|${existing.source}|${canonicalizeMemoryContent(existing.content)}`,existing.id);
    this.contentIndex.set(`${existing.kind}|${canonicalizeMemoryContent(existing.content)}`,existing.id);
    return options.clone===false?existing:structuredClone(existing);
   }
   const semanticVector=vectorize(input.content); const entities=[...new Set([...(input.entities??[]),...extractEntities(input.content)])];
   // If canonical content already exists only as an expired/quarantined record,
   // a fresh observation gets its own stable-in-process identity rather than
   // mutating history or overwriting the historical item's map entry.
   const collision=this.itemIndex.has(input.id??identity.stableId);
   const materializedInput:MemoryEncodeInput=options.forceDistinct||input.id||!collision?input:{...input,id:stableMemoryId(`${canonicalContent}\0reobserved:${now}:${this.state.items.length}:${this.state.reconsolidations}`,input.kind,input.source)};
   const item=this.buildMemoryItem(materializedInput,identity,entities,semanticVector,now);
   if(collision&&!input.id&&!options.forceDistinct&&!materializedInput.revisionGroupId)item.revisionGroupId=item.id;
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
   this.state.items.unshift(item as MemoryItem2);this.state.estimatedBytes+=estimateMemoryBytes(item as MemoryItem2);this.itemIndex.set(item.id,item as MemoryItem2);this.linkSupportCache=null;if(this.state.items.length>1600){const removed=this.state.items.pop();if(removed){this.removeIndexedId(removed.id);this.itemIndex.delete(removed.id);this.rebuildDedupIndexesFor(removed);}}this.exactIndex.set(`${item.kind}|${item.source}|${canonicalizeMemoryContent(item.content)}`,item.id);
   this.contentIndex.set(`${item.kind}|${canonicalizeMemoryContent(item.content)}`,item.id);this.indexItem(item);this.lowerContentCache.delete(item.id);
   for(const linkedId of item.contradictionLinks??[]){const linked=this.itemIndex.get(linkedId);if(linked){linked.contradictionLinks=[...new Set([...(linked.contradictionLinks??[]),item.id])].slice(0,6);this.state.linkUpdates++;}}
   this.state.linkUpdates+=item.semanticLinks.length+item.temporalLinks.length;
   if(item.epistemicStatus==='quarantined')this.state.quarantined++;return options.clone===false?(item as MemoryItem2):structuredClone(item as MemoryItem2);
 }
 retrieve(query:string,limit=8,goalRelevance=0,identityRelevance=0,temporalOptions:MemoryTemporalQueryOptions={},clone=true){
   const qTokens=this.tokensFor(query);
   const conceptQuery=expandMemoryQueryConcepts(qTokens);
   const queryEntities=extractEntities(query);
   this.state.semanticQueries++;
   const wallClockNow=Date.now();
   const requestedAsOf=typeof temporalOptions.asOfAt==='number'&&Number.isFinite(temporalOptions.asOfAt)?temporalOptions.asOfAt:undefined;
   const temporalMode:MemoryTemporalMode=temporalOptions.temporalMode??'current';
   // A point-in-time hint must not rewind ordinary/current retrieval. Only the
   // explicit `at` mode opts into historical time; `all` remains an archive view.
   const now=temporalMode==='at'&&requestedAsOf!==undefined?requestedAsOf:wallClockNow;
   const isValidAt=(m:MemoryItem2,at:number)=>{const from=Number(m.validFromAt??m.createdAt),until=m.validUntilAt==null?Number.POSITIVE_INFINITY:Number(m.validUntilAt);return from<=at&&at<until;};
   const queryLower=query.toLocaleLowerCase();
   const queryIntentMode=detectMemoryQueryIntent(query);
   // Context belongs to the current query, not a lifetime counter. Using
   // linkUpdates/semanticQueries here made unrelated questions drift into causal
   // or temporal policy buckets after enough ordinary retrievals.
   const contextCausal=(queryIntentMode==='causal'||/\b(why|cause|causal|because|reason|effect|consequence)\b/iu.test(query)||/(причин|почему|следств)/iu.test(query))?1:0;
   const contextTemporal=(temporalMode!=='current'||queryIntentMode==='episodic'||/\b(today|now|yesterday|recent|recently|last|earlier|week|month|year)\b/iu.test(query)||/(сегодня|сейчас|вчера|недав|послед|раньше|недел|месяц|год)/iu.test(query))?1:0;
   this.activePolicy=this.adaptivePolicy.choose({pressure01:clamp(this.state.items.length/1600),goal01:clamp(goalRelevance),causal01:contextCausal,temporal01:contextTemporal,mobile:true},now);
   if(this.linkSupportCacheVersion!==this.state.linkUpdates||!this.linkSupportCache){
     const support=new Map<string,number>();
     for(const source of this.state.items){
       for(const linkedId of source.semanticLinks.slice(0,8)) support.set(linkedId,(support.get(linkedId)||0)+source.salience/6);
       for(const linkedId of source.causalLinks.slice(0,8)) support.set(linkedId,(support.get(linkedId)||0)+source.predictionError/5);
     }
     this.linkSupportCache=support;this.linkSupportCacheVersion=this.state.linkUpdates;
   }
   const linkSupport=this.linkSupportCache;
   const rows:Array<{m:MemoryItem2;score:number;bm25:number;entity:number;lexical:number}> = [];
   // Candidate truncation must not depend on the insertion order of the snapshot.
   // Accumulate inverse-document-frequency support across all unique query terms, then
   // select a bounded deterministic top set. The old first-192 walk could omit relevant
   // memories solely because their row happened to be later in an imported snapshot.
   const candidatePriority=new Map<string,{idfSupport:number;matchedTerms:number;fuzzySupport:number;fuzzyMatches:number;metadataSupport:number;metadataMatches:number}>();
   const priorityFor=(id:string)=>{const prior=candidatePriority.get(id)??{idfSupport:0,matchedTerms:0,fuzzySupport:0,fuzzyMatches:0,metadataSupport:0,metadataMatches:0};candidatePriority.set(id,prior);return prior;};
   const corpusSize=Math.max(1,this.state.items.length);
   const idfFor=(token:string)=>{const df=this.documentFrequency.get(token)??0;return Math.log(1+(corpusSize-df+.5)/(df+.5));};
   for(const token of qTokens){
     const ids=this.tokenIndex.get(token);
     const idf=idfFor(token);
     if(ids)for(const id of ids){const priority=priorityFor(id);priority.idfSupport+=idf;priority.matchedTerms++;}
     if(this.metadataRecallEnabled){
       const metadataIds=this.metadataTokenIndex.get(token);
       if(metadataIds){const support=idf*.42;for(const id of metadataIds){const priority=priorityFor(id);priority.metadataSupport+=support;priority.metadataMatches++;}}
     }
     // Fuzzy discovery only runs for meaningful token lengths. Candidate terms
     // come from shared character n-grams, not a full corpus scan. This lets
     // spelling variants and inflected forms enter the bounded retrieval pool.
     if([...token].length<4)continue;
     const grams=charTrigrams(token);const voteCounts=new Map<string,number>();
     for(const gram of grams)for(const candidateToken of this.characterGramIndex.get(gram)??[]){
       if(candidateToken===token||Math.abs([...candidateToken].length-[...token].length)>Math.max(2,Math.floor([...token].length*.4)))continue;
       voteCounts.set(candidateToken,(voteCounts.get(candidateToken)??0)+1);
     }
     const fuzzyTerms=[...voteCounts.entries()].map(([candidateToken,votes])=>({token:candidateToken,similarity:charDiceSimilarity(token,candidateToken),votes}))
       .filter(row=>row.similarity>=.38)
       .sort((a,b)=>b.similarity-a.similarity||b.votes-a.votes||(this.documentFrequency.get(a.token)??0)-(this.documentFrequency.get(b.token)??0)||a.token.localeCompare(b.token))
       .slice(0,8);
     for(const fuzzyTerm of fuzzyTerms){
       const fuzzyIds=this.tokenIndex.get(fuzzyTerm.token);if(!fuzzyIds)continue;
       const support=fuzzyTerm.similarity*idfFor(fuzzyTerm.token)*.72;
       for(const id of fuzzyIds){const priority=priorityFor(id);priority.fuzzySupport+=support;priority.fuzzyMatches++;}
     }
   }
   const queryPhrase=queryLower.trim();
   // Bilingual concept aliases can discover a memory whose wording differs from the
   // query (e.g. "why did it fail" → a note phrased as a "failure cause"). These hits
   // receive only 34% lexical support and remain subordinate to direct token/fuzzy hits.
   for(const [token,weight] of conceptQuery.weights){
     if(weight>=1)continue;
     const ids=this.tokenIndex.get(token);if(!ids)continue;
     const support=idfFor(token)*weight;
     for(const id of ids){const priority=priorityFor(id);priority.idfSupport+=support;priority.matchedTerms+=weight*.25;}
   }
   const rankedSeedIds=[...candidatePriority.entries()].map(([id,priority])=>{
     const item=this.itemIndex.get(id);
     if(!item)return {id,score:priority.idfSupport+priority.fuzzySupport,matchedTerms:priority.matchedTerms,fuzzyMatches:priority.fuzzyMatches,exactPhrase:0,validAt:0,lastAccessAt:0,salience:0,createdAt:0,revisionSequence:0};
     const exactPhrase=queryPhrase.length>=4&&this.lowerFor(id,item.content).includes(queryPhrase)?1:0;
     const validAt=temporalMode==='all'||isValidAt(item,now)?1:0;
     // A tiny lexical coverage/phrase term breaks high-fanout ties without letting
     // recency overpower a genuinely rarer query match.
     const score=priority.idfSupport+priority.fuzzySupport*.70+priority.metadataSupport*.72+exactPhrase*.65+Math.min(priority.matchedTerms,8)*.035;
     return {id,score,matchedTerms:priority.matchedTerms,fuzzyMatches:priority.fuzzyMatches,exactPhrase,validAt,lastAccessAt:Number(item.lastAccessAt??0),salience:clamp(Number(item.salience??0)),createdAt:Number(item.observedAt??item.createdAt??0),revisionSequence:Number(item.revisionSequence??1)};
   }).sort((a,b)=>b.score-a.score||b.matchedTerms-a.matchedTerms||b.fuzzyMatches-a.fuzzyMatches||b.exactPhrase-a.exactPhrase||b.validAt-a.validAt||b.revisionSequence-a.revisionSequence||b.lastAccessAt-a.lastAccessAt||b.salience-a.salience||b.createdAt-a.createdAt||a.id.localeCompare(b.id)).slice(0,192).map(row=>row.id);
   const candidateIds=new Set<string>(rankedSeedIds);
   if(candidateIds.size<96){
     // Preserve the prior recent-memory fallback intent, but use explicit fields and ID
     // as stable tie-breaks instead of relying on serialized array order.
     const fallback=[...this.state.items].sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)||a.id.localeCompare(b.id));
     for(const m of fallback.slice(0,128)){candidateIds.add(m.id);if(candidateIds.size>=192)break;}
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
     const orderedRevisionIds=[...(revisionIds??[])].sort((a,b)=>{
       const left=this.itemIndex.get(a),right=this.itemIndex.get(b);
       return Number(right?.revisionSequence??1)-Number(left?.revisionSequence??1)||Number(right?.createdAt??0)-Number(left?.createdAt??0)||a.localeCompare(b);
     });
     for(const revisionId of orderedRevisionIds){
       // Check before insertion: checking after .add() allowed a 192-item seed
       // pool to grow to 193 before the loop broke.
       if(candidateIds.size>=192)break;
       candidateIds.add(revisionId);
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
       // The graph expansion shares the same strict bound as lexical/revision
       // discovery; never insert the over-budget item before testing the cap.
       if(candidateIds.size>=192)break;
       candidateIds.add(linkedId);
     }
     if(candidateIds.size>=192)break;
   }
   if(candidateIds.size>192)throw new Error(`memory retrieval candidate budget exceeded: ${candidateIds.size}/192`);
   this.lastCandidateCount=candidateIds.size;
   const identifierBias=identifierLike(query);
   const rawRows:Array<{m:MemoryItem2;bm25:number;entity:number;lexical:number;coverage:number;fuzzy:number;metadata:number;conceptCoverage:number;temporal:number;causal:number;identity:number;goal:number;recency:number}> = [];
   for(const id of candidateIds){
     const m=this.itemIndex.get(id);
     if(!m||m.dormant||m.epistemicStatus==='quarantined')continue;
     // `all` is the archival view: expired revisions must remain inspectable.
     // Current/point-in-time recall still excludes them and tracks stale suppression.
     if(temporalMode!=='all'&&((m.validUntilAt!=null&&Number(m.validUntilAt)<=now)||(m.supersededById!=null&&m.validUntilAt==null))){this.state.staleRetrievalsAvoided++;continue;}
     const temporalValid=temporalMode==='all'?true:isValidAt(m,now);
     if(!temporalValid)continue;
     m.temperature01=memoryTemperature(m,now);
     const lexicalTokens=this.tokensFor(m.content);
     const metadataTokens=this.metadataRecallEnabled?this.metadataTokens(m):new Set<string>();
     const exact=this.lowerFor(m.id,m.content).includes(queryLower)?1:0;
     const queryTokenArray=[...qTokens];
     const metadata=this.metadataRecallEnabled&&queryTokenArray.length?queryTokenArray.filter(token=>metadataTokens.has(token)).length/queryTokenArray.length:0;
     const coverage=queryTokenArray.length?queryTokenArray.filter(token=>lexicalTokens.has(token)).length/queryTokenArray.length:0;
     const fuzzy=fuzzyTokenCoverage(queryTokenArray,lexicalTokens);
     const bm25=bm25Score(queryTokenArray,m.content,this.state.items.length,this.documentFrequency,this.itemTokenLength,this.totalTokenLength,m.id);
     const lexical=clamp(.24*coverage+.14*exact+.42*normalizeBm25(bm25)+.20*fuzzy);
     const entity=overlap(queryEntities,m.entities);
     const conceptCoverage=conceptGroupCoverage(conceptQuery.groups,lexicalTokens);
     const recency=clamp(1-(now-m.lastAccessAt)/(1000*60*60*24*21));
     const causal=clamp(linkSupport?.get(m.id)||0);
     const temporalBase=this.signalFusion.temporalHint(query,m.validFromAt??m.createdAt,now); const validity=temporalMode==='all'?1:(isValidAt(m,now)?1:0); const temporal=clamp(.72*validity+.28*temporalBase);
     const identity=clamp(m.identityRelevance*clamp(identityRelevance));
     const goal=clamp(m.goalRelevance*clamp(goalRelevance));
     rawRows.push({m,bm25,entity,lexical,coverage,fuzzy,metadata,conceptCoverage,temporal,causal,identity,goal,recency});
   }
   const rrfK=60;
   const rankBy=(score:(row:typeof rawRows[number])=>number)=>new Map(rawRows.filter(row=>score(row)>0).sort((a,b)=>score(b)-score(a)||a.m.id.localeCompare(b.m.id)).map((row,index)=>[row.m.id,index+1]));
   const bm25Rank=rankBy(row=>row.bm25);
   const coverageRank=rankBy(row=>row.coverage+(row.lexical>=.95?.25:0));
   const fuzzyRank=rankBy(row=>row.fuzzy);
   const entityRank=rankBy(row=>row.entity);
   const relationshipRank=rankBy(row=>row.causal*.65+(contextTemporal>.55?row.temporal*.25:0)+row.m.semanticLinks.length*.015+row.m.causalLinks.length*.025);
   // Reciprocal-rank fusion combines partially independent retrieval signals.
   // The hashed token vector is intentionally not a ranking channel: it is not
   // a semantic embedding and was largely duplicating the lexical projection.
   const metadataRank=rankBy(row=>row.metadata);
   const rrfWeights={bm25:1,coverage:.90,fuzzy:.60,metadata:(this.metadataRecallEnabled ? .28 : 0),entity:.42,relationship:.32};
   const maxRrf=Object.values(rrfWeights).reduce((sum,weight)=>sum+weight/(rrfK+1),0);
   const maxBm25=Math.max(0,...rawRows.map(x=>x.bm25));
   const fuzzyCandidateIds=new Set<string>([...candidatePriority.entries()].filter(([,priority])=>priority.fuzzyMatches>0).map(([id])=>id));
   const rawRowsById=new Map(rawRows.map(row=>[row.m.id,row]));
   const topRows=rawRows.map(row=>{
     const rrfNorm=clamp((rrfWeights.bm25/(rrfK+(bm25Rank.get(row.m.id)??rawRows.length+1))+rrfWeights.coverage/(rrfK+(coverageRank.get(row.m.id)??rawRows.length+1))+rrfWeights.fuzzy/(rrfK+(fuzzyRank.get(row.m.id)??rawRows.length+1))+rrfWeights.metadata/(rrfK+(metadataRank.get(row.m.id)??rawRows.length+1))+rrfWeights.entity/(rrfK+(entityRank.get(row.m.id)??rawRows.length+1))+rrfWeights.relationship/(rrfK+(relationshipRank.get(row.m.id)??rawRows.length+1)))/maxRrf);
     const bm25Norm=maxBm25>0?normalizeBm25(row.bm25,maxBm25):0;
     const lexical=this.metadataRecallEnabled?clamp(.18*row.lexical+.40*bm25Norm+.21*row.coverage+.16*row.fuzzy+.08*rrfNorm+.07*row.metadata):clamp(.18*row.lexical+.43*bm25Norm+.22*row.coverage+.17*row.fuzzy+.10*rrfNorm);
     const fused=this.signalFusion.score({semantic01:0,lexical01:identifierBias?clamp(lexical+.10*row.lexical):lexical,entity01:row.entity,temporal01:row.temporal,causal01:row.causal,recency01:row.recency,salience01:row.m.salience,identity01:row.identity,goal01:row.goal,predictionError01:row.m.predictionError,temperature01:row.m.temperature01});
     const policyBias=this.activePolicy==='semantic'?(row.fuzzy*.04+row.coverage*.04):this.activePolicy==='causal'?row.causal*.10:this.activePolicy==='temporal'?row.temporal*.10:this.activePolicy==='hybrid'?(rrfNorm+row.entity)*.06:(row.identity+row.goal)*.04;
     // Intent adds a bounded preference for the memory system that answers the
     // question being asked (event, procedure, self, goal, cause, or fact). It is
     // intentionally modest and cannot rescue an unrelated lexical candidate.
     const intentFit=memoryIntentFit(queryIntentMode,row.m);
     const intentBoost01=intentFit*.12;
     // One active concept group is a modest lexical bridge, not a substitute for
     // direct evidence. The bounded 0.10 boost helps paraphrases enter the top-k while
     // direct BM25/coverage/phrase scores still dominate exact matches.
     const conceptBoost01=row.conceptCoverage*.10;
     fused.score01=clamp(fused.score01+policyBias+intentBoost01+conceptBoost01);
     return {m:row.m,score:fused.score01,bm25:row.bm25,entity:row.entity,lexical,intentBoost01,conceptBoost01};
   }).sort((a,b)=>b.score-a.score||a.m.id.localeCompare(b.m.id)).slice(0,Math.max(1,limit));
   // Answerability gate: a high recency/salience/identity score is not proof that a
   // memory answers the current question. Require item-level lexical, entity, fuzzy,
   // concept or exact-phrase evidence, except for explicit typed recall requests whose
   // purpose is to ask for a category of memory (profile, episode, goal or procedure).
   // In particular, never let the bounded recent-memory fallback turn a no-match query
   // into a confident-looking autobiographical answer.
   const minQueryCoverage=qTokens.size>=5?.30:qTokens.size>=3?.34:qTokens.size===2?.50:1;
   const identifierPattern=/(?:\b[A-Z]{2,}[-_/]?[0-9]{2,}\b|\b[0-9]{3,}\b|\b[A-F0-9]{8,}\b)/giu;
   const normalizeIdentifier=(value:string)=>value.toLocaleUpperCase().replace(/[^A-Z0-9]/g,'');
   const queryIdentifiers=[...(String(query).matchAll(identifierPattern))].map(match=>normalizeIdentifier(match[0]));
   const groundedRows=topRows.filter(({m})=>{
     // Exact identifiers are direct evidence even when the prose query includes several
     // generic words; this is important for temporal, replay and incident lookups.
     const memoryIdentifiers=[...(String(m.content).matchAll(identifierPattern))].map(match=>normalizeIdentifier(match[0]));
     const identifierEvidence=queryIdentifiers.length>0&&queryIdentifiers.some(identifier=>memoryIdentifiers.includes(identifier));
     const evidence=rawRowsById.get(m.id);
     if(!evidence)return false;
     const exactPhrase=queryPhrase.length>=4&&this.lowerFor(m.id,m.content).includes(queryPhrase);
     // Deterministic morphology fallback: a single strong word-root match must survive
     // provider timeout even when long natural-language queries dilute average fuzzy coverage.
     const queryTokenArray=[...qTokens];
     const memoryTokens=this.tokensFor(m.content);
     const morphologyEvidence=queryTokenArray.some(queryToken=>queryToken.length>=5&&
       [...memoryTokens].some(memoryToken=>memoryToken.length>=5&&memoryToken!==queryToken&&
         (queryToken.startsWith(memoryToken.slice(0,5))||memoryToken.startsWith(queryToken.slice(0,5)))));
     const metadataEvidence=this.metadataRecallEnabled&&evidence.metadata>=.66;
     const lexicalEvidence=identifierEvidence||exactPhrase||morphologyEvidence||metadataEvidence||evidence.coverage>=minQueryCoverage||evidence.entity>=.40||
       (qTokens.size<5&&evidence.fuzzy>=.45)||
       (qTokens.size<=4&&evidence.conceptCoverage>=.45&&evidence.coverage>=.16);
     // A causal paraphrase may have no literal-token overlap with the event text.
     // Permit the concept bridge only when the memory carries explicit causal lineage;
     // generic semantic/recency matches still cannot bypass the answerability gate.
     const hasDecision=typeof m.context?.decisionId==='string'&&m.context.decisionId.trim().length>0;
     const hasObservation=typeof m.context?.observationId==='string'&&m.context.observationId.trim().length>0;
     const hasCausalOutcome=typeof m.context?.outcomeDirection==='string'&&m.context.outcomeDirection.trim().length>0;
     const causalLineage=(Array.isArray(m.causalLinks)&&m.causalLinks.length>0)||(hasDecision&&hasObservation&&hasCausalOutcome);
     const causalConceptEvidence=evidence.conceptCoverage>=.45&&causalLineage&&(
       queryIntentMode==='causal'||
       (queryIntentMode==='general'&&m.kind==='episodic'&&hasDecision&&hasObservation&&hasCausalOutcome&&evidence.conceptCoverage>=.55)
     );
     const typedRecall=['identity','episodic','goal','procedural'].includes(queryIntentMode)&&
       memoryIntentFit(queryIntentMode,m)>=.82;
     return lexicalEvidence||causalConceptEvidence||typedRecall;
   });
   rows.push(...groundedRows);
   this.lastHybridDiagnostics={...this.lastHybridDiagnostics,bm25Enabled:true,bm25CandidateCount:rawRows.filter(x=>x.bm25>0).length,bm25Max:maxBm25,rrfEnabled:true,identifierBias,temporalMode,asOfAt:now,queryIntentMode,maxQueryIntentBoost01:Math.max(0,...groundedRows.map(x=>x.intentBoost01)),candidateSelection:this.metadataRecallEnabled?'idf-coverage-fuzzy-concept-metadata-rrf-stable-id':'idf-coverage-fuzzy-concept-rrf-stable-id',candidateSelectionLimit:192,fuzzyEnabled:true,fuzzyCandidateCount:fuzzyCandidateIds.size,semanticVectorUsedForRanking:false,semanticEmbeddingProvider:'none',rrfSignals:this.metadataRecallEnabled?['bm25','token-coverage','character-fuzzy','metadata-tags-entities-topic','bilingual-concept-bridge','entity','graph-temporal','intent-kind-fit']:['bm25','token-coverage','character-fuzzy','bilingual-concept-bridge','entity','graph-temporal','intent-kind-fit'],answerabilityGate:'direct-evidence-or-typed-recall-v1',rankedBeforeGate:topRows.length,groundedAfterGate:groundedRows.length,abstained:groundedRows.length===0,abstentionReason:groundedRows.length===0?'no-grounded-evidence':null};
   // semanticHits is retained only for persisted-state compatibility. It is not
   // incremented by retrieval: the legacy hashed token projection is not a semantic
   // retrieval channel, and its previous calculation silently warmed cold memories.
   // Residency planning and explicit get()/consolidation own vector materialization.
   this.state.adaptiveMemoryPolicy=this.adaptivePolicy.snapshot();
   const queryTokens=[...qTokens];
   for(const witness of this.state.evictionWitnesses){
     if(witness.tokens.length<2||queryTokens.length<2)continue;
     const ov=overlap(queryTokens,witness.tokens);
     if(ov<.30)continue;
     const retainedOverlap=rows.reduce((best,row)=>Math.max(best,overlap(queryTokens,tokenize(row.m.content))),0);
     const realized=clamp(witness.value01*Math.max(ov,retainedOverlap));
     witness.matchedQueries++;
     witness.realizedRegret01=Math.max(witness.realizedRegret01,realized);
     if(realized>.05){
       const n=Math.max(1,witness.matchedQueries);
       this.state.meanEvictionRegret01=clamp(this.state.meanEvictionRegret01+(realized-this.state.meanEvictionRegret01)/n);
       this.state.budgetMisses++;
     }
   }
   return rows.map(({m})=>{m.lastAccessAt=now;m.retrievalCount++;return clone?structuredClone(m):m;});
 }
 /**
  * Commit the outcome of a read-only retrieval preview to canonical state.
  * Only selected rows receive access/retrieval updates. The exact-content guard
  * prevents a result computed for an older revision from warming a newer revision.
  */
 commitSelectedRetrieval(
  query:string,
  selectedItems:ReadonlyArray<Pick<MemoryItem2,'id'|'content'>>,
  goalRelevance=0,
  identityRelevance=0,
  temporalOptions:MemoryTemporalQueryOptions={}
 ):MemoryItem2[]{
  const wallClockNow=Date.now();
  const requestedAsOf=typeof temporalOptions.asOfAt==='number'&&Number.isFinite(temporalOptions.asOfAt)?temporalOptions.asOfAt:undefined;
  const temporalMode:MemoryTemporalMode=temporalOptions.temporalMode??'current';
  const now=temporalMode==='at'&&requestedAsOf!==undefined?requestedAsOf:wallClockNow;
  const queryIntentMode=detectMemoryQueryIntent(query);
  const contextCausal=queryIntentMode==='causal'||/\b(why|cause|causal|because|reason|effect|consequence)\b/iu.test(query)||/(причин|почему|следств)/iu.test(query);
  const contextTemporal=temporalMode!=='current'||queryIntentMode==='episodic'||/\b(today|now|yesterday|recent|recently|last|earlier|week|month|year)\b/iu.test(query)||/(сегодня|сейчас|вчера|недав|послед|раньше|недел|месяц|год)/iu.test(query);
  this.state.semanticQueries++;
  this.activePolicy=this.adaptivePolicy.choose({
   pressure01:clamp(this.state.items.length/1600),
   goal01:clamp(goalRelevance),
   causal01:contextCausal?1:0,
   temporal01:contextTemporal?1:0,
   mobile:true,
  },now);
  const validAt=(item:MemoryItem2,at:number)=>{
   const from=Number(item.validFromAt??item.createdAt);
   const until=item.validUntilAt==null?Number.POSITIVE_INFINITY:Number(item.validUntilAt);
   return from<=at&&at<until;
  };
  const seen=new Set<string>();
  const rows:MemoryItem2[]=[];
  for(const selected of selectedItems.slice(0,32)){
   if(!selected||typeof selected.id!=='string'||typeof selected.content!=='string'||seen.has(selected.id))continue;
   seen.add(selected.id);
   const item=this.state.items.find(candidate=>candidate.id===selected.id);
   if(!item||item.content!==selected.content||item.dormant||item.epistemicStatus==='quarantined')continue;
   if(temporalMode!=='all'&&((item.validUntilAt!=null&&Number(item.validUntilAt)<=now)||(item.supersededById!=null&&item.validUntilAt==null))){
    this.state.staleRetrievalsAvoided++;
    continue;
   }
   if(temporalMode!=='all'&&!validAt(item,now)){
    this.state.staleRetrievalsAvoided++;
    continue;
   }
   item.lastAccessAt=now;
   item.retrievalCount++;
   item.temperature01=memoryTemperature(item,now);
   rows.push(structuredClone(item));
  }
  this.state.adaptiveMemoryPolicy=this.adaptivePolicy.snapshot();
  return rows;
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
 private recordRevision(m:MemoryItem2,entry:MemoryItem2['revisionHistory'][number]){
  const tracked=this.itemIndex.get(m.id)===m;const before=tracked?estimateMemoryBytes(m):0;
  m.revisionHistory=normalizeRevisionHistory([entry,...m.revisionHistory]);
  if(tracked)this.state.estimatedBytes=Math.max(0,this.state.estimatedBytes-before+estimateMemoryBytes(m));
 }
 revise(id:string,to:EpistemicStatus,reason:string){const m=this.state.items.find(x=>x.id===id);if(!m||m.epistemicStatus===to)return;const from=m.epistemicStatus;this.recordRevision(m,{at:Date.now(),from,to,reason});m.epistemicStatus=to;m.lastAccessAt=Date.now();this.state.reconsolidations++;if(to==='quarantined')this.state.quarantined++;}
 reviseContent(id:string,newContent:string,options:{reason?:string;validAt?:number;source?:string;epistemicStatus?:EpistemicStatus;salience?:number;confidence?:number}={}){
   const requested=this.itemIndex.get(id); if(!requested||!String(newContent).trim())return null;
   const group=requested.revisionGroupId??requested.id;
   // A correction against a historical ID revises the current tip of that same
   // chain, avoiding a fork that would make point-in-time recall ambiguous.
   const chain=[...(this.revisionGroupIndex.get(group)??new Set([requested.id]))].map(itemId=>this.itemIndex.get(itemId)).filter((x):x is MemoryItem2=>Boolean(x));
   const parent=chain.filter(x=>x.validUntilAt==null).sort((a,b)=>Number(b.revisionSequence??1)-Number(a.revisionSequence??1)||Number(b.observedAt??b.createdAt)-Number(a.observedAt??a.createdAt))[0]??requested;
   const canonicalContent=canonicalizeMemoryContent(newContent);
   if(canonicalizeMemoryContent(parent.content)===canonicalContent)return structuredClone(parent);
   const requestedAt=Number.isFinite(Number(options.validAt))?Number(options.validAt):Date.now();
   const at=Math.max(requestedAt,Number(parent.validFromAt??parent.createdAt)+1);
   const nextSeq=Math.max(0,...chain.map(x=>Number(x.revisionSequence??1)))+1;
   const source=String(options.source??parent.source);
   // Memo content-addressed identity is still the canonical content hash, while
   // an explicit revision gets a lineage-scoped ID. This prevents an identical
   // phrase in an unrelated chain from hijacking a correction's history.
   const revisionId=stableMemoryId(`${canonicalContent}\0revision:${group}\0${nextSeq}\0${parent.id}`,parent.kind,source);
   const already=this.itemIndex.get(revisionId);
   if(already&&canonicalizeMemoryContent(already.content)===canonicalContent&&(already.revisionGroupId??already.id)===group)return structuredClone(already);
   const replacement=this.encode({
     id:revisionId,content:canonicalContent,kind:parent.kind,source,tags:parent.tags,context:parent.context,
     salience:options.salience??parent.salience,emotionalWeight:parent.emotionalWeight,identityRelevance:parent.identityRelevance,goalRelevance:parent.goalRelevance,socialRelevance:parent.socialRelevance,predictionError:parent.predictionError,confidence:options.confidence??parent.confidence,epistemicStatus:options.epistemicStatus??parent.epistemicStatus,entities:parent.entities,semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],
     validFromAt:at,validUntilAt:null,observedAt:at,supersedesId:parent.id,supersededById:null,revisionGroupId:group,revisionSequence:nextSeq
   },{clone:false,forceDistinct:true});
   parent.validUntilAt=at;parent.supersededById=replacement.id;parent.lastAccessAt=at;
   this.recordRevision(parent,{at,from:parent.epistemicStatus,to:parent.epistemicStatus,reason:String(options.reason??'content-revision').slice(0,240)});
   replacement.supersedesId=parent.id;replacement.supersededById=null;replacement.revisionGroupId=group;replacement.revisionSequence=nextSeq;
   replacement.temporalLinks=[...new Set([...(replacement.temporalLinks??[]),parent.id])].slice(0,6);
   let revisions=this.revisionGroupIndex.get(group);if(!revisions){revisions=new Set<string>();this.revisionGroupIndex.set(group,revisions);}revisions.add(parent.id);revisions.add(replacement.id);
   this.state.reconsolidations++;
   return structuredClone(replacement);
 }

 updateContext(id:string, patch:Record<string,string|undefined>) {
   const m=this.itemIndex.get(String(id));if(!m)return null;
   const before=estimateMemoryBytes(m);
   m.context=mergeMemoContext(m.context,patch);
   this.state.estimatedBytes=Math.max(0,this.state.estimatedBytes-before+estimateMemoryBytes(m));
   return structuredClone(m.context??{});
 }
 /** Merge one independently attributed evidence source through the canonical MemoryOS2 owner. */
 attachEvidenceSource(id:string, source:MemoryEvidenceSource, reason='evidence-lineage'):MemoryItem2|null {
   const item=this.state.items.find(x=>x.id===id);if(!item)return null;
   const beforeBytes=estimateMemoryBytes(item);
   const beforeSources=JSON.stringify(item.evidenceSources??[]);
   const beforeKeys=JSON.stringify(item.evidenceLineageKeys??[]);
   const now=Date.now();
   const input:MemoryEncodeInput={
     ...item,
     source:source.source,
     provenanceClass:source.provenanceClass,
     sourceAuthority01:source.sourceAuthority01,
     independenceKey:source.independenceKey,
     observedAt:source.observedAt,
     evidenceFreshnessAt:source.evidenceFreshnessAt,
     evidenceSources:[source],
   };
   this.mergeIncomingEvidence(item,input,now);
   const changed=beforeSources!==JSON.stringify(item.evidenceSources??[])||beforeKeys!==JSON.stringify(item.evidenceLineageKeys??[]);
   if(!changed)return structuredClone(item);
   item.lastAccessAt=now;
   item.temperature01=memoryTemperature(item);
   this.recordRevision(item,{at:now,from:item.epistemicStatus,to:item.epistemicStatus,reason:String(reason||'evidence-lineage').slice(0,240)});
   this.state.reconsolidations++;
   this.state.estimatedBytes=Math.max(0,this.state.estimatedBytes-beforeBytes+estimateMemoryBytes(item));
   return structuredClone(item);
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
   if(reason){this.recordRevision(m,{at:m.lastAccessAt,from:fromStatus,to:fromStatus,reason});}
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
   this.state.estimatedBytes=Math.max(0,this.state.estimatedBytes-estimateMemoryBytes(m));
   this.removeIndexedId(id);
   this.state.items.splice(i,1);
   this.itemIndex.delete(id);
   this.rebuildDedupIndexesFor(m);
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
  enforceByteBudget(options:{maxBytes?:number;tick?:number;protectedIds?:string[];reason?:string}={}){
   const budget=Math.max(16384,Math.floor(Number(options.maxBytes??this.state.byteBudget??524288)));
   this.state.byteBudget=budget;
   const protectedIds=new Set(options.protectedIds??[]);
   const removed:string[]=[];
   const scoreValue=(m:MemoryItem2)=>clamp(.24*m.salience+.16*m.identityRelevance+.16*m.goalRelevance+.10*m.socialRelevance+.12*m.predictionError+.10*m.confidence+.08*m.emotionalWeight+.04*Math.min(1,m.retrievalCount/12));
   const harm=(m:MemoryItem2)=>clamp(.22*(m.dormant?1:0)+.18*(1-m.confidence)+.15*Math.min(1,m.semanticLinks.length/8));
   const density=(m:MemoryItem2)=>{const bytes=Math.max(96,estimateMemoryBytes(m));return clamp(Math.max(0,scoreValue(m)-.30*harm(m)+.05*clamp(Number(m.sourceAuthority01??.5)))*Math.sqrt(512/bytes));};
   while(this.state.estimatedBytes>budget){
     const candidates=this.state.items.filter(m=>!protectedIds.has(m.id)&&m.epistemicStatus!=='quarantined'&&m.kind!=='identity'&&m.kind!=='autobiographical');
     if(!candidates.length)break;
     candidates.sort((a,b)=>density(a)-density(b));
     const victim=candidates[0]!;
     const next=candidates[1];
     const bytes=estimateMemoryBytes(victim);
     const witness:MemoryEvictionWitness={id:victim.id,kind:victim.kind,at:Date.now(),tick:Math.max(0,Math.floor(Number(options.tick??0))),bytes,value01:scoreValue(victim),netValuePerByte01:density(victim),reason:String(options.reason??'byte-budget'),tokens:tokenize(victim.content).slice(0,12),matchedQueries:0,realizedRegret01:0,counterfactualRegret01:next?clamp(density(next)-density(victim)):0};
     this.state.evictionWitnesses=[...this.state.evictionWitnesses,witness].slice(-256);
     if(!this.forgetById(victim.id,String(options.reason??'byte-budget')))break;
     this.state.budgetEvictions++; removed.push(victim.id);
   }
   return {budget,usedBytes:this.state.estimatedBytes,utilization01:clamp(this.state.estimatedBytes/Math.max(1,budget)),evicted:removed};
  }
  budgetDiagnostics(){return {byteBudget:this.state.byteBudget,estimatedBytes:this.state.estimatedBytes,utilization01:clamp(this.state.estimatedBytes/Math.max(1,this.state.byteBudget)),budgetEvictions:this.state.budgetEvictions,budgetMisses:this.state.budgetMisses,meanEvictionRegret01:this.state.meanEvictionRegret01,witnesses:this.state.evictionWitnesses.length};}

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
   if(now-this.state.lastConflictScanAt>=1000) this.adjudicateImplicitConflicts({at:now,limit:32,pairBudget:192});
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
   return {counts,targetItems:this.state.items.length,materializedVectors:this.state.items.reduce((n,m)=>n+(m.semanticVector.length?1:0),0),estimatedBytes:this.state.estimatedBytes};
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
     const previousDf=this.documentFrequency.get(token)||0;
     this.documentFrequency.set(token,previousDf+1);
     let ids=this.tokenIndex.get(token);
     if(!ids){ids=new Set<string>();this.tokenIndex.set(token,ids);}
     // The corpus itself is capped at 1600 memories; retain complete postings so
     // a token cannot silently hide newer/high-value rows after an arbitrary 96-ID prefix.
     if(!ids.has(item.id))ids.add(item.id);
     if(previousDf===0)for(const gram of charTrigrams(token)){let posting=this.characterGramIndex.get(gram);if(!posting){posting=new Set<string>();this.characterGramIndex.set(gram,posting);}posting.add(token);}
   }
   for(const token of this.metadataTokens(item)){
     let ids=this.metadataTokenIndex.get(token);
     if(!ids){ids=new Set<string>();this.metadataTokenIndex.set(token,ids);}
     ids.add(item.id);
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
       if(df>0)this.documentFrequency.set(token,df);else{
         this.documentFrequency.delete(token);
         for(const gram of charTrigrams(token)){const posting=this.characterGramIndex.get(gram);if(posting){posting.delete(token);if(posting.size===0)this.characterGramIndex.delete(gram);}}
       }
     }
   }
   for(const [token,ids] of this.tokenIndex){
     if(ids.delete(id)&&ids.size===0)this.tokenIndex.delete(token);
   }
   for(const [token,ids] of this.metadataTokenIndex){
     if(ids.delete(id)&&ids.size===0)this.metadataTokenIndex.delete(token);
   }
 }

 /** Point-in-time lookup from the canonical revision chain; this is read-only. */
 temporalAt(id:string,at=Date.now()):MemoryItem2|null{
   const seed=this.itemIndex.get(String(id));if(!seed||!Number.isFinite(at))return null;
   const group=seed.revisionGroupId??seed.id;
   const candidates=[...(this.revisionGroupIndex.get(group)??new Set([seed.id]))].map(itemId=>this.itemIndex.get(itemId)).filter((m):m is MemoryItem2=>m!==undefined&&this.validAt(m,at));
   candidates.sort((a,b)=>Number(b.revisionSequence??1)-Number(a.revisionSequence??1)||Number(b.observedAt??b.createdAt)-Number(a.observedAt??a.createdAt)||a.id.localeCompare(b.id));
   return candidates[0]?structuredClone(candidates[0]):null;
 }
 temporalDiff(id:string,fromAt:number,toAt:number){
   const from=this.temporalAt(id,fromAt),to=this.temporalAt(id,toAt);
   return {memoryId:String(id),from,to,changed:(from?.contentHash??from?.content??null)!==(to?.contentHash??to?.content??null)};
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
     independentEvidenceSources:this.independentEvidenceCount(m),evidenceSources:this.normalizeEvidenceSources(m),
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
   const expectedGrams=new Map<string,Set<string>>();
   for(const token of expectedDf.keys())for(const gram of charTrigrams(token)){let posting=expectedGrams.get(gram);if(!posting){posting=new Set<string>();expectedGrams.set(gram,posting);}posting.add(token);}
   let characterGramMismatch=expectedGrams.size===this.characterGramIndex.size?0:1;
   if(!characterGramMismatch)for(const [gram,tokens] of expectedGrams){const actual=this.characterGramIndex.get(gram);if(!actual||actual.size!==tokens.size||[...tokens].some(token=>!actual.has(token))){characterGramMismatch++;break;}}
   const expectedMetadataIndex=new Map<string,Set<string>>();
   for(const item of this.state.items)for(const token of this.metadataTokens(item)){let posting=expectedMetadataIndex.get(token);if(!posting){posting=new Set<string>();expectedMetadataIndex.set(token,posting);}posting.add(item.id);}
   let metadataIndexMismatch=expectedMetadataIndex.size===this.metadataTokenIndex.size?0:1;
   if(!metadataIndexMismatch)for(const [token,expectedIds] of expectedMetadataIndex){const actual=this.metadataTokenIndex.get(token);if(!actual||actual.size!==expectedIds.size||[...expectedIds].some(id=>!actual.has(id))){metadataIndexMismatch++;break;}}
   return {pass:staleItemIndex===0&&missingItemIndex===0&&staleExact===0&&staleContent===0&&dfMismatch===0&&characterGramMismatch===0&&metadataIndexMismatch===0,items:this.state.items.length,itemIndexSize:this.itemIndex.size,staleItemIndex,missingItemIndex,staleExact,staleContent,dfMismatch,characterGramMismatch,characterGramVocabulary:this.characterGramIndex.size,metadataIndexMismatch,metadataTokenVocabulary:this.metadataTokenIndex.size,semanticEmbeddingProvider:'none' as const,semanticVectorUsedForRanking:false};
 }
 /**
  * Read-only /doctor pass adapted from MemFS maintenance: checks memory identity, provenance,
  * revision pointers and link hygiene without merging, deleting, or rewriting canonical records.
  * Link targets can belong to an external graph, so those findings are warnings, not automatic repairs.
  */
 doctor(options:{at?:number;maxIssues?:number}={}){
  const at=Number.isFinite(options.at)?Number(options.at):Date.now();
  const maxIssues=Math.max(1,Math.min(128,Math.floor(options.maxIssues??64)));
  const items=this.state.items;
  const idCounts=new Map<string,number>();
  const hashCounts=new Map<string,number>();
  const revisionMembers=new Map<string,MemoryItem2[]>();
  const issues:Array<{code:string;severity:'error'|'warning';memoryId:string|null;detail:string}> = [];
  let totalErrors=0,totalWarnings=0;
  const add=(code:string,severity:'error'|'warning',memoryId:string|null,detail:string)=>{if(severity==='error')totalErrors++;else totalWarnings++;if(issues.length<maxIssues)issues.push({code,severity,memoryId,detail:detail.slice(0,240)});};
  for(const item of items){idCounts.set(item.id,(idCounts.get(item.id)??0)+1);}
  const ids=new Set(items.map(item=>item.id));
  let hashMismatch=0,invalidConfidence=0,invalidStatus=0,danglingRevision=0,danglingLinks=0,duplicateContent=0,futureEvidence=0,duplicateEvidenceKeys=0;
  for(const item of items){
   const actualHash=memoContentHash(String(item.content??''));
   if(!item.contentHash||item.contentHash!==actualHash){hashMismatch++;add('content-hash-mismatch','error',item.id,'Stored content hash is absent or differs from the canonical content hash.');}
   if(!Number.isFinite(item.confidence)||item.confidence<0||item.confidence>1){invalidConfidence++;add('invalid-confidence','error',item.id,'Confidence is not a finite value in [0,1].');}
   if(!EPISTEMIC_STATUSES.has(item.epistemicStatus)){invalidStatus++;add('invalid-epistemic-status','error',item.id,'Memory epistemic status is not in the supported enum.');}
   if(Number.isFinite(item.observedAt)&&Number(item.observedAt)>at+300000){futureEvidence++;add('future-observation-timestamp','warning',item.id,'Observation timestamp is more than five minutes in the future.');}
   if(Number.isFinite(item.evidenceFreshnessAt)&&Number(item.evidenceFreshnessAt)>at+300000){futureEvidence++;add('future-evidence-freshness','warning',item.id,'Evidence freshness timestamp is more than five minutes in the future.');}
   const group=item.revisionGroupId??item.id;
   const revisions=revisionMembers.get(group)??[];revisions.push(item);revisionMembers.set(group,revisions);
   for(const [field,ref] of [['supersedesId',item.supersedesId],['supersededById',item.supersededById]] as Array<[string,string|null|undefined]>){
    if(ref&& !ids.has(ref)){danglingRevision++;add('dangling-revision-pointer','warning',item.id,field+' references missing memory '+String(ref).slice(0,100));}
   }
   const links:Array<[string,string[]]>=[['semanticLinks',item.semanticLinks??[]],['temporalLinks',item.temporalLinks??[]],['causalLinks',item.causalLinks??[]],['contradictionLinks',item.contradictionLinks??[]]];
   for(const [field,refs] of links){
    if(!Array.isArray(refs))continue;
    if(refs.includes(item.id)){danglingLinks++;add('self-referential-link','warning',item.id,field+' contains a self-link.');}
    for(const ref of refs){if(typeof ref==='string'&&!ids.has(ref)){danglingLinks++;add('unresolved-memory-link','warning',item.id,field+' references an ID not currently present in MemoryOS2: '+ref.slice(0,96));}}
   }
   const evidenceKeys=new Set<string>();
   for(const source of item.evidenceSources??[]){
    if(Number.isFinite(source.observedAt)&&source.observedAt>at+300000){futureEvidence++;add('future-source-observation','warning',item.id,'An evidence source has an observation timestamp in the future.');}
    const key=String(source.independenceKey??source.source??'').trim();
    if(key&&evidenceKeys.has(key)){duplicateEvidenceKeys++;add('duplicate-evidence-source-key','warning',item.id,'The same independence key occurs multiple times in one record.');}
    if(key)evidenceKeys.add(key);
   }
   const hashKey=[actualHash,item.kind,item.source,item.epistemicStatus].join('|');
   hashCounts.set(hashKey,(hashCounts.get(hashKey)??0)+1);
  }
  for(const [id,count] of idCounts){if(count>1)add('duplicate-memory-id','error',id,'The snapshot contains '+count+' records with the same ID.');}
  for(const [key,count] of hashCounts){if(count>1){duplicateContent+=count-1;add('duplicate-content-candidate','warning',null,'Same canonical content hash, kind, source and epistemic status appear '+count+' times; inspect before any merge.');}}
  let revisionSequenceCollisions=0,brokenReciprocalRevisions=0;
  for(const [group,rows] of revisionMembers){
   const seqs=new Set<number>();
   for(const item of rows){
    const seq=Number(item.revisionSequence??1);
    if(seqs.has(seq)){revisionSequenceCollisions++;add('duplicate-revision-sequence','warning',item.id,'Revision group '+group+' contains a repeated sequence '+seq+'.');}
    seqs.add(seq);
    if(item.supersedesId){const previous=items.find(other=>other.id===item.supersedesId);if(previous&&previous.supersededById!==item.id){brokenReciprocalRevisions++;add('revision-link-not-reciprocal','warning',item.id,'Previous revision does not point back through supersededById.');}}
    if(item.supersededById){const next=items.find(other=>other.id===item.supersededById);if(next&&next.supersedesId!==item.id){brokenReciprocalRevisions++;add('revision-link-not-reciprocal','warning',item.id,'Next revision does not point back through supersedesId.');}}
   }
  }
  const index=this.indexDiagnostics();
  if(!index.pass)add('index-integrity-failure','error',null,'The canonical memory indexes disagree with the persisted memory list.');
  const errors=totalErrors;
  const warnings=totalWarnings;
  return {version:1,readOnly:true,pass:errors===0,at,itemCount:items.length,issueCount:errors+warnings,errors,warnings,issues,truncated:errors+warnings>issues.length,counts:{duplicateIds:[...idCounts.values()].filter(count=>count>1).length,hashMismatch,invalidConfidence,invalidStatus,duplicateContent,danglingRevision,danglingLinks,futureEvidence,duplicateEvidenceKeys,revisionSequenceCollisions,brokenReciprocalRevisions,indexIntegrityFailures:index.pass?0:1},indexes:index};
 }
 evidenceTrail(id:string){
  const item=this.itemIndex.get(String(id));if(!item)return null;
  const evidence=this.normalizeEvidenceSources(item);
  return {memoryId:item.id,independentSources:evidence.length,sources:structuredClone(evidence),corroborationBonus01:Math.min(.10,Math.max(0,evidence.length-1)*.025)};
 }
 statsLight(){const evidenceCounts=this.state.items.map(m=>this.independentEvidenceCount(m));return {items:this.state.items.length,dormant:this.state.items.reduce((n,m)=>n+(m.dormant?1:0),0),forgetCount:this.state.forgetCount,reconsolidations:this.state.reconsolidations,quarantined:this.state.quarantined,memoriesWithIndependentEvidence:evidenceCounts.filter(n=>n>1).length,independentEvidenceEntries:evidenceCounts.reduce((n,x)=>n+x,0)};}
 implicitConflictDiagnostics(){return {candidates:this.state.implicitConflictCandidates,resolved:this.state.implicitConflictsResolved,deferred:this.state.implicitConflictsDeferred,provenanceProtected:this.state.provenanceProtected,staleRetrievalsAvoided:this.state.staleRetrievalsAvoided,lastScanAt:this.state.lastConflictScanAt};}
 contradictionDiagnostics(){const linked=this.state.items.reduce((n,m)=>n+(m.contradictionLinks?.length??0),0);const withContradictions=this.state.items.filter(m=>(m.contradictionLinks?.length??0)>0).length;return {linkedPairs:linked,itemsWithContradictions:withContradictions,contradictionItemRate01:this.state.items.length?withContradictions/this.state.items.length:0};}
 memoIdentityDiagnostics(){const ids=this.state.items.map(m=>m.id);const stable=this.state.items.filter(m=>m.id===stableMemoryId(m.content,m.kind,m.source)).length;const hashes=this.state.items.filter(m=>m.contentHash===memoContentHash(m.content)).length;const uniqueHashes=new Set(this.state.items.map(m=>m.contentHash)).size;return {items:this.state.items.length,stableIds:stable,stableIdRate01:this.state.items.length?stable/this.state.items.length:1,contentHashes:hashes,contentHashRate01:this.state.items.length?hashes/this.state.items.length:1,uniqueContentHashes:uniqueHashes,hashCollisionFree01:this.state.items.length?uniqueHashes/this.state.items.length:1};}
 snapshot(options:{clone?:boolean}={}){return options.clone===false?this.state:structuredClone(this.state);}
}
