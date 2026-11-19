/**
 * Evidence-bounded user model.
 * Stores only explicitly stated, low-risk interaction preferences.
 * Repeated behavior remains an unconfirmed candidate, never a fact.
 */
export type UserModelDomain = 'interaction-style'|'content-preference'|'accessibility-preference'|'explicit-boundary';
export type UserModelClaimStatus = 'confirmed'|'needs-confirmation'|'disputed';
export interface UserModelClaim {
  key:string; domain:UserModelDomain; value:string; status:UserModelClaimStatus;
  source:'user-explicit'; evidenceRef:string; firstSeenTick:number; lastSeenTick:number;
  confirmations:number; contradictions:number;
}
export interface UserModelCandidate {
  key:string; domain:UserModelDomain; value:string; observations:number;
  firstSeenTick:number; lastSeenTick:number; confidence01:number; status:'unconfirmed-candidate';
}
export interface UserModelForgetTombstone { key:string; domain:UserModelDomain; forgottenAtTick:number; evidenceRef:string; }
export interface UserModelStateV1 {
  version:1; claims:UserModelClaim[]; candidates:UserModelCandidate[];
  processedEvidenceRefs:string[]; rejectedSensitiveCount:number; rejectedMalformedCount:number;
}
export interface UserModelState {
  version:2; claims:UserModelClaim[]; candidates:UserModelCandidate[];
  processedEvidenceRefs:string[]; forgetTombstones:UserModelForgetTombstone[];
  rejectedSensitiveCount:number; rejectedMalformedCount:number;
}
export type UserModelResult =
 | {accepted:true;status:UserModelClaimStatus;claim:UserModelClaim}
 | {accepted:false;reason:'sensitive-or-unclassified'|'invalid-input'|'missing-evidence'|'duplicate-evidence'|'forgotten-before-event'|'tombstone-capacity-exhausted'};
const DOMAINS:readonly UserModelDomain[]=['interaction-style','content-preference','accessibility-preference','explicit-boundary'];
const MAX_FORGET_TOMBSTONES=256;
const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const boundedText=(v:unknown,max:number)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
const validTick=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const normalizeKey=(v:unknown)=>boundedText(v,64).toLowerCase().replace(/[^a-z0-9._:-]/g,'-').replace(/-+/g,'-');
const isDomain=(v:unknown):v is UserModelDomain=>typeof v==='string'&&DOMAINS.includes(v as UserModelDomain);
/** Read persisted data without invoking getters; snapshots are untrusted input. */
const ownData=(value:unknown,key:string):unknown=>{
 if(!value||typeof value!=='object')return undefined;
 const descriptor=Object.getOwnPropertyDescriptor(value,key);
 return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
};
const strictOwnArray=(value:unknown,max:number):unknown[]|null=>{
 try {
  if(!Array.isArray(value))return null;
  const length=ownData(value,'length');
  if(!Number.isSafeInteger(length)||Number(length)<0||Number(length)>max)return null;
  const result:unknown[]=[];
  for(let index=0;index<Number(length);index++){
   const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
   if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return null;
   result.push(descriptor.value);
  }
  return result;
 } catch { return null; }
};
const boundedOwnArray=(value:unknown,max:number):unknown[]=>{
 if(!Array.isArray(value))return [];
 const length=ownData(value,'length');
 if(!Number.isSafeInteger(length)||Number(length)<0)return [];
 const result:unknown[]=[];
 for(let index=Math.max(0,Number(length)-max);index<Number(length);index++){
  const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
  if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))continue;
  result.push(descriptor.value);
 }
 return result;
};

