import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest, type RequestOptions } from 'node:https';

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
  /** Exact serving host for provenance; independenceKey is the conservative publisher-family key. */
  sourceHost?:string;
  error?:string;
  redirects?:number;
  queryHash?:string;
  relevance01?:number;
  matchedQueryTerms?:string[];
  /** Optional explicit proposition to anchor against source text; search queries alone are not claims. */
  claim?:string;
}

export interface ExternalProjectResearchConfig {
  enabled?:boolean;
  allowHosts?:string[];
  timeoutMs?:number;
  maxBytes?:number;
  maxRedirects?:number;
  minQueryRelevance01?:number;
}

export interface ResearchResolvedAddress { address:string; family:4|6 }
export interface ResearchHttpResponse { status:number; headers:Record<string,string|undefined>; body:Uint8Array; tooLarge?:boolean }
export interface ExternalProjectResearchDependencies {
  /** Injectable seams make DNS and transport policy testable without live network access. */
  resolveHost?:(hostname:string)=>Promise<ResearchResolvedAddress[]>;
  requestPinned?:(input:{url:URL;address:ResearchResolvedAddress;timeoutMs:number;maxBytes:number})=>Promise<ResearchHttpResponse>;
}

function normalizeHost(value:string){return value.trim().toLowerCase().replace(/^\.+/,'').replace(/\.+$/,'').replace(/^\[|\]$/g,'');}

