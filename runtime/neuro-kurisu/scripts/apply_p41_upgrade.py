from pathlib import Path
import json
root=Path('/mnt/data/p41work')

# 1) Add native media perception module.
mod=root/'src/organism/cognition/P41NativePerception.ts'
mod.write_text(r'''import type { ActionKind } from '../core/types.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clampSigned=(n:number)=>Math.max(-1,Math.min(1,Number.isFinite(n)?n:0));
const now=()=>Date.now();
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P41AudioFeatures {
  sampleRate:number;
  sampleCount:number;
  rms01:number;
  zeroCrossingRate01:number;
  spectralCentroid01:number;
  lowBand01:number;
  midBand01:number;
  highBand01:number;
  silence01:number;
  activity01:number;
}

export interface P41ImageFeatures {
  width:number;
  height:number;
  sampleCount:number;
  brightness01:number;
  contrast01:number;
  edgeDensity01:number;
  saturation01:number;
  red01:number;
  green01:number;
  blue01:number;
  change01:number;
}

export interface P41NativePerceptionState {
  version:1;
  lastAt:number;
  frames:number;
  audioFrames:number;
  imageFrames:number;
  lastAudio:P41AudioFeatures|null;
  lastImage:P41ImageFeatures|null;
  audioHistory:P41AudioFeatures[];
  imageHistory:P41ImageFeatures[];
  semanticCues:Array<{id:string;modality:'audio'|'vision';label:string;confidence01:number;source:'native-signal';at:number}>;
  metrics:{audioActivity01:number;visionChange01:number;signalStability01:number;nativeCoverage01:number;updates:number};
  actionBias:Record<ActionKind,number>;
}

export const defaultP41NativePerception=():P41NativePerceptionState=>({
  version:1,lastAt:0,frames:0,audioFrames:0,imageFrames:0,lastAudio:null,lastImage:null,
  audioHistory:[],imageHistory:[],semanticCues:[],
  metrics:{audioActivity01:0,visionChange01:0,signalStability01:0.5,nativeCoverage01:0,updates:0},
  actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
});

function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function mean(v:number[]){return v.length?v.reduce((s,x)=>s+x,0)/v.length:0;}
function variance(v:number[],m:number){return v.length?v.reduce((s,x)=>s+(x-m)*(x-m),0)/v.length:0;}

export interface P41NativeInput {
  audio?:{samples:number[];sampleRate?:number};
  vision?:{features:number[];width?:number;height?:number;rawRgb?:number[]};
  at?:number;
}

export class P41NativePerceptionEngine{
  private state=defaultP41NativePerception();
  restore(raw?:Partial<P41NativePerceptionState>|null){
    const d=defaultP41NativePerception(); const r=raw??{};
    this.state={...d,...r,lastAudio:r.lastAudio??null,lastImage:r.lastImage??null,
      audioHistory:Array.isArray(r.audioHistory)?r.audioHistory.slice(-24):[],
      imageHistory:Array.isArray(r.imageHistory)?r.imageHistory.slice(-24):[],
      semanticCues:Array.isArray(r.semanticCues)?r.semanticCues.slice(-96):[],
      metrics:{...d.metrics,...(r.metrics??{})},actionBias:{...d.actionBias,...(r.actionBias??{})}};
  }
  snapshot(){return structuredClone(this.state);}

  ingest(input:P41NativeInput){
    const at=input.at??now(); let coverage=0;
    if(input.audio?.samples?.length){this.ingestAudio(input.audio,at);coverage+=.5;}
    if(input.vision?.features?.length || input.vision?.rawRgb?.length){this.ingestVision(input.vision!,at);coverage+=.5;}
    this.state.frames++;
    this.state.metrics.nativeCoverage01=clamp(this.state.metrics.nativeCoverage01*.96+coverage*.04);
    this.state.metrics.updates++;
    this.state.lastAt=at;
    return this.snapshot();
  }

  private ingestAudio(input:NonNullable<P41NativeInput['audio']>,at:number){
    const samples=input.samples.slice(0,32768).map(Number).map(x=>Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0);
    const sampleRate=Math.max(8000,Math.min(192000,Math.floor(input.sampleRate??16000)));
    const m=mean(samples); const rms=Math.sqrt(mean(samples.map(x=>x*x))); const variance0=variance(samples,m);
    let crossings=0; for(let i=1;i<samples.length;i++){if((samples[i-1]<0)!==(samples[i]<0))crossings++;}
    const zcr=clamp(crossings/Math.max(1,samples.length-1)*1.5);
    const bins=16; const mags=new Array<number>(bins).fill(0);
    const step=Math.max(1,Math.floor(samples.length/(bins*32)));
    for(let k=1;k<=bins;k++){
      const f=step*k; let re=0,im=0;
      for(let i=0;i<samples.length;i+=Math.max(1,Math.floor(samples.length/2048))){const phase=2*Math.PI*f*i/samples.length;re+=samples[i]*Math.cos(phase);im-=samples[i]*Math.sin(phase);}
      mags[k-1]=Math.sqrt(re*re+im*im)/Math.max(1,Math.ceil(samples.length/2048));
    }
    const total=mags.reduce((s,x)=>s+x,0)||1;
    const centroid=clamp(mags.reduce((s,x,i)=>s+x*(i/(bins-1)),0)/total);
    const low=clamp(mags.slice(0,5).reduce((s,x)=>s+x,0)/total);
    const mid=clamp(mags.slice(5,11).reduce((s,x)=>s+x,0)/total);
    const high=clamp(mags.slice(11).reduce((s,x)=>s+x,0)/total);
    const rms01=clamp(rms*2.2); const silence=clamp(1-rms01*2.2); const activity=clamp(rms01*(.6+zcr*.4));
    const features:P41AudioFeatures={sampleRate,sampleCount:samples.length,rms01,zeroCrossingRate01:zcr,spectralCentroid01:centroid,lowBand01:low,midBand01:mid,highBand01:high,silence01:silence,activity01:activity};
    this.state.lastAudio=features;this.state.audioHistory=[...this.state.audioHistory,features].slice(-24);this.state.audioFrames++;
    this.state.metrics.audioActivity01=clamp(this.state.metrics.audioActivity01*.82+activity*.18);
    const prev=this.state.audioHistory.at(-2); const stable=prev?1-Math.min(1,Math.abs(prev.rms01-rms01)+Math.abs(prev.spectralCentroid01-centroid)):.5;
    this.state.metrics.signalStability01=clamp(this.state.metrics.signalStability01*.9+stable*.1);
    const cues:[string,number][]=[];
    if(silence>.78)cues.push(['audio-silence',silence]);
    if(activity>.42)cues.push(['audio-activity',activity]);
    if(zcr>.56 && centroid>.42 && rms01>.12)cues.push(['speech-like-acoustic',clamp((zcr+centroid+rms01)/3)]);
    if(high>.52 && activity>.36)cues.push(['high-frequency-activity',clamp((high+activity)/2)]);
    for(const [label,confidence01] of cues)this.addCue('audio',label,confidence01,at);
  }

  private ingestVision(input:NonNullable<P41NativeInput['vision']>,at:number){
    const rgb=input.rawRgb?.slice(0,640*480*3).map(Number).map(x=>Math.max(0,Math.min(255,Number.isFinite(x)?x:0)))??[];
    let features:P41ImageFeatures;
    if(rgb.length>=3){
      const px=Math.floor(rgb.length/3); const gray=new Array<number>(px); let r=0,g=0,b=0;
      for(let i=0;i<px;i++){const rr=rgb[i*3]/255,gg=rgb[i*3+1]/255,bb=rgb[i*3+2]/255;r+=rr;g+=gg;b+=bb;gray[i]=.2126*rr+.7152*gg+.0722*bb;}
      const brightness=mean(gray); const contrast=Math.sqrt(variance(gray,brightness));
      let edge=0; for(let i=1;i<gray.length;i++){edge+=Math.abs(gray[i]-gray[i-1]);}
      const edgeDensity=clamp(edge/Math.max(1,gray.length-1)*2.2); const maxc=Math.max(r,g,b),minc=Math.min(r,g,b); const sat=maxc?clamp((maxc-minc)/maxc):0;
      const previous=this.state.lastImage; const change=previous?clamp(Math.abs(brightness-previous.brightness01)+Math.abs(contrast-previous.contrast01)+Math.abs(sat-previous.saturation01)):.0;
      features={width:Math.max(1,Math.floor(input.width??Math.sqrt(px))),height:Math.max(1,Math.floor(input.height??Math.sqrt(px))),sampleCount:px,brightness01:clamp(brightness),contrast01:clamp(contrast*2.2),edgeDensity01:edgeDensity,saturation01:sat,red01:clamp(r/Math.max(1,px)),green01:clamp(g/Math.max(1,px)),blue01:clamp(b/Math.max(1,px)),change01:change};
    }else{
      const v=input.features.slice(0,2048).map(Number).map(x=>Number.isFinite(x)?x:0); const m=mean(v),sd=Math.sqrt(variance(v,m)); const energy=clamp(Math.sqrt(mean(v.map(x=>x*x))));
      const prev=this.state.lastImage; const change=prev?clamp(Math.abs(energy-prev.contrast01)+Math.abs(m-prev.brightness01)):.0;
      features={width:Math.max(1,Math.floor(input.width??1)),height:Math.max(1,Math.floor(input.height??1)),sampleCount:v.length,brightness01:clamp((m+1)/2),contrast01:clamp(sd*2),edgeDensity01:clamp(energy),saturation01:.5,red01:.33,green01:.33,blue01:.34,change01:change};
    }
    this.state.lastImage=features;this.state.imageHistory=[...this.state.imageHistory,features].slice(-24);this.state.imageFrames++;
    this.state.metrics.visionChange01=clamp(this.state.metrics.visionChange01*.82+features.change01*.18);
    const cues:[string,number][]=[];
    if(features.brightness01<.16)cues.push(['low-light-scene',1-features.brightness01]);
    if(features.brightness01>.82)cues.push(['bright-scene',features.brightness01]);
    if(features.edgeDensity01>.62)cues.push(['high-edge-structure',features.edgeDensity01]);
    if(features.change01>.25)cues.push(['visual-change',features.change01]);
    if(features.saturation01>.65)cues.push(['high-color-saturation',features.saturation01]);
    for(const [label,confidence01] of cues)this.addCue('vision',label,confidence01,at);
  }

  private addCue(modality:'audio'|'vision',label:string,confidence01:number,at:number){
    const id=`native-cue-${hash(`${modality}:${label}`)}`;
    this.state.semanticCues=[{id,modality,label,confidence01:clamp(confidence01),source:'native-signal',at},...this.state.semanticCues].slice(0,96);
  }

  bias(action:ActionKind){
    const a=this.state.metrics.audioActivity01,v=this.state.metrics.visionChange01;
    const uncertainty=clamp((1-this.state.metrics.signalStability01)*.12);
    const map={verify:(a+v)*.025+uncertainty,explore:v*.02,rest:clamp((1-a)*.015),respond:a*.012,reflect:(a+v)*.01,wait:0,defer:uncertainty*.8};
    return clampSigned(Number(map[action]??0));
  }

  summary(){return {lastAudio:this.state.lastAudio,lastImage:this.state.lastImage,cues:this.state.semanticCues.slice(0,16),metrics:this.state.metrics};}
}
''',encoding='utf-8')

