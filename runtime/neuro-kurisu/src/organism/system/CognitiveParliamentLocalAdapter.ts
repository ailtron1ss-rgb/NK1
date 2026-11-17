import { randomUUID } from 'node:crypto';
import type {
  ParliamentModelAttestation, ParliamentRoleExecutionRequest, ParliamentRoleExecutionResult,
  ParliamentRoleExecutor,
} from './CognitiveParliamentDispatcher.ts';

export interface ParliamentLocalChatProvider {
  readonly model:string;
  configured():boolean;
  generate(request:{system:string;user:string;maxTokens?:number;temperature?:number;signal?:AbortSignal}):Promise<{text:string}>;
}
export interface ParliamentModelIdentity { providerId:string; modelId:string; independenceGroup:string; }

/** Host-owned short-lived execution registry. The model never supplies identity fields. */
export class ParliamentModelAttestationRegistry {
  private readonly records=new Map<string,ParliamentModelAttestation>();
  register(attestation:ParliamentModelAttestation):void{
    if(!attestation||typeof attestation.executionId!=='string'||!attestation.executionId.trim()||
      typeof attestation.providerId!=='string'||!attestation.providerId.trim()||
      typeof attestation.modelId!=='string'||!attestation.modelId.trim()||
      typeof attestation.independenceGroup!=='string'||!attestation.independenceGroup.trim()||
      !Number.isFinite(attestation.verifiedAt))throw new Error('parliament-model-attestation-invalid');
    this.prune();
    if(this.records.has(attestation.executionId))throw new Error('parliament-model-execution-id-reused');
    if(this.records.size>=2048){
      const oldest=[...this.records.values()].sort((a,b)=>a.verifiedAt-b.verifiedAt)[0];
      if(oldest)this.records.delete(oldest.executionId);
    }
    this.records.set(attestation.executionId,Object.freeze({...attestation}));
  }
  attest(executionId:string):ParliamentModelAttestation|null{
    this.prune();const value=this.records.get(executionId);return value?{...value}:null;
  }
  private prune():void{
    const cutoff=Date.now()-30*60*1000;
    for(const [key,value] of this.records)if(value.verifiedAt<cutoff)this.records.delete(key);
  }
}

/** Local OpenAI-compatible model adapter; identity is taken from host config only. */
export class OpenAICompatibleLocalParliamentRoleExecutor implements ParliamentRoleExecutor {
  private readonly provider:ParliamentLocalChatProvider;
  private readonly identity:ParliamentModelIdentity;
  private readonly registry:ParliamentModelAttestationRegistry;
  constructor(provider:ParliamentLocalChatProvider,identity:ParliamentModelIdentity,registry:ParliamentModelAttestationRegistry){
    if(!provider||typeof provider.configured!=='function'||typeof provider.generate!=='function'||
      !provider.model||!identity||!identity.providerId?.trim()||!identity.modelId?.trim()||
      !identity.independenceGroup?.trim()||!registry)throw new Error('parliament-local-executor-config-invalid');
    if(identity.modelId!==provider.model)throw new Error('parliament-local-executor-model-identity-mismatch');
    this.provider=provider;this.identity={...identity};this.registry=registry;
  }
  async execute(request:ParliamentRoleExecutionRequest):Promise<ParliamentRoleExecutionResult>{
    if(!this.provider.configured())throw new Error('parliament-local-model-not-configured');
    if(request.signal.aborted)throw new Error('parliament-local-execution-aborted');
    const executionId=randomUUID();
    const response=await this.provider.generate({
      system:request.system,user:request.user,maxTokens:request.maxTokens,
      temperature:request.temperature,signal:request.signal,
    });
    if(!response||typeof response.text!=='string'||!response.text.trim()||response.text.length>65_536)
      throw new Error('parliament-local-model-response-invalid');
    this.registry.register({
      executionId,providerId:this.identity.providerId,modelId:this.identity.modelId,
      independenceGroup:this.identity.independenceGroup,verifiedAt:Date.now(),
    });
    return {executionId,text:response.text};
  }
}