/** Fail-closed minimization boundary; upstream privacy policy and receipt attestation remain required. */
export class UserModelEvidenceModel {
 private state:UserModelState={version:2,claims:[],candidates:[],processedEvidenceRefs:[],forgetTombstones:[],rejectedSensitiveCount:0,rejectedMalformedCount:0};
 snapshot(){return clone(this.state);}
 restore(raw?:Partial<UserModelState>|UserModelStateV1|null){
  const version=ownData(raw,'version');
  if(version!==1&&version!==2){this.reset();return;}
  // A v2 snapshot must preserve every deletion boundary. Oversize, sparse,
  // accessor-backed or malformed tombstone arrays invalidate the whole snapshot.
  const rawTombstones=version===2?ownData(raw,'forgetTombstones'):[];
  const tombstoneRows=version===2?strictOwnArray(rawTombstones,MAX_FORGET_TOMBSTONES):[];
  if(!tombstoneRows){this.reset();return;}
  const tombstones=tombstoneRows.map(row=>this.cleanTombstone(row));
  if(tombstones.some(row=>row===null)){this.reset();return;}
  const validTombstones=tombstones as UserModelForgetTombstone[];
  const latestByKey=new Map<string,UserModelForgetTombstone>();
  for(const tombstone of validTombstones){
   const id=this.tombstoneId(tombstone.key,tombstone.domain);
   const previous=latestByKey.get(id);
   if(!previous||tombstone.forgottenAtTick>previous.forgottenAtTick)latestByKey.set(id,tombstone);
  }
  const canonicalTombstones=[...latestByKey.values()];
  const claims=boundedOwnArray(ownData(raw,'claims'),128).map(x=>this.cleanClaim(x)).filter((x):x is UserModelClaim=>!!x)
   .filter(claim=>!this.isAtOrBeforeTombstone(claim.key,claim.domain,claim.lastSeenTick,canonicalTombstones));
  const candidates=boundedOwnArray(ownData(raw,'candidates'),128).map(x=>this.cleanCandidate(x)).filter((x):x is UserModelCandidate=>!!x)
   .filter(candidate=>!this.isAtOrBeforeTombstone(candidate.key,candidate.domain,candidate.lastSeenTick,canonicalTombstones));
  const refs=boundedOwnArray(ownData(raw,'processedEvidenceRefs'),512)
   .filter((x):x is string=>typeof x==='string').map(x=>boundedText(x,180)).filter(Boolean);
  const sensitive=ownData(raw,'rejectedSensitiveCount');
  const malformed=ownData(raw,'rejectedMalformedCount');
  this.state={version:2,claims,candidates,processedEvidenceRefs:[...new Set([...refs,...claims.map(claim=>claim.evidenceRef),...canonicalTombstones.map(item=>item.evidenceRef)])].slice(-512),
   forgetTombstones:canonicalTombstones,
   rejectedSensitiveCount:Number.isSafeInteger(sensitive)?Math.max(0,sensitive as number):0,
   rejectedMalformedCount:Number.isSafeInteger(malformed)?Math.max(0,malformed as number):0};
 }
 recordExplicit(i:{key:string;domain:UserModelDomain;value:string;tick:number;evidenceRef:string;explicit:boolean;sensitivity:'low-risk'|'sensitive'|'unknown'}):UserModelResult{
  if(i.sensitivity!=='low-risk'){this.state.rejectedSensitiveCount++;return{accepted:false,reason:'sensitive-or-unclassified'};}
  const key=normalizeKey(i.key),value=boundedText(i.value,120),ref=boundedText(i.evidenceRef,180);
  if(!i.explicit||!key||!value||!isDomain(i.domain)||!validTick(i.tick)){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'};}
  if(!ref)return{accepted:false,reason:'missing-evidence'};
  if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'};
  if(this.isForgotten(key,i.domain,i.tick))return{accepted:false,reason:'forgotten-before-event'};
  this.remember(ref);
  const old=this.state.claims.find(c=>c.key===key&&c.domain===i.domain);
  if(old&&old.value!==value){old.status='disputed';old.contradictions++;old.lastSeenTick=i.tick;return{accepted:true,status:'disputed',claim:clone(old)};}
  if(old){old.confirmations++;old.lastSeenTick=i.tick;if(old.status==='disputed')return{accepted:true,status:'disputed',claim:clone(old)};return{accepted:true,status:old.status,claim:clone(old)};}
  const claim:UserModelClaim={key,domain:i.domain,value,status:'confirmed',source:'user-explicit',evidenceRef:ref,firstSeenTick:i.tick,lastSeenTick:i.tick,confirmations:1,contradictions:0};
  this.state.claims=[...this.state.claims,claim].slice(-128);
  this.state.candidates=this.state.candidates.filter(c=>!(c.key===key&&c.domain===i.domain));
  return{accepted:true,status:claim.status,claim:clone(claim)};
 }
 observeBehavior(i:{key:string;domain:UserModelDomain;value:string;tick:number;observationRef:string;sensitivity:'low-risk'|'sensitive'|'unknown'}){
  if(i.sensitivity!=='low-risk'){this.state.rejectedSensitiveCount++;return{accepted:false,reason:'sensitive-or-unclassified'};}
  const key=normalizeKey(i.key),value=boundedText(i.value,120),ref=boundedText(i.observationRef,180);
  if(!key||!value||!isDomain(i.domain)||!validTick(i.tick)||!ref){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'};}
  if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'};
  if(this.isForgotten(key,i.domain,i.tick))return{accepted:false,reason:'forgotten-before-event'};
  this.remember(ref);
  const confirmed=this.state.claims.find(c=>c.key===key&&c.domain===i.domain&&c.status==='confirmed');
  if(confirmed)return{accepted:true};
  let c=this.state.candidates.find(x=>x.key===key&&x.domain===i.domain&&x.value===value);
  if(!c){c={key,domain:i.domain,value,observations:0,firstSeenTick:i.tick,lastSeenTick:i.tick,confidence01:0,status:'unconfirmed-candidate'};this.state.candidates=[...this.state.candidates,c].slice(-128);}
  c.observations=Math.min(1000,c.observations+1);c.lastSeenTick=i.tick;c.confidence01=clamp01(1-Math.exp(-c.observations/5))*.65;
  return{accepted:true,candidate:clone(c)};
 }
 correctExplicit(i:{key:string;domain:UserModelDomain;value:string;tick:number;evidenceRef:string;explicit:boolean;sensitivity:'low-risk'|'sensitive'|'unknown'}):UserModelResult{
  if(i.sensitivity!=='low-risk'){this.state.rejectedSensitiveCount++;return{accepted:false,reason:'sensitive-or-unclassified'};}
  const key=normalizeKey(i.key),value=boundedText(i.value,120),ref=boundedText(i.evidenceRef,180);
  if(!i.explicit||!key||!value||!isDomain(i.domain)||!validTick(i.tick)){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'};}
  if(!ref)return{accepted:false,reason:'missing-evidence'};
  if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'};
  if(this.isForgotten(key,i.domain,i.tick))return{accepted:false,reason:'forgotten-before-event'};
  const c=this.state.claims.find(x=>x.key===key&&x.domain===i.domain);
  if(!c)return this.recordExplicit(i);
  this.remember(ref);
  c.value=value;c.status='confirmed';c.evidenceRef=ref;c.lastSeenTick=i.tick;c.confirmations++;c.contradictions=0;
  return{accepted:true,status:c.status,claim:clone(c)};
 }
 /**
  * Forget one explicitly confirmed low-risk preference.
  * The persisted tombstone retains only the key/domain, source-event watermark and evidence reference;
  * the value and matching behavioral candidates are removed from the decision state.
  * `tick` must be the immutable source-event tick, not the time a replay/import was processed.
  */
 forgetExplicit(i:{key:string;domain:UserModelDomain;tick:number;evidenceRef:string;explicit:boolean}):
  | {accepted:true;removed:boolean;key:string;domain:UserModelDomain}
  | {accepted:false;reason:'invalid-input'|'missing-evidence'|'duplicate-evidence'|'tombstone-capacity-exhausted'} {
  const key=normalizeKey(i.key),ref=boundedText(i.evidenceRef,180);
  if(!i.explicit||!key||!isDomain(i.domain)||!validTick(i.tick)){
   this.state.rejectedMalformedCount++;
   return{accepted:false,reason:'invalid-input'};
  }
  if(!ref)return{accepted:false,reason:'missing-evidence'};
  if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'};
  const tombstoneId=this.tombstoneId(key,i.domain);
  const existing=this.state.forgetTombstones.find(item=>this.tombstoneId(item.key,item.domain)===tombstoneId);
  if(existing&&i.tick<existing.forgottenAtTick)return{accepted:false,reason:'invalid-input'};
  if(!existing&&this.state.forgetTombstones.length>=MAX_FORGET_TOMBSTONES)return{accepted:false,reason:'tombstone-capacity-exhausted'};
  this.remember(ref);
  const claimsBefore=this.state.claims.length;
  const candidatesBefore=this.state.candidates.length;
  this.state.claims=this.state.claims.filter(claim=>!(claim.key===key&&claim.domain===i.domain));
  this.state.candidates=this.state.candidates.filter(candidate=>!(candidate.key===key&&candidate.domain===i.domain));
  this.state.forgetTombstones=this.state.forgetTombstones.filter(item=>this.tombstoneId(item.key,item.domain)!==tombstoneId);
  this.state.forgetTombstones=[...this.state.forgetTombstones,{key,domain:i.domain,forgottenAtTick:i.tick,evidenceRef:ref}];
  return{accepted:true,removed:claimsBefore!==this.state.claims.length||candidatesBefore!==this.state.candidates.length,key,domain:i.domain};
 }
 /** Read-only decision view: disputed claims are excluded from confirmed facts. */
 decisionContext(){
  return{
   confirmedClaims:this.state.claims.filter(c=>c.status==='confirmed').map(c=>({key:c.key,domain:c.domain,value:c.value,evidenceRef:c.evidenceRef})),
   disputedClaims:this.state.claims.filter(c=>c.status==='disputed').map(c=>({key:c.key,domain:c.domain})),
   hypotheses:this.state.candidates.map(c=>({key:c.key,domain:c.domain,value:c.value,confidence01:c.confidence01,status:c.status})),
  };
 }
 confirmedValue(key:string,domain:UserModelDomain):string|null{
  const normalized=normalizeKey(key);
  const claim=this.state.claims.find(c=>c.key===normalized&&c.domain===domain&&c.status==='confirmed');
  return claim?.value??null;
 }
 private reset(){this.state={version:2,claims:[],candidates:[],processedEvidenceRefs:[],forgetTombstones:[],rejectedSensitiveCount:0,rejectedMalformedCount:0};}
 private tombstoneId(key:string,domain:UserModelDomain){return key+'\\u0000'+domain;}
 private isForgotten(key:string,domain:UserModelDomain,tick:number){return this.isAtOrBeforeTombstone(key,domain,tick,this.state.forgetTombstones);}
 private isAtOrBeforeTombstone(key:string,domain:UserModelDomain,tick:number,tombstones:UserModelForgetTombstone[]){const tombstone=tombstones.find(item=>item.key===key&&item.domain===domain);return!!tombstone&&tick<=tombstone.forgottenAtTick;}
 private cleanTombstone(raw:unknown):UserModelForgetTombstone|null{
  try {
   const key=normalizeKey(ownData(raw,'key')),domain=ownData(raw,'domain'),forgottenAtTick=ownData(raw,'forgottenAtTick'),evidenceRef=boundedText(ownData(raw,'evidenceRef'),180);
   if(!key||!isDomain(domain)||!validTick(forgottenAtTick as number)||!evidenceRef)return null;
   return{key,domain,forgottenAtTick:forgottenAtTick as number,evidenceRef};
  } catch { return null; }
 }
 private remember(ref:string){this.state.processedEvidenceRefs=[...this.state.processedEvidenceRefs,ref].slice(-512);}
 private cleanClaim(r:any):UserModelClaim|null{
  const key=normalizeKey(ownData(r,'key')),value=boundedText(ownData(r,'value'),120),ref=boundedText(ownData(r,'evidenceRef'),180);
  const domain=ownData(r,'domain'),firstSeenTick=ownData(r,'firstSeenTick'),lastSeenTick=ownData(r,'lastSeenTick');
  const status=ownData(r,'status'),confirmations=ownData(r,'confirmations'),contradictions=ownData(r,'contradictions');
  if(!key||!value||!isDomain(domain)||!validTick(firstSeenTick as number)||!validTick(lastSeenTick as number)||(firstSeenTick as number)>(lastSeenTick as number)||!ref||(status!=='confirmed'&&status!=='disputed'))return null;
  return{key,domain,value,status:status as UserModelClaimStatus,source:'user-explicit',evidenceRef:ref,firstSeenTick:firstSeenTick as number,lastSeenTick:lastSeenTick as number,confirmations:Number.isSafeInteger(confirmations)?Math.max(1,Math.min(1000,confirmations as number)):1,contradictions:Number.isSafeInteger(contradictions)?Math.max(0,Math.min(1000,contradictions as number)):0};
 }
 private cleanCandidate(r:any):UserModelCandidate|null{
  const key=normalizeKey(ownData(r,'key')),value=boundedText(ownData(r,'value'),120);
  const domain=ownData(r,'domain'),firstSeenTick=ownData(r,'firstSeenTick'),lastSeenTick=ownData(r,'lastSeenTick');
  const rawObservations=ownData(r,'observations'),rawConfidence=ownData(r,'confidence01');
  if(!key||!value||!isDomain(domain)||!validTick(firstSeenTick as number)||!validTick(lastSeenTick as number)||(firstSeenTick as number)>(lastSeenTick as number))return null;
  const observations=Number.isSafeInteger(rawObservations)?Math.max(1,Math.min(1000,rawObservations as number)):1;
  return{key,domain,value,observations,firstSeenTick:firstSeenTick as number,lastSeenTick:lastSeenTick as number,confidence01:Math.min(.65,clamp01(rawConfidence as number)),status:'unconfirmed-candidate'};
 }
}