// A deliberately conservative, dependency-free publisher key. Common public suffixes
// and multi-tenant hosting suffixes are handled explicitly so two subdomains of one
// publisher (or two paths on one host) cannot manufacture source independence. This is
// not a full Public Suffix List implementation; unknown suffixes fall back to the last
// two labels, which errs toward conservative grouping for typical publisher domains.
const MULTI_LABEL_PUBLIC_SUFFIXES=new Set([
  'co.uk','org.uk','ac.uk','gov.uk','sch.uk','me.uk','ltd.uk','plc.uk','net.uk',
  'com.au','net.au','org.au','edu.au','gov.au','asn.au','id.au',
  'co.nz','org.nz','ac.nz','govt.nz','net.nz',
  'co.jp','ne.jp','or.jp','ac.jp','go.jp',
  'co.in','firm.in','net.in','org.in','gen.in','ind.in',
  'co.za','org.za','net.za','com.br','net.br','org.br',
  'com.cn','net.cn','org.cn','gov.cn','com.sg','com.my','com.tr','com.mx',
  'com.ar','com.tw','com.hk','com.ph','co.kr','or.kr','ne.kr','go.kr',
  'github.io','gitlab.io','pages.dev','vercel.app','netlify.app','herokuapp.com',
  'appspot.com','cloudfront.net','azurewebsites.net','web.app','firebaseapp.com',
]);
export function publisherIndependenceKey(rawHost:string):string {
  const host=normalizeHost(rawHost);
  if(!host || isIP(host) || !host.includes('.'))return host;
  const labels=host.split('.').filter(Boolean);
  if(labels.length<=2)return host;
  const lastTwo=labels.slice(-2).join('.');
  return MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo)?labels.slice(-3).join('.'):lastTwo;
}
function hostAllowed(host:string, allowHosts:string[]):boolean{
  const h=normalizeHost(host);
  return allowHosts.some(raw=>{const p=normalizeHost(raw); return !!p && (h===p || h.endsWith(`.${p}`));});
}
function stripHtml(html:string):string{
  return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
}
function titleOf(text:string):string{
  const m=text.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return stripHtml(m?.[1]??'').slice(0,180);
}
function inV4Cidr(address:string, network:string, bits:number):boolean {
  const toInt=(value:string)=>value.split('.').reduce((sum,part)=>(sum*256+Number(part))>>>0,0)>>>0;
  const addr=toInt(address), base=toInt(network), mask=bits===0?0:(0xffffffff << (32-bits))>>>0;
  return (addr&mask)===(base&mask);
}
function parseIpv6BigInt(raw:string):bigint|null {
  let host=raw.toLowerCase().split('%')[0];
  if(!host || !host.includes(':')) return null;
  if(host.includes('.')) {
    const lastColon=host.lastIndexOf(':');
    if(lastColon<0) return null;
    const v4=host.slice(lastColon+1).split('.').map(Number);
    if(v4.length!==4 || v4.some(n=>!Number.isInteger(n)||n<0||n>255)) return null;
    host=`${host.slice(0,lastColon+1)}${((v4[0]<<8)|v4[1]).toString(16)}:${((v4[2]<<8)|v4[3]).toString(16)}`;
  }
  const halves=host.split('::');
  if(halves.length>2) return null;
  const left=halves[0]?halves[0].split(':'):[];
  const right=halves.length===2&&halves[1]?halves[1].split(':'):[];
  if([...left,...right].some(x=>! /^[0-9a-f]{1,4}$/.test(x))) return null;
  let groups:string[];
  if(halves.length===1){if(left.length!==8)return null;groups=left;}
  else {const missing=8-left.length-right.length;if(missing<1)return null;groups=[...left,...Array(missing).fill('0'),...right];}
  if(groups.length!==8)return null;
  return groups.reduce((sum,group)=>(sum<<16n)|BigInt(`0x${group||'0'}`),0n);
}
function isPublicInternetAddress(address:string):boolean {
  const normalized=normalizeHost(address);
  const family=isIP(normalized);
  if(family===4){
    const blocked:[string,number][]=[
      ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],
      ['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],
      ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4],
    ];
    return !blocked.some(([network,bits])=>inV4Cidr(normalized,network,bits));
  }
  if(family===6){
    const n=parseIpv6BigInt(normalized); if(n===null)return false;
    // Outbound research permits only IPv6 global-unicast 2000::/3. This
    // conservatively excludes loopback, mapped IPv4, unique-local, link-local,
    // multicast and all unspecified/protocol-local ranges by default.
    if((n>>125n)!==1n)return false;
    const in6=(prefix:string,bits:number)=>{const p=parseIpv6BigInt(prefix); if(p===null)return false; const shift=128n-BigInt(bits); return (n>>shift)===(p>>shift);};
    if(in6('2001::',23)||in6('2001:db8::',32)||in6('2001:2::',48)||in6('2002::',16)||in6('3fff::',20))return false;
    return true;
  }
  return false;
}
function hostnameUnsafe(host:string):boolean {
  const h=normalizeHost(host);
  return h==='localhost'||h.endsWith('.localhost')||h==='localhost.localdomain'||h.endsWith('.local')||h.endsWith('.internal')||h==='metadata.google.internal'||h==='metadata';
}
const QUERY_STOP_WORDS=new Set(['the','and','for','with','that','this','from','into','about','have','has','was','were','are','как','что','это','для','при','или','его','её','они','она','они','быть','был','была','были','где','когда','зачем','чтобы','между','после','перед','через','также','если','один','одна','одно']);
function queryTokens(raw:string):string[]{
  return [...new Set(String(raw??'').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[])].filter(token=>!QUERY_STOP_WORDS.has(token)).slice(0,32);
}
function tokenMatches(queryToken:string,documentTokens:Set<string>):boolean {
  if(documentTokens.has(queryToken))return true;
  if(queryToken.length<5)return false;
  for(const token of documentTokens){if(token.length>=5&&(token.startsWith(queryToken)||queryToken.startsWith(token)))return true;}
  return false;
}
function scoreQueryRelevance(query:string, title:string, content:string):{score01:number;matchedTerms:string[];queryHash:string;valid:boolean}{
  const normalized=String(query??'').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g,' ');
  const queryHash=createHash('sha256').update(normalized).digest('hex');
  const terms=queryTokens(normalized);
  if(normalized.length<8||normalized.length>320||terms.length<3)return {score01:0,matchedTerms:[],queryHash,valid:false};
  const bodyTokens=new Set(queryTokens(content));const titleTokens=new Set(queryTokens(title));
  const matched=terms.filter(term=>tokenMatches(term,bodyTokens));
  const titleMatches=terms.filter(term=>tokenMatches(term,titleTokens)).length;
  const coverage=matched.length/terms.length;
  const titleCoverage=titleMatches/terms.length;
  const score01=clamp(coverage*.82+titleCoverage*.18);
  return {score01,matchedTerms:matched,queryHash,valid:true};
}
function isTextualContentType(raw:string):boolean {
  const type=raw.split(';',1)[0].trim().toLowerCase();
  return type==='text/html'||type==='text/plain'||type==='text/markdown'||type==='text/xml'||type==='application/xhtml+xml'||type==='application/json'||type==='application/xml'||type==='application/rss+xml'||type==='application/atom+xml';
}
function getHeader(headers:Record<string,string|undefined>, name:string):string { return String(headers[name.toLowerCase()]??headers[name]??'').trim(); }

