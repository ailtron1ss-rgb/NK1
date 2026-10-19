import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ExternalProjectResearchTool, publisherIndependenceKey } from '../src/organism/system/ExternalProjectResearchTool.ts';

const body=(value)=>new TextEncoder().encode(value);
const hash=(value)=>createHash('sha256').update(body(value)).digest('hex');
const html=(title,text)=>`<!doctype html><html><head><title>${title}</title></head><body><main>${text}</main><script>ignored()</script></body></html>`;
const public4={address:'93.184.216.34',family:4};
const public6={address:'2606:4700:4700::1111',family:6};
let tests=0;
const check=async (name,fn)=>{await fn();tests++;console.log(`PASS ${name}`);};

await check('publisher identity groups subdomains and public suffixes conservatively',()=>{
  assert.equal(publisherIndependenceKey('docs.example.com'),'example.com');
  assert.equal(publisherIndependenceKey('www.example.co.uk'),'example.co.uk');
  assert.equal(publisherIndependenceKey('docs.example.co.uk'),'example.co.uk');
  assert.equal(publisherIndependenceKey('alice.github.io'),'alice.github.io');
  assert.equal(publisherIndependenceKey('docs.alice.github.io'),'alice.github.io');
  assert.equal(publisherIndependenceKey('example.com'),'example.com');
});

await check('safe address classifier blocks special and non-global addresses',()=>{
  for(const url of ['https://127.0.0.1','https://10.1.2.3','https://100.64.1.2','https://169.254.169.254','https://192.0.2.1','https://224.0.0.1','https://[::1]','https://[::ffff:127.0.0.1]','https://[fe80::1]','https://[2001:db8::1]','https://[ff02::1]']){
    const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:[new URL(url).hostname]});
    assert.equal(tool.preflightUrl({url}).ok,false,url);
  }
});

await check('preflight rejects credentials, nonstandard ports and unsafe schemes',()=>{
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']});
  assert.equal(tool.preflightUrl({url:'http://example.com'}).error,'only-https-allowed');
  assert.equal(tool.preflightUrl({url:'https://user:secret@example.com'}).error,'url-credentials-not-allowed');
  assert.equal(tool.preflightUrl({url:'https://example.com:8443'}).error,'nonstandard-port-not-allowed');
  assert.equal(tool.preflightUrl({url:'https://example.com/path'}).ok,true);
});

await check('query is mandatory, specific enough, and bound by a stable fingerprint',()=>{
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']});
  assert.equal(tool.preflightQuery({query:''}).error,'research-query-required');
  assert.equal(tool.preflightQuery({query:'the and for'}).error,'research-query-too-broad');
  assert.equal(tool.preflightQuery({query:'quantum computing'}).error,'research-query-too-broad');
  const one=tool.preflightQuery({query:'Adaptive systems research'});
  const two=tool.preflightQuery({query:'adaptive systems evidence'});
  assert.equal(one.ok,true);assert.equal(two.ok,true);assert.notEqual(one.queryHash,two.queryHash);
});

await check('DNS answers containing any private address are rejected before transport',async()=>{
  let requestCount=0;
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{
    resolveHost:async()=>[public4,{address:'10.0.0.8',family:4}],
    requestPinned:async()=>{requestCount++;return {status:200,headers:{'content-type':'text/plain'},body:body('must not run')}}
  });
  const result=await tool.fetchUrl({url:'https://example.com/research',query:'external research evidence'});
  assert.equal(result.ok,false);assert.equal(result.error,'dns-private-or-special-address-blocked');assert.equal(requestCount,0);
  assert.equal(tool.snapshot().dnsRejects,1);
});

await check('public HTTPS fetch pins the vetted address and creates content fingerprint',async()=>{
  const requested=[]; const page=html('Research title','Evidence on adaptive systems.');
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{
    resolveHost:async(host)=>{assert.equal(host,'example.com');return [public4]},
    requestPinned:async(input)=>{requested.push(input);return {status:200,headers:{'content-type':'text/html; charset=utf-8','content-length':String(body(page).byteLength)},body:body(page)}}
  });
  const result=await tool.fetchUrl({url:'https://example.com/research?q=1',query:'adaptive systems research'});
  assert.equal(result.ok,true);assert.equal(result.verified,true);assert.equal(result.externalEvidence,true);
  assert.equal(result.title,'Research title');assert.match(result.snippet,/Evidence on adaptive systems/);
  assert.equal(result.contentHash,hash(page));assert.equal(result.independenceKey,'example.com');
  assert.equal(result.redirects,0);assert.equal(requested.length,1);assert.deepEqual(requested[0].address,public4);
});

await check('redirect is followed only after independent policy and DNS checks',async()=>{
  const resolved=[];const requested=[];
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{
    resolveHost:async(host)=>{resolved.push(host);return host==='example.com'?[public4]:[public6]},
    requestPinned:async(input)=>{requested.push({url:input.url.toString(),ip:input.address.address});if(input.url.pathname==='/start')return {status:302,headers:{location:'https://docs.example.com/final','content-type':'text/plain'},body:new Uint8Array()};return {status:200,headers:{'content-type':'text/plain'},body:body('research evidence on adaptive systems')}}
  });
  const result=await tool.fetchUrl({url:'https://example.com/start',query:'external research evidence'});
  assert.equal(result.ok,true);assert.equal(result.finalUrl,'https://docs.example.com/final');assert.equal(result.redirects,1);
  assert.deepEqual(resolved,['example.com','docs.example.com']);assert.equal(requested.length,2);assert.deepEqual(requested.map(x=>x.ip),[public4.address,public6.address]);
});

