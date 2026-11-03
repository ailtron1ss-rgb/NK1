export interface P79Observation {tick:number;location?:string;scene?:string;objects?:number;events?:number;audioActivity01?:number;visionChange01?:number;energy01:number;thermal01:number;uncertainty01:number;}
export interface P79State {version:1;samples:number;location?:string;scene?:string;entityCount:number;eventCount:number;affordances01:number;novelty01:number;grounding01:number;uncertainty01:number;history:Array<{tick:number;scene:string;location?:string;grounding01:number}>;}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finiteOr=(value:unknown,fallback:number):number=>{
  const numeric=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;
  return Number.isFinite(numeric)?numeric:(Number.isFinite(fallback)?fallback:0);
};
const countOr=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(finiteOr(value,fallback)));
const textOrUndef=(value:unknown):string|undefined=>typeof value==='string'&&value.length?value.slice(0,240):undefined;
export const defaultP79=():P79State=>({version:1,samples:0,location:undefined,scene:'unknown',entityCount:0,eventCount:0,affordances01:.2,novelty01:.3,grounding01:.2,uncertainty01:.5,history:[]});
export class P79EmbodiedSituationModel{
 private state=defaultP79();
 /** Restore without trusting the snapshot: grounding/novelty/affordances feed EMAs, so NaN poisons embodied grounding; history rows are element-validated. */
 restore(raw:Partial<P79State>|undefined){
  const d=defaultP79();
  const source=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};
  const read=(key:string):unknown=>{try{return (source as Record<string,unknown>)[key];}catch{return undefined;}};
  const historyRaw=read('history');
  this.state={
   version:1,
   samples:countOr(read('samples'),d.samples),
   location:textOrUndef(read('location')),
   scene:textOrUndef(read('scene'))??d.scene,
   entityCount:countOr(read('entityCount'),d.entityCount),
   eventCount:countOr(read('eventCount'),d.eventCount),
   affordances01:clamp(finiteOr(read('affordances01'),d.affordances01)),
   novelty01:clamp(finiteOr(read('novelty01'),d.novelty01)),
   grounding01:clamp(finiteOr(read('grounding01'),d.grounding01)),
   uncertainty01:clamp(finiteOr(read('uncertainty01'),d.uncertainty01)),
   history:Array.isArray(historyRaw)?historyRaw.filter((h):h is {tick:number;scene:string;location?:string;grounding01:number}=>Boolean(h)&&typeof h==='object'&&typeof (h as any).scene==='string').map((h:any)=>({tick:countOr(h.tick,0),scene:String(h.scene).slice(0,240),location:textOrUndef(h.location),grounding01:clamp(finiteOr(h.grounding01,0))})).slice(-48):[],
  };
 }
 snapshot(){return structuredClone(this.state);}
 observe(o:P79Observation){
  const entity=Number(o.objects??0), events=Number(o.events??0); const sceneChange=clamp((o.visionChange01??0)+entity/8+events/8);
  const grounding=clamp(.22+Math.min(1,entity/10)*.32+Math.min(1,events/8)*.18+(o.location?.length?0.12:0)+(o.scene&&o.scene!=='unknown'?0.16:0)-(o.uncertainty01*.2));
  this.state.samples++; this.state.location=o.location; this.state.scene=o.scene??this.state.scene; this.state.entityCount=entity; this.state.eventCount=events; this.state.affordances01=clamp(this.state.affordances01*.85+Math.min(1,(entity+events)/12)*.15); this.state.novelty01=clamp(this.state.novelty01*.9+sceneChange*.1); this.state.grounding01=clamp(this.state.grounding01*.88+grounding*.12); this.state.uncertainty01=clamp(this.state.uncertainty01*.88+o.uncertainty01*.12); this.state.history=[...this.state.history,{tick:o.tick,scene:o.scene??'unknown',location:o.location,grounding01:this.state.grounding01}].slice(-48);
  return this.snapshot();
 }
 actionGrounding(action:string){ if(!action) return 0; const known=['respond','explore','verify','rest','reflect','wait','defer']; return known.includes(action)?this.state.grounding01:clamp(this.state.grounding01*.6); }
}
