import type { ActionKind } from '../core/types.ts';
import { randomUUID } from 'node:crypto';
import { OutcomeVerificationService, type OutcomeVerification, type OutcomeVerifier } from './OutcomeVerificationService.ts';

export interface ActionAuditRecord { at:number; executionId?:string; action:ActionKind|'tool'; tool?:string; accepted:boolean; mode:'dry-run'|'live'; reason:string; verified?:boolean; verificationBasis?:'none'|'tool-contract'|'external-postcondition'; verificationConfidence01?:number; observationId?:string; result?:string; }
export interface ActionGatewayConfig { live?:boolean; allow?:ActionKind[]; }
export interface ToolDefinition { id:string; capability:string; destructive:boolean; projectAllowed?:boolean; execute:(input:Record<string,unknown>)=>Promise<Record<string,unknown>>; verify?:OutcomeVerifier; }
export interface ToolExecution { ok:boolean; verified:boolean; executionId:string; tool:string; capability:string; result:Record<string,unknown>; audit:ActionAuditRecord; verification:OutcomeVerification; }
const DEFAULT_ALLOWED:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
export class ActionGateway {
  private readonly live:boolean; private readonly allowed:Set<ActionKind>; private readonly tools=new Map<string,ToolDefinition>(); private history:ActionAuditRecord[]=[]; private readonly verifier=new OutcomeVerificationService();
  constructor(config:ActionGatewayConfig={}){this.live=Boolean(config.live);this.allowed=new Set(config.allow??DEFAULT_ALLOWED)}
  authorize(action:ActionKind,reason:string):ActionAuditRecord{const accepted=this.allowed.has(action);const rec={at:Date.now(),action,accepted,mode:this.live?'live' as const:'dry-run' as const,reason:reason.slice(0,240)};this.push(rec);return rec}
  registerTool(def:ToolDefinition){if(!/^[a-z0-9._-]{2,64}$/i.test(def.id)) throw new Error('invalid-tool-id');this.tools.set(def.id,def)}
  listTools(){return [...this.tools.values()].map(t=>({id:t.id,capability:t.capability,destructive:t.destructive,projectAllowed:Boolean(t.projectAllowed)}))}
  async executeTool(id:string,input:Record<string,unknown>={},reason='tool-request'):Promise<ToolExecution>{
    const executionId=`exec-${randomUUID()}`;
    const tool=this.tools.get(id); if(!tool){const audit=this.auditTool(id,false,'unknown-tool',false,'unknown',undefined,'none',undefined,executionId); return {ok:false,verified:false,executionId,tool:id,capability:'unknown',result:{error:'unknown-tool'},audit,verification:{verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'unknown tool'}}}
    if(tool.destructive&&!this.live){const audit=this.auditTool(id,false,'dry-run-destructive-block',false,tool.capability,undefined,'none',undefined,executionId);return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:'dry-run-destructive-block'},audit,verification:{verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'destructive tool blocked in dry-run'}}}
    if(tool.destructive&&this.live&&!tool.verify){const audit=this.auditTool(id,false,'live-destructive-verifier-required',false,tool.capability,undefined,'none',undefined,executionId);return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:'live-destructive-verifier-required'},audit,verification:{verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'live destructive tools require an independent postcondition verifier'}}}
    try{const result=await tool.execute(input);const ok=result?.ok!==false;const verification=await this.verifier.verify({toolId:id,input,result},tool.verify);const audit=this.auditTool(id,ok,reason,verification.verified,tool.capability,result,verification.basis,verification,executionId);return {ok,verified:verification.verified,executionId,tool:id,capability:tool.capability,result,audit,verification};}
    catch(error){const msg=String((error as any)?.message||error);const verification={verified:false,basis:'none' as const,confidence01:0,externalObservation:false,notes:'tool execution failed'};const audit=this.auditTool(id,false,msg,false,tool.capability,undefined,'none',verification,executionId);return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:msg},audit,verification}}
  }
  snapshot():ActionAuditRecord[]{return structuredClone(this.history)}
  private auditTool(tool:string,accepted:boolean,reason:string,verified:boolean,capability='unknown',result?:Record<string,unknown>,verificationBasis:ActionAuditRecord['verificationBasis']='none',verification?:OutcomeVerification,executionId?:string){const rec:ActionAuditRecord={at:Date.now(),executionId,action:'tool',tool,accepted,mode:this.live?'live':'dry-run',reason:reason.slice(0,240),verified,verificationBasis,verificationConfidence01:verification?.confidence01,observationId:verification?.observationId,result:result?JSON.stringify(result).slice(0,300):undefined};this.push(rec);return rec}
  private push(rec:ActionAuditRecord){this.history=[rec,...this.history].slice(0,512)}
}