# 2) Extend types.
types=root/'src/organism/core/types.ts'
s=types.read_text()
s=s.replace("vision?: { features:number[];", "vision?: { features:number[]; width?:number; height?:number; rawRgb?:number[];")
types.write_text(s)

# 3) Extend embodiment facet and migrations.
types=root/'src/organism/core/types.ts'; s=types.read_text()
s=s.replace("  p41SemanticPerception: import('../cognition/P41SemanticPerception.ts').P41PerceptionState;", "  p41SemanticPerception: import('../cognition/P41SemanticPerception.ts').P41PerceptionState;\n  p41NativePerception: import('../cognition/P41NativePerception.ts').P41NativePerceptionState;")
types.write_text(s)

mig=root/'src/organism/persistence/StateMigrations.ts'; s=mig.read_text()
s=s.replace("import { defaultP41SemanticPerception } from '../cognition/P41SemanticPerception.ts';", "import { defaultP41SemanticPerception } from '../cognition/P41SemanticPerception.ts';\nimport { defaultP41NativePerception } from '../cognition/P41NativePerception.ts';")
s=s.replace("const p41Default = defaultP41SemanticPerception();", "const p41Default = defaultP41SemanticPerception();")
needle="  embodiment.p41SemanticPerception = { ...p41Default, ...p41Raw, version:1, scene:{...p41Default.scene,...(p41Raw.scene??{})}, entities:Array.isArray(p41Raw.entities)?p41Raw.entities.slice(-192):[], relations:Array.isArray(p41Raw.relations)?p41Raw.relations.slice(-384):[], events:Array.isArray(p41Raw.events)?p41Raw.events.slice(-128):[], snapshots:Array.isArray(p41Raw.snapshots)?p41Raw.snapshots.slice(-128):[], pending:Array.isArray(p41Raw.pending)?p41Raw.pending.slice(-64):[], modalityReliability:{...p41Default.modalityReliability,...(p41Raw.modalityReliability??{})}, actionBias:{...p41Default.actionBias,...(p41Raw.actionBias??{})}, metrics:{...p41Default.metrics,...(p41Raw.metrics??{})} };"
rep=needle+"\n  const p41NativeDefault = defaultP41NativePerception();\n  const p41NativeRaw = (raw.facets as any)?.embodiment?.p41NativePerception ?? (raw as any).p41NativePerception ?? {};\n  embodiment.p41NativePerception = { ...p41NativeDefault, ...p41NativeRaw, version:1, lastAudio:p41NativeRaw.lastAudio??null, lastImage:p41NativeRaw.lastImage??null, audioHistory:Array.isArray(p41NativeRaw.audioHistory)?p41NativeRaw.audioHistory.slice(-24):[], imageHistory:Array.isArray(p41NativeRaw.imageHistory)?p41NativeRaw.imageHistory.slice(-24):[], semanticCues:Array.isArray(p41NativeRaw.semanticCues)?p41NativeRaw.semanticCues.slice(-96):[], metrics:{...p41NativeDefault.metrics,...(p41NativeRaw.metrics??{})}, actionBias:{...p41NativeDefault.actionBias,...(p41NativeRaw.actionBias??{})} };"
s=s.replace(needle,rep)
mig.write_text(s)

