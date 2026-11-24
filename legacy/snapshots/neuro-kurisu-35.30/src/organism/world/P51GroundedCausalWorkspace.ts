/**
 * P51 Grounded Causal Workspace.
 *
 * A lightweight bridge between observations, semantic anchors and causal
 * hypotheses. It deliberately stays symbolic/structured: this is grounding
 * infrastructure, not a claim of phenomenal consciousness or a learned VLM.
 */
export type P51EvidenceKind = 'observation'|'prediction'|'action'|'outcome'|'counterfactual'|'intervention';
export interface P51Concept { id:string; label:string; kind:'entity'|'event'|'state'|'goal'|'concept'; confidence01:number; mentions:number; lastAt:number; sources:string[]; }
export interface P51Hypothesis { id:string; cause:string; effect:string; confidence01:number; support:number; contradiction:number; lastAt:number; }
export interface P51Branch { id:string; action:string; expected01:number; actual01:number|null; regret01:number; horizon:number; at:number; }
export interface P51Evidence { id:string; kind:P51EvidenceKind; subject:string; value01:number; confidence01:number; at:number; }
export interface P51State {
  version:1; cycles:number; broadcasts:number; concepts:P51Concept[]; hypotheses:P51Hypothesis[];
  branches:P51Branch[]; evidence:P51Evidence[]; unresolved:number; semanticCoverage01:number;
  causalReadiness01:number; groundingQuality01:number; selfWorldAlignment01:number; lastAt:number; lastFocus:string;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tokenize=(text:string)=>Array.from(new Set((text.toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu)??[]))).slice(0,24);
