import { EvidenceFirewallEngine } from './EvidenceFirewall.ts';
import type {
  ParliamentEvidenceReference, ParliamentModelAttestation, ParliamentTrustPort,
  ParliamentTrustSession, ParliamentVerifiedEvidence,
} from './CognitiveParliament.ts';

export type ParliamentModelAttestor=(executionId:string)=>ParliamentModelAttestation|null;

/**
 * Host-side trust adapter. Evidence is accepted only when its exact immutable
 * canonical firewall observation belongs to a promoted claim and appears in
 * that claim's promotion receipt. Source lineage is collapsed across syndicated
 * publisher copies. Model identity is accepted only from a host attestor.
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
    // Rebuild the same conservative source↔lineage connected components used by
    // EvidenceFirewall. Different publisher domains tied to one story/document/hash
    // must not become separate independent sources for a parliament decision.
    const graph=new Map<string,Set<string>>();
    const connect=(left:string,right:string)=>{
      const a=graph.get(left)??new Set<string>();a.add(right);graph.set(left,a);
      const b=graph.get(right)??new Set<string>();b.add(left);graph.set(right,b);
    };
    const activeExternal=snapshot.observations.filter(row=>
      row.sourceClass==='external-api'&&Date.now()-row.observedAt<=30*24*60*60*1000);
    for(const row of activeExternal){
      const source=`source:${row.sourceKey}`;
      const lineage=`lineage:${row.sourceLineageKey||(row.documentKey?`doc:${row.documentKey}`:row.contentHash?`hash:${row.contentHash}`:`observation:${row.id}`)}`;
      connect(source,lineage);
    }
    const sourceFamilyBySource=new Map<string,string>();
    const visited=new Set<string>();
    for(const node of graph.keys()){
      if(visited.has(node))continue;
      const stack=[node],component:string[]=[];
      visited.add(node);
      while(stack.length){
        const current=stack.pop()!;component.push(current);
        for(const next of graph.get(current)??[])if(!visited.has(next)){visited.add(next);stack.push(next);}
      }
      const sourceNodes=component.filter(value=>value.startsWith('source:')).sort();
      const family=`external-api:${sourceNodes.join('|')}`;
      for(const sourceNode of sourceNodes)sourceFamilyBySource.set(sourceNode,family);
    }
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
        const sourceFamily=observation.sourceClass==='external-api'
          ?(sourceFamilyBySource.get(`source:${observation.sourceKey}`)||`external-api:${observation.sourceKey}`)
          :sourceIdentity;
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
