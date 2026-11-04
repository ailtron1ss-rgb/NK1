import type { ActionKind } from '../core/types.ts';

const AREAS = ['sensorium','memory','association','selfAction'] as const;
type AreaName = typeof AREAS[number];
const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]!*(b[i]??0);return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp01(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.08)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const matrix=(rows:number,cols:number,seed:number,scale=.07)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>rand(seed+i*97+j*17,scale)));
const zeros=(rows:number,cols:number)=>Array.from({length:rows},()=>Array.from({length:cols},()=>0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const svec=(v:unknown,n:number,fill=0):number[]=>Array.isArray(v)?v.slice(0,n).map(x=>clamp11(finN(x,fill))).concat(new Array(Math.max(0,n-v.length)).fill(fill)):new Array(n).fill(fill);
const smat=(v:unknown,rows:number,cols:number,fb:number[][]):number[][]=>Array.isArray(v)?Array.from({length:rows},(_,i)=>{const row=Array.isArray((v as unknown[])[i])?(v as unknown[])[i] as unknown[]:null;return row?Array.from({length:cols},(_,j)=>clamp11(finN(row[j],fb[i]?.[j]??0))):(fb[i]?.slice()??new Array(cols).fill(0));}):fb.map(r=>r.slice());
const areaSpikes=(v:unknown,fb:Record<AreaName,number[]>):Record<AreaName,number[]>=>{const out={} as Record<AreaName,number[]>;const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};for(const a of AREAS)out[a]=Array.isArray(r[a])?svec(r[a],8,0):fb[a]!.slice();return out;};
const sanHistory=(x:unknown):B282WorkspaceState['history'][number]|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {tick:cnt(r.tick,0),coalition:Array.isArray(r.coalition)?r.coalition.filter((a):a is AreaName=>AREAS.includes(a as AreaName)).slice(0,4):[],score01:clamp01(finN(r.score01,0)),error01:clamp01(finN(r.error01,0))};};

export interface B282WorkspaceState{
  version:1; tick:number; steps:number; learningUpdates:number; predictionUpdates:number; ignitionCount:number; coalitionSwitches:number;
  areaEncoders:Record<AreaName,number[][]>; hypothesisScores:Record<AreaName,number>; broadcastWeights:number[][]; globalPredictor:number[][];
  selfContextWeights:number[][]; worldContextWeights:number[][]; goalContextWeights:number[][]; recurrentWeights:number[][]; actionReadout:number[][];
  globalLatent:number[]; predictedNextGlobal:number[]; lastGlobalError01:number; lastCoalition:AreaName[]; ignition01:number; dwellTicks:number;
  globalCoherence01:number; globalPrediction01:number; coalitionStability01:number; workspaceCausalDrop01:number; actionInfluence01:number; lastAreaSpikes:Record<AreaName,number[]>; history:Array<{tick:number;coalition:AreaName[];score01:number;error01:number}>;
}

export interface B282StepInput{
  tick:number; areaSpikes:Record<AreaName,number[]>; selfLatent?:number[]; worldLatent?:number[]; goalVector?:number[];
  novelty01?:number; uncertainty01?:number; predictionError01?:number; reward01?:number; autonomy01?:number; learningEnabled?:boolean;
}

export function defaultB282State():B282WorkspaceState{
  const areaEncoders={} as Record<AreaName,number[][]>; const hypothesisScores={} as Record<AreaName,number>;
  AREAS.forEach((a,i)=>{areaEncoders[a]=matrix(8,16,250000+i*1000,.09);hypothesisScores[a]=0;});
  return {version:1,tick:0,steps:0,learningUpdates:0,predictionUpdates:0,ignitionCount:0,coalitionSwitches:0,areaEncoders,hypothesisScores,
    broadcastWeights:matrix(16,32,260000,.06),globalPredictor:matrix(16,16,261000,.05),selfContextWeights:matrix(8,16,262000,.045),worldContextWeights:matrix(8,16,263000,.045),goalContextWeights:matrix(8,16,264000,.045),recurrentWeights:matrix(16,16,265000,.035),actionReadout:matrix(ACTIONS.length,16,266000,.04),globalLatent:new Array(16).fill(0),predictedNextGlobal:new Array(16).fill(0),lastGlobalError01:.5,lastCoalition:[],ignition01:0,dwellTicks:0,globalCoherence01:.5,globalPrediction01:.5,coalitionStability01:0,workspaceCausalDrop01:0,actionInfluence01:0,lastAreaSpikes:{sensorium:new Array(8).fill(0),memory:new Array(8).fill(0),association:new Array(8).fill(0),selfAction:new Array(8).fill(0)},history:[]};
}

