import { countOr, isPlainDataArray, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitStrictOr, unitOr } from '../body/RestoreSanitizers.ts';
import { countOr, isPlainDataArray, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitOr } from '../body/RestoreSanitizers.ts';
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export type EpistemicSource='observed'|'model-output'|'derived'|'unresolved';
export interface EvidenceClaim { id:string; at:number; modality:string; claim:string; source:EpistemicSource; confidence01:number; targetIds:string[]; supersedes?:string; }
export interface EpistemicState { version:1; claims:EvidenceClaim[]; contradictionPairs:number; resolvedPairs:number; corroboratedPairs:number; meanConfidence01:number; lastAt:number; }
export const defaultEpistemicState=():EpistemicState=>({version:1,claims:[],contradictionPairs:0,resolvedPairs:0,corroboratedPairs:0,meanConfidence01:.5,lastAt:0});
function idFor(modality:string,claim:string,at:number){return `evidence-${createHash('sha256').update(`${modality}|${claim}|${at}`).digest('hex').slice(0,16)}`;}

const NEGATION_TOKENS=new Set(['not','no','never','without','cannot','cant','isnt','doesnt','dont','wasnt','werent','не','нет','никогда','без','нельзя','невозможно']);
// Scalar phrases that contain a negation token but still assert a positive claim.
const NON_NEGATING_PHRASES=[/\bnot\s+only\b/g,/\bnot\s+just\b/g,/\bне\s+только\b/g];
const ANTONYM_PAIRS:[string,string][]=[
  ['open','closed'],['opened','closed'],['open','shut'],
  ['on','off'],['enabled','disabled'],['active','inactive'],
  ['present','absent'],['connected','disconnected'],
  ['true','false'],['yes','no'],['alive','dead'],['up','down'],
  ['hot','cold'],['light','dark'],['wet','dry'],['full','empty'],
  ['moving','still'],['visible','hidden'],['valid','invalid'],
  ['открыт','закрыт'],['включён','выключен'],['включен','выключен'],
  ['есть','нет'],['присутствует','отсутствует'],
  ['живой','мёртвый'],['живой','мертвый'],['горячий','холодный'],['полный','пустой'],
];
const ANTONYMS=new Map<string,Set<string>>();
for(const [a,b] of ANTONYM_PAIRS){
  if(!ANTONYMS.has(a))ANTONYMS.set(a,new Set());
  if(!ANTONYMS.has(b))ANTONYMS.set(b,new Set());
  ANTONYMS.get(a)!.add(b); ANTONYMS.get(b)!.add(a);
}

export interface ClaimPolarity { core:string; polarity:1|-1; tokens:string[]; }

const polarityMemo=new Map<string,ClaimPolarity>();

/**
 * Splits a claim into a comparable core proposition plus its polarity.
 * Negation tokens flip polarity and are removed from the core, so
 * "door is open" and "door is not open" share a core and can be compared.
 */
export function claimPolarity(claim:string):ClaimPolarity{
  const key=String(claim??'');
  const cached=polarityMemo.get(key);
  if(cached)return cached;
  const parsed=parseClaimPolarity(key);
  // The memo is bounded by the 256-claim window plus transient inputs.
  if(polarityMemo.size>2048)polarityMemo.clear();
  polarityMemo.set(key,parsed);
  return parsed;
}

function parseClaimPolarity(claim:string):ClaimPolarity{
  let text=String(claim??'').normalize('NFKC').toLowerCase();
  for(const phrase of NON_NEGATING_PHRASES)text=text.replace(phrase,' ');
  const tokens=text.split(/[^a-zа-яё0-9]+/).filter(Boolean);
  let negations=0;
  const core:string[]=[];
  for(const token of tokens){
    if(NEGATION_TOKENS.has(token)){negations++;continue;}
    core.push(token);
  }
  return {core:core.join(' '),polarity:negations%2?-1:1,tokens:core};
}

function contradicts(a:EvidenceClaim,b:EvidenceClaim):boolean{
  const pa=claimPolarity(a.claim), pb=claimPolarity(b.claim);
  if(pa.core&&pa.core===pb.core)return pa.polarity!==pb.polarity;
  // Different wording over the same subject: an antonym with the same polarity
  // is still a direct disagreement ("door is open" against "door is closed").
  const bTokens=new Set(pb.tokens);
  let shared=false;
  for(const token of pa.tokens)if(bTokens.has(token)){shared=true;break;}
  if(!shared)return false;
  let hasAntonym=false;
  for(const token of pa.tokens){
    const opposites=ANTONYMS.get(token);
    if(!opposites)continue;
    for(const opposite of opposites){
      if(bTokens.has(opposite)){hasAntonym=true;break;}
    }
    if(hasAntonym)break;
  }
  return hasAntonym&&pa.polarity===pb.polarity;
}