# 4) Core import/default/field/restore/observe/persistence/methods.
core=root/'src/organism/core/OrganismCore.ts'; s=core.read_text()
s=s.replace("import { P41SemanticPerceptionEngine } from '../cognition/P41SemanticPerception.ts';", "import { P41SemanticPerceptionEngine } from '../cognition/P41SemanticPerception.ts';\nimport { P41NativePerceptionEngine } from '../cognition/P41NativePerception.ts';")
s=s.replace("p41SemanticPerception: defaultP41SemanticPerception() };", "p41SemanticPerception: defaultP41SemanticPerception(), p41NativePerception: defaultP41NativePerception() };")
s=s.replace("  private readonly p41SemanticPerception = new P41SemanticPerceptionEngine();", "  private readonly p41SemanticPerception = new P41SemanticPerceptionEngine();\n  private readonly p41NativePerception = new P41NativePerceptionEngine();")
s=s.replace("    this.p41SemanticPerception.restore((this.persisted.facets.embodiment as any).p41SemanticPerception);", "    this.p41SemanticPerception.restore((this.persisted.facets.embodiment as any).p41SemanticPerception);\n    this.p41NativePerception.restore((this.persisted.facets.embodiment as any).p41NativePerception);")
old="""    this.p41SemanticPerception.ingest({\n      text: observation.text,\n      vision: observation.vision ? { sceneLabel: observation.vision.sceneLabel, confidence01: observation.vision.confidence01, objects: observation.vision.objects, relations: observation.vision.relations, semantic: Boolean((observation.vision as any).semantic ?? true), latencyMs: Number((observation.vision as any).latencyMs ?? 0) } : undefined,\n      audio: observation.audio ? { events: observation.audio.events, semantic: Boolean((observation.audio as any).semantic ?? true), latencyMs: Number((observation.audio as any).latencyMs ?? 0) } : undefined,\n      sensor: observation.embodiment ? { energy01: observation.embodiment.bodyEnergy01, thermal01: observation.embodiment.thermalStrain01, capacity01: observation.embodiment.cognitiveCapacity01, freshness01: observation.embodiment.sensoryFreshness01, location: observation.worldContext?.location } : undefined,\n      world: observation.worldContext ? { scene: observation.worldContext.location, objects: observation.worldContext.objects?.map(o => ({label:o.label,kind:'object' as const,confidence01:o.visible?.65:.35})), events: observation.worldContext.events } : undefined,\n      at: state.at,\n    });\n    this.persisted.facets.embodiment.p41SemanticPerception=this.p41SemanticPerception.snapshot();"""
new=old+"\n    this.p41NativePerception.ingest({\n      audio: observation.audio ? { samples: observation.audio.samples, sampleRate: observation.audio.sampleRate } : undefined,\n      vision: observation.vision ? { features: observation.vision.features, width: (observation.vision as any).width, height: (observation.vision as any).height, rawRgb: (observation.vision as any).rawRgb } : undefined,\n      at: state.at,\n    });\n    this.persisted.facets.embodiment.p41NativePerception=this.p41NativePerception.snapshot();"
s=s.replace(old,new)
# add bias
s=s.replace(" + this.p40SemanticIntelligence.bias(action) + this.p41SemanticPerception.bias(action) + memoryBias", " + this.p40SemanticIntelligence.bias(action) + this.p41SemanticPerception.bias(action) + this.p41NativePerception.bias(action) + memoryBias")
# use P41 cues in P40 claims
s=s.replace("...p40Sensor.relationEdges.slice(0,16).map(r => ({ modality:'world' as const, subject:r.from, predicate:r.relation, object:r.to, confidence01:r.confidence01, source:'observed' as const })),", "...p40Sensor.relationEdges.slice(0,16).map(r => ({ modality:'world' as const, subject:r.from, predicate:r.relation, object:r.to, confidence01:r.confidence01, source:'observed' as const })),\n      ...this.p41NativePerception.snapshot().semanticCues.slice(0,8).map(c => ({ modality:c.modality, subject:'sensorium', predicate:'cue', object:c.label, confidence01:c.confidence01, source:'derived' as const })),")
# persistence sync where p40 persisted; add p41 native snapshot
s=s.replace("    this.persisted.facets.embodiment.p40SemanticIntelligence=this.p40SemanticIntelligence.snapshot();", "    this.persisted.facets.embodiment.p40SemanticIntelligence=this.p40SemanticIntelligence.snapshot();\n    this.persisted.facets.embodiment.p41NativePerception=this.p41NativePerception.snapshot();", 1)
# methods near p41 methods
s=s.replace("  p41PerceptionSnapshot(){ return this.p41SemanticPerception.snapshot(); }", "  p41PerceptionSnapshot(){ return this.p41SemanticPerception.snapshot(); }\n  p41NativePerceptionSnapshot(){ return this.p41NativePerception.snapshot(); }\n  p41NativePerceptionSummary(){ return this.p41NativePerception.summary(); }")
# p41 persistence sync at feedback occurrence
s=s.replace("      this.persisted.facets.embodiment.p41SemanticPerception=this.p41SemanticPerception.snapshot();", "      this.persisted.facets.embodiment.p41SemanticPerception=this.p41SemanticPerception.snapshot();\n      this.persisted.facets.embodiment.p41NativePerception=this.p41NativePerception.snapshot();")
core.write_text(s)