const hid=(s:string)=>{let h=2166136261>>>0; for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0; return h.toString(16)};
export const defaultP51=():P51State=>({version:1,cycles:0,broadcasts:0,concepts:[],hypotheses:[],branches:[],evidence:[],unresolved:0,semanticCoverage01:0,causalReadiness01:0.2,groundingQuality01:0.2,selfWorldAlignment01:0.5,lastAt:0,lastFocus:''});
export class P51GroundedCausalWorkspace {
  private state=defaultP51();
  private conceptIndex = new Map<string, P51Concept>();
  private hypothesisIndex = new Map<string, P51Hypothesis>();
  restore(raw?:Partial<P51State>|null){const b=defaultP51(),r=raw??{};this.state={...b,...r,concepts:Array.isArray(r.concepts)?r.concepts.slice(-128):[],hypotheses:Array.isArray(r.hypotheses)?r.hypotheses.slice(-128):[],branches:Array.isArray(r.branches)?r.branches.slice(-96):[],evidence:Array.isArray(r.evidence)?r.evidence.slice(-256):[]};this.rebuildIndexes();}
  private rebuildIndexes(){
    this.conceptIndex=new Map(this.state.concepts.map(c=>[c.id,c]));
    this.hypothesisIndex=new Map(this.state.hypotheses.map(h=>[h.id,h]));
  }
  snapshot(){return structuredClone(this.state);}
  private concept(label:string,kind:P51Concept['kind'],confidence:number,at:number,source:string){const clean=label.trim().slice(0,100); if(!clean)return ''; const id=`${kind}:${hid(clean)}`; const f=this.conceptIndex.get(id); if(f){f.confidence01=clamp(f.confidence01*.84+clamp(confidence)*.16);f.mentions++;f.lastAt=at;f.sources=[source,...f.sources.filter(x=>x!==source)].slice(0,8);return id;} const row={id,label:clean,kind,confidence01:clamp(confidence),mentions:1,lastAt:at,sources:[source]}; this.state.concepts.unshift(row); this.conceptIndex.set(id,row); if(this.state.concepts.length>128){ const removed=this.state.concepts.pop(); if(removed)this.conceptIndex.delete(removed.id); } return id;}
  private hypothesis(cause:string,effect:string,confidence:number,at:number){const key=`${cause}->${effect}`; const id=`h:${hid(key)}`; const f=this.hypothesisIndex.get(id); if(f){f.confidence01=clamp(f.confidence01*.88+clamp(confidence)*.12);f.support++;f.lastAt=at;return id;} const row={id,cause,effect,confidence01:clamp(confidence),support:1,contradiction:0,lastAt:at}; this.state.hypotheses.unshift(row); this.hypothesisIndex.set(id,row); if(this.state.hypotheses.length>128){ const removed=this.state.hypotheses.pop(); if(removed)this.hypothesisIndex.delete(removed.id); } return id;}
  observe(input:{at:number; text?:string; action?:string; success01?:number; predictionConfidence01?:number; predictionError01?:number; selfLabel?:string; worldLabel?:string; goals?:string[]; sceneObjects?:string[]; facts?:string[]}, options:{clone?:boolean}={}):P51State{
    const at=Number(input.at)||Date.now(); this.state.cycles++; const source=`cycle:${this.state.cycles}`;
    const text=[input.text,input.selfLabel,input.worldLabel,...(input.goals??[]),...(input.sceneObjects??[]),...(input.facts??[])].filter(Boolean).join(' | ');
    const tokens=tokenize(text); for(const t of tokens) this.concept(t, 'concept', .55, at, source);
    if(input.action) this.concept(input.action,'event',clamp(input.predictionConfidence01??.5),at,source);
    if(input.selfLabel) this.concept(input.selfLabel,'state',.65,at,source);
    if(input.worldLabel) this.concept(input.worldLabel,'state',.6,at,source);
    if(input.action && input.worldLabel){const conf=clamp(1-(input.predictionError01??.25));this.hypothesis(input.action,input.worldLabel,conf,at);}
    const confidence=clamp(input.predictionConfidence01??.5); const value=clamp(input.success01??.5);
    const ev:P51Evidence={id:`e:${this.state.cycles}:${hid(text.slice(0,180))}`,kind:input.action?'action':'observation',subject:text.slice(0,180),value01:value,confidence01:confidence,at}; this.state.evidence.unshift(ev);this.state.evidence=this.state.evidence.slice(0,256);
    const conceptDen=Math.max(1,tokens.length+Number(Boolean(input.action))+Number(Boolean(input.worldLabel)));
    this.state.semanticCoverage01=clamp(this.state.concepts.length/64*.55 + Math.min(1,conceptDen/24)*.45);
    this.state.groundingQuality01=clamp(this.state.groundingQuality01*.88 + (tokens.length?0.62:0.22)*.12);
    const causalEvidence=this.state.hypotheses.reduce((s,h)=>s+h.confidence01*Math.log1p(h.support),0)/Math.max(1,this.state.hypotheses.length);
    this.state.causalReadiness01=clamp(this.state.causalReadiness01*.9 + clamp(causalEvidence*.22 + (1-(input.predictionError01??.25))*.58)*.1);
    this.state.selfWorldAlignment01=clamp(this.state.selfWorldAlignment01*.9 + (1-(input.predictionError01??.25))*.1);
    this.state.unresolved=Math.max(0,this.state.hypotheses.filter(h=>h.contradiction>h.support).length + Math.round(this.state.evidence.length/64)-2);
    this.state.lastAt=at; this.state.lastFocus=(input.action??input.worldLabel??tokens[0]??'observe').slice(0,120);
    return options.clone===false?this.state:this.snapshot();
  }
  counterfactual(action:string,expected01:number,actual01:number|null,horizon:number,at=Date.now()){const regret=actual01===null?0:clamp(Math.abs(clamp(expected01)-clamp(actual01)));this.state.branches.unshift({id:`b:${this.state.branches.length+1}:${hid(`${action}|${at}`)}`,action,expected01:clamp(expected01),actual01:actual01===null?null:clamp(actual01),regret01:regret,horizon:Math.max(1,Math.min(12,Math.floor(horizon))),at});this.state.branches=this.state.branches.slice(0,96);if(actual01!==null)this.state.unresolved=Math.max(0,this.state.unresolved+(regret>.45?1:-1));this.state.selfWorldAlignment01=clamp(this.state.selfWorldAlignment01*.92+(1-regret)*.08);return this.snapshot();}
  intervene(subject:string,predicted01:number,actual01:number,at=Date.now()){const err=clamp(Math.abs(clamp(predicted01)-clamp(actual01)));this.state.evidence.unshift({id:`i:${this.state.evidence.length+1}:${hid(subject)}`,kind:'intervention',subject:subject.slice(0,160),value01:clamp(actual01),confidence01:1-err,at});this.state.evidence=this.state.evidence.slice(0,256);if(err>.4)this.state.unresolved++;this.state.causalReadiness01=clamp(this.state.causalReadiness01*.9+(1-err)*.1);return this.snapshot();}
  broadcast(maxItems=6){const concepts=this.state.concepts.slice(0,Math.max(1,Math.min(12,maxItems))).map(c=>c.label);this.state.broadcasts++;return {focus:this.state.lastFocus,concepts,hypotheses:this.state.hypotheses.slice(0,Math.max(1,Math.min(6,maxItems))),semanticCoverage01:this.state.semanticCoverage01,causalReadiness01:this.state.causalReadiness01,groundingQuality01:this.state.groundingQuality01};}
  summary(){return {cycles:this.state.cycles,broadcasts:this.state.broadcasts,concepts:this.state.concepts.length,hypotheses:this.state.hypotheses.length,branches:this.state.branches.length,unresolved:this.state.unresolved,semanticCoverage01:this.state.semanticCoverage01,causalReadiness01:this.state.causalReadiness01,groundingQuality01:this.state.groundingQuality01,selfWorldAlignment01:this.state.selfWorldAlignment01,lastFocus:this.state.lastFocus};}
}