await check('redirect to non-allowlisted domain is rejected without fetching target',async()=>{
  let requests=0;let dns=0;
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{
    resolveHost:async()=>{dns++;return [public4]},
    requestPinned:async()=>{requests++;return {status:302,headers:{location:'https://evil.invalid/collect'},body:new Uint8Array()}}
  });
  const result=await tool.fetchUrl({url:'https://example.com/start',query:'external research evidence'});
  assert.equal(result.ok,false);assert.equal(result.error,'redirect-host-not-allowlisted');assert.equal(requests,1);assert.equal(dns,1);assert.equal(tool.snapshot().redirectRejects,1);
});

await check('redirect loop/chain is bounded',async()=>{
  let requests=0;
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com'],maxRedirects:1},{
    resolveHost:async()=>[public4],
    requestPinned:async({url})=>{requests++;return {status:302,headers:{location:`https://example.com/${requests+1}`},body:new Uint8Array()}}
  });
  const result=await tool.fetchUrl({url:'https://example.com/1',query:'external research evidence'});
  assert.equal(result.ok,false);assert.equal(result.error,'redirect-limit-exceeded');assert.equal(requests,2);assert.equal(result.redirects,1);
});

await check('oversized, binary and unsupported content types fail closed',async()=>{
  const cases=[
    {response:{status:200,headers:{'content-type':'text/plain'},body:new Uint8Array(4097),tooLarge:true},expected:'response-too-large'},
    {response:{status:200,headers:{'content-type':'application/octet-stream'},body:body('binary')},expected:'unsupported-content-type'},
    {response:{status:200,headers:{'content-type':'text/plain'},body:body('a\u0000b')},expected:'binary-content-rejected'},
    {response:{status:200,headers:{'content-type':'text/html'},body:body('<html></html>')},expected:'empty-text-content'},
  ];
  for(const item of cases){
    const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com'],maxBytes:4096},{resolveHost:async()=>[public4],requestPinned:async()=>item.response});
    const result=await tool.fetchUrl({url:'https://example.com/research',query:'external research evidence'});assert.equal(result.ok,false);assert.equal(result.error,item.expected);
  }
});

await check('successful HTTP fetch with unrelated content is not promoted to evidence',async()=>{
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{resolveHost:async()=>[public4],requestPinned:async()=>({status:200,headers:{'content-type':'text/plain'},body:body('A recipe for a chocolate cake with flour and sugar.')})});
  const result=await tool.fetchUrl({url:'https://example.com/cake',query:'quantum computing error correction'});
  assert.equal(result.ok,false);assert.equal(result.verified,false);assert.equal(result.externalEvidence,false);assert.equal(result.error,'research-query-not-supported');assert.ok((result.relevance01??1)<.35);
});

await check('HTTP errors and transport failures do not become evidence',async()=>{
  const http=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{resolveHost:async()=>[public4],requestPinned:async()=>({status:503,headers:{'content-type':'text/plain'},body:body('unavailable')})});
  const httpResult=await http.fetchUrl({url:'https://example.com/research',query:'external research evidence'});assert.equal(httpResult.error,'http-503');assert.equal(httpResult.externalEvidence,false);
  const timeout=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{resolveHost:async()=>[public4],requestPinned:async()=>{throw Object.assign(new Error('sensitive internal detail'),{code:'ETIMEDOUT'})}});
  const timeoutResult=await timeout.fetchUrl({url:'https://example.com/research',query:'external research evidence'});assert.equal(timeoutResult.error,'network-timeout');assert.equal(timeoutResult.externalEvidence,false);assert.doesNotMatch(timeoutResult.error,/sensitive/);
});

await check('DNS resolver timeout is bounded and never invokes transport',async()=>{
  let requests=0;
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com'],timeoutMs:1000},{resolveHost:async()=>await new Promise(()=>{}),requestPinned:async()=>{requests++;return {status:200,headers:{'content-type':'text/plain'},body:body('unexpected')}}});
  const result=await tool.fetchUrl({url:'https://example.com/research',query:'adaptive systems research'});
  assert.equal(result.ok,false);assert.equal(result.error,'dns-resolution-timeout');assert.equal(requests,0);
});

await check('successful fetch cache avoids repeat network calls and is observable',async()=>{
  let requests=0;
  const tool=new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']},{resolveHost:async()=>[public4],requestPinned:async()=>{requests++;return {status:200,headers:{'content-type':'text/plain'},body:body('cacheable research memory')}}});
  const one=await tool.fetchUrl({url:'https://example.com/a',query:'cacheable research memory'});const two=await tool.fetchUrl({url:'https://example.com/a',query:'cacheable research memory'});
  assert.equal(one.contentHash,two.contentHash);assert.equal(requests,1);assert.equal(tool.snapshot().cacheHits,1);
});

console.log(`BIG_PASS_180_EXTERNAL_RESEARCH_TRANSPORT=PASS tests=${tests}`);