async function resolvePublicHost(hostname:string):Promise<ResearchResolvedAddress[]> {
  const host=normalizeHost(hostname); const literal=isIP(host);
  if(literal===4||literal===6)return [{address:host,family:literal}];
  const resolved=await lookup(host,{all:true,verbatim:true});
  return resolved.map((row:any)=>({address:String(row.address),family:Number(row.family) as 4|6}));
}

async function requestPinnedHttps(input:{url:URL;address:ResearchResolvedAddress;timeoutMs:number;maxBytes:number}):Promise<ResearchHttpResponse>{
  const {url,address,timeoutMs,maxBytes}=input;
  return await new Promise((resolve,reject)=>{
    let settled=false; let tooLarge=false; const chunks:Uint8Array[]=[]; let total=0;
    const finish=(response:ResearchHttpResponse)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(response);};
    const fail=(error:Error)=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
    const host=normalizeHost(url.hostname);
    const lookupPinned=((_hostname:string,optionsOrCallback:any,maybeCallback?:any)=>{
      // Pin DNS to the already vetted address. Otherwise a second DNS lookup by
      // the HTTP stack creates a rebinding window after our policy check.
      const options=typeof optionsOrCallback==='function'?undefined:optionsOrCallback;
      const callback=typeof optionsOrCallback==='function'?optionsOrCallback:maybeCallback;
      if(typeof callback!=='function')return;
      if(options&&typeof options==='object'&&options.all) callback(null,[{address:address.address,family:address.family}]);
      else callback(null,address.address,address.family);
    }) as NonNullable<RequestOptions['lookup']>;
    const req=httpsRequest({
      protocol:'https:',hostname:host,port:url.port||443,method:'GET',path:`${url.pathname||'/'}${url.search}`,
      servername:isIP(host)?undefined:host, rejectUnauthorized:true, agent:false, maxHeaderSize:16*1024,
      lookup:lookupPinned,
      headers:{'user-agent':'Neuro-Kurisu-Research/35.61.0','accept':'text/html, text/plain, application/xhtml+xml, application/json, application/xml, application/rss+xml, application/atom+xml','accept-encoding':'identity','connection':'close'},
    },response=>{
      const headers:Record<string,string|undefined>={};
      for(const [key,value] of Object.entries(response.headers as Record<string,unknown>)) headers[key.toLowerCase()]=Array.isArray(value)?value.join(', '):(value===undefined||value===null?'':String(value));
      if(response.statusCode && response.statusCode>=300 && response.statusCode<400){
        response.destroy(); finish({status:response.statusCode,headers,body:new Uint8Array()}); return;
      }
      const contentLength=Number(headers['content-length']);
      if(Number.isFinite(contentLength)&&contentLength>maxBytes){response.destroy();finish({status:response.statusCode??0,headers,body:new Uint8Array(),tooLarge:true});return;}
      response.on('data',(chunk:Uint8Array|string)=>{
        if(settled)return;
        const buf:Uint8Array=typeof chunk==='string'?Buffer.from(chunk):chunk; total+=buf.byteLength;
        if(total>maxBytes){tooLarge=true;response.destroy();req.destroy();finish({status:response.statusCode??0,headers,body:new Uint8Array(),tooLarge:true});return;}
        chunks.push(buf);
      });
      response.on('end',()=>finish({status:response.statusCode??0,headers,body:new Uint8Array(Buffer.concat(chunks,total)),tooLarge}));
      response.on('error',(error:Error)=>{if(!settled)fail(error);});
    });
    const timer=setTimeout(()=>req.destroy(Object.assign(new Error('network-timeout'),{code:'ETIMEDOUT'})),timeoutMs);
    req.on('error',(error:Error)=>fail(error));
    req.end();
  });
}