/**
 * Number of distinct opposing witness pairs among retained claims.
 *
 * A witness is (modality, claim): restating the same claim from the same
 * modality is persistence, not a second witness, so it cannot inflate the
 * gauge. A pair settled by an explicit `supersedes` edge is no longer a
 * standing disagreement and is not counted.
 */
function countContradictionPairs(claims:readonly EvidenceClaim[]):number{
  const witnesses=new Map<string,EvidenceClaim>();
  for(const claim of claims){
    const key=`${claim.modality}\u0000${claim.claim}`;
    if(!witnesses.has(key))witnesses.set(key,claim);
  }
  const rows=[...witnesses.values()];
  let pairs=0;
  for(let i=0;i<rows.length;i+=1){
    const a=rows[i]!;
    for(let j=i+1;j<rows.length;j+=1){
      const b=rows[j]!;
      if(a.supersedes===b.id||b.supersedes===a.id)continue;
      if(contradicts(a,b))pairs++;
    }
  }
  return Math.min(pairs,4096);
}

export class PerceptualEpistemicGraph {
  private state=defaultEpistemicState();
  restore(raw?:Partial<EpistemicState>|null){
    const d=defaultEpistemicState();
    const r=isPlainDataRecord(raw)?raw:{};
    const claims:EvidenceClaim[]=[];
    const rawClaims=ownDataValue(r,'claims');
    const seenClaimIds=new Set<string>();
    if(isPlainDataArray(rawClaims,1024)){
      for(const candidate of rawClaims.slice(-256)){
        if(!isPlainDataRecord(candidate))continue;
        const id=stringOr(ownDataValue(candidate,'id'),'').trim().slice(0,180);
        const modality=stringOr(ownDataValue(candidate,'modality'),'unknown',32).trim()||'unknown';
        const claim=stringOr(ownDataValue(candidate,'claim'),'').trim().slice(0,360);
        if(!id||!claim||seenClaimIds.has(id))continue;
        seenClaimIds.add(id);
        const rawSource=ownDataValue(candidate,'source');
        const source:EpistemicSource=rawSource==='observed'||rawSource==='derived'?'derived':
          rawSource==='model-output'||rawSource==='unresolved'?rawSource:'unresolved';
        const targetIdsRaw=ownDataValue(candidate,'targetIds');
        const targetIds=isPlainDataArray(targetIdsRaw,64)
          ?[...new Set(targetIdsRaw.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim()))
            .map(value=>value.trim().slice(0,180)))].slice(0,16)
          :[];
        const supersedes=stringOr(ownDataValue(candidate,'supersedes'),'',180).trim();
        claims.push({
          id,at:timestampOr(ownDataValue(candidate,'at'),0),modality,claim,source,
          confidence01:unitStrictOr(ownDataValue(candidate,'confidence01'),0),targetIds,
          ...(supersedes?{supersedes}:{})
        });
      }
    }
    const ids=new Set(claims.map(row=>row.id));
    for(const row of claims)if(row.supersedes&&(row.supersedes===row.id||!ids.has(row.supersedes)))delete row.supersedes;
    const modalityWitnesses=new Map<string,Set<string>>();
    for(const row of claims){
      const witnesses=modalityWitnesses.get(row.claim)??new Set<string>();
      witnesses.add(row.modality);
      modalityWitnesses.set(row.claim,witnesses);
    }
    let corroboratedPairs=0;
    for(const witnesses of modalityWitnesses.values()){
      const count=witnesses.size;
      corroboratedPairs+=count*(count-1)/2;
    }
    const resolvedPairs=claims.filter(row=>Boolean(row.supersedes)).length;
    const meanConfidence01=claims.length
      ?clamp(claims.reduce((sum,row)=>sum+row.confidence01,0)/claims.length)
      :d.meanConfidence01;
    this.state={
      version:1,
      claims,
      contradictionPairs:countContradictionPairs(claims),
      resolvedPairs:Math.min(4096,resolvedPairs),
      corroboratedPairs:Math.min(1000,corroboratedPairs),
      meanConfidence01,
      lastAt:claims.reduce((latest,row)=>Math.max(latest,row.at),0),
    };
  }
  snapshot(){return structuredClone(this.state);}
  add(input:{at:number;modality:string;claim:string;source:EpistemicSource;confidence01:number;targetIds?:string[];supersedes?:string}){
    // Refuse accessors/proxies and downgrade caller-supplied "observed" labels.
    if(!isPlainDataRecord(input))return null;
    const rawClaim=ownDataValue(input,'claim');
    if(typeof rawClaim!=='string')return null;
    const claim=rawClaim.trim().slice(0,360); if(!claim)return null;
    const at=timestampOr(ownDataValue(input,'at'),0);
    const modality=stringOr(ownDataValue(input,'modality'),'unknown',32).trim()||'unknown';
    const confidence01=unitOr(ownDataValue(input,'confidence01'),0);
    const rawSource=ownDataValue(input,'source');
    const source:EpistemicSource=rawSource==='observed'||rawSource==='derived'?'derived':
      rawSource==='model-output'||rawSource==='unresolved'?rawSource:'unresolved';
    const rawTargets=ownDataValue(input,'targetIds');
    const targetIds=isPlainDataArray(rawTargets,64)
      ?[...new Set(rawTargets.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim()))
        .map(value=>value.trim().slice(0,180)))].slice(0,16)
      :[];
    const supersedes=stringOr(ownDataValue(input,'supersedes'),'',180).trim();
    const id=idFor(modality,claim,at);
    const replayed=this.state.claims.find(x=>x.id===id);
    if(replayed)return structuredClone(replayed);
    // Only an existing retained claim can be superseded; dangling caller-chosen
    // IDs must never become future contradiction-suppression edges.
    const superseded=supersedes
      ? this.state.claims.find(x=>x.id===supersedes&&x.id!==id)
      : undefined;
    const c:EvidenceClaim={id,at,modality,claim,source,confidence01,targetIds,...(superseded?{supersedes:superseded.id}:{})};
    const similar=this.state.claims.filter(x=>x.claim===claim&&x.id!==c.id);
    const independentCorroboration=similar.filter(x=>x.modality!==modality);
    // Repeating the same proposition from the same modality is persistence,
    // not independent corroboration.
    if(superseded)this.state.resolvedPairs=Math.min(4096,this.state.resolvedPairs+1);
    else if(independentCorroboration.length)this.state.corroboratedPairs=Math.min(1000,this.state.corroboratedPairs+independentCorroboration.length);
    this.state.claims.unshift(c); this.state.claims=this.state.claims.slice(0,256);
    // contradictionPairs is a gauge over the retained window, not a lifetime
    // event counter: restating one side of a standing disagreement must not
    // inflate it, and trimming the window must not freeze a stale number.
    this.state.contradictionPairs=countContradictionPairs(this.state.claims);
    this.state.meanConfidence01=clamp(this.state.claims.reduce((s,x)=>s+x.confidence01,0)/Math.max(1,this.state.claims.length));
    this.state.lastAt=Math.max(this.state.lastAt,at); return structuredClone(c);
  }
  recent(limit=32){return this.state.claims.slice(0,Math.max(1,Math.min(64,Math.floor(limit)))).map(x=>structuredClone(x));}
  /**
   * Distinct opposing witness pairs, newest witness first.
   * The pairing rule lives here, not in callers, so downstream consumers cannot
   * invent a different notion of "conflict".
   */
  contestedPairs(limit=8){
    const witnesses=new Map<string,EvidenceClaim>();
    for(const claim of this.state.claims){
      const key=`${claim.modality}\u0000${claim.claim}`;
      if(!witnesses.has(key))witnesses.set(key,claim);
    }
    const rows=[...witnesses.values()].sort((a,b)=>b.at-a.at);
    const pairs:{claim:EvidenceClaim;opposing:EvidenceClaim}[]=[];
    const paired=new Set<string>();
    for(const a of rows){
      for(const b of rows){
        if(a.id===b.id)continue;
        if(a.supersedes===b.id||b.supersedes===a.id)continue;
        if(!contradicts(a,b))continue;
        const key=[a.id,b.id].sort().join('|');
        if(paired.has(key))continue;
        paired.add(key);
        pairs.push({claim:structuredClone(a),opposing:structuredClone(b)});
        break;
      }
      if(pairs.length>=limit)break;
    }
    return pairs;
  }
  summary(){return {version:1,claims:this.state.claims.length,contradictionPairs:this.state.contradictionPairs,resolvedPairs:this.state.resolvedPairs,corroboratedPairs:this.state.corroboratedPairs,meanConfidence01:this.state.meanConfidence01,lastAt:this.state.lastAt};}
}
