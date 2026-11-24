/**
 * P61 — Integrated Mind Kernel.
 *
 * The organism has accumulated many cognitive organs. This kernel is the
 * integration membrane that converts their signals into one momentary
 * computational stance without pretending that a single score is a mind or
 * consciousness. It provides an explicit broadcast/attention boundary and a
 * bounded action envelope.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type P61Mode='orient'|'experience'|'reflect'|'learn'|'develop'|'rest'|'social';
export interface P61Candidate {action:string;score:number;salience01?:number;confidence01?:number;source?:string;}
export interface P61Input {
  tick:number;at:number;observationId:string;externalInput:boolean;
  identity01:number;workspace01:number;metacognitive01:number;predictionError01:number;
  uncertainty01:number;novelty01:number;grounding01:number;causal01:number;
  bodyEnergy01:number;thermal01:number;cognitiveCapacity01:number;memoryPressure01:number;
  socialNeed01:number;goalPressure01:number;realityGap01:number;memoryHealth01:number;
  developmentalPriority01:number;identityDecision:'allow'|'caution'|'veto';
  candidates:P61Candidate[];
}
export interface P61Frame {
  tick:number;at:number;mode:P61Mode;ignited:boolean;ignition01:number;competition01:number;
  coalition:string[];broadcastToken:string;confidence01:number;integration01:number;stability01:number;
  realityGap01:number;developmentalPressure01:number;memoryPressure01:number;actionBias:Record<string,number>;
  reasons:string[];externalInput:boolean;
}
export interface P61State {
  version:1;cycles:number;ignitions:number;modeCounts:Record<P61Mode,number>;
  meanIntegration01:number;meanStability01:number;meanIgnition01:number;meanRealityGap01:number;
  lastFrame:P61Frame|null;frames:P61Frame[];
}
export const defaultP61=():P61State=>({
  version:1,cycles:0,ignitions:0,
  modeCounts:{orient:0,experience:0,reflect:0,learn:0,develop:0,rest:0,social:0},
  meanIntegration01:.45,meanStability01:.78,meanIgnition01:.35,meanRealityGap01:.5,lastFrame:null,frames:[]
});

export class P61IntegratedMindKernel{
  private state=defaultP61();
  restore(raw?:Partial<P61State>|null){const d=defaultP61(),r=raw??{};this.state={...d,...r,modeCounts:{...d.modeCounts,...(r.modeCounts??{})},frames:Array.isArray(r.frames)?r.frames.slice(-96):[]};}
  snapshot(){return structuredClone(this.state);}
  integrate(input:P61Input):P61Frame{
    const ws=clamp(input.workspace01),mc=clamp(input.metacognitive01),id=clamp(input.identity01),pe=clamp(input.predictionError01),u=clamp(input.uncertainty01),n=clamp(input.novelty01),g=clamp(input.grounding01),ca=clamp(input.causal01),e=clamp(input.bodyEnergy01),th=clamp(input.thermal01),cap=clamp(input.cognitiveCapacity01),mp=clamp(input.memoryPressure01),sn=clamp(input.socialNeed01),gp=clamp(input.goalPressure01),rg=clamp(input.realityGap01),mh=clamp(input.memoryHealth01),dp=clamp(input.developmentalPriority01);
    const candidateRows=input.candidates.slice(0,12).map((c,i)=>({...c,score:clamp(c.score),salience01:clamp(c.salience01??c.score),confidence01:clamp(c.confidence01??.5),source:c.source??(input.externalInput?'external':'internal')}));
    candidateRows.sort((a,b)=>(b.score+b.salience01*.35+b.confidence01*.1)-(a.score+a.salience01*.35+a.confidence01*.1));
    const capacity=Math.max(2,Math.min(6,Math.round(3+cap*2-(mp>.8?1:0))));
    const coalition=candidateRows.slice(0,capacity);
    const sourceDiversity=new Set(coalition.map(c=>c.source)).size/Math.max(1,new Set(candidateRows.map(c=>c.source)).size);
    const competition=clamp(candidateRows.length/Math.max(1,capacity*2));
    const salience=clamp((candidateRows[0]?.salience01??.15)*.52+pe*.12+u*.12+n*.12+gp*.08+sn*.04);
    const ignition=clamp(salience*.42+competition*.13+ws*.19+sourceDiversity*.08+mc*.08+g*.05+(1-rg)*.05+(input.externalInput?.05:0));
    const ignited=ignition>=.58 && coalition.length>=2;
    const integration=clamp(ws*.17+id*.13+mc*.11+g*.12+ca*.1+(1-pe)*.1+(1-u)*.05+(1-rg)*.08+mh*.07+cap*.04+ignition*.03);
    const stability=clamp(id*.22+ws*.16+mc*.12+g*.11+ca*.1+e*.08+cap*.08+mh*.07+(1-th)*.06+(1-rg)*.08);
    const development=Math.max(dp,pe*.28+u*.18+rg*.15+Math.max(0,.8-g)*.12+n*.1+mp*.08+(input.identityDecision==='caution'?.05:input.identityDecision==='veto'?.12:0));
    const pressure:{mode:P61Mode;score:number}[]=[
      {mode:'rest',score:(1-e)*.34+th*.3+(1-cap)*.26+mp*.1},
      {mode:'social',score:sn*.62+gp*.12+(input.externalInput?.15:0)+rg*.11},
      {mode:'learn',score:pe*.3+u*.2+rg*.15+g*.1+mp*.1+(!ignited?.05:0)},
      {mode:'reflect',score:id*.16+u*.17+pe*.15+ca*.14+rg*.14+(1-ws)*.08+development*.16},
      {mode:'develop',score:development*.62+noveltyGate(n,gp)*.2+ca*.08+(1-rg)*.1},
      {mode:'experience',score:(ignited?1:0)*.46+salience*.22+g*.1+id*.08+(1-u)*.08},
      {mode:'orient',score:(1-ignition)*.24+u*.26+n*.18+rg*.16+(1-ws)*.16}
    ];
    pressure.sort((a,b)=>b.score-a.score); const mode=pressure[0].mode; const margin=pressure[0].score-(pressure[1]?.score??0); const confidence=clamp(.34+margin*.85+(1-rg)*.16+mc*.12);
    const actionBias:Record<string,number>={respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0};
    if(mode==='rest'){actionBias.rest=.16;actionBias.explore=-.08;actionBias.verify=-.05;}
    if(mode==='social'){actionBias.respond=.14;actionBias.reflect=.02;}
    if(mode==='learn'){actionBias.verify=.1;actionBias.reflect=.08;}
    if(mode==='reflect'){actionBias.reflect=.12;actionBias.verify=.05;actionBias.respond=-.015;}
    if(mode==='develop'){actionBias.reflect=.08;actionBias.verify=.07;actionBias.explore=.05;}
    if(mode==='experience'){actionBias.respond=.06;actionBias.verify=.03;}
    if(mode==='orient'){actionBias.wait=.05;actionBias.defer=.04;actionBias.explore=-.03;}
    if(!ignited){actionBias.explore-=.025;}
    if(input.identityDecision==='veto'){actionBias.explore-=.12;actionBias.reflect+=.05;actionBias.wait+=.05;}
    if(th>.75||cap<.35){actionBias.rest+=.05;actionBias.explore-=.06;}
    const reasons:string[]=[];
    if(ignited)reasons.push('workspace-ignition'); if(pe>.45)reasons.push('prediction-error'); if(u>.58)reasons.push('uncertainty'); if(rg>.35)reasons.push('reality-gap'); if(mp>.65)reasons.push('memory-pressure'); if(development>.55)reasons.push('developmental-pressure'); if(!reasons.length)reasons.push('stable-integrated-moment');
    const frame:P61Frame={tick:input.tick,at:input.at,mode,ignited,ignition01:ignition,competition01:competition,coalition:coalition.map(c=>c.action),broadcastToken:`p61:${input.tick}:${input.observationId}:${mode}:${ignited?'1':'0'}`,confidence01:confidence,integration01:integration,stability01:stability,realityGap01:rg,developmentalPressure01:clamp(development),memoryPressure01:mp,actionBias,reasons,externalInput:input.externalInput};
    this.state.cycles++; if(ignited)this.state.ignitions++; this.state.modeCounts[mode]++; this.state.meanIntegration01=clamp(this.state.meanIntegration01*.96+integration*.04); this.state.meanStability01=clamp(this.state.meanStability01*.96+stability*.04); this.state.meanIgnition01=clamp(this.state.meanIgnition01*.96+ignition*.04); this.state.meanRealityGap01=clamp(this.state.meanRealityGap01*.96+rg*.04); this.state.lastFrame=frame; this.state.frames=[frame,...this.state.frames].slice(0,96);
    return structuredClone(frame);
  }
}
function noveltyGate(n:number,gp:number){return clamp(n*.7+gp*.3);}
