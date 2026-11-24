import { cosineSimilarity } from '../core/NumericPrimitives.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine=(a:number[],b:number[])=>Math.max(-1,Math.min(1,cosineSimilarity(a,b,1e-9)));
const hash=(parts:string[])=>{let h=2166136261;for(const p of parts){for(let i=0;i<p.length;i++){h^=p.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16);};
const mut=(v:number[],seed:number)=>v.map((x,i)=>clamp11(x + Math.sin((i+1)*(seed+1)*1.618)*.065));

export interface B274SkillCandidate {
  id:string;
  goalFingerprint:string;
  actions:ActionKind[];
  neuralFingerprint:string;
  novelty01:number;
  imaginedGain01:number;
  selfAlignment01:number;
  personalityFit01:number;
  uncertainty01:number;
  attempts:number;
  acceptedTrials:number;
  rejectedTrials:number;
  empiricalGain01:number;
  transferGain01:number;
  robustness01:number;
  status:'incubating'|'trial'|'candidate'|'promoted'|'rejected'|'retired';
  createdTick:number;
  lastTick:number;
}

export interface B274State {
  version:1;
  ticks:number;
  cycles:number;
  imaginedExperiments:number;
  realTrials:number;
  independentEvaluations:number;
  promotions:number;
  rejections:number;
  transfers:number;
  reversions:number;
  candidates:B274SkillCandidate[];
  promotedSkillIds:string[];
  activeCandidateId:string|null;
  lastExperimentId:string|null;
  endogenousSkillPressure01:number;
  discoveryRate01:number;
  transferRate01:number;
  promotionConfidence01:number;
  neuralGrounding01:number;
  autonomyContribution01:number;
  selfAlignment01:number;
  personalityFit01:number;
  rollbackSafety01:number;
  transferKeys:string[];
}

export interface B274StepInput {
  tick:number;
  goalVector:number[];
  plan:ActionKind[];
  selfLatent:number[];
  worldLatent:number[];
  neuralAssembly:number[];
  needs:{novelty01:number;uncertainty01:number;goalPressure01:number;autonomy01:number;coherence01:number};
  traits:Record<string,number>;
  imaginedPlanScores?:Array<{actions:ActionKind[];predictedGain01:number;uncertainty01:number}>;
  independentGain01?:number;
}

export interface B274StepResult {
  candidateId:string;
  candidateCreated:boolean;
  experimentActions:ActionKind[];
  imaginedGain01:number;
  novelty01:number;
  selfAlignment01:number;
  neuralGrounding01:number;
  autonomyContribution01:number;
}

export function defaultB274State():B274State{
  return {version:1,ticks:0,cycles:0,imaginedExperiments:0,realTrials:0,independentEvaluations:0,promotions:0,rejections:0,transfers:0,reversions:0,candidates:[],promotedSkillIds:[],activeCandidateId:null,lastExperimentId:null,endogenousSkillPressure01:.35,discoveryRate01:0,transferRate01:0,promotionConfidence01:.35,neuralGrounding01:.35,autonomyContribution01:.35,selfAlignment01:.5,personalityFit01:.5,rollbackSafety01:.9,transferKeys:[]};
}

export class B274AutonomousSkillLaboratory{
  private state=defaultB274State();
  restore(raw?:Partial<B274State>|null){
    const d=defaultB274State(),r=raw??{};
    this.state={...d,...r,candidates:Array.isArray(r.candidates)?r.candidates.slice(-96).map((c:any)=>({...c,actions:Array.isArray(c?.actions)?c.actions.slice(0,6).filter((a:any)=>ACTIONS.includes(a)):['reflect']})):[],promotedSkillIds:Array.isArray(r.promotedSkillIds)?r.promotedSkillIds.slice(-64):[],transferKeys:Array.isArray(r.transferKeys)?r.transferKeys.slice(-128):[]};
  }
  snapshot(){return structuredClone(this.state);}

  private goalFingerprint(v:number[]){return hash(v.slice(0,8).map(x=>Number(x).toFixed(3)));}
  private neuralFingerprint(assembly:number[],self:number[],world:number[]){const mix=assembly.slice(0,16).map((x,i)=>clamp11(x*.55+(self[i%Math.max(1,self.length)]??0)*.25+(world[i%Math.max(1,world.length)]??0)*.2));return hash(mix.map(x=>x.toFixed(3)));}
  private candidateSequence(input:B274StepInput,index:number){
    const base=input.plan.filter(a=>ACTIONS.includes(a));
    const pool=base.length?base:['reflect','verify'];
    const seed=Math.round(Math.abs(input.goalVector.reduce((s,x,i)=>s+(i+1)*x,0))*1000)%17+index;
    const first=pool[index%pool.length]??'reflect';
    const second=pool[(index+1+seed)%pool.length]??'verify';
    const third=index%3===0?'explore':index%3===1?'verify':'reflect';
    const seq=[first,second,third].filter((x,i,arr)=>arr.indexOf(x)===i) as ActionKind[];
    return seq.length>=2?seq:((pool.slice(0,2).length>=2?pool.slice(0,2):['reflect','verify']) as ActionKind[]);
  }
  private fit(input:B274StepInput,actions:ActionKind[],imaginedGain:number,uncertainty:number){
    const selfAlignment=clamp01(.5+.5*cosine(input.goalVector.slice(0,8),input.selfLatent.slice(0,8)));
    const personalityValues=Object.values(input.traits);
    const personalityMean=personalityValues.length?personalityValues.reduce((s,x)=>s+x,0)/personalityValues.length:.5;
    const actionNovelty=new Set(actions).size/Math.max(1,actions.length);
    const neuralGrounding=clamp01(.35+.38*Math.abs(cosine(input.neuralAssembly.slice(0,16),input.worldLatent.slice(0,16)))+.27*Math.min(1,input.neuralAssembly.length/16));
    const personalityFit=clamp01(.45+.25*(1-Math.abs(personalityMean-.5))+.18*(input.needs.coherence01)+.12*(input.needs.autonomy01));
    const novelty=clamp01(.28*input.needs.novelty01+.24*actionNovelty+.22*(1-uncertainty)+.16*(1-selfAlignment)+.10*(1-Math.max(0,imaginedGain)));
    return {selfAlignment,neuralGrounding,personalityFit,novelty};
  }

  step(input:B274StepInput):B274StepResult{
    this.state.ticks=input.tick;this.state.cycles++;
    const plans=input.imaginedPlanScores?.length?input.imaginedPlanScores.slice(0,12):[];
    let best=plans.sort((a,b)=>(b.predictedGain01-b.uncertainty01*.32)-(a.predictedGain01-a.uncertainty01*.32))[0];
    const index=(this.state.imaginedExperiments+this.state.cycles)%5;
    const experimentActions=(best?.actions?.length?best.actions:this.candidateSequence(input,index)).slice(0,6) as ActionKind[];
    const imaginedGain=clamp01(best?.predictedGain01 ?? (.42+.12*input.needs.novelty01+.08*input.needs.autonomy01-.12*input.needs.uncertainty01));
    const uncertainty=clamp01(best?.uncertainty01 ?? (.45+.22*input.needs.uncertainty01));
    const fit=this.fit(input,experimentActions,imaginedGain,uncertainty);
    const goalFingerprint=this.goalFingerprint(input.goalVector);
    const neuralFingerprint=this.neuralFingerprint(input.neuralAssembly,input.selfLatent,input.worldLatent);
    const id=`skill274-${hash([goalFingerprint,neuralFingerprint,experimentActions.join('>')])}`;
    const nearby=this.state.candidates
      .filter(c=>c.status!=='retired' && c.actions.join('>')===experimentActions.join('>'))
      .map(c=>({c,sim:cosine(c.goalFingerprint.split('').map(ch=>ch.charCodeAt(0)/127),input.goalVector.slice(0,8))}))
      .sort((a,b)=>b.sim-a.sim)[0];
    let candidate=(nearby && nearby.sim>.86)?nearby.c:this.state.candidates.find(c=>c.id===id);
    let created=false;
    if(!candidate){
      candidate={id,goalFingerprint,actions:experimentActions,neuralFingerprint,novelty01:fit.novelty,imaginedGain01:imaginedGain,selfAlignment01:fit.selfAlignment,personalityFit01:fit.personalityFit,uncertainty01:uncertainty,attempts:0,acceptedTrials:0,rejectedTrials:0,empiricalGain01:.5,transferGain01:.5,robustness01:.7,status:'incubating',createdTick:input.tick,lastTick:input.tick};
      this.state.candidates=[...this.state.candidates.slice(-95),candidate];created=true;this.state.imaginedExperiments++;
    } else {
      candidate.lastTick=input.tick;candidate.novelty01=clamp01(candidate.novelty01*.86+fit.novelty*.14);candidate.selfAlignment01=clamp01(candidate.selfAlignment01*.88+fit.selfAlignment*.12);
    }
    candidate.status='trial';
    this.state.activeCandidateId=candidate.id;this.state.lastExperimentId=candidate.id;this.state.endogenousSkillPressure01=clamp01(this.state.endogenousSkillPressure01*.88+(fit.novelty*.35+input.needs.goalPressure01*.25+(1-fit.selfAlignment)*.2+input.needs.uncertainty01*.2)*.12);
    this.state.neuralGrounding01=clamp01(this.state.neuralGrounding01*.88+fit.neuralGrounding*.12);
    this.state.selfAlignment01=clamp01(this.state.selfAlignment01*.9+fit.selfAlignment*.1);
    this.state.personalityFit01=clamp01(this.state.personalityFit01*.9+fit.personalityFit*.1);
    this.state.autonomyContribution01=clamp01(this.state.autonomyContribution01*.9+(.45*fit.novelty+.35*fit.neuralGrounding+.20*input.needs.autonomy01)*.1);
    return {candidateId:id,candidateCreated:created,experimentActions,imaginedGain01:imaginedGain,novelty01:fit.novelty,selfAlignment01:fit.selfAlignment,neuralGrounding01:fit.neuralGrounding,autonomyContribution01:this.state.autonomyContribution01};
  }

  observeTrial(input:{tick:number;candidateId:string;reward01:number;independentGain01:number;predictionError01:number;personalityAlignment01:number;selfAlignment01:number;worldNovelty01:number;neuralReliability01:number;transferTestGain01?:number;robustness01?:number}){
    const c=this.state.candidates.find(x=>x.id===input.candidateId);if(!c)return {accepted:false,promoted:false,rejected:false,transfer:false,rollback:false,skillId:null};
    this.state.realTrials++;this.state.independentEvaluations++;
    const evidence=clamp01(.28*input.reward01+.34*clamp01(.5+input.independentGain01)+.14*(1-input.predictionError01)+.12*input.personalityAlignment01+.12*input.neuralReliability01);
    const gain=input.independentGain01;
    const acceptance=gain>.025 && evidence>.56 && input.predictionError01<.78 && input.neuralReliability01>.42;
    c.attempts++;c.lastTick=input.tick;c.empiricalGain01=clamp01(c.empiricalGain01*.76+clamp01(.5+gain)*.24);c.transferGain01=clamp01(c.transferGain01*.78+clamp01(.5+(input.transferTestGain01??gain))*.22);c.robustness01=clamp01(c.robustness01*.8+(input.robustness01??(1-input.predictionError01))*.2);
    if(acceptance){c.acceptedTrials++;c.status=c.acceptedTrials>=2?'candidate':'trial';}
    else {c.rejectedTrials++;c.status=c.rejectedTrials>=2?'rejected':'trial';}
    let promoted=false,rollback=false,transfer=false;
    const promotionGate=c.acceptedTrials>=2 && c.empiricalGain01>.54 && c.transferGain01>.54 && c.robustness01>.52 && c.selfAlignment01>.42;
    if(promotionGate){c.status='promoted';if(!this.state.promotedSkillIds.includes(c.id)){this.state.promotedSkillIds=[...this.state.promotedSkillIds.slice(-63),c.id];this.state.promotions++;promoted=true;}}
    if(c.rejectedTrials>=2 && c.attempts>2){c.status='retired';this.state.rejections++;rollback=true;}
    if((input.transferTestGain01??0)>.04 && c.status==='promoted'){this.state.transferRate01=clamp01(this.state.transferRate01*.84+.16);transfer=true;}
    if(!acceptance && c.status==='candidate'){c.status='trial';this.state.rollbackSafety01=clamp01(this.state.rollbackSafety01*.95+.05);rollback=true;}
    const localRate=this.state.realTrials?this.state.promotions/this.state.realTrials:0;this.state.discoveryRate01=clamp01(this.state.discoveryRate01*.86+localRate*.14);this.state.promotionConfidence01=clamp01(this.state.promotionConfidence01*.84+evidence*.16);
    return {accepted:acceptance,promoted,rejected:c.status==='retired',transfer,rollback,skillId:c.status==='promoted'?c.id:null,evidence01:evidence,empiricalGain01:c.empiricalGain01,transferGain01:c.transferGain01,robustness01:c.robustness01};
  }

  promoteTransferred(input:{tick:number;sourceSkillId:string;newGoalVector:number[];selfLatent:number[];neuralAssembly:number[];independentGain01:number;robustness01:number}){
    const source=this.state.candidates.find(c=>c.id===input.sourceSkillId && c.status==='promoted');if(!source)return {promoted:false,transferGain01:0,skillId:null};
    const similarity=cosine(source.goalFingerprint.split('').map(ch=>ch.charCodeAt(0)/127),input.newGoalVector.slice(0,Math.min(8,input.newGoalVector.length)));
    const neural=clamp01(.5+.5*cosine(input.neuralAssembly.slice(0,16),input.selfLatent.slice(0,16)));
    const transferGain=clamp01(.55+.25*input.independentGain01+.12*similarity+.08*input.robustness01)*neural;
    const transferKey=hash([source.id,input.newGoalVector.slice(0,8).map(x=>Number(x).toFixed(3)).join(',')]);
    if(transferGain>.57 && input.robustness01>.52){
      if(!this.state.transferKeys.includes(transferKey)){this.state.transferKeys=[...this.state.transferKeys.slice(-127),transferKey];this.state.transfers++;this.state.transferRate01=clamp01(this.state.transferRate01*.8+.2);return {promoted:true,transferGain01:transferGain,skillId:`transfer274-${transferKey}`};}
      return {promoted:false,transferGain01:transferGain,skillId:`transfer274-${transferKey}`};
    }
    return {promoted:false,transferGain01:transferGain,skillId:null};
  }

  actionBias(action:ActionKind){
    const c=this.state.activeCandidateId?this.state.candidates.find(x=>x.id===this.state.activeCandidateId):null;
    if(!c)return 0;
    const idx=c.actions.indexOf(action);
    const promoted=c.status==='promoted'?0.035:0.014;
    const position=idx>=0?promoted/(idx+1):0;
    const trust=c.status==='promoted'?(.6*c.empiricalGain01+.25*c.transferGain01+.15*c.robustness01):(.4*c.imaginedGain01);
    return clamp11(position*(.7+trust)+.012*(this.state.autonomyContribution01-.5));
  }

  promotedSkillSummaries(){ return this.state.candidates.filter(c=>c.status==='promoted').map(c=>({id:c.id,actions:c.actions.slice(),reliability01:clamp01(.45*c.empiricalGain01+.35*c.transferGain01+.20*c.robustness01)})); }
  diagnostics(){
    const promoted=this.state.candidates.filter(c=>c.status==='promoted').length;
    const active=this.state.candidates.filter(c=>['incubating','trial','candidate'].includes(c.status)).length;
    return {
      version:1, ticks:this.state.ticks, cycles:this.state.cycles,
      imaginedExperiments:this.state.imaginedExperiments, realTrials:this.state.realTrials,
      independentEvaluations:this.state.independentEvaluations, promotions:this.state.promotions,
      rejections:this.state.rejections, transfers:this.state.transfers, reversions:this.state.reversions,
      activeCandidates:active, promotedSkills:promoted, discoveryRate01:this.state.discoveryRate01,
      transferRate01:this.state.transferRate01, promotionConfidence01:this.state.promotionConfidence01,
      neuralGrounding01:this.state.neuralGrounding01, autonomyContribution01:this.state.autonomyContribution01,
      selfAlignment01:this.state.selfAlignment01, personalityFit01:this.state.personalityFit01,
      rollbackSafety01:this.state.rollbackSafety01, activeCandidateId:this.state.activeCandidateId,
    };
  }
}
