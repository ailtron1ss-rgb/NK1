import type { ActionKind } from '../core/types.ts';
/**
 * P64 — Integrated Organism Dynamics.
 *
 * This is the canonical arbitration layer for the current moment. Older P58,
 * P61 and P63 layers remain as specialist/diagnostic organs, but P64 is the
 * single place where their signals are fused into a final developmental stance.
 *
 * Design goals:
 * - one bounded current-moment representation;
 * - hysteresis to prevent mode lock;
 * - explicit evidence gating;
 * - action arbitration that respects body, identity and uncertainty;
 * - measurable separation between integration and complexity.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type P64Mode='protect'|'experience'|'social'|'learn'|'reflect'|'develop'|'explore'|'rest'|'orient';
export interface P64Signals {
  identity01:number; workspace01:number; metacognitive01:number; predictionError01:number;
  uncertainty01:number; novelty01:number; grounding01:number; causal01:number;
  bodyEnergy01:number; thermal01:number; cognitiveCapacity01:number; memoryPressure01:number;
  socialNeed01:number; goalPressure01:number; realityGap01:number; memoryHealth01:number;
  agency01:number; externalInput:boolean; identityDecision:'allow'|'caution'|'veto';
  p58Mode?:string; p58Stability01?:number; p61Mode?:string; p61Integration01?:number;
  p63Mode?:string; p63Priority01?:number; retrievalQuality01?:number; conflictPressure01?:number;
  homeostaticPressure01?:number; homeostaticMode?:string; goalFocus01?:number; goalStaleness01?:number; dopamine01?:number;
}
export interface P64Candidate {action:string;score:number;confidence01:number;predictedUtility?:number;source?:string;userRequested?:boolean;}
export interface P64Frame {
  tick:number;at:number;mode:P64Mode;modeChanged:boolean;modeStreak:number;modePressure01:number;
  integration01:number;stability01:number;agency01:number;attention01:number;developmentalBudget01:number;confidence01:number;
  epistemicGate01:number;realityGap01:number;competition01:number;coalition:string[];
  actionBias:Record<string,number>;candidateScores:Record<string,number>;
  reasons:string[];broadcastToken:string;
}
export interface P64State {
  version:1;cycles:number;modeChanges:number;forcedDiversions:number;
  modeCounts:Record<P64Mode,number>;modeStreak:number;lastMode:P64Mode|null;
  meanIntegration01:number;meanStability01:number;meanAgency01:number;meanEpistemicGate01:number;
  meanRealityGap01:number;lastFrame:P64Frame|null;history:P64Frame[];
}

export const defaultP64=():P64State=>({
  version:1,cycles:0,modeChanges:0,forcedDiversions:0,
  modeCounts:{protect:0,experience:0,social:0,learn:0,reflect:0,develop:0,explore:0,rest:0,orient:0},
  modeStreak:0,lastMode:null,meanIntegration01:.5,meanStability01:.8,meanAgency01:.5,
  meanEpistemicGate01:.5,meanRealityGap01:.5,lastFrame:null,history:[]
});

export class P64IntegratedOrganismDynamics {
  private state=defaultP64();
  restore(raw?:Partial<P64State>|null){
    const d=defaultP64(),r=raw??{};
    this.state={...d,...r,
      modeCounts:{...d.modeCounts,...(r.modeCounts??{})},
      history:Array.isArray(r.history)?r.history.slice(-128):[]
    };
  }
  snapshot(){return structuredClone(this.state);}
  /** Durable projection keeps enough recent mode frames for diagnostics/restart without persisting the full 128-frame working window. */
  persistenceSnapshot(){
    return {
      ...this.state,
      modeCounts:{...this.state.modeCounts},
      lastFrame:this.state.lastFrame?{...this.state.lastFrame,coalition:this.state.lastFrame.coalition.slice(),actionBias:{...this.state.lastFrame.actionBias},candidateScores:{...this.state.lastFrame.candidateScores},reasons:this.state.lastFrame.reasons.slice()}:null,
      history:this.state.history.slice(0,32).map(frame=>({
        ...frame, coalition:frame.coalition.slice(), actionBias:{...frame.actionBias}, candidateScores:{...frame.candidateScores}, reasons:frame.reasons.slice()
      })),
    };
  }


  finalize<T extends {action:ActionKind;score:number}>(candidates:T[], userRequestedAction:ActionKind|null, frame:P64Frame):T|null{
    if(!candidates.length) return null;
    const ranked=candidates.map(c=>{
      let score=clamp(c.score);
      if(userRequestedAction && c.action===userRequestedAction) score+=.025;
      if(frame.mode==='protect' || frame.mode==='rest'){
        if(c.action==='explore') score-=.14;
        if(c.action==='rest') score+=.06;
        if(c.action==='verify') score+=.03;
      }
      if(frame.epistemicGate01<.45){ if(c.action==='explore') score-=.11; if(c.action==='verify') score+=.055; }
      if(frame.realityGap01>.5 && c.action==='respond') score-=.035;
      if(frame.stability01<.48 && c.action==='explore') score-=.08;
      score+=clamp(frame.actionBias[c.action]??0)*.25;
      return {...c,score:clamp(score)};
    }).sort((a,b)=>b.score-a.score);
    return structuredClone(ranked[0]??null);
  }

  arbitrate(input:{tick:number;at:number;signals:P64Signals;candidates:P64Candidate[]}):P64Frame{
    const s=input.signals;
    const candidates=input.candidates.slice(0,12).map(c=>({...c}));
    const id=clamp(s.identity01),hs=clamp(s.homeostaticPressure01??0),gf=clamp(s.goalFocus01??s.goalPressure01),gs=clamp(s.goalStaleness01??0),ws=clamp(s.workspace01),mc=clamp(s.metacognitive01),pe=clamp(s.predictionError01),u=clamp(s.uncertainty01),n=clamp(s.novelty01),g=clamp(s.grounding01),ca=clamp(s.causal01),e=clamp(s.bodyEnergy01),th=clamp(s.thermal01),cap=clamp(s.cognitiveCapacity01),mp=clamp(s.memoryPressure01),sn=clamp(s.socialNeed01),gp=clamp(s.goalPressure01),rg=clamp(s.realityGap01),mh=clamp(s.memoryHealth01),ag=clamp(s.agency01);
    const rows=candidates.map(c=>({...c,score:clamp(c.score),confidence01:clamp(c.confidence01),predictedUtility:c.predictedUtility==null?undefined:clamp(c.predictedUtility)}));
    rows.sort((a,b)=>(b.score+b.confidence01*.08)-(a.score+a.confidence01*.08));
    const capacity=Math.max(2,Math.min(6,Math.round(2+cap*4-(mp>.82?1:0))));
    const coalition=rows.slice(0,capacity);
    const competition=clamp(rows.length/Math.max(1,capacity*2));
    const sources=new Set(coalition.map(c=>c.source??'internal')).size;
    const sourcePool=Math.max(1,new Set(rows.map(c=>c.source??'internal')).size);
    const diversity=clamp(sources/sourcePool);
    const salience=clamp((rows[0]?.score??.2)*.46+pe*.14+u*.11+n*.07+gp*.08+gf*.08+sn*.04+gs*.02);
    const integration=clamp(id*.12+ws*.12+mc*.1+g*.12+ca*.1+(1-pe)*.08+(1-u)*.05+(1-rg)*.1+mh*.08+e*.04+cap*.05+salience*.04+ag*.1);
    const stability=clamp(id*.2+ws*.15+mc*.12+g*.1+ca*.1+e*.08+cap*.08+mh*.07+(1-th)*.05+(1-rg)*.05);
    const agency=clamp(ag*.38+id*.16+gp*.12+ca*.1+g*.1+(1-u)*.06+(s.externalInput?.04:0));
    const attention=clamp(ws*.25+salience*.25+mc*.12+gp*.12+n*.1+u*.06+(1-mp)*.1);
    const gate=clamp((1-rg)*.24+g*.2+ca*.16+mc*.12+mh*.12+(1-u)*.08+(1-pe)*.08);
    const devBudget=clamp(.18+pe*.2+u*.12+n*.12+rg*.08+gp*.08+gf*.08+(1-e)*.08+(1-cap)*.1-(s.identityDecision==='veto'?.2:s.identityDecision==='caution'?.08:0));
    const pressures:Record<P64Mode,number>={
      protect:(1-id)*.44+rg*.22+th*.16+(1-cap)*.12+hs*.14+(s.homeostaticMode==='protect'?.08:0)+(s.identityDecision==='veto'?.18:0),
      experience:salience*.42+g*.12+id*.1+ws*.08+(1-u)*.08+(s.externalInput?.12:0),
      social:sn*.54+gp*.12+(s.externalInput?.1:0)+rg*.08+(1-mc)*.06,
      learn:pe*.34+u*.18+rg*.14+g*.1+mp*.12+(1-gate)*.12,
      reflect:id*.12+u*.17+pe*.13+ca*.13+rg*.14+gp*.06+gf*.08+gs*.04+(1-ws)*.07+devBudget*.16,
      develop:devBudget*.58+n*.08+ca*.1+(1-rg)*.08+pe*.08+gf*.06-hs*.04,
      explore:n*.32+u*.18+g*.1+gp*.09+gf*.06+ag*.08+gate*.06+(1-clamp(s.conflictPressure01??0))*.1-gs*.05-hs*.06+(s.homeostaticMode==='explore'?.04:0),
      rest:(1-e)*.42+th*.22+(1-cap)*.18+mp*.1+hs*.18+(s.homeostaticMode==='recover'?.10:0),
      orient:(1-salience)*.2+u*.28+n*.12+rg*.18+(1-ws)*.14+(1-ag)*.08,
    };
    const recentModes=this.state.history.slice(0,24).map(frame=>frame.mode);
    if(recentModes.length>=8){
      const recentCounts=new Map<P64Mode,number>();
      for(const recentMode of recentModes) recentCounts.set(recentMode,(recentCounts.get(recentMode)??0)+1);
      for(const [recentMode,count] of recentCounts){
        const share=count/recentModes.length;
        if(share>.70 && recentMode!=='protect' && recentMode!=='rest'){
          const penalty=share>.84?.48:share>.76?.62:.74;
          pressures[recentMode]=pressures[recentMode]*penalty;
        }
      }
    }
    let mode=(Object.entries(pressures).sort((a,b)=>b[1]-a[1])[0]?.[0]??'orient') as P64Mode;
    const rawPressure=pressures[mode];
    const previous=this.state.lastMode;
    let modeChanged=previous!==mode;
    let streak=previous===mode?this.state.modeStreak+1:1;
    if(previous===mode && streak>=10){
      const penalized=Object.entries(pressures).map(([k,v])=>[k,k===mode?v*(streak>=20?.5:.72):v] as [string,number]).sort((a,b)=>b[1]-a[1]);
      const alternative=penalized.find(([k])=>k!==mode);
      if(alternative && alternative[1]>=penalized[0][1]*.92){ mode=alternative[0] as P64Mode; modeChanged=true; this.state.forcedDiversions++; streak=1; }
    }
    if(mode!==previous){this.state.modeChanges++; streak=1;}
    const pressure=clamp(pressures[mode]);
    const confidence=clamp(.32+(pressure-(Object.entries(pressures).filter(([k])=>k!==mode).sort((a,b)=>b[1]-a[1])[0]?.[1]??0))*.9+gate*.18+mc*.08);
    const actionBias:Record<string,number>={respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0};
    if(mode==='protect'){actionBias.explore=-.18;actionBias.verify=.08;actionBias.rest=.08;actionBias.wait=.05;}
    if(mode==='experience'){actionBias.respond=.08;actionBias.explore=.02;}
    if(mode==='social'){actionBias.respond=.16;actionBias.reflect=.03;}
    if(mode==='learn'){actionBias.verify=.1;actionBias.reflect=.08;actionBias.explore=.01;}
    if(mode==='reflect'){actionBias.reflect=.13;actionBias.verify=.05;actionBias.explore=-.02;}
    if(mode==='develop'){actionBias.reflect=.09;actionBias.verify=.08;actionBias.explore=.04;}
    if(mode==='explore'){actionBias.explore=.11;actionBias.verify=.04;actionBias.reflect=.02;}
    if(mode==='rest'){actionBias.rest=.17;actionBias.explore=-.1;actionBias.verify=-.05;}
    if(mode==='orient'){actionBias.wait=.07;actionBias.defer=.05;actionBias.explore=-.04;}
    if(s.identityDecision==='veto'){actionBias.explore-=.16;actionBias.respond-=.03;actionBias.reflect+=.05;actionBias.wait+=.06;}
    if(s.identityDecision==='caution') actionBias.explore-=.05;
    if(th>.75||cap<.35){actionBias.explore-=.07;actionBias.rest+=.06;actionBias.reflect-=.02;}
    if(gate<.45){actionBias.verify+=.08;actionBias.explore-=.06;}
    if(rg>.5){actionBias.verify+=.08;actionBias.respond-=.02;}
    if(mp>.72){actionBias.reflect+=.04;actionBias.explore-=.04;}
    const candidateScores:Record<string,number>={};
    for(const c of rows){
      let score=c.score+(actionBias[c.action]??0);
      if(c.source==='external'&&s.externalInput) score+=.015;
      if(c.action==='explore'&&gate<.5) score-=.08;
      if(c.action==='verify'&&gate<.62) score+=.04;
      if(c.action==='rest'&&e<.3) score+=.08;
      if(c.action==='respond'&&s.externalInput) score+=.05;
      candidateScores[c.action]=clamp(score);
    }
    const reasons:string[]=[];
    if(modeChanged)reasons.push('mode-transition');
    if(pe>.45)reasons.push('prediction-error');
    if(rg>.35)reasons.push('reality-gap');
    if(u>.58)reasons.push('uncertainty');
    if(n>.6)reasons.push('novelty');
    if(sn>.62)reasons.push('social-need');
    if(mp>.65)reasons.push('memory-pressure');
    if(th>.72)reasons.push('thermal-pressure');
    if(gate<.5)reasons.push('evidence-weak');
    if(s.identityDecision!=='allow')reasons.push('identity-governance');
    if(recentModes.length>=8){const recentTop=Math.max(...Object.values(Object.fromEntries([...new Set(recentModes)].map(m=>[m,recentModes.filter(x=>x===m).length])) as Record<string,number>));if(recentTop/recentModes.length>.70)reasons.push('mode-diversity-pressure');}
    if(!reasons.length)reasons.push('stable-integrated-dynamics');
    const frame:P64Frame={tick:input.tick,at:input.at,mode,modeChanged,modeStreak:streak,modePressure01:pressure,integration01:integration,stability01:stability,agency01:agency,attention01:attention,developmentalBudget01:devBudget,confidence01:confidence,epistemicGate01:gate,realityGap01:rg,competition01:competition,coalition:coalition.map(c=>c.action),actionBias,candidateScores,reasons,broadcastToken:`p64:${input.tick}:${mode}:${Math.round(integration*1000)}:${Math.round(gate*1000)}`};
    this.state.cycles++;this.state.modeStreak=streak;this.state.lastMode=mode;this.state.modeCounts[mode]++;
    this.state.meanIntegration01=clamp(this.state.meanIntegration01*.97+integration*.03);
    this.state.meanStability01=clamp(this.state.meanStability01*.97+stability*.03);
    this.state.meanAgency01=clamp(this.state.meanAgency01*.97+agency*.03);
    this.state.meanEpistemicGate01=clamp(this.state.meanEpistemicGate01*.97+gate*.03);
    this.state.meanRealityGap01=clamp(this.state.meanRealityGap01*.97+rg*.03);
    this.state.lastFrame=frame;this.state.history=[frame,...this.state.history].slice(0,128);
    return structuredClone(frame);
  }
  summary(){return {cycles:this.state.cycles,modeChanges:this.state.modeChanges,forcedDiversions:this.state.forcedDiversions,modeCounts:this.state.modeCounts,modeStreak:this.state.modeStreak,lastMode:this.state.lastMode,meanIntegration01:this.state.meanIntegration01,meanStability01:this.state.meanStability01,meanAgency01:this.state.meanAgency01,meanEpistemicGate01:this.state.meanEpistemicGate01,meanRealityGap01:this.state.meanRealityGap01,lastFrame:this.state.lastFrame};}
}
