import { createHash } from 'node:crypto';
import type { WillIntegrationBridge } from './WillIntegrationBridge.ts';

export interface WillSdkHost {
  step(message?:string, options?:{deliberate?:boolean}):Promise<any>;
  snapshot():any;
  flush():Promise<void>;
}
export interface WillStimulus { text:string; from?:string; provenance?:'exafferent'|'reafferent'|'unknown'; thread?:string; correlationId?:string; }

export interface WillSdkBridgeApi {
  enqueue(input:Parameters<WillIntegrationBridge['enqueue']>[0]):ReturnType<WillIntegrationBridge['enqueue']>;
  ack(input:Parameters<WillIntegrationBridge['ack']>[0]):ReturnType<WillIntegrationBridge['ack']>;
  searchText(text:string,k?:number):unknown;
  benchmarkVectorIndex(queries?:string[],k?:number,efSearch?:number):unknown;
  diagnostics():unknown;
}

export class WillSdkFacade {
  private readonly host:WillSdkHost;
  private readonly bridge:WillSdkBridgeApi;
  private readonly subjectId:string;
  constructor(host:WillSdkHost, bridge:WillSdkBridgeApi, subjectId='kurisu'){ this.host=host; this.bridge=bridge; this.subjectId=subjectId; }
  capabilities(){ return {name:'neuro-kurisu-will-sdk',version:'1.0.0',subjectId:this.subjectId,semantics:['sense','state','save','transport','vector-search','fidelity','record-integrity']}; }
  async sense(stimulus:WillStimulus){
    const id=stimulus.correlationId || `sdk:${createHash('sha256').update(JSON.stringify({subjectId:this.subjectId,from:stimulus.from??'user',text:stimulus.text,thread:stimulus.thread??null})).digest('hex').slice(0,24)}`;
    this.bridge.enqueue({id,type:'stimulus',source:stimulus.from??'user',payload:stimulus});
    const result=await this.host.step(stimulus.text,{deliberate:true});
    await this.host.flush();
    return result;
  }
  state(){ return this.host.snapshot(); }
  async save(){ const pma=(this.host as any).exportWillPma?.(); if(!pma) throw new Error('portable-pma-unavailable'); return pma; }
  validatePma(pma:unknown){ return (this.host as any).validateWillPma(pma); }
  enqueue(envelope:Parameters<WillIntegrationBridge['enqueue']>[0]){ return this.bridge.enqueue(envelope); }
  ack(ack:Parameters<WillIntegrationBridge['ack']>[0]){ return this.bridge.ack(ack); }
  vectorSearch(text:string,k=5){ return this.bridge.searchText(text,k); }
  vectorBenchmark(queries:string[]=[],k=5,efSearch=32){ return this.bridge.benchmarkVectorIndex(queries,k,efSearch); }
  diagnostics(){ return this.bridge.diagnostics(); }
}
