/**
 * P58 — Integrated Cognitive Kernel.
 *
 * A thin integration membrane over the existing cognitive organs. It does not
 * replace them; it converts their outputs into one bounded frame used for
 * attention, action arbitration and developmental mode selection.
 *
 * Design principle: integration is useful only if it changes behaviour in a
 * measurable and reversible way. No consciousness claim is produced here.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const P58_MODES:readonly P58Mode[]=['stabilize','attend','learn','explore','rest','social'];
const strList=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,cap):[];
const biasMap=(v:unknown):Record<string,number>=>{const out:Record<string,number>={};if(!v||typeof v!=='object')return out;const r=v as Record<string,unknown>;for(const k of Object.keys(r))out[k]=clamp(finN(r[k],0));return out;};
const modeCounts=(v:unknown,d:Record<P58Mode,number>):Record<P58Mode,number>=>{const out={...d};if(!v||typeof v!=='object')return out;const r=v as Record<string,unknown>;for(const m of P58_MODES)if(m in r)out[m]=cnt(r[m],d[m]);return out;};
const sanFrame=(x:unknown):P58Frame|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {tick:cnt(r.tick,0),at:Math.max(0,finN(r.at,0)),mode:P58_MODES.includes(r.mode as P58Mode)?r.mode as P58Mode:'stabilize',salience01:clamp(finN(r.salience01,0)),confidence01:clamp(finN(r.confidence01,0)),integrated01:clamp(finN(r.integrated01,0)),stability01:clamp(finN(r.stability01,0)),realityGap01:clamp(finN(r.realityGap01,0)),actionBias:biasMap(r.actionBias),reasons:strList(r.reasons,12),broadcastToken:typeof r.broadcastToken==='string'?r.broadcastToken.slice(0,160):''};};
const mapFrames=(v:unknown):P58Frame[]=>{if(!Array.isArray(v))return [];const out:P58Frame[]=[];for(const x of v.slice(-96)){try{const f=sanFrame(x);if(f)out.push(f);}catch{/* drop malformed frame */}}return out;};

export type P58Mode='stabilize'|'attend'|'learn'|'explore'|'rest'|'social';
export interface P58Signals {
  identity01:number; workspace01:number; metacognitive01:number;
  predictionError01:number; uncertainty01:number; novelty01:number;
  grounding01:number; causal01:number; bodyEnergy01:number;
  thermal01:number; cognitiveCapacity01:number; memoryPressure01:number;
  socialNeed01:number; goalPressure01:number; realityGap01:number;
}
export interface P58Frame {
  tick:number; at:number; mode:P58Mode; salience01:number; confidence01:number;
  integrated01:number; stability01:number; realityGap01:number;
  actionBias:Record<string,number>; reasons:string[]; broadcastToken:string;
}
export interface P58State {
  version:1; cycles:number; modeCounts:Record<P58Mode,number>;
  meanIntegrated01:number; meanStability01:number; meanRealityGap01:number;
  lastFrame:P58Frame|null; frames:P58Frame[];
}
export const defaultP58=():P58State=>({version:1,cycles:0,modeCounts:{stabilize:0,attend:0,learn:0,explore:0,rest:0,social:0},meanIntegrated01:.5,meanStability01:.8,meanRealityGap01:.5,lastFrame:null,frames:[]});

