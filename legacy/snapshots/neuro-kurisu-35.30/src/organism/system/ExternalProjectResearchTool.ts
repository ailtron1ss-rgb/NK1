import { createHash } from 'node:crypto';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface ExternalProjectResearchResult {
  ok:boolean;
  verified:boolean;
  externalEvidence:boolean;
  url:string;
  finalUrl:string;
  status:number;
  contentType:string;
  title:string;
  contentHash:string;
  bytes:number;
  snippet:string;
  fetchedAt:number;
  trust01:number;
  independenceKey:string;
  error?:string;
}

export interface ExternalProjectResearchConfig {
  enabled?:boolean;
  allowHosts?:string[];
  timeoutMs?:number;
  maxBytes?:number;
}

function normalizeHost(value:string){return value.trim().toLowerCase().replace(/^\.+/,'').replace(/\.+$/,'');}
function hostAllowed(host:string, allowHosts:string[]):boolean{
  const h=normalizeHost(host);
  return allowHosts.some(raw=>{const p=normalizeHost(raw); return !!p && (h===p || h.endsWith(`.${p}`));});
}
function stripHtml(html:string):string{
  return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();
}
function titleOf(text:string):string{
  const m=text.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return stripHtml(m?.[1]??'').slice(0,180);
}

function hostIsUnsafe(host:string):boolean{
  const h=host.toLowerCase();
  if(h==='localhost' || h==='localhost.localdomain' || h==='0.0.0.0' || h==='::1' || h==='[::1]') return true;
  if(/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  const m=h.match(/^172\.(\d+)\./); if(m && Number(m[1])>=16 && Number(m[1])<=31) return true;
  if(/^169\.254\./.test(h) || /^0\./.test(h)) return true;
  if(/^fc|^fd|^fe80:/i.test(h)) return true;
  return false;
}

export class ExternalProjectResearchTool {
  private readonly enabled:boolean;
  private readonly allowHosts:string[];
  private readonly timeoutMs:number;
  private readonly maxBytes:number;
  private readonly cacheTtlMs:number;
  private readonly cacheMaxEntries:number;
  private cache=new Map<string,{at:number;result:ExternalProjectResearchResult}>();
  private cacheHits=0;
  constructor(config:ExternalProjectResearchConfig={}){
    this.enabled=Boolean(config.enabled ?? /^(1|true|yes)$/i.test(String(process.env.NEURO_PROJECT_NETWORK_ENABLED??'')));
    const fromEnv=String(process.env.NEURO_PROJECT_NETWORK_ALLOWLIST??'').split(',').map(normalizeHost).filter(Boolean);
    this.allowHosts=(config.allowHosts?.length ? config.allowHosts : fromEnv);
    this.timeoutMs=Math.max(1000,Math.min(20_000,Math.floor(Number(config.timeoutMs??process.env.NEURO_PROJECT_NETWORK_TIMEOUT_MS??8000))));
    this.maxBytes=Math.max(4096,Math.min(2_000_000,Math.floor(Number(config.maxBytes??process.env.NEURO_PROJECT_NETWORK_MAX_BYTES??256_000))));
    this.cacheTtlMs=Math.max(1000,Math.min(3_600_000,Math.floor(Number(process.env.NEURO_PROJECT_NETWORK_CACHE_TTL_MS??600_000))));
    this.cacheMaxEntries=Math.max(1,Math.min(32,Math.floor(Number(process.env.NEURO_PROJECT_NETWORK_CACHE_MAX??8))));
  }
  snapshot(){return {enabled:this.enabled,allowHosts:[...this.allowHosts],timeoutMs:this.timeoutMs,maxBytes:this.maxBytes,cacheTtlMs:this.cacheTtlMs,cacheMaxEntries:this.cacheMaxEntries,cacheEntries:this.cache.size,cacheHits:this.cacheHits};}
  async fetchUrl(input:{url:string}):Promise<ExternalProjectResearchResult>{
    const raw=String(input.url??'').trim();
    const at=Date.now();
    const fail=(error:string):ExternalProjectResearchResult=>({ok:false,verified:false,externalEvidence:false,url:raw,finalUrl:raw,status:0,contentType:'',title:'',contentHash:'',bytes:0,snippet:'',fetchedAt:at,trust01:0,independenceKey:'',error:error.slice(0,240)});
    if(!this.enabled)return fail('project-network-disabled');
    let parsed:URL;
    try{parsed=new URL(raw);}catch{return fail('invalid-url');}
    if(!['https:'].includes(parsed.protocol))return fail('only-https-allowed');
    if(hostIsUnsafe(parsed.hostname))return fail('private-host-blocked');
    if(!hostAllowed(parsed.hostname,this.allowHosts))return fail('host-not-allowlisted');
    const cacheKey=parsed.toString(); const cached=this.cache.get(cacheKey);
    if(cached && at-cached.at<=this.cacheTtlMs){ this.cacheHits++; return structuredClone(cached.result); }
    this.cache.delete(cacheKey);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await fetch(parsed,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'user-agent':'Neuro-Kurisu-Research/34.19'}});
      if(!response.ok)return fail(`http-${response.status}`);
      const finalUrl=response.url||parsed.toString();
      if(response.status>=300 && response.status<400)return fail('redirect-not-accepted');
      const finalParsed=new URL(finalUrl);
      if(finalParsed.protocol!=='https:' || !hostAllowed(finalParsed.hostname,this.allowHosts) || hostIsUnsafe(finalParsed.hostname))return fail('final-host-not-allowlisted');
      const contentType=response.headers.get('content-type')??'';
      const reader=response.body?.getReader();
      if(!reader)return fail('empty-response-body');
      const chunks:Uint8Array[]=[];let total=0;
      while(true){const {done,value}=await reader.read();if(done)break; if(value){total+=value.byteLength;if(total>this.maxBytes){await reader.cancel().catch(()=>{});return fail('response-too-large');}chunks.push(value);}}
      const bytes=new Uint8Array(total); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const digest=createHash('sha256'); digest.update(bytes); const hash=digest.digest('hex');
      const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
      const isHtml=/text\/html|application\/xhtml\+xml/i.test(contentType);
      const cleaned=isHtml?stripHtml(text):text.replace(/\s+/g,' ').trim();
      const title=isHtml?titleOf(text):'';
      const snippet=cleaned.slice(0,1200);
      const trust=clamp(.84 + (response.status===200?.04:0) - (total>this.maxBytes*.8?.05:0));
      const sourceKey=finalParsed.hostname.toLowerCase();
      const result={ok:true,verified:true,externalEvidence:true,url:raw,finalUrl,status:response.status,contentType,title,contentHash:hash,bytes:total,snippet,fetchedAt:Date.now(),trust01:trust,independenceKey:sourceKey};
      this.cache.set(cacheKey,{at:Date.now(),result});
      while(this.cache.size>this.cacheMaxEntries){ const oldest=this.cache.keys().next().value; if(oldest) this.cache.delete(oldest); else break; }
      return structuredClone(result);
    }catch(error:any){return fail(String(error?.name==='AbortError'?'network-timeout':error?.message||error));}
    finally{clearTimeout(timer);}
  }
}
