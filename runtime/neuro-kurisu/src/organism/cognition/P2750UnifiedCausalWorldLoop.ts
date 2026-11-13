import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const LATENT=8;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const norm=(v:number[])=>Math.sqrt(v.reduce((s,x)=>s+finite(x)*finite(x),0)/Math.max(1,v.length));
const distance=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>{const d=finite(x)-finite(b[i]);return s+d*d;},0)/Math.max(1,a.length));
const zeros=(n:number)=>new Array(n).fill(0);
const matrix=(n:number)=>Array.from({length:n},()=>zeros(n));

export interface P2750BandState{
  values:number[];
  decay01:number;
  confidence01:number;
  writes:number;
  stableReads:number;
  lastWriteTick:number;
  scheduledWrites:number;
  bridgeIn01:number;
}
export interface P2750ActionModel{
  samples:number;
  rewardMean01:number;
  rewardVar01:number;
  deltaMean:number[];
  deltaVar:number[];
  confidence01:number;
  modelError01:number;
  risk01:number;
}
export interface P2750State{
  version:1;
  enabled:boolean;
  tick:number;
  outcomes:number;
  activeContextId:number;
  contextSwitches:number;
  lastContextSwitchTick:number;
  contextCentroids:number[][];
  contextVisits:number[];
  fast:P2750BandState;
  medium:P2750BandState;
  slow:P2750BandState;
  causalMatrix:number[][];
  causalStrength:number[][];
  actions:P2750ActionModel[];
  worldConfidence01:number;
  transitionError01:number;
  plannerValue01:number;
  plannerPolicyAgreement01:number;
  policyFallback01:number;
  causalCredit01:number;
  causalSurprise01:number;
  memoryConsensus01:number;
  informationValue01:number;
  uncertainty01:number;
  interventionCount:number;
  syntheticReplayUsed:number;
  syntheticReplayCredit01:number;
  syntheticTrajectoryCount:number;
  embodiedGrounding01:number;
  embodiedPredictionError01:number;
  groundedConsequence01:number;
  replayUtility01:number;
  mobilePressure01:number;
  planningDepth:number;
  predictionHorizon:number;
  lastActionIndex:number;
  lastReason:string;
}

const band=(decay01:number):P2750BandState=>({values:zeros(LATENT),decay01,confidence01:.15,writes:0,stableReads:0,lastWriteTick:-1,scheduledWrites:0,bridgeIn01:0});
const action=():P2750ActionModel=>({samples:0,rewardMean01:.5,rewardVar01:.25,deltaMean:zeros(LATENT),deltaVar:new Array(LATENT).fill(.22),confidence01:.08,modelError01:.5,risk01:.5});
export const defaultP2750UnifiedCausalWorldLoop=():P2750State=>({
  version:1,enabled:true,tick:0,outcomes:0,activeContextId:0,contextSwitches:0,lastContextSwitchTick:-999,
  contextCentroids:Array.from({length:8},()=>zeros(LATENT)),contextVisits:new Array(8).fill(0),
  fast:band(.72),medium:band(.93),slow:band(.985),causalMatrix:matrix(LATENT),causalStrength:matrix(LATENT),actions:ACTIONS.map(action),
  worldConfidence01:.12,transitionError01:.5,plannerValue01:.5,plannerPolicyAgreement01:.5,policyFallback01:.2,
  causalCredit01:0,causalSurprise01:.45,memoryConsensus01:.35,informationValue01:.3,uncertainty01:.55,
  interventionCount:0,syntheticReplayUsed:0,syntheticReplayCredit01:0,syntheticTrajectoryCount:0,embodiedGrounding01:.18,embodiedPredictionError01:.5,groundedConsequence01:.28,replayUtility01:.35,mobilePressure01:.2,
  planningDepth:2,predictionHorizon:2,lastActionIndex:0,lastReason:'init'
});

