/** Evidence-bounded user model: explicit low-risk facts only; behavior stays hypothetical. */
export type UserModelDomain='interaction-style'|'content-preference'|'accessibility-preference'|'explicit-boundary';
export type UserModelClaimStatus='confirmed'|'needs-confirmation'|'disputed';
export interface UserModelClaim{key:string;domain:UserModelDomain;value:string;status:UserModelClaimStatus;source:'user-explicit';evidenceRef:string;firstSeenTick:number;lastSeenTick:number;confirmations:number;contradictions:number}
export interface UserModelCandidate{key:string;domain:UserModelDomain;value:string;observations:number;firstSeenTick:number;lastSeenTick:number;confidence01:number;status:'unconfirmed-candidate'}
export interface UserModelForgetTombstone{key:string;domain:UserModelDomain;forgottenAtTick:number;evidenceRef:string}
export interface UserModelState{version:2;claims:UserModelClaim[];candidates:UserModelCandidate[];processedEvidenceRefs:string[];forgetTombstones:UserModelForgetTombstone[];rejectedSensitiveCount:number;rejectedMalformedCount:number}
export type UserModelResult={accepted:true;status:UserModelClaimStatus;claim:UserModelClaim}|{accepted:false;reason:'sensitive-or-unclassified'|'invalid-input'|'missing-evidence'|'duplicate-evidence'|'forgotten-before-event'};
const DOMAINS:readonly UserModelDomain[]=['interaction-style','content-preference','accessibility-preference','explicit-boundary'];
const MAX_TOMBSTONES=256,clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const boundedText=(v:unknown,max:number)=>typeof v==='string'?v.normalize('NFKC').replace(/[\\u0000-\\u001f\\u007f]/g,'').trim().slice(0,max):'';
const validTick=(n:number)=>Number.isSafeInteger(n)&&n>=0,clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const normalizeKey=(v:unknown)=>boundedText(v,64).toLowerCase().replace(/[^a-z0-9._:-]/g,'-').replace(/-+/g,'-');
const isDomain=(v:unknown):v is UserModelDomain=>typeof v==='string'&&DOMAINS.includes(v as UserModelDomain);
const ownData=(v:unknown,k:string):unknown=>{if(!v||typeof v!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.prototype.hasOwnProperty.call(d,'value')?d.value:undefined};
const boundedOwnArray=(v:unknown,max:number):unknown[]=>{if(!Array.isArray(v))return[];const n=ownData(v,'length');if(!Number.isSafeInteger(n)||Number(n)<0)return[];const out:unknown[]=[];for(let i=Math.max(0,Number(n)-max);i<Number(n);i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(d&&Object.prototype.hasOwnProperty.call(d,'value'))out.push(d.value)}return out};
export class UserModelEvidenceModel{
 private state:UserModelState={version:2,claims:[],candidates:[],processedEvidenceRefs:[],forgetTombstones:[],rejectedSensitiveCount:0,rejectedMalformedCount:0};
 snapshot(){return clone(this.state)}
 restore(raw?:Partial<UserModelState>|null){
  const version=ownData(raw,'version');if(version!==1&&version!==2){this.reset();return}
  const claims=boundedOwnArray(ownData(raw,'claims'),128).map(x=>this.cleanClaim(x)).filter((x):x is UserModelClaim=>!!x);
  const candidates=boundedOwnArray(ownData(raw,'candidates'),128).map(x=>this.cleanCandidate(x)).filter((x):x is UserModelCandidate=>!!x);
  const refs=boundedOwnArray(ownData(raw,'processedEvidenceRefs'),512).filter((x):x is string=>typeof x==='string').map(x=>boundedText(x,180)).filter(Boolean);
  const rawTombs=version===2?ownData(raw,'forgetTombstones'):undefined;
  const tombs=version===2?boundedOwnArray(rawTombs,MAX_TOMBSTONES).map(x=>this.cleanTombstone(x)).filter((x):x is UserModelForgetTombstone=>!!x):[];
  const unique=new Map<string,UserModelForgetTombstone>();for(const t of tombs){const id=this.id(t.key,t.domain),old=unique.get(id);if(!old||t.forgottenAtTick>old.forgottenAtTick)unique.set(id,t)}
  const sensitive=ownData(raw,'rejectedSensitiveCount'),malformed=ownData(raw,'rejectedMalformedCount');
  this.state={version:2,claims,candidates,processedEvidenceRefs:[...new Set([...refs,...claims.map(c=>c.evidenceRef),...tombs.map(t=>t.evidenceRef)])].slice(-512),forgetTombstones:[...unique.values()],rejectedSensitiveCount:Number.isSafeInteger(sensitive)?Math.max(0,sensitive as number):0,rejectedMalformedCount:Number.isSafeInteger(malformed)?Math.max(0,malformed as number):0};
 }
 recordExplicit(i:{key:string;domain:UserModelDomain;value:string;tick:number;evidenceRef:string;explicit:boolean;sensitivity:'low-risk'|'sensitive'|'unknown'}):UserModelResult{
  if(i.sensitivity!=='low-risk'){this.state.rejectedSensitiveCount++;return{accepted:false,reason:'sensitive-or-unclassified'}}
  const key=normalizeKey(i.key),value=boundedText(i.value,120),ref=boundedText(i.evidenceRef,180);
  if(!i.explicit||!key||!value||!isDomain(i.domain)||!validTick(i.tick)){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'}}
  if(this.isForgotten(key,i.domain,i.tick))return{accepted:false,reason:'forgotten-before-event'}
  if(!ref)return{accepted:false,reason:'missing-evidence'};if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'};this.remember(ref);
  const old=this.state.claims.find(c=>c.key===key&&c.domain===i.domain);
  if(old&&old.value!==value){old.status='disputed';old.contradictions++;old.lastSeenTick=i.tick;return{accepted:true,status:'disputed',claim:clone(old)}}
  if(old){old.confirmations++;old.lastSeenTick=i.tick;return{accepted:true,status:old.status,claim:clone(old)}}
  const claim:UserModelClaim={key,domain:i.domain,value,status:'confirmed',source:'user-explicit',evidenceRef:ref,firstSeenTick:i.tick,lastSeenTick:i.tick,confirmations:1,contradictions:0};
  this.state.claims=[...this.state.claims,claim].slice(-128);this.state.candidates=this.state.candidates.filter(c=>!(c.key===key&&c.domain===i.domain));
  return{accepted:true,status:claim.status,claim:clone(claim)}
 }
 observeBehavior(i:{key:string;domain:UserModelDomain;value:string;tick:number;observationRef:string;sensitivity:'low-risk'|'sensitive'|'unknown'}){
  if(i.sensitivity!=='low-risk'){this.state.rejectedSensitiveCount++;return{accepted:false,reason:'sensitive-or-unclassified'}}
  const key=normalizeKey(i.key),value=boundedText(i.value,120),ref=boundedText(i.observationRef,180);
  if(!key||!value||!isDomain(i.domain)||!validTick(i.tick)||!ref){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'}}
  if(this.isForgotten(key,i.domain,i.tick))return{accepted:false,reason:'forgotten-before-event'}
  if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'};this.remember(ref);
  if(this.state.claims.some(c=>c.key===key&&c.domain===i.domain&&c.status==='confirmed'))return{accepted:true};
  let c=this.state.candidates.find(x=>x.key===key&&x.domain===i.domain&&x.value===value);
  if(!c){c={key,domain:i.domain,value,observations:0,firstSeenTick:i.tick,lastSeenTick:i.tick,confidence01:0,status:'unconfirmed-candidate'};this.state.candidates=[...this.state.candidates,c].slice(-128)}
  c.observations=Math.min(1000,c.observations+1);c.lastSeenTick=i.tick;c.confidence01=clamp01(1-Math.exp(-c.observations/5))*.65;return{accepted:true,candidate:clone(c)}
 }
 correctExplicit(i:{key:string;domain:UserModelDomain;value:string;tick:number;evidenceRef:string;explicit:boolean;sensitivity:'low-risk'|'sensitive'|'unknown'}):UserModelResult{
  if(i.sensitivity!=='low-risk'){this.state.rejectedSensitiveCount++;return{accepted:false,reason:'sensitive-or-unclassified'}}
  const key=normalizeKey(i.key),value=boundedText(i.value,120),ref=boundedText(i.evidenceRef,180);
  if(!i.explicit||!key||!value||!isDomain(i.domain)||!validTick(i.tick)){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'}}
  if(this.isForgotten(key,i.domain,i.tick))return{accepted:false,reason:'forgotten-before-event'}
  if(!ref)return{accepted:false,reason:'missing-evidence'};if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'}
  const c=this.state.claims.find(x=>x.key===key&&x.domain===i.domain);if(!c)return this.recordExplicit(i);
  this.remember(ref);c.value=value;c.status='confirmed';c.evidenceRef=ref;c.lastSeenTick=i.tick;c.confirmations++;c.contradictions=0;return{accepted:true,status:c.status,claim:clone(c)}
 }
 forgetExplicit(i:{key:string;domain:UserModelDomain;tick:number;evidenceRef:string;explicit:boolean}):
  |{accepted:true;removed:boolean;key:string;domain:UserModelDomain}
  |{accepted:false;reason:'invalid-input'|'missing-evidence'|'duplicate-evidence'|'tombstone-capacity-exhausted'}{
  const key=normalizeKey(i.key),ref=boundedText(i.evidenceRef,180);
  if(!i.explicit||!key||!isDomain(i.domain)||!validTick(i.tick)){this.state.rejectedMalformedCount++;return{accepted:false,reason:'invalid-input'}}
  if(!ref)return{accepted:false,reason:'missing-evidence'};if(this.state.processedEvidenceRefs.includes(ref))return{accepted:false,reason:'duplicate-evidence'}
  const id=this.id(key,i.domain),old=this.state.forgetTombstones.find(t=>this.id(t.key,t.domain)===id);
  if(!old&&this.state.forgetTombstones.length>=MAX_TOMBSTONES)return{accepted:false,reason:'tombstone-capacity-exhausted'}
  if(old&&i.tick<old.forgottenAtTick)return{accepted:false,reason:'invalid-input'}
  this.remember(ref);const before=this.state.claims.length+this.state.candidates.length;
  this.state.claims=this.state.claims.filter(c=>!(c.key===key&&c.domain===i.domain));this.state.candidates=this.state.candidates.filter(c=>!(c.key===key&&c.domain===i.domain));
  this.state.forgetTombstones=this.state.forgetTombstones.filter(t=>this.id(t.key,t.domain)!==id);
  this.state.forgetTombstones=[...this.state.forgetTombstones,{key,domain:i.domain,forgottenAtTick:i.tick,evidenceRef:ref}];
  return{accepted:true,removed:before!==this.state.claims.length+this.state.candidates.length,key,domain:i.domain}
 }
 decisionContext(){return{confirmedClaims:this.state.claims.filter(c=>c.status==='confirmed').map(c=>({key:c.key,domain:c.domain,value:c.value,evidenceRef:c.evidenceRef})),disputedClaims:this.state.claims.filter(c=>c.status==='disputed').map(c=>({key:c.key,domain:c.domain})),hypotheses:this.state.candidates.map(c=>({key:c.key,domain:c.domain,value:c.value,confidence01:c.confidence01,status:c.status}))}}
 confirmedValue(key:string,domain:UserModelDomain):string|null{const normalized=normalizeKey(key);return this.state.claims.find(c=>c.key===normalized&&c.domain===domain&&c.status==='confirmed')?.value??null}
 private reset(){this.state={version:2,claims:[],candidates:[],processedEvidenceRefs:[],forgetTombstones:[],rejectedSensitiveCount:0,rejectedMalformedCount:0}}
 private id(key:string,domain:UserModelDomain){return key+'\\u0000'+domain}
 private isForgotten(key:string,domain:UserModelDomain,tick:number){const t=this.state.forgetTombstones.find(x=>x.key===key&&x.domain===domain);return!!t&&tick<=t.forgottenAtTick}
 private remember(ref:string){this.state.processedEvidenceRefs=[...this.state.processedEvidenceRefs,ref].slice(-512)}
 private cleanTombstone(r:unknown):UserModelForgetTombstone|null{const key=normalizeKey(ownData(r,'key')),domain=ownData(r,'domain'),tick=ownData(r,'forgottenAtTick'),ref=boundedText(ownData(r,'evidenceRef'),180);return key&&isDomain(domain)&&validTick(tick as number)&&ref?{key,domain,forgottenAtTick:tick as number,evidenceRef:ref}:null}
 private cleanClaim(r:any):UserModelClaim|null{
  const key=normalizeKey(ownData(r,'key')),value=boundedText(ownData(r,'value'),120),ref=boundedText(ownData(r,'evidenceRef'),180),domain=ownData(r,'domain'),first=ownData(r,'firstSeenTick'),last=ownData(r,'lastSeenTick'),status=ownData(r,'status'),confirmations=ownData(r,'confirmations'),contradictions=ownData(r,'contradictions');
  if(!key||!value||!isDomain(domain)||!validTick(first as number)||!validTick(last as number)||(first as number)>(last as number)||!ref||(status!=='confirmed'&&status!=='disputed'))return null;
  return{key,domain,value,status:status as UserModelClaimStatus,source:'user-explicit',evidenceRef:ref,firstSeenTick:first as number,lastSeenTick:last as number,confirmations:Number.isSafeInteger(confirmations)?Math.max(1,Math.min(1000,confirmations as number)):1,contradictions:Number.isSafeInteger(contradictions)?Math.max(0,Math.min(1000,contradictions as number)):0}
 }
 private cleanCandidate(r:any):UserModelCandidate|null{
  const key=normalizeKey(ownData(r,'key')),value=boundedText(ownData(r,'value'),120),domain=ownData(r,'domain'),first=ownData(r,'firstSeenTick'),last=ownData(r,'lastSeenTick'),obs=ownData(r,'observations'),confidence=ownData(r,'confidence01');
  if(!key||!value||!isDomain(domain)||!validTick(first as number)||!validTick(last as number)||(first as number)>(last as number))return null;
  return{key,domain,value,observations:Number.isSafeInteger(obs)?Math.max(1,Math.min(1000,obs as number)):1,firstSeenTick:first as number,lastSeenTick:last as number,confidence01:Math.min(.65,clamp01(confidence as number)),status:'unconfirmed-candidate'}
 }
}
