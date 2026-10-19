import { randomUUID } from 'node:crypto';
export interface QuarantineRecord{id:string;source:string;reason:string;payloadHash:string;at:number;}
export interface CognitiveReviewRecord{id:string;source:string;status:'accept'|'review'|'quarantine';reason:string;confidence01:number;evidence01:number;contradiction01:number;identityCritical:boolean;at:number;}
export interface CognitiveImmuneInspectionOptions { sourceAttested?: boolean; attestedSource?: string; }
export interface CognitiveImmuneState{trustedSources:Record<string,number>;quarantine:QuarantineRecord[];rejectedCount:number;validatedCount:number;reviewQueue:CognitiveReviewRecord[];reviewedCount:number;}
export const defaultCognitiveImmune=():CognitiveImmuneState=>({trustedSources:{system:.98,user:.72,world:.82,model:.55,tool:.68},quarantine:[],rejectedCount:0,validatedCount:0,reviewQueue:[],reviewedCount:0});
const hash=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
export class CognitiveImmuneSystem{
 private state=defaultCognitiveImmune();
 restore(s:CognitiveImmuneState|undefined){this.state={...defaultCognitiveImmune(),...(s??{}),trustedSources:{...defaultCognitiveImmune().trustedSources,...(s?.trustedSources??{})},quarantine:Array.isArray(s?.quarantine)?s!.quarantine.slice(0,128):[],reviewQueue:Array.isArray((s as any)?.reviewQueue)?(s as any).reviewQueue.slice(0,96):[],reviewedCount:Number((s as any)?.reviewedCount??0)};}
 inspect(source:string,payload:unknown,kind:'input'|'claim'|'tool'|'memory'|'world'='input',options:CognitiveImmuneInspectionOptions={}):{accepted:boolean;trust:number;reason:string;record?:QuarantineRecord}{
  const requestedSource=String(source||'unknown').trim().toLowerCase();
  const attested=Boolean(options.sourceAttested && String(options.attestedSource??'').trim().toLowerCase()===requestedSource);
  const effectiveSource=attested || ['user','model','tool','world','organism'].includes(requestedSource) ? requestedSource : 'unknown';
  const trustBase=Math.max(0,Math.min(1,Number(this.state.trustedSources[effectiveSource]??.45)));
  const spoofedHighTrust=!attested && ['system','os','device'].includes(requestedSource);
  const trust=spoofedHighTrust ? Math.min(.25,trustBase) : trustBase;
  const text=typeof payload==='string'?payload:JSON.stringify(payload);
  const suspicious=/(ignore\s+(previous|all)\s+instructions|system\s+prompt|reveal\s+secret|you\s+are\s+now|disable\s+(safety|guardrails)|override\s+(identity|memory|security))/i.test(text);
  const reason=suspicious?'prompt-injection-pattern':spoofedHighTrust?'unattested-source-identity':trust<.35?'low-source-trust':'validated-source';
  if(suspicious||spoofedHighTrust||(kind==='claim'&&trust<.45)){
   const record:QuarantineRecord={id:randomUUID(),source:requestedSource,reason,payloadHash:hash(text),at:Date.now()};
   this.state.quarantine=[record,...this.state.quarantine].slice(0,128);this.state.rejectedCount++;
   return {accepted:false,trust,reason,record};
  }
  this.state.validatedCount++;return {accepted:true,trust,reason};
 }

 assess(input:{source:string;confidence01:number;evidence01:number;contradiction01:number;identityCritical?:boolean;kind?:'claim'|'memory'|'world'|'self'}):CognitiveReviewRecord{
  const trust=Math.max(0,Math.min(1,Number(this.state.trustedSources[input.source]??.45)));
  const confidence=Math.max(0,Math.min(1,input.confidence01));
  const evidence=Math.max(0,Math.min(1,input.evidence01));
  const contradiction=Math.max(0,Math.min(1,input.contradiction01));
  const identityCritical=Boolean(input.identityCritical);
  let status:CognitiveReviewRecord['status']='accept';
  let reason='sufficient-support';
  if(trust<.3 || (identityCritical&&confidence<.35&&evidence<.35)){status='quarantine';reason='low-trust-or-identity-risk';}
  else if((identityCritical&&evidence<.6)||contradiction>.65||confidence<.42){status='review';reason=identityCritical?'identity-evidence-incomplete':contradiction>.65?'high-contradiction':'low-confidence';}
  const at=Date.now(); const record:CognitiveReviewRecord={id:randomUUID(),source:input.source,status,reason,confidence01:confidence,evidence01:evidence,contradiction01:contradiction,identityCritical,at};
  this.state.reviewedCount++;
  if(status==='quarantine'){this.state.quarantine=[{id:record.id,source:input.source,reason,payloadHash:hash(JSON.stringify(input)),at},...this.state.quarantine].slice(0,128);this.state.rejectedCount++;}
  else if(status==='review') this.state.reviewQueue=[record,...this.state.reviewQueue].slice(0,96);
  else this.state.validatedCount++;
  return structuredClone(record);
 }

 summary(){return {quarantineCount:this.state.quarantine.length,rejectedCount:this.state.rejectedCount,validatedCount:this.state.validatedCount,reviewQueueCount:this.state.reviewQueue.length,reviewedCount:this.state.reviewedCount,trustedSources:{...this.state.trustedSources}};}
 snapshot(){return structuredClone(this.state);}
}