export class P58CognitiveKernel {
  private state=defaultP58();
  restore(raw?:Partial<P58State>|null){const d=defaultP58();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let lastFrame:P58Frame|null=null;try{lastFrame=sanFrame(read('lastFrame'));}catch{lastFrame=null;}this.state={version:1,cycles:cnt(read('cycles'),d.cycles),modeCounts:modeCounts(read('modeCounts'),d.modeCounts),meanIntegrated01:clamp(finN(read('meanIntegrated01'),d.meanIntegrated01)),meanStability01:clamp(finN(read('meanStability01'),d.meanStability01)),meanRealityGap01:clamp(finN(read('meanRealityGap01'),d.meanRealityGap01)),lastFrame,frames:mapFrames(read('frames'))};}
  snapshot(){return structuredClone(this.state);}
  integrate(tick:number,at:number,s:P58Signals):P58Frame{
    const id=clamp(s.identity01), ws=clamp(s.workspace01), mc=clamp(s.metacognitive01), pe=clamp(s.predictionError01), u=clamp(s.uncertainty01), n=clamp(s.novelty01), g=clamp(s.grounding01), ca=clamp(s.causal01), e=clamp(s.bodyEnergy01), th=clamp(s.thermal01), cap=clamp(s.cognitiveCapacity01), mp=clamp(s.memoryPressure01), sn=clamp(s.socialNeed01), gp=clamp(s.goalPressure01), rg=clamp(s.realityGap01);
    const stability=clamp(id*.24+ws*.18+mc*.12+g*.14+ca*.12+e*.08+cap*.07+(1-th)*.05);
    const integrated=clamp(id*.12+ws*.14+mc*.11+(1-pe)*.10+(1-u)*.06+g*.12+ca*.10+e*.07+cap*.07+(1-rg)*.11);
    const salience=clamp(pe*.24+u*.18+n*.18+gp*.16+sn*.10+rg*.14+(1-e)*.05+th*.05);
    const pressures:{mode:P58Mode;value:number}[]=[
      {mode:'stabilize',value:(1-stability)*.72+rg*.28},
      {mode:'attend',value:salience*.42+u*.18+gp*.18+(1-ws)*.22},
      {mode:'learn',value:pe*.28+u*.18+rg*.14+g*.12+mc*.10+mp*.18},
      {mode:'explore',value:n*.38+u*.24+g*.12+gp*.14+e*.06+ca*.06},
      {mode:'rest',value:(1-e)*.42+th*.24+mp*.12+(1-cap)*.22},
      {mode:'social',value:sn*.52+gp*.16+(1-mc)*.10+rg*.08+n*.14},
    ];
    pressures.sort((a,b)=>b.value-a.value);
    const mode=pressures[0].mode;
    const gap=pressures[0].value-(pressures[1]?.value??0);
    const confidence=clamp(.45+gap*.7+(1-rg)*.15);
    const actionBias:Record<string,number>={respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0};
    if(mode==='rest'){actionBias.rest=.12;actionBias.explore=-.06;actionBias.verify=-.04;}
    if(mode==='explore'){actionBias.explore=.10;actionBias.verify=.04;actionBias.rest=-.04;}
    if(mode==='learn'){actionBias.verify=.08;actionBias.reflect=.07;actionBias.respond=-.01;}
    if(mode==='social'){actionBias.respond=.11;actionBias.explore=-.02;}
    if(mode==='stabilize'){actionBias.rest=.06;actionBias.wait=.05;actionBias.defer=.04;actionBias.explore=-.07;}
    if(mode==='attend'){actionBias.verify=.03;actionBias.reflect=.03;}
    if(th>.75||cap<.35){actionBias.explore-=.05;actionBias.verify-=.03;actionBias.reflect-=.02;actionBias.rest+=.04;}
    const reasons:string[]=[];
    if(pe>.45)reasons.push('prediction-error'); if(rg>.35)reasons.push('reality-gap'); if(u>.58)reasons.push('uncertainty'); if(n>.58)reasons.push('novelty'); if(sn>.62)reasons.push('social-need'); if(mp>.62)reasons.push('memory-pressure'); if(th>.72)reasons.push('thermal-pressure'); if(!reasons.length)reasons.push('stable-integration');
    const frame:P58Frame={tick,at,mode,salience01:salience,confidence01:confidence,integrated01:integrated,stability01:stability,realityGap01:rg,actionBias,reasons,broadcastToken:`p58:${tick}:${mode}:${Math.round(integrated*1000)}`};
    this.state.cycles++;this.state.modeCounts[mode]++;this.state.meanIntegrated01=clamp(this.state.meanIntegrated01*.96+integrated*.04);this.state.meanStability01=clamp(this.state.meanStability01*.96+stability*.04);this.state.meanRealityGap01=clamp(this.state.meanRealityGap01*.96+rg*.04);this.state.lastFrame=frame;this.state.frames=[frame,...this.state.frames].slice(0,96);
    return structuredClone(frame);
  }
}