# 5) Export module.
idx=root/'src/organism/index.ts'; s=idx.read_text();
if "P41NativePerception" not in s: s += "\nexport * from './cognition/P41NativePerception.ts';\n"
idx.write_text(s)

# 6) Release contract/version.
rel=root/'src/organism/system/ReleaseContract.ts'; rel.write_text("export const RELEASE_CONTRACT = Object.freeze({\n  application: '9.1.0',\n  organismCore: '38.0.0-p41-semantic-perception-temporal-world-mega-pack',\n  stateSchema: 44,\n  phase: 'P41-semantic-perception-temporal-world-mega-pack',\n  node: '>=22.12.0',\n  npm: '>=10.8.0',\n  canonicalPath: 'src/organism',\n  legacyPath: 'legacy-original',\n} as const);\nexport type ReleaseContract = typeof RELEASE_CONTRACT;\n",encoding='utf-8')
# Version.json in current partial tree should match P40? keep unless already P41 desired; set now.
(root/'VERSION.json').write_text(json.dumps({"application":"9.1.0","organismCore":"38.0.0-p41-semantic-perception-temporal-world-mega-pack","stateSchema":44,"phase":"P41-semantic-perception-temporal-world-mega-pack","releaseName":"Neuro-Kurisu Evolution","node":">=22.12.0","npm":">=10.8.0","canonicalPath":"src/organism","legacyPath":"legacy-original"},ensure_ascii=False,indent=2)+"\n")
# package version
pkg=root/'package.json'; data=json.loads(pkg.read_text()); data['version']='9.1.0'; data['scripts']['test:p41:native']='node --experimental-strip-types tests/p41-native-perception.mjs'; data['scripts']['test:p41:integration']='node --experimental-strip-types tests/p41-integration.mjs'; data['scripts']['test:p41:migration']='node --experimental-strip-types tests/p41-migration.mjs'; data['scripts']['test:p41:server']='node --experimental-strip-types tests/p41-server-smoke.mjs'; pkg.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
# lock package version
lock=root/'package-lock.json'; ld=json.loads(lock.read_text()); ld['version']='9.1.0'; ld.get('packages',{}).get('',{})['version']='9.1.0'; lock.write_text(json.dumps(ld,ensure_ascii=False,indent=2)+"\n")

print('applied')
