/**
 * P69 — Constitutional Arbiter.
 *
 * One final decision membrane for the organism. Earlier modules provide
 * specialist evidence; P69 applies hard constraints, uncertainty-aware
 * hysteresis and behavioural-diversity pressure exactly once before an action
 * becomes the organism's chosen intent.
 */
const clamp = (x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P69Mode='protect'|'respond'|'explore'|'verify'|'reflect'|'rest'|'observe';
export interface P69State {
  version:1; cycles:number; vetoes:number; cautions:number; modeChanges:number; forcedDiversions:number;
  modeCounts:Record<P69Mode,number>; meanConfidence01:number; meanConstraintSlack01:number;
  lastMode:P69Mode; modeStreak:number; recentActions:string[]; lastChosen:string|null;
}
export const defaultP69=():P69State=>({version:1,cycles:0,vetoes:0,cautions:0,modeChanges:0,forcedDiversions:0,modeCounts:{protect:0,respond:0,explore:0,verify:0,reflect:0,rest:0,observe:0},meanConfidence01:.5,meanConstraintSlack01:1,lastMode:'observe',modeStreak:0,recentActions:[],lastChosen:null});
export interface P69Input {
  tick:number; energy01:number; thermal01:number; capacity01:number; identity01:number; realityGap01:number;
  uncertainty01:number; novelty01:number; socialNeed01:number; attention01:number; homeostaticPressure01:number;
  candidates:Array<{id:string;action:string;score:number;confidence:number;predictedUtility:number;goalId?:string}>;
  requestedAction?:string|null; userPresent:boolean; upstreamMode:string;
}
export class P69ConstitutionalArbiter {
  private state=defaultP69();
  restore(raw?:Partial<P69State>|null){const d=defaultP69(),r=raw??{};this.state={...d,...r,modeCounts:{...d.modeCounts,...(r.modeCounts??{})},recentActions:Array.isArray(r.recentActions)?r.recentActions.slice(0,24):[]};}
  snapshot(){return structuredClone(this.state);}
  arbitrate(input:P69Input){
    const e=clamp(input.energy01),th=clamp(input.thermal01),cap=clamp(input.capacity01),id=clamp(input.identity01),rg=clamp(input.realityGap01),u=clamp(input.uncertainty01),n=clamp(input.novelty01),sn=clamp(input.socialNeed01),att=clamp(input.attention01),hp=clamp(input.homeostaticPressure01);
    const constraints=clamp(.32*e+.22*cap+.18*id+.12*att+.16*(1-rg));
    const modePressure:{mode:P69Mode;value:number}[]=[
      {mode:'protect',value:Math.max(th*.95,(1-cap)*.72+(1-e)*.38+rg*.24)},
      {mode:'respond',value:(input.userPresent?0.58:0)+sn*.24+att*.12},
      {mode:'explore',value:n*.42+u*.18+Math.max(0,cap-.65)*.18+hp*.12},
      {mode:'verify',value:rg*.34+u*.24+Math.max(0,.55-constraints)*.22},
      {mode:'reflect',value:Math.max(0,1-att)*.10+u*.14+rg*.18+hp*.20},
      {mode:'rest',value:(1-e)*.55+th*.30+(1-cap)*.28},
      {mode:'observe',value:(input.userPresent ? 0 : 1)*.16+(1-n)*.10},
    ];
    modePressure.sort((a,b)=>b.value-a.value);
    let mode=modePressure[0].mode;
    const previous=this.state.lastMode;
    const streak=mode===previous?this.state.modeStreak+1:1;
    if(streak>10 && mode!=='protect' && mode!=='respond'){
      const fallback=modePressure.find(x=>x.mode!==mode && ['verify','reflect','observe','rest'].includes(x.mode));
      if(fallback){mode=fallback.mode;this.state.forcedDiversions++;}
    }
    if(mode!==previous)this.state.modeChanges++;
    this.state.cycles++;this.state.modeCounts[mode]++;this.state.lastMode=mode;this.state.modeStreak=mode===previous?streak:1;
    const last=this.state.recentActions.at(0);
    const available=input.candidates.map(c=>({c,adjusted:c.score}));
    for(const row of available){
      let delta=0;
      if(mode==='protect') delta += row.c.action==='rest'?0.16:row.c.action==='wait'?0.08:row.c.action==='defer'?0.07:-0.10;
      if(mode==='respond') delta += row.c.action==='respond'?0.15:0;
      if(mode==='explore') delta += row.c.action==='explore'?0.12:0;
      if(mode==='verify') delta += row.c.action==='verify'?0.14:row.c.action==='explore'?-0.05:0;
      if(mode==='reflect') delta += row.c.action==='reflect'?0.14:0;
      if(mode==='rest') delta += row.c.action==='rest'?0.18:row.c.action==='explore'?-0.09:-0.02;
      if(rg>.6 && row.c.action==='respond') delta-=0.08;
      if(id<.55 && ['explore','reflect'].includes(row.c.action)) delta-=0.06;
      if(e<.22 && row.c.action!=='rest') delta-=0.08;
      if(th>.8 && row.c.action!=='rest') delta-=0.06;
      if(last===row.c.action) delta-=0.055;
      row.adjusted=clamp(row.adjusted+delta);
    }
    available.sort((a,b)=>b.adjusted-a.adjusted);
    const best=available[0]?.c??null;
    let chosen = best as (typeof available[number]['c'] | null);
    let vetoed = false;
    if(input.requestedAction){const requested=available.find(x=>x.c.action===input.requestedAction)?.c; if(requested && mode!=='protect' && constraints>.35){ chosen = requested; } }
    if(chosen && mode==='protect' && !['rest','wait','defer'].includes(chosen.action)){
      this.state.vetoes++;
      vetoed = true;
      chosen=available.find(x=>['rest','wait','defer'].includes(x.c.action))?.c ?? null;
    }
    else if(chosen && (id<.4||th>.9||cap<.2)){if(!['rest','wait','defer'].includes(chosen.action)){this.state.cautions++;}}
    const confidence=clamp(.35+constraints*.35+Math.max(0,(available[0]?.adjusted??0)-(available[1]?.adjusted??0))*.5-u*.15);
    const slack=clamp(constraints-(mode==='protect'?.12:0));
    this.state.meanConfidence01=clamp(this.state.meanConfidence01*.96+confidence*.04);this.state.meanConstraintSlack01=clamp(this.state.meanConstraintSlack01*.96+slack*.04);
    this.state.lastChosen=chosen?.action??null;this.state.recentActions=[chosen?.action??'none',...this.state.recentActions].slice(0,24);
    return {chosen:chosen?{...chosen,score:available.find(x=>x.c.id===chosen!.id)?.adjusted??chosen.score}:null,mode,vetoed, constraintSlack01:slack,confidence01:confidence,diversityPressure01:clamp(last===chosen?.action?0.75:0.18),constraints01:constraints};
  }
}