export class ExternalProjectResearchTool {
  private readonly enabled:boolean;
  private readonly allowHosts:string[];
  private readonly timeoutMs:number;
  private readonly maxBytes:number;
  private readonly maxRedirects:number;
  private readonly minQueryRelevance01:number;
  private readonly cacheTtlMs:number;
  private readonly cacheMaxEntries:number;
  private readonly resolveHost:(hostname:string)=>Promise<ResearchResolvedAddress[]>;
  private readonly requestPinned:(input:{url:URL;address:ResearchResolvedAddress;timeoutMs:number;maxBytes:number})=>Promise<ResearchHttpResponse>;
  private cache=new Map<string,{at:number;result:ExternalProjectResearchResult}>();
  private cacheHits=0;
  private networkRequests=0;
  private dnsRejects=0;
  private redirectRejects=0;
  constructor(config:ExternalProjectResearchConfig={},dependencies:ExternalProjectResearchDependencies={}){
    this.enabled=Boolean(config.enabled ?? /^(1|true|yes)$/i.test(String(process.env.NEURO_PROJECT_NETWORK_ENABLED??'')));
    const fromEnv=String(process.env.NEURO_PROJECT_NETWORK_ALLOWLIST??'').split(',').map(normalizeHost).filter(Boolean);
    this.allowHosts=[...(config.allowHosts?.length ? config.allowHosts : fromEnv)].map(normalizeHost).filter(Boolean);
    this.timeoutMs=Math.max(1000,Math.min(20_000,Math.floor(Number(config.timeoutMs??process.env.NEURO_PROJECT_NETWORK_TIMEOUT_MS??8000))));
    this.maxBytes=Math.max(4096,Math.min(2_000_000,Math.floor(Number(config.maxBytes??process.env.NEURO_PROJECT_NETWORK_MAX_BYTES??256_000))));
    this.maxRedirects=Math.max(0,Math.min(5,Math.floor(Number(config.maxRedirects??3))));
    this.minQueryRelevance01=clamp(Number(config.minQueryRelevance01??.35));
    this.cacheTtlMs=Math.max(1000,Math.min(3_600_000,Math.floor(Number(process.env.NEURO_PROJECT_NETWORK_CACHE_TTL_MS??600_000))));
    this.cacheMaxEntries=Math.max(1,Math.min(32,Math.floor(Number(process.env.NEURO_PROJECT_NETWORK_CACHE_MAX??8))));
    this.resolveHost=dependencies.resolveHost??resolvePublicHost;
    this.requestPinned=dependencies.requestPinned??requestPinnedHttps;
  }
  snapshot(){return {enabled:this.enabled,allowHosts:[...this.allowHosts],timeoutMs:this.timeoutMs,maxBytes:this.maxBytes,maxRedirects:this.maxRedirects,minQueryRelevance01:this.minQueryRelevance01,queryRequired:true,cacheTtlMs:this.cacheTtlMs,cacheMaxEntries:this.cacheMaxEntries,cacheEntries:this.cache.size,cacheHits:this.cacheHits,networkRequests:this.networkRequests,dnsRejects:this.dnsRejects,redirectRejects:this.redirectRejects};}
  preflightUrl(input:{url:string}):{ok:boolean;error?:string;hostname?:string}{
    const raw=String(input.url??'').trim();
    if(!this.enabled)return {ok:false,error:'project-network-disabled'};
    if(!raw)return {ok:false,error:'project-research-url-required'};
    let parsed:URL;
    try{parsed=new URL(raw);}catch{return {ok:false,error:'invalid-url'};}
    if(parsed.protocol!=='https:')return {ok:false,error:'only-https-allowed'};
    if(parsed.username||parsed.password)return {ok:false,error:'url-credentials-not-allowed'};
    if(parsed.port && parsed.port!=='443')return {ok:false,error:'nonstandard-port-not-allowed'};
    const hostname=normalizeHost(parsed.hostname);
    if(hostnameUnsafe(hostname))return {ok:false,error:'private-host-blocked'};
    if(isIP(hostname) && !isPublicInternetAddress(hostname))return {ok:false,error:'private-host-blocked'};
    if(!this.allowHosts.length)return {ok:false,error:'project-network-allowlist-empty'};
    if(!hostAllowed(hostname,this.allowHosts))return {ok:false,error:'host-not-allowlisted'};
    return {ok:true,hostname};
  }
  preflightQuery(input:{query:string}):{ok:boolean;error?:string;queryHash?:string;terms?:number}{
    const raw=String(input.query??'').trim();
    if(!raw)return {ok:false,error:'research-query-required'};
    if(raw.length>320)return {ok:false,error:'research-query-too-long'};
    const relevance=scoreQueryRelevance(raw,'','');
    const terms=queryTokens(raw).length;
    if(!relevance.valid||terms<3)return {ok:false,error:'research-query-too-broad',terms};
    return {ok:true,queryHash:relevance.queryHash,terms};
  }
  async fetchUrl(input:{url:string;query?:string;claim?:string}):Promise<ExternalProjectResearchResult>{
    const raw=String(input.url??'').trim();
    const query=String(input.query??process.env.NEURO_PROJECT_RESEARCH_QUERY??'').trim();
    const claim=String(input.claim??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,600);
    const at=Date.now();
    const fail=(error:string,status=0,finalUrl=raw,redirects=0,extra:Partial<ExternalProjectResearchResult>={}):ExternalProjectResearchResult=>({ok:false,verified:false,externalEvidence:false,url:raw,finalUrl,status,contentType:String(extra.contentType??''),title:String(extra.title??''),contentHash:String(extra.contentHash??''),bytes:Number(extra.bytes??0),snippet:String(extra.snippet??''),fetchedAt:Date.now(),trust01:0,independenceKey:'',error:error.slice(0,240),redirects,queryHash:extra.queryHash,relevance01:extra.relevance01,matchedQueryTerms:extra.matchedQueryTerms,claim:claim||undefined});
    const preflight=this.preflightUrl({url:raw});
    if(!preflight.ok)return fail(preflight.error??'research-preflight-rejected');
    const queryCheck=this.preflightQuery({query});
    if(!queryCheck.ok)return fail(queryCheck.error??'research-query-rejected');
    const queryHash=queryCheck.queryHash!;
    let current:URL;
    try{current=new URL(raw);}catch{return fail('invalid-url',0,raw,0,{queryHash});}
    const cacheKey=createHash('sha256').update(`${current.toString()}\n${queryHash}`).digest('hex'); const cached=this.cache.get(cacheKey);
    if(cached && at-cached.at<=this.cacheTtlMs){this.cacheHits++;return structuredClone(cached.result);}
    this.cache.delete(cacheKey);
    let redirects=0;
    try{
      while(true){
        const check=this.preflightUrl({url:current.toString()});
        if(!check.ok){if(redirects)this.redirectRejects++;return fail(redirects?`redirect-${check.error??'rejected'}`:(check.error??'research-preflight-rejected'),0,current.toString(),redirects,{queryHash});}
        let addresses:ResearchResolvedAddress[];
        let dnsTimer:any;
        try{
          addresses=await Promise.race([
            this.resolveHost(check.hostname!),
            new Promise<ResearchResolvedAddress[]>((_resolve,reject)=>{dnsTimer=setTimeout(()=>reject(Object.assign(new Error('dns-resolution-timeout'),{code:'ETIMEDOUT'})),this.timeoutMs);}),
          ]);
        }catch(error:any){return fail(error?.code==='ETIMEDOUT'?'dns-resolution-timeout':'dns-resolution-failed',0,current.toString(),redirects,{queryHash});}
        finally{if(dnsTimer)clearTimeout(dnsTimer);}
        if(!addresses.length)return fail('dns-no-addresses',0,current.toString(),redirects,{queryHash});
        // Reject the whole DNS answer if any address is non-public; do not choose
        // a public answer from a mixed public/private set.
        const unsafe=addresses.find(row=>!isPublicInternetAddress(row.address)||row.family!==isIP(row.address));
        if(unsafe){this.dnsRejects++;return fail('dns-private-or-special-address-blocked',0,current.toString(),redirects,{queryHash});}
        const response=await this.requestPinned({url:current,address:addresses[0],timeoutMs:this.timeoutMs,maxBytes:this.maxBytes});
        this.networkRequests++;
        if(response.tooLarge)return fail('response-too-large',response.status,current.toString(),redirects,{queryHash});
        if([301,302,303,307,308].includes(response.status)){
          const location=getHeader(response.headers,'location');
          if(!location)return fail('redirect-location-missing',response.status,current.toString(),redirects,{queryHash});
          if(redirects>=this.maxRedirects){this.redirectRejects++;return fail('redirect-limit-exceeded',response.status,current.toString(),redirects,{queryHash});}
          let next:URL;try{next=new URL(location,current);}catch{return fail('redirect-location-invalid',response.status,current.toString(),redirects,{queryHash});}
          const nextCheck=this.preflightUrl({url:next.toString()});
          if(!nextCheck.ok){this.redirectRejects++;return fail(`redirect-${nextCheck.error??'rejected'}`,response.status,next.toString(),redirects+1,{queryHash});}
          redirects++;current=next;continue;
        }
        if(response.status<200||response.status>=300)return fail(`http-${response.status}`,response.status,current.toString(),redirects,{queryHash});
        const contentType=getHeader(response.headers,'content-type');
        if(!isTextualContentType(contentType))return fail(contentType?'unsupported-content-type':'content-type-missing',response.status,current.toString(),redirects,{queryHash});
        if(response.body.byteLength>this.maxBytes)return fail('response-too-large',response.status,current.toString(),redirects,{queryHash});
        const bytes=response.body.byteLength;
        const digest=createHash('sha256');digest.update(response.body);const hash=digest.digest('hex');
        const text=new TextDecoder('utf-8',{fatal:false}).decode(response.body);
        if(text.includes('\u0000'))return fail('binary-content-rejected',response.status,current.toString(),redirects,{queryHash});
        const isHtml=/text\/html|application\/xhtml\+xml/i.test(contentType);
        const cleaned=isHtml?stripHtml(text):text.replace(/\s+/g,' ').trim();
        if(!cleaned)return fail('empty-text-content',response.status,current.toString(),redirects,{queryHash});
        const title=isHtml?titleOf(text):'';
        const snippet=cleaned.slice(0,1200);
        const relevance=scoreQueryRelevance(query,title,cleaned);
        if(!relevance.valid)return fail('research-query-too-broad',response.status,current.toString(),redirects,{queryHash});
        if(relevance.matchedTerms.length<Math.min(2,queryTokens(query).length)||relevance.score01<this.minQueryRelevance01){
          return fail('research-query-not-supported',response.status,current.toString(),redirects,{queryHash,relevance01:relevance.score01,matchedQueryTerms:relevance.matchedTerms,contentType,title,contentHash:hash,bytes,snippet});
        }
        const trust=clamp(.84+(response.status===200?.04:0)-(bytes>this.maxBytes*.8?.05:0)-(redirects*.02));
        const sourceHost=normalizeHost(current.hostname);
        const sourceKey=publisherIndependenceKey(sourceHost);
        const result:ExternalProjectResearchResult={ok:true,verified:true,externalEvidence:true,url:raw,finalUrl:current.toString(),status:response.status,contentType,title,contentHash:hash,bytes,snippet,fetchedAt:Date.now(),trust01:trust,independenceKey:sourceKey,sourceHost,redirects,queryHash,relevance01:relevance.score01,matchedQueryTerms:relevance.matchedTerms,claim:claim||undefined};
        this.cache.set(cacheKey,{at:Date.now(),result});
        while(this.cache.size>this.cacheMaxEntries){const oldest=this.cache.keys().next().value;if(oldest)this.cache.delete(oldest);else break;}
        return structuredClone(result);
      }
    }catch(error:any){
      const code=String(error?.code??'');
      const reason=code==='ETIMEDOUT'||error?.name==='AbortError'?'network-timeout':code==='ENOTFOUND'||code==='EAI_AGAIN'?'dns-resolution-failed':code==='CERT_HAS_EXPIRED'||code==='ERR_TLS_CERT_ALTNAME_INVALID'||code==='UNABLE_TO_VERIFY_LEAF_SIGNATURE'?'tls-verification-failed':'network-request-failed';
      return fail(reason,0,current.toString(),redirects,{queryHash});
    }
  }
}
