import { cosineSimilarity } from '../core/NumericPrimitives.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine=(a:number[],b:number[])=>Math.max(-1,Math.min(1,cosineSimilarity(a,b,1e-9)));
const hash=(parts:string[])=>{let h=2166136261;for(const p of parts){for(let i=0;i<p.length;i++){h^=p.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16)};

export interface B278NeuralPrimitive{
  id:string;
  transform:number[];
  recurrent:number[];
  contextGate:number[];
  actionProjection:number[];
  contextActionProjection:number[][];
  traitAffinity:number[];
  bias:number;
  novelty01:number;
  maturity01:number;
  confidence01:number;
  reward01:number;
  predictionError01:number;
  usage:number;
  transferCount:number;
  verificationTrials:number;
  promotedTick:number;
  status:'germinal'|'candidate'|'verified'|'rejected'|'retired';
  parentOperatorId:string|null;
  parentProgramId:string|null;
}

export interface B278State{
  version:1;
  ticks:number;
  cycles:number;
  inventions:number;
  verifiedPrimitives:number;
  rejectedPrimitives:number;
  realTrials:number;
  virtualTrials:number;
  transfers:number;
  compositionDepthMax:number;
  learningUpdates:number;
  neuralGrounding01:number;
  selfBinding01:number;
  personalityBinding01:number;
  autonomy01:number;
  primitiveNovelty01:number;
  compositionCoherence01:number;
  activePrimitiveIds:string[];
  lastAction:ActionKind|null;
  lastInternalVector:number[];
  lastBaselineScore01:number;
  lastPrimitiveScore01:number;
  lastGain01:number;
  primitives:B278NeuralPrimitive[];
}

export interface B278StepInput{
  tick:number;
  goalVector:number[];
  selfLatent:number[];
  worldLatent:number[];
  neuralAssembly:number[];
  operatorOutput:number[];
  operatorId?:string|null;
  programLatent?:number[];
  personalityBias:Record<string,number>;
  autonomy01:number;
  novelty01:number;
  predictionError01:number;
  traitValues?:Record<string,number>;
  programId?:string|null;
}

export interface B278OutcomeInput{
  tick:number;
  reward01:number;
  predictionError01:number;
  action:ActionKind;
  selfLatent:number[];
  worldLatent:number[];
  neuralAssembly:number[];
  autonomy01:number;
  externalEvidence01:number;
  novelty01:number;
  personalityFit01:number;
  contextVector?:number[];
}

export function defaultB278State():B278State{
  return {version:1,ticks:0,cycles:0,inventions:0,verifiedPrimitives:0,rejectedPrimitives:0,realTrials:0,virtualTrials:0,transfers:0,compositionDepthMax:0,learningUpdates:0,neuralGrounding01:.5,selfBinding01:.5,personalityBinding01:.5,autonomy01:.45,primitiveNovelty01:.2,compositionCoherence01:.5,activePrimitiveIds:[],lastAction:null,lastInternalVector:Array(12).fill(0),lastBaselineScore01:.5,lastPrimitiveScore01:.5,lastGain01:0,primitives:[]};
}

function cleanPrimitive(raw:any):B278NeuralPrimitive{
  return {
    ...raw,
    transform:Array.isArray(raw?.transform)?raw.transform.slice(0,24):Array(24).fill(0),
    recurrent:Array.isArray(raw?.recurrent)?raw.recurrent.slice(0,12):Array(12).fill(0),
    contextGate:Array.isArray(raw?.contextGate)?raw.contextGate.slice(0,12):Array(12).fill(.5),
    actionProjection:Array.isArray(raw?.actionProjection)?raw.actionProjection.slice(0,7):Array(7).fill(0),
    contextActionProjection:Array.isArray(raw?.contextActionProjection)?raw.contextActionProjection.slice(0,7).map((r:any)=>Array.isArray(r)?r.slice(0,8):Array(8).fill(0)):Array.from({length:7},()=>Array(8).fill(0)),
    traitAffinity:Array.isArray(raw?.traitAffinity)?raw.traitAffinity.slice(0,8):Array(8).fill(.5),
  };
}

export class B278NeuralPrimitiveGenesis{
  private state:B278State=defaultB278State();
  restore(raw?:Partial<B278State>|null){
    const d=defaultB278State(),r=raw??{};
    this.state={...d,...r,activePrimitiveIds:Array.isArray(r.activePrimitiveIds)?r.activePrimitiveIds.slice(-4):[],lastInternalVector:Array.isArray(r.lastInternalVector)?r.lastInternalVector.slice(0,12):d.lastInternalVector,primitives:Array.isArray(r.primitives)?r.primitives.slice(-128).map(cleanPrimitive):[]};
  }
  snapshot(){return structuredClone(this.state);}
  private context(input:B278StepInput){
    const f=[...input.goalVector.slice(0,8),...input.selfLatent.slice(0,8),...input.worldLatent.slice(0,8),...input.operatorOutput.slice(0,8),...input.neuralAssembly.slice(0,8),input.autonomy01,input.novelty01,input.predictionError01];
    while(f.length<48)f.push(0);
    return f.slice(0,48).map(x=>clamp11(Number(x)||0));
  }
  private createPrimitive(input:B278StepInput):B278NeuralPrimitive{
    const c=this.context(input);
    const seed=[...c.slice(0,16),...(input.programLatent??[]).slice(0,8)];
    const parent=input.operatorId??'none';
    const program=input.programId??'none';
    const id=`np278-${hash([String(input.tick),parent,program,seed.slice(0,12).map(v=>v.toFixed(3)).join(',')])}`;
    const existing=this.state.primitives.find(p=>p.id===id);if(existing)return structuredClone(existing);
    const transform=Array.from({length:24},(_,i)=>clamp11(Math.tanh((seed[i%seed.length]??0)*(.55+(i%7)*.07))*.72));
    const recurrent=Array.from({length:12},(_,i)=>clamp11((input.operatorOutput[i%Math.max(1,input.operatorOutput.length)]??0)*.16));
    const contextGate=Array.from({length:12},(_,i)=>clamp01(.5+(seed[(i+3)%seed.length]??0)*.16));
    const actionProjection=ACTIONS.map((a,i)=>clamp11((input.personalityBias[a]??.5-.5)*.24+(seed[i%seed.length]??0)*.1));
    const contextActionProjection=ACTIONS.map((a,ai)=>Array.from({length:8},(_,j)=>clamp11((seed[(ai+j+3)%seed.length]??0)*.08+(input.goalVector[j]??0)*.06)));
    const affinityNames=['curiosity','truth-seeking','self-reflection','persistence','social-attunement','self-preservation','autonomy','care'];
    const traitAffinity=affinityNames.map((n,i)=>clamp01(.5+.22*(Number(input.traitValues?.[n]??.5)-.5)+.06*(seed[i%seed.length]??0)));
    const p:B278NeuralPrimitive={id,transform,recurrent,contextGate,actionProjection,contextActionProjection,traitAffinity,bias:clamp11(input.autonomy01*.1-input.predictionError01*.08),novelty01:clamp01(input.novelty01),maturity01:.08,confidence01:.35,reward01:.5,predictionError01:input.predictionError01,usage:0,transferCount:0,verificationTrials:0,promotedTick:0,status:'candidate',parentOperatorId:input.operatorId??null,parentProgramId:input.programId??null};
    this.state.primitives=[...this.state.primitives.slice(-127),p];
    this.state.inventions++;
    return structuredClone(p);
  }
  private compose(inputs:number[][]){
    const out=Array(12).fill(0); for(const v of inputs){for(let i=0;i<12;i++)out[i]+=clamp11(v[i]??0)/Math.max(1,inputs.length);} return out.map(clamp11);
  }
  private activate(p:B278NeuralPrimitive,c:number[],input:B278StepInput){
    const hidden=Array.from({length:12},(_,i)=>{
      const base=dot(p.transform.slice(i*2,i*2+16),c.slice(i*2,i*2+16))/8;
      const gate=p.contextGate[i%12]; const rec=p.recurrent[i%12]??0;
      const out=(input.operatorOutput[i%Math.max(1,input.operatorOutput.length)]??0);
      return Math.tanh(base*gate+rec+p.bias+out*.18+input.novelty01*.03-input.predictionError01*.02);
    });
    return hidden.map((v,i)=>clamp11(v));
  }
  private controlContext(input:B278StepInput){
    const goal=input.goalVector.slice(0,8), world=input.worldLatent.slice(0,8), self=input.selfLatent.slice(0,8);
    return Array.from({length:8},(_,i)=>clamp11((goal[i]??0)*.5+(world[i]??0)*.32+(self[i]??0)*.18));
  }
  private score(p:B278NeuralPrimitive,hidden:number[],input:B278StepInput){
    const contextAlign=.5+.5*cosine(hidden,input.goalVector.slice(0,12));
    const neural=.5+.5*cosine(hidden,input.neuralAssembly.slice(0,12));
    const self=.5+.5*cosine(hidden,input.selfLatent.slice(0,12));
    const maturity=p.maturity01, novelty=p.novelty01;
    const cc=this.controlContext(input);
    const contextualAction=Math.max(...p.contextActionProjection.map(row=>dot(row,cc)/Math.max(1,cc.length)));
    return clamp01(.18*contextAlign+.18*neural+.16*self+.12*maturity+.1*p.reward01+.08*input.autonomy01+.05*novelty+.13*(.5+.5*clamp11(contextualAction)));
  }
  private selectPrimitives(input:B278StepInput){
    const eligible=this.state.primitives.filter(p=>p.status==='candidate'||p.status==='verified'||p.status==='germinal');
    const ranked=eligible.map(p=>({p,score:this.score(p,this.activate(p,this.context(input),input),input)})).sort((a,b)=>b.score-a.score);
    const best=ranked.slice(0,Math.min(3,ranked.length)).map(x=>x.p);
    if(best.length<2 && (input.novelty01*.4+input.predictionError01*.3+input.autonomy01*.12>.47 || this.state.primitives.length<2)){
      best.push(this.createPrimitive(input));
    }
    return best.slice(0,3);
  }
  step(input:B278StepInput){
    this.state.ticks=input.tick;this.state.cycles++;
    let selected=this.selectPrimitives(input);
    if(selected.length===0) selected=[this.createPrimitive(input)];
    const c=this.context(input);
    const hidden=selected.map(p=>this.activate(p,c,input));
    const composed=this.compose(hidden);
    const depth=selected.length;
    const cc=this.controlContext(input);
    const baseScores=ACTIONS.map((a,i)=>({action:a,score:clamp01(.5+.08*(input.personalityBias[a]??.5)+.03*(cc[i%Math.max(1,cc.length)]??0))}));
    const primitiveScores=ACTIONS.map((a,i)=>{let s=baseScores[i].score;const ctx=cc;for(const p of selected){s+=.035*(p.actionProjection[i]??0);s+=.065*(dot(p.contextActionProjection[i]??[],ctx)/Math.max(1,ctx.length));s+=.018*(composed[i%12]??0);}return {action:a,score:clamp01(s),primitive:s-baseScores[i].score};}).sort((a,b)=>b.score-a.score);
    const selectedAction=primitiveScores[0].action;
    this.state.activePrimitiveIds=selected.map(p=>p.id);
    this.state.lastAction=selectedAction;this.state.lastInternalVector=composed.slice(0,12);
    this.state.lastBaselineScore01=baseScores.find(x=>x.action===selectedAction)?.score??.5;
    this.state.lastPrimitiveScore01=primitiveScores[0]?.score??.5;
    this.state.lastGain01=this.state.lastPrimitiveScore01-this.state.lastBaselineScore01;
    this.state.compositionDepthMax=Math.max(this.state.compositionDepthMax,depth);
    this.state.virtualTrials+=depth;
    this.state.neuralGrounding01=clamp01(this.state.neuralGrounding01*.92+(.5+.5*cosine(composed,input.neuralAssembly.slice(0,12)))*.08);
    this.state.selfBinding01=clamp01(this.state.selfBinding01*.92+(.5+.5*cosine(composed,input.selfLatent.slice(0,12)))*.08);
    const traitMean=Object.values(input.traitValues??{}).map(Number);this.state.personalityBinding01=clamp01(this.state.personalityBinding01*.92+(.5+.5*((traitMean.length?traitMean.reduce((a,b)=>a+b,0)/traitMean.length:.5)))*.08);
    this.state.autonomy01=clamp01(this.state.autonomy01*.9+input.autonomy01*.1);
    this.state.primitiveNovelty01=clamp01(this.state.primitiveNovelty01*.9+input.novelty01*.1);
    this.state.compositionCoherence01=clamp01(this.state.compositionCoherence01*.9+(.5+.5*cosine(composed,hidden[0]??composed))*.1);
    return {primitiveIds:selected.map(p=>p.id),selectedAction,rankings:primitiveScores,internalVector:composed,predictedGain01:this.state.lastGain01,compositionDepth:depth,neuralGrounding01:this.state.neuralGrounding01,selfBinding01:this.state.selfBinding01};
  }
  learnFromOutcome(input:B278OutcomeInput){
    const active=this.state.activePrimitiveIds.map(id=>this.state.primitives.find(p=>p.id===id)).filter(Boolean) as B278NeuralPrimitive[];
    if(!active.length)return {updated:false,promoted:0,rejected:0};
    const target=clamp11((input.reward01-.5)*2-.18*clamp01(input.predictionError01));
    const ctx=(input.contextVector??this.controlContext({tick:input.tick,goalVector:input.contextVector??[],selfLatent:input.selfLatent,worldLatent:input.worldLatent,neuralAssembly:input.neuralAssembly,operatorOutput:[],operatorId:null,programLatent:[],personalityBias:{},autonomy01:input.autonomy01,novelty01:input.novelty01,predictionError01:input.predictionError01} as B278StepInput)).slice(0,8);
    let promoted=0,rejected=0;
    for(const p of active){
      const lr=.028*(.55+.45*clamp01(input.externalEvidence01));
      for(let i=0;i<p.transform.length;i++)p.transform[i]=clamp11(p.transform[i]+lr*target*(ctx[i%ctx.length]??0));
      for(let i=0;i<p.actionProjection.length;i++){p.actionProjection[i]=clamp11(p.actionProjection[i]+lr*.45*target*(ACTIONS[i]===input.action?1:-.18));for(let j=0;j<p.contextActionProjection[i].length;j++)p.contextActionProjection[i][j]=clamp11(p.contextActionProjection[i][j]+lr*target*(ACTIONS[i]===input.action?1:-.12)*(ctx[j]??0));}
      for(let i=0;i<p.contextGate.length;i++)p.contextGate[i]=clamp01(p.contextGate[i]+lr*.6*target);
      for(let i=0;i<p.recurrent.length;i++)p.recurrent[i]=clamp11(p.recurrent[i]+lr*.35*target*(p.recurrent[(i+1)%p.recurrent.length]??0));
      p.reward01=clamp01(p.reward01*.86+input.reward01*.14);p.predictionError01=input.predictionError01;p.novelty01=input.novelty01;p.usage++;p.verificationTrials++;
      const maturity=clamp01(.05+.015*Math.min(40,p.verificationTrials)+.08*p.reward01+.05*(1-input.predictionError01));
      p.maturity01=clamp01(p.maturity01*.9+maturity*.1);
      const gain=clamp01(.5+target*.5);p.confidence01=clamp01(p.confidence01*.86+(.55*gain+.25*(1-input.predictionError01)+.2*input.personalityFit01)*.14);
      if(p.status==='candidate'&&p.verificationTrials>=4&&p.confidence01>.68&&p.maturity01>.18&&gain>.53&&input.predictionError01<.6){p.status='verified';p.promotedTick=input.tick;promoted++;this.state.verifiedPrimitives++;}
      if((gain<.36&&input.predictionError01>.72&&p.verificationTrials>=6)||p.confidence01<.18){if(p.status!=='rejected'){p.status='rejected';rejected++;this.state.rejectedPrimitives++;}}
    }
    this.state.realTrials++;this.state.learningUpdates++;return {updated:true,promoted,rejected,maturity01:active[0].maturity01,confidence01:active[0].confidence01};
  }
  transfer(input:{tick:number;primitiveId:string;goalVector:number[];selfLatent:number[];neuralAssembly:number[];independentGain01:number;robustness01:number}){
    const p=this.state.primitives.find(x=>x.id===input.primitiveId&&x.status==='verified');if(!p)return {success:false,gain01:0,transfered:false};
    const alignment=.5+.5*cosine(p.transform.slice(0,12),input.goalVector.slice(0,12));
    const neural=.5+.5*cosine(p.transform.slice(0,12),input.neuralAssembly.slice(0,12));
    const gain=clamp01(.36+.28*input.independentGain01+.2*alignment+.16*neural)*input.robustness01;
    const success=gain>.57&&input.robustness01>.55;if(success){p.transferCount++;this.state.transfers++;}
    return {success,gain01:gain,alignment01:alignment,neural01:neural,transfered:success};
  }
  actionBias(action:ActionKind){const p=this.state.primitives.filter(x=>x.status==='verified'&&this.state.activePrimitiveIds.includes(x.id));if(!p.length)return 0;const i=ACTIONS.indexOf(action);return clamp11(p.reduce((s,x)=>s+(x.actionProjection[i]??0),0)/p.length*.03);
  }
  ablation(action:ActionKind){const i=ACTIONS.indexOf(action);const active=this.state.primitives.filter(x=>x.status==='verified'&&this.state.activePrimitiveIds.includes(x.id));const withPrimitive=this.state.lastPrimitiveScore01;let without=this.state.lastBaselineScore01;for(const p of active)without=clamp01(without+.055*(p.actionProjection[i]??0));return {action,withPrimitiveScore01:withPrimitive,withoutPrimitiveScore01:clamp01(without),causalDrop01:Math.abs(withPrimitive-clamp01(without))};}
  diagnostics(){const verified=this.state.primitives.filter(p=>p.status==='verified');return {...this.state,verified:verified.map(p=>({id:p.id,maturity01:p.maturity01,confidence01:p.confidence01,transferCount:p.transferCount,usage:p.usage,parentOperatorId:p.parentOperatorId,parentProgramId:p.parentProgramId})),activePrimitiveIds:this.state.activePrimitiveIds.slice()};}
}
