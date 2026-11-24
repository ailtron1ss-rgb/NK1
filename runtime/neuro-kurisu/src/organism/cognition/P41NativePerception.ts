import type { ActionKind } from '../core/types.ts';

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
    const raw=input.samples.slice(0,32768);
    const samples=raw.map(Number).map(x=>Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0);
    const sampleRate=Math.max(8000,Math.min(192000,Math.floor(input.sampleRate??16000)));
    const meanValue=mean(samples);
    const rms=Math.sqrt(mean(samples.map(x=>x*x)));
    let crossings=0;
    for(let i=1;i<samples.length;i++) if((samples[i-1]<0)!==(samples[i]<0)) crossings++;
    const zcr=clamp(crossings/Math.max(1,samples.length-1)*1.5);
    const lowN=Math.max(1,Math.floor(samples.length*.22));
    const midStart=lowN, midEnd=Math.max(midStart+1,Math.floor(samples.length*.65));
    let low=0,mid=0,high=0;
    for(let i=0;i<samples.length;i++){
      const energy=samples[i]*samples[i];
      if(i<lowN) low+=energy;
      else if(i<midEnd) mid+=energy;
      else high+=energy;
    }
    const total=low+mid+high || 1;
    let centroid=this.state.lastAudio?.spectralCentroid01 ?? 0;
    let lowBand=this.state.lastAudio?.lowBand01 ?? 0;
    let midBand=this.state.lastAudio?.midBand01 ?? 0;
    let highBand=this.state.lastAudio?.highBand01 ?? 0;
    if(this.state.audioFrames % 8 === 0){
      const downsampleStep=Math.max(1,Math.ceil(samples.length/256));
      const ds:number[]=[]; for(let i=0;i<samples.length;i+=downsampleStep) ds.push(samples[i]);
      const goertzel=(frequency01:number)=>{ const k=Math.max(1,Math.min(ds.length-2,Math.round(frequency01*ds.length))); const omega=2*Math.PI*k/ds.length; const coeff=2*Math.cos(omega); let q1=0,q2=0; for(const x of ds){ const q0=coeff*q1-q2+x; q2=q1; q1=q0; } return Math.max(0,q1*q1+q2*q2-coeff*q1*q2); };
      const spectralProbes=[.04,.09,.16,.27,.42];
      const energies=spectralProbes.map(goertzel); const eTotal=energies.reduce((a,b)=>a+b,0)||1;
      centroid=clamp(spectralProbes.reduce((a,f,i)=>a+f*energies[i],0)/eTotal*1.8);
      lowBand=clamp(energies[0]/eTotal);
      midBand=clamp((energies[1]+energies[2]+energies[3])/eTotal);
      highBand=clamp(energies[4]/eTotal);
    }
    const rms01=clamp(rms*2.2);
    const silence=clamp(1-rms01*2.2);
    const activity=clamp(rms01*(.6+zcr*.4));
    const features:P41AudioFeatures={
      sampleRate,sampleCount:samples.length,rms01,zeroCrossingRate01:zcr,
      spectralCentroid01:centroid,lowBand01:lowBand,midBand01:midBand,highBand01:highBand,
      silence01:silence,activity01:activity,
    };
    this.state.lastAudio=features;
    this.state.audioHistory=[...this.state.audioHistory,features].slice(-24);
    this.state.audioFrames++;
    this.state.metrics.audioActivity01=clamp(this.state.metrics.audioActivity01*.82+activity*.18);
    const prev=this.state.audioHistory.at(-2);
    const stable=prev?1-Math.min(1,Math.abs(prev.rms01-rms01)+Math.abs(prev.spectralCentroid01-centroid)):.5;
    this.state.metrics.signalStability01=clamp(this.state.metrics.signalStability01*.9+stable*.1);
    const cues:Array<[string,number]>=[];
    if(silence>.78)cues.push(['audio-silence',silence]);
    if(activity>.34)cues.push(['audio-activity',activity]);
    if(zcr>.56 && centroid>.42 && rms01>.12)cues.push(['speech-like-acoustic',clamp((zcr+centroid+rms01)/3)]);
    if(highBand>.52 && activity>.36)cues.push(['high-frequency-activity',clamp((highBand+activity)/2)]);
    for(const [label,confidence01] of cues)this.addCue('audio',label,confidence01,at);
  }

  private ingestVision(input:NonNullable<P41NativeInput['vision']>,at:number){
    const raw=input.rawRgb??[]; const pixelCount=Math.floor(raw.length/3); const stride=Math.max(1,Math.ceil(pixelCount/16384)); const rgb:number[]=[]; for(let p=0;p<pixelCount;p+=stride){ rgb.push(Number(raw[p*3]??0),Number(raw[p*3+1]??0),Number(raw[p*3+2]??0)); } const safeRgb=rgb.map(x=>Math.max(0,Math.min(255,Number.isFinite(x)?x:0)));
    let features:P41ImageFeatures;
    if(rgb.length>=3){
      const px=Math.floor(safeRgb.length/3); const gray=new Array<number>(px); let r=0,g=0,b=0;
      for(let i=0;i<px;i++){const rr=safeRgb[i*3]/255,gg=safeRgb[i*3+1]/255,bb=safeRgb[i*3+2]/255;r+=rr;g+=gg;b+=bb;gray[i]=.2126*rr+.7152*gg+.0722*bb;}
      const brightness=mean(gray); const contrast=Math.sqrt(variance(gray,brightness));
      let edge=0; for(let i=1;i<gray.length;i++){edge+=Math.abs(gray[i]-gray[i-1]);}
      const width=Math.max(1,Math.floor(input.width??Math.sqrt(px))); const height=Math.max(1,Math.floor(input.height??Math.ceil(px/width)));
      let edgeSum=0, edgeCount=0;
      for(let y=0;y<height;y++){ for(let x=0;x<width;x++){ const i=y*width+x; if(i>=gray.length) continue; if(x+1<width && i+1<gray.length){edgeSum+=Math.abs(gray[i]-gray[i+1]);edgeCount++;} if(y+1<height && i+width<gray.length){edgeSum+=Math.abs(gray[i]-gray[i+width]);edgeCount++;} } }
      const edgeDensity=clamp(edgeSum/Math.max(1,edgeCount)*2.2); const maxc=Math.max(r,g,b),minc=Math.min(r,g,b); const sat=maxc?clamp((maxc-minc)/maxc):0;
      const previous=this.state.lastImage; const change=previous?clamp(Math.abs(brightness-previous.brightness01)+Math.abs(contrast-previous.contrast01)+Math.abs(sat-previous.saturation01)):.0;
      features={width:Math.max(1,Math.floor(input.width??Math.sqrt(px))),height:Math.max(1,Math.floor(input.height??Math.sqrt(px))),sampleCount:px,brightness01:clamp(brightness),contrast01:clamp(contrast*2.2),edgeDensity01:edgeDensity,saturation01:sat,red01:clamp(r/Math.max(1,px)),green01:clamp(g/Math.max(1,px)),blue01:clamp(b/Math.max(1,px)),change01:change};
    }else{
      const v=input.features.slice(0,2048).map(Number).map(x=>Number.isFinite(x)?x:0); const m=mean(v),sd=Math.sqrt(variance(v,m)); const energy=clamp(Math.sqrt(mean(v.map(x=>x*x))));
      const prev=this.state.lastImage; const change=prev?clamp(Math.abs(energy-prev.contrast01)+Math.abs(m-prev.brightness01)):.0;
      features={width:Math.max(1,Math.floor(input.width??1)),height:Math.max(1,Math.floor(input.height??1)),sampleCount:v.length,brightness01:clamp((m+1)/2),contrast01:clamp(sd*2),edgeDensity01:clamp(energy),saturation01:.5,red01:.33,green01:.33,blue01:.34,change01:change};
    }
    this.state.lastImage=features;this.state.imageHistory=[...this.state.imageHistory,features].slice(-24);this.state.imageFrames++;
    this.state.metrics.visionChange01=clamp(this.state.metrics.visionChange01*.82+features.change01*.18);
    const cues:Array<[string,number]>=[];
    if(features.brightness01<.16)cues.push(['low-light-scene',1-features.brightness01]);
    if(features.brightness01>.82)cues.push(['bright-scene',features.brightness01]);
    if(features.edgeDensity01>.62)cues.push(['high-edge-structure',features.edgeDensity01]);
    if(features.change01>.25)cues.push(['visual-change',features.change01]);
    if(features.saturation01>.65)cues.push(['high-color-saturation',features.saturation01]);
    for(const [label,confidence01] of cues)this.addCue('vision',label,confidence01,at);
  }

  private addCue(modality:'audio'|'vision',label:string,confidence01:number,at:number){
    const id=`native-cue-${hash(`${modality}:${label}`)}`;
    this.state.semanticCues=[{id,modality,label,confidence01:clamp(confidence01),source:'native-signal' as const,at},...this.state.semanticCues].slice(0,96);
  }

  bias(action:ActionKind){
    const a=this.state.metrics.audioActivity01,v=this.state.metrics.visionChange01;
    const uncertainty=clamp((1-this.state.metrics.signalStability01)*.12);
    const map={verify:(a+v)*.025+uncertainty,explore:v*.02,rest:clamp((1-a)*.015),respond:a*.012,reflect:(a+v)*.01,wait:0,defer:uncertainty*.8};
    return clampSigned(Number(map[action]??0));
  }

  summary(){return {lastAudio:this.state.lastAudio,lastImage:this.state.lastImage,cues:this.state.semanticCues.slice(0,16),metrics:this.state.metrics};}
}