export interface P2750SyntheticReplay{actionIndex:number;latent:number[];predictedNext:number[];reward01:number;confidence01:number;contextId:number;priority01:number;}
export interface P2750SyntheticTrajectoryStep{actionIndex:number;latent:number[];predictedNext:number[];reward01:number;confidence01:number;priority01:number;}
export interface P2750SyntheticTrajectory{contextId:number;steps:P2750SyntheticTrajectoryStep[];priority01:number;confidence01:number;terminalReward01:number;}

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const vecN=(v:unknown,len:number,lo:number,hi:number,fill:number):number[]=>Array.from({length:len},(_,i)=>{const x=Array.isArray(v)?(v as unknown[])[i]:undefined;const n=typeof x==='number'?x:Number(x);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fill;});
const matN=(v:unknown,rows:number,cols:number,fb:number[][]):number[][]=>Array.from({length:rows},(_,i)=>{const row=Array.isArray(v)?(v as unknown[])[i]:undefined;const fbr=fb[i]??[];return Array.from({length:cols},(_,j)=>{const c=Array.isArray(row)?(row as unknown[])[j]:undefined;const n=typeof c==='number'?c:Number(c);return Number.isFinite(n)?Math.max(-1,Math.min(1,n)):(fbr[j]??0);});});
const sanBand=(v:unknown,def:P2750BandState):P2750BandState=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};return {values:vecN(r.values,LATENT,-1,1,0),decay01:Math.max(.5,Math.min(.999,finN(r.decay01,def.decay01))),confidence01:clamp(finN(r.confidence01,def.confidence01)),writes:cnt(r.writes,def.writes),stableReads:cnt(r.stableReads,def.stableReads),lastWriteTick:finN(r.lastWriteTick,def.lastWriteTick),scheduledWrites:cnt(r.scheduledWrites,def.scheduledWrites),bridgeIn01:clamp(finN(r.bridgeIn01,def.bridgeIn01))};};
const sanAction=(v:unknown,def:P2750ActionModel):P2750ActionModel=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};return {samples:cnt(r.samples,def.samples),rewardMean01:clamp(finN(r.rewardMean01,def.rewardMean01)),rewardVar01:clamp(finN(r.rewardVar01,def.rewardVar01)),deltaMean:vecN(r.deltaMean,LATENT,-1,1,0),deltaVar:vecN(r.deltaVar,LATENT,0,1,def.deltaVar[0]??.22),confidence01:clamp(finN(r.confidence01,def.confidence01)),modelError01:clamp(finN(r.modelError01,def.modelError01)),risk01:clamp(finN(r.risk01,def.risk01))};};
export class P2750UnifiedCausalWorldLoop{
  private state:P2750State=defaultP2750UnifiedCausalWorldLoop();
  private contexts=8;
  snapshot(){return structuredClone(this.state);}
  metrics(){return structuredClone(this.state);}
  setEnabled(v:boolean){this.state.enabled=!!v;}
  restore(raw?:Partial<P2750State>|null){
    const d=defaultP2750UnifiedCausalWorldLoop();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const ccRaw=read('contextCentroids'),cmRaw=read('causalMatrix'),csRaw=read('causalStrength'),acRaw=read('actions');
    const acArr=Array.isArray(acRaw)?acRaw as unknown[]:[];
    this.state={version:1,enabled:read('enabled')!==false,tick:cnt(read('tick'),d.tick),outcomes:cnt(read('outcomes'),d.outcomes),activeContextId:Math.max(0,Math.min(this.contexts-1,Math.floor(finN(read('activeContextId'),d.activeContextId)))),contextSwitches:cnt(read('contextSwitches'),d.contextSwitches),lastContextSwitchTick:finN(read('lastContextSwitchTick'),d.lastContextSwitchTick),
      contextCentroids:Array.from({length:this.contexts},(_,i)=>vecN(Array.isArray(ccRaw)?(ccRaw as unknown[])[i]:undefined,LATENT,-1,1,0)),contextVisits:Array.from({length:this.contexts},(_,i)=>cnt(Array.isArray(read('contextVisits'))?(read('contextVisits') as unknown[])[i]:undefined,0)),
      fast:sanBand(read('fast'),d.fast),medium:sanBand(read('medium'),d.medium),slow:sanBand(read('slow'),d.slow),causalMatrix:matN(cmRaw,LATENT,LATENT,d.causalMatrix),causalStrength:matN(csRaw,LATENT,LATENT,d.causalStrength),actions:ACTIONS.map((_,i)=>sanAction(acArr[i],d.actions[i]!)),
      worldConfidence01:clamp(finN(read('worldConfidence01'),d.worldConfidence01)),transitionError01:clamp(finN(read('transitionError01'),d.transitionError01)),plannerValue01:clamp(finN(read('plannerValue01'),d.plannerValue01)),plannerPolicyAgreement01:clamp(finN(read('plannerPolicyAgreement01'),d.plannerPolicyAgreement01)),policyFallback01:clamp(finN(read('policyFallback01'),d.policyFallback01)),causalCredit01:clamp(finN(read('causalCredit01'),d.causalCredit01)),causalSurprise01:clamp(finN(read('causalSurprise01'),d.causalSurprise01)),memoryConsensus01:clamp(finN(read('memoryConsensus01'),d.memoryConsensus01)),informationValue01:clamp(finN(read('informationValue01'),d.informationValue01)),uncertainty01:clamp(finN(read('uncertainty01'),d.uncertainty01)),
      interventionCount:cnt(read('interventionCount'),d.interventionCount),syntheticReplayUsed:cnt(read('syntheticReplayUsed'),d.syntheticReplayUsed),syntheticReplayCredit01:clamp(finN(read('syntheticReplayCredit01'),d.syntheticReplayCredit01)),syntheticTrajectoryCount:cnt(read('syntheticTrajectoryCount'),d.syntheticTrajectoryCount),embodiedGrounding01:clamp(finN(read('embodiedGrounding01'),d.embodiedGrounding01)),embodiedPredictionError01:clamp(finN(read('embodiedPredictionError01'),d.embodiedPredictionError01)),groundedConsequence01:clamp(finN(read('groundedConsequence01'),d.groundedConsequence01)),replayUtility01:clamp(finN(read('replayUtility01'),d.replayUtility01)),mobilePressure01:clamp(finN(read('mobilePressure01'),d.mobilePressure01)),
      planningDepth:Math.max(1,Math.min(8,Math.floor(finN(read('planningDepth'),d.planningDepth)))),predictionHorizon:Math.max(1,Math.min(8,Math.floor(finN(read('predictionHorizon'),d.predictionHorizon)))),lastActionIndex:Math.max(0,Math.min(ACTIONS.length-1,Math.floor(finN(read('lastActionIndex'),d.lastActionIndex)))),lastReason:str(read('lastReason'),d.lastReason)};
  }
  private assignContext(latent:number[],novelty01:number,predictionError01:number):{id:number;shift:number}{
    let best=0,bestD=Infinity;
    for(let i=0;i<this.contexts;i++){const d=distance(latent,this.state.contextCentroids[i]!);if(d<bestD){bestD=d;best=i;}}
    const active=this.state.activeContextId,activeD=distance(latent,this.state.contextCentroids[active]!);
    const shift=clamp(.48*(activeD/1.2)+.30*novelty01+.22*predictionError01);
    const unused=this.state.contextVisits.findIndex(v=>v===0);
    const existingMatch=best!==active && bestD<.46;
    const cooldown=Math.max(6,Math.min(18,Math.round(7+this.state.mobilePressure01*8)));
    const canSwitch=(this.state.tick-this.state.lastContextSwitchTick)>=cooldown;
    if(unused>=0 && !existingMatch && shift>.56)best=unused;
    if(best!==active && canSwitch && (existingMatch || shift>.64 || (unused>=0&&best===unused))){this.state.contextSwitches++;this.state.activeContextId=best;this.state.lastContextSwitchTick=this.state.tick;}
    const id=this.state.activeContextId,rate=clamp(.012+.045*(1-this.state.mobilePressure01),.008,.06);
    const p=this.state.contextCentroids[id]!;for(let k=0;k<LATENT;k++)p[k]=finite(p[k])+(finite(latent[k])-finite(p[k]))*rate;
    this.state.contextVisits[id]=(this.state.contextVisits[id]??0)+1;
    return {id,shift};
  }
  private updateBands(latent:number[],surprise01:number,verified01:number){
    // Continuum-memory scheduling: fast/medium/slow memories do not all rewrite at every tick.
    // Under resource pressure the slow bands update less often; bridges carry confirmed information downstream.
    const periods=this.state.mobilePressure01>.70?[1,4,8]:this.state.mobilePressure01>.44?[1,3,6]:[1,2,5];
    const weights=[1,.45,.12];const bands=[this.state.fast,this.state.medium,this.state.slow];
    for(let b=0;b<bands.length;b++){
      const m=bands[b]!,period=periods[b]!,due=b===0 || this.state.tick%period===0;
      if(!due){m.stableReads++;m.bridgeIn01=clamp(m.bridgeIn01*.995);continue;}
      const source=b===0?latent:(b===1?this.state.fast.values:this.state.medium.values);
      const bridge=.12+.18*(1-surprise01)+.15*verified01+.10*(1-this.state.mobilePressure01);
      const input=b===0?latent:latent.map((x,k)=>finite(x)*(1-bridge)+finite(source[k])*bridge);
      const rate=(1-m.decay01)*(0.35+0.65*(b===0?1:verified01))*(.7+.3*(1-this.state.mobilePressure01))*weights[b];
      for(let k=0;k<LATENT;k++)m.values[k]=finite(m.values[k])*(1-rate)+finite(input[k])*rate;
      m.writes++;m.scheduledWrites++;m.lastWriteTick=this.state.tick;
      m.bridgeIn01=clamp(m.bridgeIn01*.88+bridge*.12);
      m.confidence01=clamp(m.confidence01*.97+(.25+.75*(1-surprise01))*.03);m.stableReads++;
    }
    const a=this.state.fast.values,md=this.state.medium.values,s=this.state.slow.values;
    const fastMedium=clamp(1-distance(a,md));const mediumSlow=clamp(1-distance(md,s));
    this.state.fast.bridgeIn01=clamp(this.state.fast.bridgeIn01*.98+fastMedium*.02);
    this.state.medium.bridgeIn01=clamp(this.state.medium.bridgeIn01*.92+fastMedium*.08);
    this.state.slow.bridgeIn01=clamp(this.state.slow.bridgeIn01*.90+mediumSlow*.10);
    const consensus=clamp(1-(distance(a,md)*.42+distance(md,s)*.36+distance(a,s)*.22));
    this.state.memoryConsensus01=clamp(consensus*.78+.22*(this.state.medium.bridgeIn01*.55+this.state.slow.bridgeIn01*.45));
  }
  private predict(actionIndex:number,latent:number[],contextId:number):{next:number[];reward:number;variance:number;confidence:number}{
    const m=this.state.actions[actionIndex]!,ctx=this.state.contextCentroids[contextId]!;
    const centered=latent.map((x,k)=>finite(x)-finite(ctx[k]));
    const horizon=this.state.predictionHorizon;
    const next=latent.map((x,k)=>{
      const base=finite(m.deltaMean[k]),ctxGain=.18*centered[k];
      return clamp(x+tanh((base+ctxGain)/Math.max(1,horizon)), -1,1);
    });
    const variance=clamp(m.deltaVar.reduce((s,x)=>s+finite(x),0)/LATENT);
    const reward=clamp(m.rewardMean01+.06*norm(next.map((x,k)=>x-finite(latent[k])))-.055*Math.sqrt(variance));
    const confidence=clamp(m.confidence01*(1-variance*.58));
    return {next,reward,variance,confidence};
  }
  beforeDecision(i:{tick:number;latent:number[];baseUtilities:Record<ActionKind,number>;novelty01:number;uncertainty01:number;predictionError01:number;resource01:number;goalPressure01:number;identityGap01:number;existingBias?:Partial<Record<ActionKind,number>>}){
    if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,contextId:0,selectedAction:'respond' as ActionKind,worldConfidence01:0,causalCredit01:0,informationValue01:0,plannerPolicyAgreement01:0,memoryConsensus01:0,learningScale01:1,replayUtility01:0,syntheticReady:0,consolidationPressure01:0};
    this.state.tick=i.tick;this.state.uncertainty01=clamp(i.uncertainty01);this.state.mobilePressure01=clamp(.52*(1-i.resource01)+.30*i.uncertainty01+.18*this.state.mobilePressure01);
    this.state.predictionHorizon=this.state.mobilePressure01>.70?1:this.state.mobilePressure01>.44?2:3;
    this.state.planningDepth=this.state.predictionHorizon;
    const latent=i.latent.slice(0,LATENT).concat(zeros(LATENT)).slice(0,LATENT).map(x=>finite(x));
    const ctx=this.assignContext(latent,i.novelty01,i.predictionError01);this.state.activeContextId=ctx.id;
    this.updateBands(latent,clamp(i.predictionError01*.65+i.novelty01*.35),0);
    const scores:number[]=[];let plannerValue=0,confidence=0,info=0;
    const causalDiag=ACTIONS.map((_,a)=>{
      const row=this.state.causalMatrix.map(r=>r[a%LATENT]??0);return clamp(norm(row));
    });
    for(let a=0;a<ACTIONS.length;a++){
      const p=this.predict(a,latent,ctx.id),base=clamp(i.baseUtilities[ACTIONS[a]!]??.5);
      const epistemic=clamp(.46*p.variance+.28*(1-p.confidence)+.18*i.novelty01+.08*ctx.shift);
      const pragmatic=clamp(base*.72+p.reward*.28+.04*i.goalPressure01-.02*i.identityGap01);
      const risk=.05*p.variance+.025*this.state.actions[a]!.modelError01;
      const causal=.018*causalDiag[a]+.015*this.state.causalCredit01;
      const fallback=(1-p.confidence)*.035;
      scores[a]=pragmatic+.035*epistemic+causal-risk-fallback+.012*this.state.groundedConsequence01-.010*this.state.embodiedPredictionError01;
      plannerValue+=p.reward;confidence+=p.confidence;info+=epistemic;
    }
    const ordered=scores.slice().sort((a,b)=>b-a),best=scores.indexOf(Math.max(...scores));
    const margin=ordered[0]!-ordered[1]!;
    const baseBest=ACTIONS.indexOf(ACTIONS[best]!); // kept explicit for traceability
    const policyScores=ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5));
    const policyBest=policyScores.indexOf(Math.max(...policyScores));
    this.state.plannerValue01=clamp(plannerValue/ACTIONS.length);this.state.worldConfidence01=clamp((confidence/ACTIONS.length)*(.55+.45*this.state.memoryConsensus01));this.state.informationValue01=clamp(info/ACTIONS.length);
    this.state.plannerPolicyAgreement01=best===policyBest?1:clamp(.45+margin*2.8);
    this.state.policyFallback01=clamp((1-this.state.worldConfidence01)*.68);
    if(this.state.worldConfidence01<.24)this.state.policyFallback01=clamp(this.state.policyFallback01+.18);
    if(this.state.informationValue01>.58){this.state.interventionCount++;}
    const selected=ACTIONS[best]!;
    const actionBias=Object.fromEntries(ACTIONS.map((a,ai)=>{const rank=scores[ai]!-scores[best]!;const base=finite(i.existingBias?.[a]??0);const fallbackBias=(this.state.worldConfidence01<.32?((ai===policyBest)?.014:0):0);return [a,clamp(base+rank*.022+fallbackBias,-.10,.10)];})) as Record<ActionKind,number>;
    const consolidationPressure=clamp(this.state.slow.confidence01*this.state.slow.bridgeIn01*(.55+.45*(1-this.state.causalSurprise01)));
    const learningScale=clamp(.90+.16*this.state.worldConfidence01+.08*this.state.memoryConsensus01+.04*consolidationPressure-.10*this.state.mobilePressure01,.78,1.12);
    const replayUtility=clamp(.31*i.predictionError01+.26*i.novelty01+.20*this.state.informationValue01+.15*(1-this.state.worldConfidence01)+.08*(1-this.state.memoryConsensus01));
    this.state.replayUtility01=clamp(this.state.replayUtility01*.92+replayUtility*.08);this.state.lastActionIndex=best;this.state.lastReason=`ctx=${ctx.id};shift=${ctx.shift.toFixed(2)};world=${this.state.worldConfidence01.toFixed(2)};fallback=${this.state.policyFallback01.toFixed(2)};plan=${selected};h=${this.state.predictionHorizon}`;
    return {actionBias,contextId:ctx.id,selectedAction:selected,worldConfidence01:this.state.worldConfidence01,causalCredit01:this.state.causalCredit01,informationValue01:this.state.informationValue01,plannerPolicyAgreement01:this.state.plannerPolicyAgreement01,memoryConsensus01:this.state.memoryConsensus01,learningScale01:learningScale,replayUtility01:this.state.replayUtility01,syntheticReady:this.syntheticReplay().length,consolidationPressure01:consolidationPressure};
  }
  observeOutcome(i:{tick:number;latentBefore:number[];latentAfter:number[];action:ActionKind;reward01:number;predictionError01:number;novelty01:number;uncertainty01:number;verified01:number;contextId?:number}){
    if(!this.state.enabled)return;
    this.state.tick=i.tick;this.state.outcomes++;const ai=Math.max(0,ACTIONS.indexOf(i.action)),ctx=Math.max(0,Math.min(this.contexts-1,Math.floor(i.contextId??this.state.activeContextId)));
    const before=i.latentBefore.slice(0,LATENT).concat(zeros(LATENT)).slice(0,LATENT).map(x=>finite(x));
    const after=i.latentAfter.slice(0,LATENT).concat(zeros(LATENT)).slice(0,LATENT).map(x=>finite(x));
    const delta=after.map((x,k)=>x-before[k]!);const m=this.state.actions[ai]!;const p=this.predict(ai,before,ctx);const residual=distance(delta,p.next.map((x,k)=>x-before[k]!));
    const lr=Math.min(.18,1.8/(m.samples+1));const rewardErr=i.reward01-m.rewardMean01;m.rewardMean01=clamp(m.rewardMean01+rewardErr*lr);m.rewardVar01=clamp(m.rewardVar01*.94+Math.abs(rewardErr)*.06);
    for(let k=0;k<LATENT;k++){const err=delta[k]!-finite(m.deltaMean[k]);m.deltaMean[k]=finite(m.deltaMean[k])+err*lr;m.deltaVar[k]=clamp(finite(m.deltaVar[k],.22)*.94+Math.abs(err)*.06,.001,1);}
    m.samples++;m.modelError01=clamp(m.modelError01*.92+residual*.08);m.risk01=clamp(m.risk01*.92+Math.sqrt(m.deltaVar.reduce((s,x)=>s+x,0)/LATENT)*.08);m.confidence01=clamp(m.confidence01*.94+(1-residual)*.06);
    for(let iLat=0;iLat<LATENT;iLat++)for(let jLat=0;jLat<LATENT;jLat++){
      const v=clamp(delta[jLat]!*before[iLat]!, -1,1);this.state.causalMatrix[iLat]![jLat]=clamp(finite(this.state.causalMatrix[iLat]![jLat])*.985+v*.015,-1,1);this.state.causalStrength[iLat]![jLat]=clamp(finite(this.state.causalStrength[iLat]![jLat])*.985+Math.abs(v)*.015);
    }
    const causalEnergy=clamp(norm(this.state.causalMatrix.flat()));
    this.state.causalSurprise01=clamp(this.state.causalSurprise01*.90+(residual*(.62+i.uncertainty01*.38))*.10);
    this.state.transitionError01=clamp(this.state.transitionError01*.90+residual*.10);
    this.state.worldConfidence01=clamp(this.state.worldConfidence01*.92+m.confidence01*.08*(1-this.state.causalSurprise01*.25));
    this.state.causalCredit01=clamp(this.state.causalCredit01*.92+clamp((i.reward01-.5)*.65+causalEnergy*.35,-1,1)*.08,-1,1);
    this.updateBands(after,this.state.causalSurprise01,i.verified01);
    this.state.replayUtility01=clamp(this.state.replayUtility01*.9+clamp(.32*residual+.24*i.novelty01+.22*this.state.informationValue01+.22*this.state.causalSurprise01)*.1);
  }
  learningScale01(){const consolidation=clamp(this.state.slow.confidence01*this.state.slow.bridgeIn01*(.55+.45*(1-this.state.causalSurprise01)));return clamp(.90+.16*this.state.worldConfidence01+.08*this.state.memoryConsensus01+.04*consolidation-.12*this.state.mobilePressure01-.06*this.state.causalSurprise01,.72,1.12);}
  observeEmbodiedOutcome(i:{action:ActionKind;reward01:number;verified01:number;predictionError01:number;sensorimotorError01:number;sensorFreshness01?:number}){
    if(!this.state.enabled)return;
    const sensorError=clamp(i.sensorimotorError01),fresh=clamp(i.sensorFreshness01??(1-sensorError));
    const grounded=clamp(.44*(1-sensorError)+.26*clamp(i.verified01)+.18*fresh+.12*this.state.worldConfidence01);
    const ai=Math.max(0,ACTIONS.indexOf(i.action));
    const actionModel=this.state.actions[ai]!;
    const actionConfidence=clamp(actionModel.confidence01*(1-.34*sensorError));
    this.state.embodiedPredictionError01=clamp(this.state.embodiedPredictionError01*.90+sensorError*.10);
    this.state.embodiedGrounding01=clamp(this.state.embodiedGrounding01*.92+grounded*.08);
    this.state.groundedConsequence01=clamp(this.state.groundedConsequence01*.90+(grounded*.62+actionConfidence*.38)*.10);
    this.state.worldConfidence01=clamp(this.state.worldConfidence01*.94+(1-sensorError)*.03+this.state.embodiedGrounding01*.03);
    this.state.replayUtility01=clamp(this.state.replayUtility01*.94+(.32*sensorError+.22*(1-grounded)+.18*this.state.causalSurprise01+.28*this.state.embodiedGrounding01)*.06);
  }

  replayScore(sample:{latent?:number[];priority01:number;predictionError01:number;reward01:number;verified01?:number;contextId?:number}){
    const latent=(sample.latent??[]).slice(0,LATENT).concat(zeros(LATENT)).slice(0,LATENT);const drift=norm(latent.map((x,k)=>x-finite(this.state.slow.values[k])));const ctx=sample.contextId===this.state.activeContextId?1:.35;
    return clamp(.21*sample.priority01+.20*sample.predictionError01+.16*drift+.11*sample.reward01+.09*(sample.verified01??0)+.08*this.state.causalSurprise01+.07*this.state.embodiedPredictionError01+.08*this.state.groundedConsequence01+.06*ctx*this.state.informationValue01);
  }
  syntheticTrajectories(limit=1,depth=3):P2750SyntheticTrajectory[]{
    const topConfidence=this.state.actions.reduce((m,a)=>Math.max(m,a.confidence01),0);
    if(!this.state.enabled||topConfidence<.52||this.state.transitionError01>.62||this.state.causalSurprise01>.68)return [];
    const ctx=this.state.activeContextId;
    const base=this.state.slow.values.slice();
    const seeds=this.state.actions.map((_,ai)=>{const p=this.predict(ai,base,ctx);return {ai,p};}).sort((a,b)=>b.p.reward*b.p.confidence-a.p.reward*a.p.confidence).slice(0,Math.max(1,Math.min(2,limit)));
    const out:P2750SyntheticTrajectory[]=[];
    for(const seed of seeds){
      let latent=base.slice();let prevReward=.5;const steps:P2750SyntheticTrajectoryStep[]=[];let aggregate=0,confidence=1;
      for(let d=0;d<Math.max(1,Math.min(3,depth));d++){
        let bestAction=seed.ai,best:any=null;
        for(let ai=0;ai<ACTIONS.length;ai++){const p=this.predict(ai,latent,ctx);const value=p.reward*(.62+.38*p.confidence)-p.variance*.045;if(!best||value>best.value){best={p,value};bestAction=ai;}}
        const p=best.p;
        const priority=clamp(.40*p.confidence+.24*(1-p.variance)+.20*this.state.replayUtility01+.10*this.state.groundedConsequence01+.06*(1-this.state.causalSurprise01));
        steps.push({actionIndex:bestAction,latent:latent.slice(),predictedNext:p.next.slice(),reward01:p.reward,confidence01:p.confidence,priority01:priority});
        aggregate+=p.reward*(.68**d);confidence*=clamp(p.confidence,.25,1);prevReward=p.reward;latent=p.next.slice();
      }
      const norm=steps.reduce((s,_,d)=>s+.68**d,0)||1;
      out.push({contextId:ctx,steps,priority01:clamp(aggregate/norm*.62+this.state.replayUtility01*.18+this.state.groundedConsequence01*.12+(1-this.state.causalSurprise01)*.08),confidence01:clamp(confidence**(1/Math.max(1,steps.length))),terminalReward01:prevReward});
    }
    this.state.syntheticTrajectoryCount+=out.length;
    return out.sort((a,b)=>b.priority01-a.priority01).slice(0,Math.max(0,Math.min(2,limit)));
  }

  syntheticReplay(limit=2):P2750SyntheticReplay[]{
    const topConfidence=this.state.actions.reduce((m,a)=>Math.max(m,a.confidence01),0);
    if(!this.state.enabled||topConfidence<.52||this.state.transitionError01>.55||this.state.causalSurprise01>.62)return [];
    const ctx=this.state.activeContextId,base=this.state.slow.values.slice();
    return this.state.actions.map((_,ai)=>{const p=this.predict(ai,base,ctx);return {actionIndex:ai,latent:base.slice(),predictedNext:p.next,reward01:p.reward,confidence01:p.confidence,contextId:ctx,priority01:clamp(.38*p.confidence+.30*this.state.replayUtility01+.32*(1-p.variance))};}).sort((a,b)=>b.priority01-a.priority01).slice(0,Math.max(0,Math.min(3,limit)));
  }
  noteSyntheticCredit(value01:number){this.state.syntheticReplayUsed++;this.state.syntheticReplayCredit01=clamp(this.state.syntheticReplayCredit01*.97+clamp(value01)*.03);}
  noteSyntheticTrajectoryCredit(value01:number){this.state.syntheticReplayUsed++;this.state.syntheticReplayCredit01=clamp(this.state.syntheticReplayCredit01*.965+clamp(value01)*.035);}
}
