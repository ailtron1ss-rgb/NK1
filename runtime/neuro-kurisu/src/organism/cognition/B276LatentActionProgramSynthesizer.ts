import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine=(a:number[],b:number[])=>clamp11(dot(a,b)/(norm(a)*norm(b)));
const hash=(parts:string[])=>{let h=2166136261;for(const p of parts){for(let i=0;i<p.length;i++){h^=p.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16);};

export interface B276ProgramNode {
  id:string;
  opLatent:number[];
  primitive:ActionKind;
  children:string[];
  gate01:number;
  value01:number;
  visits:number;
}

export interface B276LatentProgram {
  id:string;
  nodes:string[];
  latent:number[];
  predictedGain01:number;
  novelty01:number;
  selfAlignment01:number;
  neuralGrounding01:number;
  personalityFit01:number;
  verificationGain01:number;
  robustness01:number;
  status:'candidate'|'verified'|'rejected'|'retired';
  createdTick:number;
  lastUsedTick:number;
  consequenceEMA01:number;
  adaptationCount:number;
  structureRevisionCount:number;
  stepCredits01:number[];
}

export interface B276State {
  version:1;
  ticks:number;
  proposals:number;
  imaginedPrograms:number;
  realTrials:number;
  verifiedPrograms:number;
  rejectedPrograms:number;
  transferTrials:number;
  successfulTransfers:number;
  programStructureRevisions:number;
  composeDepthMax:number;
  neuralGrounding01:number;
  selfAlignment01:number;
  personalityFit01:number;
  autonomy01:number;
  programNovelty01:number;
  verificationConfidence01:number;
  transferGeneralization01:number;
  activeProgramId:string|null;
  executionPlan:ActionKind[];
  executionCursor:number;
  executionProgramId:string|null;
  executionCompletions:number;
  lastPrimitive:ActionKind|null;
  executionHistory:Array<{tick:number;programId:string;stepIndex:number;primitive:ActionKind;completed:boolean;reward01?:number}>;
  actionConsequenceCredits01:Record<ActionKind,number>;
  nodes:B276ProgramNode[];
  programs:B276LatentProgram[];
}

export interface B276ProposeInput {
  tick:number;
  goalVector:number[];
  selfLatent:number[];
  worldLatent:number[];
  neuralAssembly:number[];
  personalityBias:Record<string,number>;
  autonomy01:number;
  noveltyNeed01:number;
  promotedSkills:Array<{id:string;actions:ActionKind[];reliability01:number}>;
}

export function defaultB276State():B276State{
  return {version:1,ticks:0,proposals:0,imaginedPrograms:0,realTrials:0,verifiedPrograms:0,rejectedPrograms:0,transferTrials:0,successfulTransfers:0,programStructureRevisions:0,composeDepthMax:0,neuralGrounding01:.45,selfAlignment01:.5,personalityFit01:.5,autonomy01:.4,programNovelty01:.25,verificationConfidence01:.35,transferGeneralization01:.2,activeProgramId:null,executionPlan:[],executionCursor:0,executionProgramId:null,executionCompletions:0,lastPrimitive:null,executionHistory:[],actionConsequenceCredits01:{respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5},nodes:[],programs:[]};
}

export class B276LatentActionProgramSynthesizer{
  private state=defaultB276State();
  restore(raw?:Partial<B276State>|null){const d=defaultB276State(),r=raw??{};this.state={...d,...r,executionPlan:Array.isArray(r.executionPlan)?r.executionPlan.slice(0,8):d.executionPlan,executionCursor:Math.max(0,Math.floor(Number(r.executionCursor??d.executionCursor))),executionProgramId:typeof r.executionProgramId==='string'?r.executionProgramId:null,executionCompletions:Math.max(0,Math.floor(Number(r.executionCompletions??d.executionCompletions))),executionHistory:Array.isArray(r.executionHistory)?r.executionHistory.slice(-64).map((e:any)=>({tick:Math.floor(Number(e?.tick??0)),
  programId:String(e?.programId??''),stepIndex:Math.max(0,Math.floor(Number(e?.stepIndex??0))),primitive:e?.primitive,completed:Boolean(e?.completed),reward01:typeof e?.reward01==='number'?clamp01(e.reward01):undefined})).filter((e:any)=>typeof e.programId==='string'&&e.programId.length>0):d.executionHistory,
  actionConsequenceCredits01:{...d.actionConsequenceCredits01,...(r.actionConsequenceCredits01??{})},nodes:Array.isArray(r.nodes)?r.nodes.slice(-256).map((n:any)=>({...n,opLatent:Array.isArray(n?.opLatent)?n.opLatent.slice(0,12):Array(8).fill(0),children:Array.isArray(n?.children)?n.children.slice(0,6):[]})):[],programs:Array.isArray(r.programs)?r.programs.slice(-128).map((p:any)=>({...p,nodes:Array.isArray(p?.nodes)?p.nodes.slice(0,12):[],latent:Array.isArray(p?.latent)?p.latent.slice(0,16):Array(8).fill(0),structureRevisionCount:Math.max(0,Math.floor(Number(p?.structureRevisionCount??0))),stepCredits01:Array.isArray(p?.stepCredits01)?p.stepCredits01.slice(0,8).map((x:any)=>clamp01(Number(x))):[]})):[]};}
  snapshot(){return structuredClone(this.state);}
  private makeLatent(parts:number[][],weights:number[]){const out=Array.from({length:12},()=>0);for(let k=0;k<out.length;k++){let s=0;parts.forEach((v,j)=>{s+=(v[k%v.length]??0)*(weights[j]??0)});out[k]=clamp11(Math.tanh(s));}return out;}
  private primitiveFromLatent(v:number[],bias:Record<string,number>){let best:ActionKind='reflect';let score=-Infinity;for(const a of ACTIONS){const idx=ACTIONS.indexOf(a);const s=(v[idx%v.length]??0)+Number(bias[a]??0)*.4+(idx===1?0.03:0);if(s>score){score=s;best=a;}}return best;}

  propose(input:B276ProposeInput){
    this.state.ticks=input.tick;this.state.proposals++;
    const skills=input.promotedSkills.filter(s=>s.actions.length).slice(0,8);
    const sources=skills.length?skills:[{id:'intrinsic-seed',actions:['reflect','verify'] as ActionKind[],reliability01:.5}];
    const selected=sources.slice().sort((a,b)=>b.reliability01-a.reliability01).slice(0,4);
    const programNodes:string[]=[];const primitives:ActionKind[]=[];
    for(let i=0;i<selected.length;i++){
      const skill=selected[i];
      const latent=this.makeLatent([input.goalVector,input.selfLatent,input.worldLatent,input.neuralAssembly,skill.actions.map(a=>ACTIONS.indexOf(a)/6)], [0.22,0.22,0.16,0.2,0.2]);
      const primitive=this.primitiveFromLatent(latent,input.personalityBias);
      const id=`node276-${hash([input.tick.toString(),skill.id,i.toString(),primitive,latent.map(x=>x.toFixed(3)).join(',')])}`;
      this.state.nodes.push({id,opLatent:latent,primitive,children:[],gate01:clamp01(.45+.3*input.autonomy01+.25*input.noveltyNeed01),value01:clamp01(.4+.3*skill.reliability01),visits:0});
      programNodes.push(id);primitives.push(primitive);
      if(i>0)this.state.nodes[this.state.nodes.length-2].children.push(id);
    }
    const compact:Array<ActionKind>=[...new Set(primitives)];
    // Brick 4 program floor: a compositional program must contain at least three
    // distinct primitives. Fallback primitives are selected from current personality
    // preference rather than hard-coded as the whole policy.
    if(compact.length<3){
      const preferred=ACTIONS.slice().sort((a,b)=>(Number(input.personalityBias[b]??0)-Number(input.personalityBias[a]??0)));
      for(const a of preferred){ if(compact.length>=3) break; if(!compact.includes(a)) compact.push(a); }
    }
    if(compact.length<3){ for(const a of ['verify','reflect','wait'] as ActionKind[]) if(compact.length<3&&!compact.includes(a)) compact.push(a as ActionKind); }
    // Materialize fallback primitives as actual nodes so the plan is not just metadata.
    for(const primitive of compact.slice(programNodes.length)){
      const id=`node276-${hash([input.tick.toString(),'fallback',primitive,compact.join('>')])}`;
      const latent=this.makeLatent([input.goalVector,input.selfLatent,input.worldLatent,input.neuralAssembly,[ACTIONS.indexOf(primitive)/6]],[.22,.22,.16,.2,.2]);
      this.state.nodes.push({id,opLatent:latent,primitive,children:[],gate01:clamp01(.45+.3*input.autonomy01+.25*input.noveltyNeed01),value01:.5,visits:0});
      if(programNodes.length) this.state.nodes[this.state.nodes.length-1].children.push(...programNodes.slice(-1));
      programNodes.push(id);
    }
    const latent=this.makeLatent([input.goalVector,input.selfLatent,input.worldLatent,input.neuralAssembly,compact.map(a=>ACTIONS.indexOf(a)/6)],[.2,.22,.16,.2,.22]);
    const novelty=clamp01(.25*input.noveltyNeed01+.2*(compact.length/Math.max(1,ACTIONS.length))+.2*(1-Math.abs(cosine(latent,input.selfLatent)))/2+.2*(1-input.autonomy01)+.15*(selected.length>=3?1:0));
    const selfAlignment=clamp01(.5+.5*cosine(latent,input.selfLatent));
    const neuralGrounding=clamp01(.5+.5*cosine(latent,input.neuralAssembly));
    const vals=Object.values(input.personalityBias);const pMean=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;const personalityFit=clamp01(.55+.2*(1-Math.abs(pMean))+.25*input.autonomy01);
    const predictedGain=clamp01(.48+.12*novelty+.14*selfAlignment+.1*neuralGrounding+.08*personalityFit+.05*selected.length/4);
    const id=`program276-${hash([...programNodes,latent.map(x=>x.toFixed(3)).join(',')])}`;
    const program:B276LatentProgram={id,nodes:programNodes,latent,predictedGain01:predictedGain,novelty01:novelty,selfAlignment01:selfAlignment,neuralGrounding01:neuralGrounding,personalityFit01:personalityFit,verificationGain01:.5,robustness01:.7,status:'candidate',createdTick:input.tick,lastUsedTick:input.tick,consequenceEMA01:.5,adaptationCount:0,structureRevisionCount:0,stepCredits01:compact.map(()=>.5)};
    this.state.programs=[...this.state.programs.filter(p=>p.id!==id).slice(-127),program];this.state.imaginedPrograms++;this.state.activeProgramId=id;this.state.executionPlan=compact.slice(0,8);this.state.executionCursor=0;this.state.executionProgramId=id;this.state.composeDepthMax=Math.max(this.state.composeDepthMax,compact.length);
    this.state.neuralGrounding01=clamp01(this.state.neuralGrounding01*.88+neuralGrounding*.12);this.state.selfAlignment01=clamp01(this.state.selfAlignment01*.88+selfAlignment*.12);this.state.personalityFit01=clamp01(this.state.personalityFit01*.88+personalityFit*.12);this.state.autonomy01=clamp01(this.state.autonomy01*.9+input.autonomy01*.1);this.state.programNovelty01=clamp01(this.state.programNovelty01*.86+novelty*.14);
    return {programId:id,primitivePlan:compact,latent:[...latent],predictedGain01:predictedGain,novelty01:novelty,selfAlignment01:selfAlignment,neuralGrounding01:neuralGrounding,personalityFit01:personalityFit,depth:programNodes.length};
  }

  observeTrial(input:{tick:number;programId:string;reward01:number;independentGain01:number;predictionError01:number;robustness01:number;personalityAlignment01:number;selfAlignment01:number}){
    const p=this.state.programs.find(x=>x.id===input.programId);if(!p)return {accepted:false,verified:false,rejected:false,gain01:0};
    this.state.realTrials++;this.state.ticks=input.tick;p.lastUsedTick=input.tick;
    const gain=clamp01(.5+input.independentGain01);const evidence=clamp01(.3*input.reward01+.28*gain+.14*(1-input.predictionError01)+.14*input.robustness01+.08*input.personalityAlignment01+.06*input.selfAlignment01);
    p.verificationGain01=clamp01(p.verificationGain01*.72+gain*.28);p.robustness01=clamp01(p.robustness01*.78+input.robustness01*.22);p.selfAlignment01=clamp01(p.selfAlignment01*.85+input.selfAlignment01*.15);p.personalityFit01=clamp01(p.personalityFit01*.85+input.personalityAlignment01*.15);
    p.consequenceEMA01=clamp01((p.consequenceEMA01??.5)*.84+input.reward01*.16);
    const verified=input.independentGain01>.035 && evidence>.59 && input.predictionError01<.72 && input.robustness01>.55 && p.neuralGrounding01>.48;
    const rejected=input.independentGain01<-.03 || evidence<.42 || input.robustness01<.35;
    if(verified){if(p.status!=='verified')this.state.verifiedPrograms++;p.status='verified';} else if(rejected){p.status='rejected';this.state.rejectedPrograms++;}
    this.state.verificationConfidence01=clamp01(this.state.verificationConfidence01*.84+evidence*.16);
    return {accepted:evidence>.5,verified,rejected,gain01:input.independentGain01,evidence01:evidence,programId:p.id,status:p.status};
  }

  observeExecutionOutcome(input:{tick:number;programId:string;stepIndex:number;primitive:ActionKind;reward01:number;success01:number;predictionError01:number;unseenContext01?:number}){
    const p=this.state.programs.find(x=>x.id===input.programId);
    if(!p) return {updated:false,reason:'not-found',consequenceEMA01:0};
    const step=Math.max(0,Math.min(this.state.executionPlan.length-1,Math.floor(input.stepIndex)));
    const reward=clamp01(input.reward01);
    const success=clamp01(input.success01);
    const predictionQuality=clamp01(1-input.predictionError01);
    const evidence=clamp01(.55*reward+.25*success+.20*predictionQuality);
    p.consequenceEMA01=clamp01((p.consequenceEMA01??.5)*.78+evidence*.22);
    p.adaptationCount=(p.adaptationCount??0)+1;
    if(!Array.isArray(p.stepCredits01)) p.stepCredits01=this.state.executionPlan.map(()=>.5);
    while(p.stepCredits01.length<this.state.executionPlan.length) p.stepCredits01.push(.5);
    p.stepCredits01[step]=clamp01(p.stepCredits01[step]*.72+evidence*.28);
    const oldCredit=this.state.actionConsequenceCredits01[input.primitive]??.5;
    this.state.actionConsequenceCredits01[input.primitive]=clamp01(oldCredit*.76+evidence*.24);
    const nodeId=p.nodes[step];
    const node=this.state.nodes.find(n=>n.id===nodeId);
    if(node) node.value01=clamp01(node.value01*.72+evidence*.28);
    if(this.state.executionProgramId===p.id && this.state.executionPlan[step]===input.primitive){
      this.state.executionHistory=[...this.state.executionHistory.slice(-63),{tick:input.tick,programId:p.id,stepIndex:step,primitive:input.primitive,completed:false,reward01:reward}];
    }
    // Brick 4 learned program revision: after enough completed evidence, reorder the
    // persistent program sequence by learned step utility. Revision is only allowed
    // when the cursor is at a sequence boundary, so the current physical execution
    // cannot be rewritten mid-action. This changes the executable structure, not just
    // a scalar confidence/bias.
    if(p.adaptationCount>=3 && p.adaptationCount%3===0 && (this.state.executionCursor===0 || this.state.executionCursor>=this.state.executionPlan.length) && p.stepCredits01.length>=3){
      const indexed=this.state.executionPlan.map((primitive,index)=>({primitive,index,credit:p.stepCredits01[index]??.5}));
      const min=Math.min(...indexed.map(x=>x.credit));
      const max=Math.max(...indexed.map(x=>x.credit));
      // Materiality must be scale-invariant. Step credits are learned from reward
      // evidence whose absolute magnitude depends on the upstream learning gate
      // (raw vs gated rewards differ ~2x), so a fixed absolute spread threshold
      // silently disables revision whenever evidence arrives pre-gated. Judge the
      // spread relative to the current credit level, with an absolute floor.
      const spread=max-min;
      const meanCredit=indexed.reduce((a,x)=>a+x.credit,0)/indexed.length;
      if(spread>=.055 || (meanCredit>=.1 && spread/meanCredit>=.05)){
        const sorted=indexed.slice().sort((a,b)=>b.credit-a.credit || a.index-b.index);
        const changed=sorted.some((x,i)=>x.primitive!==indexed[i]?.primitive);
        if(changed){
          this.state.executionPlan=sorted.map(x=>x.primitive);
          p.stepCredits01=sorted.map(x=>p.stepCredits01[x.index]??.5);
          p.nodes=sorted.map(x=>p.nodes[x.index]).filter((x):x is string=>typeof x==='string');
          p.structureRevisionCount++;
          this.state.programStructureRevisions++;
          this.state.executionCursor=0;
          this.state.executionProgramId=p.id;
        }
      }
    }
    this.state.transferGeneralization01=clamp01(this.state.transferGeneralization01*.9+(input.unseenContext01??0)*.1*evidence);
    this.state.ticks=input.tick;
    return {updated:true,programId:p.id,stepIndex:step,primitive:input.primitive,evidence01:evidence,consequenceEMA01:p.consequenceEMA01,stepCredit01:p.stepCredits01[step],actionCredit01:this.state.actionConsequenceCredits01[input.primitive],adaptationCount:p.adaptationCount};
  }

  transfer(input:{tick:number;programId:string;newGoalVector:number[];selfLatent:number[];worldLatent:number[];neuralAssembly:number[];independentGain01:number;robustness01:number}){
    const p=this.state.programs.find(x=>x.id===input.programId&&x.status==='verified');if(!p)return {success:false,gain01:0,reason:'not-verified'};
    this.state.transferTrials++;const sim=clamp01(.5+.5*cosine(p.latent.slice(0,8),input.newGoalVector.slice(0,8)));const neural=clamp01(.5+.5*cosine(p.latent.slice(0,Math.min(12,p.latent.length)),input.neuralAssembly.slice(0,12)));const goal=clamp01(.5+.5*cosine(p.latent.slice(0,8),input.selfLatent.slice(0,8)));const learned=clamp01((p.consequenceEMA01??.5)*.72+(p.stepCredits01?.reduce((a,b)=>a+b,0)??0)/Math.max(1,p.stepCredits01?.length??1)*.28);const generalization=clamp01(.5+.5*learned);const gain=clamp01(.35+.25*input.independentGain01+.10*sim+.10*neural+.08*goal+.17*generalization)*input.robustness01;
    const success=gain>.55&&input.robustness01>.52;if(success){this.state.successfulTransfers++;this.state.transferGeneralization01=clamp01(this.state.transferGeneralization01*.8+.2*gain);}else{this.state.transferGeneralization01=clamp01(this.state.transferGeneralization01*.92+.08*gain);}
    return {success,gain01:gain,similarity01:sim,neural01:neural,goalAlignment01:goal};
  }

  actionBias(action:ActionKind){const p=this.state.activeProgramId?this.state.programs.find(x=>x.id===this.state.activeProgramId):null;if(!p)return 0;const cursor=this.state.executionCursor;const expected=this.state.executionProgramId===p.id?this.state.executionPlan[cursor]:null;if(expected===action){const stepCredit=p.stepCredits01?.[cursor]??.5;const consequence=this.state.actionConsequenceCredits01[action]??.5;const trust=p.status==='verified'?( .34*p.verificationGain01+.18*p.robustness01+.18*p.selfAlignment01+.15*(p.consequenceEMA01??.5)+.15*stepCredit):.35*p.predictedGain01;return clamp11(.028*(.55+trust)*(.75+.5*consequence));}return 0;}

  peekExecutablePrimitive(){
    const pid=this.state.executionProgramId;
    const p=pid?this.state.programs.find(x=>x.id===pid):null;
    if(!p || p.status!=='verified' || this.state.executionCursor>=this.state.executionPlan.length) return null;
    return {primitive:this.state.executionPlan[this.state.executionCursor],programId:p.id,stepIndex:this.state.executionCursor,steps:this.state.executionPlan.length};
  }

  nextExecutablePrimitive(){
    const next=this.peekExecutablePrimitive();
    if(!next)return null;
    this.state.executionCursor++;
    this.state.lastPrimitive=next.primitive;
    const completed=this.state.executionCursor>=this.state.executionPlan.length;
    if(completed) this.state.executionCompletions++;
    this.state.executionHistory=[...this.state.executionHistory,{tick:this.state.ticks,programId:next.programId,stepIndex:next.stepIndex,primitive:next.primitive,completed}].slice(-64);
    return {...next,completed};
  }

  stepPrimitive(){ return this.nextExecutablePrimitive(); }

  diagnostics(){
    return {
      version:1,
      ticks:this.state.ticks,
      proposals:this.state.proposals,
      imaginedPrograms:this.state.imaginedPrograms,
      realTrials:this.state.realTrials,
      verifiedPrograms:this.state.verifiedPrograms,
      rejectedPrograms:this.state.rejectedPrograms,
      transferTrials:this.state.transferTrials,
      successfulTransfers:this.state.successfulTransfers,
      composeDepthMax:this.state.composeDepthMax,
      neuralGrounding01:this.state.neuralGrounding01,
      selfAlignment01:this.state.selfAlignment01,
      personalityFit01:this.state.personalityFit01,
      autonomy01:this.state.autonomy01,
      programNovelty01:this.state.programNovelty01,
      verificationConfidence01:this.state.verificationConfidence01,
      transferGeneralization01:this.state.transferGeneralization01,
      activeProgramId:this.state.activeProgramId,
      activeProgramStatus:(this.state.activeProgramId?this.state.programs.find(p=>p.id===this.state.activeProgramId)?.status:null),
      activeProgramConsequenceEMA01:(this.state.activeProgramId?this.state.programs.find(p=>p.id===this.state.activeProgramId)?.consequenceEMA01:null),
      activeProgramStepCredits01:(this.state.activeProgramId?[...(this.state.programs.find(p=>p.id===this.state.activeProgramId)?.stepCredits01??[])]:[]),
      activeProgramStructureRevisionCount:(this.state.activeProgramId?(this.state.programs.find(p=>p.id===this.state.activeProgramId)?.structureRevisionCount??0):0),
      executionPlan:[...this.state.executionPlan],
      executionCursor:this.state.executionCursor,
      executionProgramId:this.state.executionProgramId,
      executionCompletions:this.state.executionCompletions,
      programStructureRevisions:this.state.programStructureRevisions,
      lastPrimitive:this.state.lastPrimitive,
      executionHistory:this.state.executionHistory.slice(),
      actionConsequenceCredits01:{...this.state.actionConsequenceCredits01},
    };
  }
}
