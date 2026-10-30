import { readFile } from 'node:fs/promises';
import type { VisionSemanticBackend, VisionSemanticInput, VisionSemanticResult } from './VisionSemanticBackend.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

export interface GeminiVisionConfig {
  apiKey:string;
  model?:string;
  timeoutMs?:number;
  maxImageBytes?:number;
  prompt?:string;
}

interface GeminiResponse {
  candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>
}

export function detectGeminiImageMimeType(bytes:Uint8Array):'image/jpeg'|'image/png'|'image/webp'{
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return 'image/png';
  if(bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return 'image/webp';
  throw new Error('gemini-vision-unsupported-image-format');
}

function bytesToBase64(bytes:Uint8Array){ const chunk=0x8000; let out=''; for(let i=0;i<bytes.length;i+=chunk){ out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk))); } return btoa(out); }

const DEFAULT_PROMPT=`You are the visual perception backend of an embodied cognitive organism. Return ONLY JSON with this shape:\n{"sceneLabel":"...","confidence01":0.0,"objects":[{"label":"...","kind":"person|object|place|event|concept|body|unknown","confidence01":0.0}],"relations":[{"from":"...","relation":"...","to":"...","confidence01":0.0}],"events":[{"label":"...","confidence01":0.0}]}\nOnly report content supported by the image. Do not invent object identities, persistent track IDs, 3D coordinates, distances, depth, camera-space transforms, hidden causes, identities, emotions, intentions, or facts that are not directly visible. If location in 3D is required, leave it unknown unless a calibrated spatial source supplies a coordinate frame.`;

function extractText(body:GeminiResponse){ return body.candidates?.flatMap(c=>c.content?.parts??[]).map(p=>p.text??'').join('')?.trim() ?? ''; }
function parsePayload(text:string):any{
  const trimmed=text.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const start=trimmed.indexOf('{'); const end=trimmed.lastIndexOf('}');
  if(start<0||end<=start) throw new Error('gemini-vision-non-json');
  return JSON.parse(trimmed.slice(start,end+1));
}
function normalizeKind(value:unknown){const k=String(value??'unknown');return ['person','object','place','event','concept','body','unknown'].includes(k)?k:'unknown';}

export class GeminiVisionSemanticBackend implements VisionSemanticBackend {
  readonly id:string;
  private readonly cfg:Required<GeminiVisionConfig>;
  constructor(cfg:GeminiVisionConfig){
    if(!cfg.apiKey) throw new Error('gemini-vision-api-key-required');
    this.cfg={model:cfg.model??'gemini-3.8-flash',timeoutMs:Math.max(2000,Math.min(30000,cfg.timeoutMs??12000)),maxImageBytes:Math.max(32_000,Math.min(18_000_000,cfg.maxImageBytes??8_000_000)),prompt:cfg.prompt??DEFAULT_PROMPT,apiKey:cfg.apiKey};
    this.id=`gemini-vision:${this.cfg.model}`;
  }
  async analyze(input:VisionSemanticInput):Promise<VisionSemanticResult>{
    const bytes=await readFile(input.imagePath);
    if(bytes.length>this.cfg.maxImageBytes) throw new Error(`gemini-vision-image-too-large:${bytes.length}`);
    const mimeType=detectGeminiImageMimeType(bytes);
    const started=Date.now();
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.cfg.timeoutMs);
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.cfg.model)}:generateContent`,{
        method:'POST',headers:{'content-type':'application/json','x-goog-api-key':this.cfg.apiKey},signal:controller.signal,
        body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:mimeType,data:bytesToBase64(bytes)}},{text:`${this.cfg.prompt}\nContext scene=${input.context?.scene??'unknown'} location=${input.context?.location??'unknown'} uncertainty=${clamp(input.context?.uncertainty01??.5).toFixed(2)}`}]}],generationConfig:{temperature:0,responseMimeType:'application/json'}}),
      });
      if(!response.ok) throw new Error(`gemini-vision-http-${response.status}`);
      const body=await response.json() as GeminiResponse; const text=extractText(body); if(!text) throw new Error('gemini-vision-empty');
      const p=parsePayload(text);
      const objects=Array.isArray(p.objects)?p.objects.slice(0,48).map((o:any)=>({label:String(o.label??'unknown').slice(0,120),kind:normalizeKind(o.kind) as any,confidence01:clamp(Number(o.confidence01??.5))})):[];
      const relations=Array.isArray(p.relations)?p.relations.slice(0,64).map((r:any)=>({from:String(r.from??'').slice(0,120),relation:String(r.relation??'related').slice(0,80),to:String(r.to??'').slice(0,120),confidence01:clamp(Number(r.confidence01??.5))})).filter((r:any)=>r.from&&r.to):[];
      const events=Array.isArray(p.events)?p.events.slice(0,24).map((e:any)=>({label:String(e.label??'').slice(0,120),confidence01:clamp(Number(e.confidence01??.45))})).filter((e:any)=>e.label):[];
      return {
        semantic:true,
        sceneLabel:p.sceneLabel?String(p.sceneLabel).slice(0,120):undefined,
        confidence01:clamp(Number(p.confidence01??.55)),
        objects,relations,events,backend:this.id,
        latencyMs:Math.max(0,Date.now()-started),
        evidenceKind:'model-output',
      };
    }finally{clearTimeout(timer);}
  }
}
