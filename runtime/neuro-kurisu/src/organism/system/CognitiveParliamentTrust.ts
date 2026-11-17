import { EvidenceFirewallEngine } from './EvidenceFirewall.ts';
import type {
  ParliamentEvidenceReference, ParliamentModelAttestation, ParliamentTrustPort,
  ParliamentTrustSession, ParliamentVerifiedEvidence,
} from './CognitiveParliament.ts';

export type ParliamentModelAttestor=(executionId:string)=>ParliamentModelAttestation|null;

/**
 * Host-side trust adapter. Evidence is accepted only when its exact immutable
 * firewall observation belongs to a promoted claim and appears in that claim's
 * promotion receipt. Model identity is accepted only from a host attestor.
 */
export class EvidenceFirewallParliamentTrustPort implements ParliamentTrustPort {
  constructor(
    private readonly firewall:EvidenceFirewallEngine,
    private readonly modelAttestor?:ParliamentModelAttestor,
  ) {}

  openSession():ParliamentTrustSession {
    const snapshot=this.firewall.snapshot();
    const observations=new Map(snapshot.observations.map(row=>[row.id,row] as const));
    const claims=new Map(snapshot.claims.map(row=>[row.claimKey,row] as const));
    const modelCache=new Map<string,ParliamentModelAttestation|null>();
    return {
      verifyEvidence:(reference:ParliamentEvidenceReference):ParliamentVerifiedEvidence|null=>{
        const observation=observations.get(reference.id);
        const claim=claims.get(reference.claimKey);
        if(!observation||!claim||observation.claimKey!==reference.claimKey||claim.status!=='promoted')return null;
        const receipt=claim.promotionReceipt;
        if(!receipt||receipt.policyVersion!=='firewall-v1'||!Number.isFinite(receipt.promotedAt)||
          receipt.promotedAt<=0||receipt.promotedAt>Date.now()+5*60*1000)return null;
        if(!['os','device','user','external-api','world'].includes(observation.sourceClass))return null;
        const sourceIdentity=`${observation.sourceClass}:${observation.sourceKey}`;
        if(!receipt.independentSources.includes(sourceIdentity))return null;
        const sourceFamily=observation.sourceLineageKey?.trim()||sourceIdentity;
        if(!sourceIdentity||!sourceFamily||!Number.isFinite(observation.confidence01)||
          !Number.isFinite(observation.trust01)||!Number.isFinite(observation.observedAt)||
          observation.observedAt<=0)return null;
        return {
          id:observation.id,claimKey:observation.claimKey,sourceIdentity,sourceFamily,
          sourceClass:observation.sourceClass as ParliamentVerifiedEvidence['sourceClass'],
          confidence01:Math.max(0,Math.min(1,observation.confidence01)),
          trust01:Math.max(0,Math.min(1,observation.trust01)),
          promotionScore01:Math.max(0,Math.min(1,claim.promotionScore01)),
          observedAt:observation.observedAt,
        };
      },
      verifyModelExecution:(executionId:string):ParliamentModelAttestation|null=>{
        if(!this.modelAttestor)return null;
        if(!modelCache.has(executionId)){
          try{modelCache.set(executionId,this.modelAttestor(executionId));}
          catch{modelCache.set(executionId,null);}
        }
        return modelCache.get(executionId)??null;
      },
    };
  }
}
