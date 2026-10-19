import type { WillSdkFacade } from './WillSdkFacade.ts';

export interface JsonRpcRequest { jsonrpc:'2.0'; id?:string|number|null; method:string; params?:Record<string,unknown>; }
export interface JsonRpcResponse { jsonrpc:'2.0'; id?:string|number|null; result?:unknown; error?:{code:number;message:string;data?:unknown}; }

export class WillMcpJsonRpcServer {
  private readonly sdk:WillSdkFacade;
  constructor(sdk:WillSdkFacade){ this.sdk=sdk; }
  manifest(){ return {protocolVersion:'2025-06-18',serverInfo:{name:'neuro-kurisu-will',version:'1.0.0'},tools:[
    {name:'perceive',description:'Deliver a stimulus to the canonical organism.',inputSchema:{type:'object',required:['text']}},
    {name:'state',description:'Read canonical organism state.',inputSchema:{type:'object'}},
    {name:'save',description:'Export a compact portable continuity artifact.',inputSchema:{type:'object'}},
    {name:'pma_validate',description:'Validate a portable continuity artifact.',inputSchema:{type:'object',required:['pma']}},
    {name:'vector_search',description:'Search the deterministic HNSW memory adapter.',inputSchema:{type:'object',required:['text']}},
    {name:'vector_benchmark',description:'Benchmark retrieval recall/reduction and decide promotion.',inputSchema:{type:'object'}},
    {name:'will_diagnostics',description:'Read WILL integration diagnostics.',inputSchema:{type:'object'}}
  ]}; }
  async handle(req:JsonRpcRequest):Promise<JsonRpcResponse>{
    const id=req.id??null;
    try{
      switch(req.method){
        case 'initialize': return {jsonrpc:'2.0',id,result:{protocolVersion:'2025-06-18',serverInfo:{name:'neuro-kurisu-will',version:'1.0.0'},capabilities:{tools:{},resources:{}}}};
        case 'tools/list': return {jsonrpc:'2.0',id,result:{tools:this.manifest().tools}};
        case 'resources/list': return {jsonrpc:'2.0',id,result:{resources:[{uri:'will://state',name:'state'},{uri:'will://diagnostics',name:'diagnostics'}]}};
        case 'resources/read': { const uri=String(req.params?.uri||''); if(uri==='will://state') return {jsonrpc:'2.0',id,result:{contents:[{uri,mimeType:'application/json',text:JSON.stringify(this.sdk.state())}]}}; if(uri==='will://diagnostics') return {jsonrpc:'2.0',id,result:{contents:[{uri,mimeType:'application/json',text:JSON.stringify(this.sdk.diagnostics())}]}}; throw Object.assign(new Error('unknown-resource'),{code:-32004}); }
        case 'tools/call': { const name=String(req.params?.name||''); const args=(req.params?.arguments??{}) as Record<string,unknown>; return {jsonrpc:'2.0',id,result:await this.callTool(name,args)}; }
        case 'notifications/initialized': return {jsonrpc:'2.0',id,result:null};
        default: throw Object.assign(new Error(`method-not-found:${req.method}`),{code:-32601});
      }
    }catch(error:any){ return {jsonrpc:'2.0',id,error:{code:Number(error?.code??-32000),message:String(error?.message||error)}}; }
  }
  private async callTool(name:string,args:Record<string,unknown>):Promise<unknown>{
    switch(name){
      case 'perceive': return await this.sdk.sense({text:String(args.text||''),from:args.from?String(args.from):undefined,provenance:(['exafferent','reafferent','unknown'] as const).includes(args.provenance as any)?args.provenance as any:'exafferent',correlationId:args.correlationId?String(args.correlationId):undefined});
      case 'state': return this.sdk.state();
      case 'save': return await this.sdk.save();
      case 'pma_validate': return this.sdk.validatePma(args.pma);
      case 'vector_search': return this.sdk.vectorSearch(String(args.text||''),Math.max(1,Math.min(32,Number(args.k??5))));
      case 'vector_benchmark': return this.sdk.vectorBenchmark(Array.isArray(args.queries)?args.queries.map(String):[],Math.max(1,Math.min(16,Number(args.k??5))),Math.max(8,Math.min(256,Number(args.efSearch??32))));
      case 'will_diagnostics': return this.sdk.diagnostics();
      default: throw Object.assign(new Error(`tool-not-found:${name}`),{code:-32601});
    }
  }
}
