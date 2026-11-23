import { randomUUID } from 'node:crypto';
import type { ParliamentModelAttestation, ParliamentRole } from './CognitiveParliament.ts';
import type {
  ParliamentRoleExecutionRequest, ParliamentRoleExecutionResult, ParliamentRoleExecutor, ParliamentRoleExecutorMap,
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
    const now=Date.now();
    if(!attestation||typeof attestation.executionId!=='string'||!attestation.executionId.trim()||attestation.executionId.length>256||
      typeof attestation.providerId!=='string'||!attestation.providerId.trim()||attestation.providerId.length>160||
      typeof attestation.modelId!=='string'||!attestation.modelId.trim()||attestation.modelId.length>200||
      typeof attestation.independenceGroup!=='string'||!attestation.independenceGroup.trim()||attestation.independenceGroup.length>160||
      !Number.isFinite(attestation.verifiedAt)||attestation.verifiedAt<now-30*60*1000||
      attestation.verifiedAt>now+5*60*1000)throw new Error('parliament-model-attestation-invalid');
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
      typeof provider.model!=='string'||!provider.model.trim()||provider.model.length>200||
      !identity||typeof identity.providerId!=='string'||!identity.providerId.trim()||identity.providerId.length>160||
      typeof identity.modelId!=='string'||!identity.modelId.trim()||identity.modelId.length>200||
      typeof identity.independenceGroup!=='string'||!identity.independenceGroup.trim()||identity.independenceGroup.length>160||
      !registry)throw new Error('parliament-local-executor-config-invalid');
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
    if(request.signal.aborted)throw new Error('parliament-local-execution-aborted');
    if(!response||typeof response.text!=='string'||!response.text.trim()||response.text.length>65_536)
      throw new Error('parliament-local-model-response-invalid');
    this.registry.register({
      executionId,providerId:this.identity.providerId,modelId:this.identity.modelId,
      independenceGroup:this.identity.independenceGroup,verifiedAt:Date.now(),
    });
    return {executionId,text:response.text};
  }
}

export interface ParliamentLocalProviderBinding {
  provider:ParliamentLocalChatProvider;
  identity:ParliamentModelIdentity;
}

/**
 * Build a role-specific executor map from host-configured local model profiles.
 * Independence groups are supplied by the host and are never inferred from model text.
 */
export function createLocalParliamentRoleExecutors(
  bindings:Partial<Record<ParliamentRole,ParliamentLocalProviderBinding>>,
  registry:ParliamentModelAttestationRegistry,
):ParliamentRoleExecutorMap {
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings)||!registry)
    throw new Error('parliament-local-provider-bindings-invalid');
  const roles:ParliamentRole[]=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
  const result:ParliamentRoleExecutorMap={};
  for(const key of Object.keys(bindings))if(!roles.includes(key as ParliamentRole))
    throw new Error('parliament-local-provider-role-unknown');
  for(const role of roles){
    const descriptor=Object.getOwnPropertyDescriptor(bindings,role);
    const binding=descriptor&&'value' in descriptor?descriptor.value:undefined;
    if(binding===undefined)continue;
    if(!binding||typeof binding!=='object'||Array.isArray(binding))
      throw new Error('parliament-local-provider-binding-invalid');
    result[role]=new OpenAICompatibleLocalParliamentRoleExecutor(binding.provider,binding.identity,registry);
  }
  return result;
}

export interface ParliamentLanguageInvoker {
  (request:{system:string;user:string;maxTokens?:number;temperature?:number;signal?:AbortSignal}):Promise<{
    text:string;backend:string;latencyMs?:number;
  }>;
}

/**
 * Adapter for the runtime's existing LanguageInvoker. Backend identity is read
 * from the host invoker response, never from model-generated content. All six
 * specialist roles share one conservative independence family in this mode.
 */
export class LanguageInvokerParliamentRoleExecutor implements ParliamentRoleExecutor {
  private readonly invoke:ParliamentLanguageInvoker;
  private readonly registry:ParliamentModelAttestationRegistry;
  constructor(invoke:ParliamentLanguageInvoker,registry:ParliamentModelAttestationRegistry){
    if(typeof invoke!=='function'||!registry)throw new Error('parliament-language-invoker-config-invalid');
    this.invoke=invoke;this.registry=registry;
  }
  async execute(request:ParliamentRoleExecutionRequest):Promise<ParliamentRoleExecutionResult>{
    if(request.signal.aborted)throw new Error('parliament-language-invoker-aborted');
    const response=await this.invoke({
      system:request.system,user:request.user,maxTokens:request.maxTokens,
      temperature:request.temperature,signal:request.signal,
    });
    if(request.signal.aborted)throw new Error('parliament-language-invoker-aborted');
    if(!response||typeof response.text!=='string'||!response.text.trim()||response.text.length>65_536||
      typeof response.backend!=='string'||!response.backend.trim()||response.backend.length>120)
      throw new Error('parliament-language-invoker-response-invalid');
    const executionId=randomUUID();
    const backend=response.backend.trim();
    this.registry.register({
      executionId,providerId:'language-invoker',modelId:backend,
      // A generic LanguageInvoker has no explicit independent-model manifest.
      // Keep every call in one family even if its backend label changes at runtime.
      independenceGroup:'language-invoker:shared-backend',verifiedAt:Date.now(),
    });
    return {executionId,text:response.text};
  }
}

/**
 * Six role-specific prompts over the host's existing language invoker.
 * This is a convenient single-family mode, not six independent models.
 */
export function createLanguageInvokerParliamentRoleExecutors(
  invoke:ParliamentLanguageInvoker,
  registry:ParliamentModelAttestationRegistry,
):ParliamentRoleExecutorMap {
  const executor=new LanguageInvokerParliamentRoleExecutor(invoke,registry);
  const roles:ParliamentRole[]=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
  return Object.fromEntries(roles.map(role=>[role,executor])) as ParliamentRoleExecutorMap;
}