export class B282PredictiveGlobalWorkspace{
  private state=B282PredictiveGlobalWorkspace.create();
  static create(){return defaultB282State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw:unknown){const base=defaultB282State();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const aeRaw=read('areaEncoders');const aeObj=(aeRaw&&typeof aeRaw==='object')?aeRaw as Record<string,unknown>:{};const areaEncoders={} as Record<AreaName,number[][]>;for(const a of AREAS)areaEncoders[a]=smat(aeObj[a],8,16,base.areaEncoders[a]!);const hsRaw=read('hypothesisScores');const hsObj=(hsRaw&&typeof hsRaw==='object')?hsRaw as Record<string,unknown>:{};const hypothesisScores={} as Record<AreaName,number>;for(const a of AREAS)hypothesisScores[a]=clamp11(finN(hsObj[a],base.hypothesisScores[a]!));let history:B282WorkspaceState['history']=[];try{const h=read('history');if(Array.isArray(h))history=h.slice(-160).map(sanHistory).filter((x):x is B282WorkspaceState['history'][number]=>x!==null);}catch{history=[];}this.state={version:1,tick:cnt(read('tick'),base.tick),steps:cnt(read('steps'),base.steps),learningUpdates:cnt(read('learningUpdates'),base.learningUpdates),predictionUpdates:cnt(read('predictionUpdates'),base.predictionUpdates),ignitionCount:cnt(read('ignitionCount'),base.ignitionCount),coalitionSwitches:cnt(read('coalitionSwitches'),base.coalitionSwitches),areaEncoders,hypothesisScores,broadcastWeights:smat(read('broadcastWeights'),16,32,base.broadcastWeights),globalPredictor:smat(read('globalPredictor'),16,16,base.globalPredictor),selfContextWeights:smat(read('selfContextWeights'),8,16,base.selfContextWeights),worldContextWeights:smat(read('worldContextWeights'),8,16,base.worldContextWeights),goalContextWeights:smat(read('goalContextWeights'),8,16,base.goalContextWeights),recurrentWeights:smat(read('recurrentWeights'),16,16,base.recurrentWeights),actionReadout:smat(read('actionReadout'),ACTIONS.length,16,base.actionReadout),globalLatent:svec(read('globalLatent'),16),predictedNextGlobal:svec(read('predictedNextGlobal'),16),lastGlobalError01:clamp01(finN(read('lastGlobalError01'),base.lastGlobalError01)),lastCoalition:Array.isArray(read('lastCoalition'))?(read('lastCoalition') as unknown[]).filter((a):a is AreaName=>AREAS.includes(a as AreaName)).slice(0,4):[],ignition01:clamp01(finN(read('ignition01'),base.ignition01)),dwellTicks:cnt(read('dwellTicks'),base.dwellTicks),globalCoherence01:clamp01(finN(read('globalCoherence01'),base.globalCoherence01)),globalPrediction01:clamp01(finN(read('globalPrediction01'),base.globalPrediction01)),coalitionStability01:clamp01(finN(read('coalitionStability01'),base.coalitionStability01)),workspaceCausalDrop01:clamp01(finN(read('workspaceCausalDrop01'),base.workspaceCausalDrop01)),actionInfluence01:clamp01(finN(read('actionInfluence01'),base.actionInfluence01)),lastAreaSpikes:areaSpikes(read('lastAreaSpikes'),base.lastAreaSpikes),history};}
  step(input:B282StepInput){
    this.state.tick=input.tick;
    for(const area of AREAS) this.state.lastAreaSpikes[area]=(input.areaSpikes[area]?.slice(0,8)??new Array(8).fill(0));
    const context=Array.from({length:16},(_,i)=>clamp11((input.selfLatent?.[i%Math.max(1,input.selfLatent?.length??1)]??0)*.28+(input.worldLatent?.[i%Math.max(1,input.worldLatent?.length??1)]??0)*.26+(input.goalVector?.[i%Math.max(1,input.goalVector?.length??1)]??0)*.26+((input.novelty01??.5)-.5)*.10+((input.uncertainty01??.5)-.5)*.10));
    const candidates=AREAS.map((area,ai)=>{
      const spikes=input.areaSpikes[area]?.slice(0,8)??new Array(8).fill(0); const enc=this.state.areaEncoders[area]!; const latent=new Array(16).fill(0);
      for(let j=0;j<16;j++){let s=0;for(let i=0;i<8;i++)s+=spikes[i]!*enc[i]![j]!; latent[j]=tanh(s+(context[j]??0)*.42);}
      const energy=spikes.reduce((a,b)=>a+Math.abs(b),0)/8; const selfMatch=cosine01(latent,input.selfLatent?.slice(0,16)??new Array(16).fill(0)); const goalMatch=cosine01(latent,input.goalVector?.slice(0,16)??new Array(16).fill(0));
      const score=clamp01(.18+energy*.28+selfMatch*.16+goalMatch*.18+(input.autonomy01??.5)*.10+(1-(input.uncertainty01??.5))*.10);
      return {area,latent,score};
    });
    candidates.sort((a,b)=>b.score-a.score);
    const top=candidates.slice(0,2); const coalition=top.map(x=>x.area);
    const prevKey=this.state.lastCoalition.join('|'), nextKey=coalition.join('|'); if(prevKey!==nextKey&&this.state.steps>0)this.state.coalitionSwitches++;
    this.state.lastCoalition=coalition;
    const latent=new Array(16).fill(0); for(const c of top)for(let j=0;j<16;j++)latent[j]+=c.latent[j]!/(top.length||1);
    for(let i=0;i<16;i++){let rec=0;for(let j=0;j<16;j++)rec+=this.state.recurrentWeights[i]![j]!*(this.state.globalLatent[j]??0);latent[i]=tanh(latent[i]+rec*.18);}
    const predicted=this.state.globalPredictor.map(row=>tanh(row.reduce((s,w,j)=>s+w*(latent[j]??0),0)));
    const ignition=clamp01(.45+top[0]!.score*.32+top[1]!.score*.18+(1-(input.uncertainty01??.5))*.10+(input.autonomy01??.5)*.08);
    const coherent=cosine01(latent,this.state.globalLatent);
    this.state.hypothesisScores={sensorium:0,memory:0,association:0,selfAction:0}; candidates.forEach(c=>this.state.hypothesisScores[c.area]=c.score);
    this.state.globalLatent=latent; this.state.predictedNextGlobal=predicted; this.state.ignition01=ignition; this.state.dwellTicks=ignition>.68?this.state.dwellTicks+1:0; this.state.globalCoherence01=this.state.globalCoherence01*.85+coherent*.15;
    if(ignition>.72&&this.state.dwellTicks===1)this.state.ignitionCount++;
    const action=this.readAction(latent);
    this.state.steps++; this.state.globalPrediction01=clamp01(.5+this.state.globalPrediction01*.5); this.state.history.push({tick:input.tick,coalition,score01:top[0]!.score,error01:this.state.lastGlobalError01}); if(this.state.history.length>160)this.state.history.shift();
    if(input.learningEnabled!==false)this.applyLearning(input,predicted,latent);
    return {coalition,action,globalLatent:latent,ignition01:ignition,globalCoherence01:this.state.globalCoherence01,globalPrediction01:this.state.globalPrediction01,workspaceDepth:2};
  }
  private applyLearning(input:B282StepInput,predicted:number[],latent:number[]){
    const targetContext=Array.from({length:16},(_,i)=>clamp11((input.selfLatent?.[i%Math.max(1,input.selfLatent?.length??1)]??0)*.35+(input.worldLatent?.[i%Math.max(1,input.worldLatent?.length??1)]??0)*.35+(input.goalVector?.[i%Math.max(1,input.goalVector?.length??1)]??0)*.30));
    const error=1-cosine01(predicted,targetContext); this.state.lastGlobalError01=error; this.state.globalPrediction01=this.state.globalPrediction01*.86+(1-error)*.14;
    const reward=clamp01(input.reward01??.5), third=clamp11((reward-.5)*.7-(error-.5)*.3);
    for(let i=0;i<16;i++)for(let j=0;j<16;j++){const residual=(targetContext[j]??0)-(predicted[j]??0); this.state.globalPredictor[i]![j]=clamp11(this.state.globalPredictor[i]![j]!+.0024*residual*(latent[i]??0)); this.state.recurrentWeights[i]![j]=clamp11(this.state.recurrentWeights[i]![j]!+.0009*third*(latent[i]??0)); if(Math.abs(residual)>.02)this.state.predictionUpdates++;}
    for(const area of AREAS){const spikes=input.areaSpikes[area]?.slice(0,8)??new Array(8).fill(0);const enc=this.state.areaEncoders[area]!;for(let i=0;i<8;i++)for(let j=0;j<16;j++){const local=.0013*third*spikes[i]!*(targetContext[j]??0);enc[i]![j]=clamp11(enc[i]![j]!+local);}}
    this.state.learningUpdates++; this.state.actionInfluence01=clamp01(this.state.actionInfluence01*.9+(1-error)*.1);
  }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;action:ActionKind|null}){const bonus=clamp11((input.reward01-.5)*.6-(input.predictionError01-.5)*.35);for(let i=0;i<this.state.actionReadout.length;i++){const chosen=ACTIONS[i]===input.action?1:-.15;for(let j=0;j<16;j++)this.state.actionReadout[i]![j]=clamp11(this.state.actionReadout[i]![j]!+.001*bonus*chosen*(this.state.globalLatent[j]??0));}this.state.globalPrediction01=clamp01(this.state.globalPrediction01*.92+(1-input.predictionError01)*.08);}
  actionBias(action:ActionKind){const ai=ACTIONS.indexOf(action);if(ai<0)return 0;const value=dot(this.state.actionReadout[ai]!,this.state.globalLatent)/Math.max(1,this.state.globalLatent.length);return clamp11(value)*.05;}
  lesionCoalition(area:AreaName,fraction01=.5){const before=this.computeInfluence(area);const old=this.state.areaEncoders[area]!.map(r=>r.slice());this.state.areaEncoders[area]=this.state.areaEncoders[area]!.map(r=>r.map(v=>v*(1-clamp01(fraction01))));const after=this.computeInfluence(area);this.state.areaEncoders[area]=old;const drop=clamp01(before-after);this.state.workspaceCausalDrop01=drop;return {area,before,after,causalDrop01:drop};}
  private computeInfluence(area:AreaName){const spikes=this.state.lastAreaSpikes[area]??new Array(8).fill(0);const enc=this.state.areaEncoders[area]!;let energy=0;for(let j=0;j<16;j++){let s=0;for(let i=0;i<8;i++)s+=spikes[i]!*(enc[i]![j]??0);energy+=Math.abs(Math.tanh(s));}energy/=16;const base=this.state.hypothesisScores[area]??0;return clamp01(base*.4+energy*.35+this.state.ignition01*.1+this.state.globalCoherence01*.15);}
  private readAction(latent:number[]){let best=0,bestScore=-Infinity;for(let i=0;i<ACTIONS.length;i++){const s=dot(this.state.actionReadout[i]!,latent);if(s>bestScore){bestScore=s;best=i;}}return ACTIONS[best]!;}
  diagnostics(){return {steps:this.state.steps,learningUpdates:this.state.learningUpdates,predictionUpdates:this.state.predictionUpdates,ignitionCount:this.state.ignitionCount,coalitionSwitches:this.state.coalitionSwitches,lastCoalition:[...this.state.lastCoalition],ignition01:this.state.ignition01,dwellTicks:this.state.dwellTicks,globalCoherence01:this.state.globalCoherence01,globalPrediction01:this.state.globalPrediction01,coalitionStability01:clamp01(1-this.state.coalitionSwitches/Math.max(1,this.state.steps)),workspaceCausalDrop01:this.state.workspaceCausalDrop01,actionInfluence01:this.state.actionInfluence01,hypothesisScores:{...this.state.hypothesisScores}};}
  snapshotWorkspace(){return structuredClone({steps:this.state.steps,learningUpdates:this.state.learningUpdates,predictionUpdates:this.state.predictionUpdates,ignitionCount:this.state.ignitionCount,coalitionSwitches:this.state.coalitionSwitches,ignition01:this.state.ignition01,dwellTicks:this.state.dwellTicks,globalCoherence01:this.state.globalCoherence01,globalPrediction01:this.state.globalPrediction01,coalitionStability01:clamp01(1-this.state.coalitionSwitches/Math.max(1,this.state.steps)),workspaceCausalDrop01:this.state.workspaceCausalDrop01,actionInfluence01:this.state.actionInfluence01,lastCoalition:[...this.state.lastCoalition]});}
}
