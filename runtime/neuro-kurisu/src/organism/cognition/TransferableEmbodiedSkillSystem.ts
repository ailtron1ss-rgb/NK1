import type { ActionKind } from '../core/types.ts';
import { cosineSimilarity as cosine } from '../core/NumericPrimitives.ts';
const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;

const dist=(a:number[],b:number[])=>{let s=0,n=Math.min(a.length,b.length);for(let i=0;i<n;i++){const d=finite(a[i])-finite(b[i]);s+=d*d;}return Math.sqrt(s/Math.max(1,n));};
const deep=<T>(x:T):T=>structuredClone(x);

export interface TransferableSkill {
  id:string;
  action:ActionKind;
  contextPrototype:number[];
  deltaPrototype:number[];
  successorFeature:number[];
  reward01:number;
  success01:number;
  confidence01:number;
  uncertainty01:number;
  stability01:number;
  contradiction01:number;
  usage:number;
  sourceCount:number;
  optionLength01:number;
  lastTick:number;
}

export interface TransferableEmbodiedSkillSystemState {
  version:1;
  tick:number;
  decisions:number;
  transitions:number;
  skillTransfers:number;
  successfulTransfers:number;
  interventionProbes:number;
  recoveries:number;
  failedRecoveries:number;
  holdoutEvaluations:number;
  holdoutSuccesses:number;
  transfer01:number;
  abstractionGain01:number;
  recoveryQuality01:number;
  skillDiversity01:number;
  interventionValue01:number;
  optionCoverage01:number;
  negativeTransfer01:number;
  consolidationCount:number;
  mergedSkills:number;
  skillFragmentation01:number;
  selectedSkillId:string|null;
  selectedSkillConfidence01:number;
  selectedRecoveryAction:ActionKind|null;
  skills:TransferableSkill[];
}

export const defaultTransferableEmbodiedSkillSystem=():TransferableEmbodiedSkillSystemState=>({
  version:1,tick:0,decisions:0,transitions:0,skillTransfers:0,successfulTransfers:0,interventionProbes:0,
  recoveries:0,failedRecoveries:0,holdoutEvaluations:0,holdoutSuccesses:0,transfer01:0,abstractionGain01:0,
  recoveryQuality01:.5,skillDiversity01:0,interventionValue01:0,optionCoverage01:0,negativeTransfer01:0,consolidationCount:0,mergedSkills:0,skillFragmentation01:0,
  selectedSkillId:null,selectedSkillConfidence01:0,selectedRecoveryAction:null,skills:[]
});

export class TransferableEmbodiedSkillSystem {
  private state=defaultTransferableEmbodiedSkillSystem();
  readonly maxSkills=48;

  snapshot(){return deep(this.state);}
  restore(raw?:Partial<TransferableEmbodiedSkillSystemState>|null){
    const d=defaultTransferableEmbodiedSkillSystem(),r:any=raw??{};
    const arr=(v:any,n:number,f=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(f)).slice(0,n):new Array(n).fill(f);
    const skills=Array.isArray(r.skills)?r.skills.slice(-this.maxSkills):[];
    this.state={...d,...deep(r),version:1,
      skills:skills.map((s:any)=>({...s,contextPrototype:arr(s.contextPrototype,8),deltaPrototype:arr(s.deltaPrototype,8),successorFeature:arr(s.successorFeature,8)})),
      transfer01:clamp(Number(r.transfer01??0)),abstractionGain01:clamp(Number(r.abstractionGain01??0)),recoveryQuality01:clamp(Number(r.recoveryQuality01??.5)),
      skillDiversity01:clamp(Number(r.skillDiversity01??0)),interventionValue01:clamp(Number(r.interventionValue01??0)),optionCoverage01:clamp(Number(r.optionCoverage01??0)),negativeTransfer01:clamp(Number(r.negativeTransfer01??0)),consolidationCount:Math.max(0,Number(r.consolidationCount??0)),mergedSkills:Math.max(0,Number(r.mergedSkills??0)),skillFragmentation01:clamp(Number(r.skillFragmentation01??0)),
    };
  }

  private signature(v:number[],n=8){return Array.from({length:n},(_,i)=>clamp(tanh(finite(v[i%Math.max(1,v.length)],0))));}
  private consolidateSkills(maxMerges=2){
    if(this.state.skills.length<33)return 0;
    let merged=0;
    for(let pass=0;pass<maxMerges && this.state.skills.length>16;pass++){
      let bi=-1,bj=-1,bscore=.90;
      for(let i=0;i<this.state.skills.length;i++){
        const a=this.state.skills[i]!;
        for(let j=i+1;j<this.state.skills.length;j++){
          const b=this.state.skills[j]!;
          if(a.action!==b.action)continue;
          const cs=cosine(a.contextPrototype,b.contextPrototype);
          const ds=cosine(a.deltaPrototype,b.deltaPrototype);
          const ss=cosine(a.successorFeature,b.successorFeature);
          const score=.48*cs+.34*ds+.18*ss-.10*(a.contradiction01+b.contradiction01)*.5;
          if(score>bscore){bscore=score;bi=i;bj=j;}
        }
      }
      if(bi<0 || bj<0)break;
      const a=this.state.skills[bi]!,b=this.state.skills[bj]!;
      const wa=Math.max(1,a.usage),wb=Math.max(1,b.usage),w=wa+wb,avg=(x:number,y:number)=>clamp((x*wa+y*wb)/w);
      const mergedSkill:TransferableSkill={
        ...a,
        contextPrototype:a.contextPrototype.map((v,i)=>avg(v,b.contextPrototype[i]??v)),
        deltaPrototype:a.deltaPrototype.map((v,i)=>avg(v,b.deltaPrototype[i]??v)),
        successorFeature:a.successorFeature.map((v,i)=>avg(v,b.successorFeature[i]??v)),
        reward01:avg(a.reward01,b.reward01),success01:avg(a.success01,b.success01),confidence01:avg(a.confidence01,b.confidence01),
        uncertainty01:avg(a.uncertainty01,b.uncertainty01),stability01:avg(a.stability01,b.stability01),contradiction01:avg(a.contradiction01,b.contradiction01),
        usage:a.usage+b.usage,sourceCount:a.sourceCount+b.sourceCount,optionLength01:avg(a.optionLength01,b.optionLength01),lastTick:Math.max(a.lastTick,b.lastTick)
      };
      this.state.skills[bi]=mergedSkill;
      this.state.skills.splice(bj,1);
      merged++;
      this.state.mergedSkills++;
      this.state.consolidationCount++;
    }
    const actionCount=new Set(this.state.skills.map(s=>s.action)).size;
    this.state.skillFragmentation01=clamp((this.state.skills.length-Math.max(1,actionCount))/Math.max(1,this.maxSkills-Math.max(1,actionCount)));
    return merged;
  }

  private findSkill(action:ActionKind,context:number[],delta:number[]){
    let best:TransferableSkill|undefined,bestScore=-Infinity;
    for(const s of this.state.skills){
      if(s.action!==action)continue;
      const cs=cosine(s.contextPrototype,context),ds=cosine(s.deltaPrototype,delta);
      const score=.62*cs+.28*ds+.10*s.stability01-.14*s.contradiction01-.08*s.uncertainty01;
      if(score>bestScore){bestScore=score;best=s;}
    }
    return {skill:best,score:bestScore};
  }

  beforeDecision(args:{tick:number;context:number[];latent:number[];actionUtilities:Record<ActionKind,number>;goalPressure01:number;uncertainty01:number;computeBudget01:number;predictionError01:number;novelty01:number;}):{
    actionBias:Record<ActionKind,number>;selectedSkillId:string|null;selectedSkillConfidence01:number;selectedRecoveryAction:ActionKind|null;interventionValue01:number;optionCoverage01:number;
  }{
    this.state.tick=args.tick;this.state.decisions++;
    const context=this.signature(args.context),latent=this.signature(args.latent),bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
    const candidates:{a:ActionKind;skill:TransferableSkill;score:number;value:number}[]=[];
    for(const a of ACTIONS){
      const {skill,score}=this.findSkill(a,context,latent);
      if(!skill || score<.58)continue;
      const value=clamp(.40*skill.reward01+.24*skill.confidence01+.16*skill.success01+.10*skill.stability01+.10*cosine(skill.successorFeature,latent));
      const transferPenalty=skill.contradiction01*.18+skill.uncertainty01*.12;
      const bonus=(value-transferPenalty)*(.45+.55*clamp(args.computeBudget01));
      bias[a]=clamp((bonus-.42)*.16,-.10,.10);
      candidates.push({a,skill,score,value});
    }
    candidates.sort((a,b)=>b.value+b.score-(a.value+a.score));
    const selected=candidates[0]?.skill??null;
    this.state.selectedSkillId=selected?.id??null;
    this.state.selectedSkillConfidence01=selected?clamp(.55*candidates[0]!.score+.45*selected.confidence01):0;
    this.state.optionCoverage01=clamp(this.state.optionCoverage01*.96+(candidates.length/ACTIONS.length)*.04);
    this.state.abstractionGain01=clamp(this.state.abstractionGain01*.94+(candidates.length?Math.max(0,candidates[0]!.score-.58):0)*.06);

    const needsProbe=args.uncertainty01>.52 || args.predictionError01>.48;
    if(needsProbe && args.computeBudget01>.42){
      this.state.interventionProbes++;
      const probe= ACTIONS.filter(a=>a!==candidates[0]?.a).map(a=>({a,v:(args.actionUtilities[a]??.5)+bias[a]})).sort((x,y)=>y.v-x.v)[0];
      if(probe){this.state.interventionValue01=clamp(this.state.interventionValue01*.94+(probe.v-(args.actionUtilities[probe.a]??.5)+.5)*.06);}
    }

    let recovery:ActionKind|null=null;
    if(args.predictionError01>.58){
      recovery=(this.state.skills.filter(s=>s.action==='verify'||s.action==='explore'||s.action==='reflect').sort((a,b)=>(b.success01+b.confidence01)-(a.success01+a.confidence01))[0]?.action)??'verify';
      bias[recovery]=clamp(bias[recovery]+.035,-.10,.10);
      this.state.selectedRecoveryAction=recovery;
    }else this.state.selectedRecoveryAction=null;
    return {actionBias:bias,selectedSkillId:this.state.selectedSkillId,selectedSkillConfidence01:this.state.selectedSkillConfidence01,selectedRecoveryAction:recovery,interventionValue01:this.state.interventionValue01,optionCoverage01:this.state.optionCoverage01};
  }

  afterOutcome(args:{tick:number;context:number[];latent:number[];nextLatent:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;transferContext?:number[];}):{
    transferred:boolean;skillCreated:boolean;skillId:string;transfer01:number;negativeTransfer01:number;recoveryTriggered:boolean;recoveryQuality01:number;
  }{
    this.state.tick=args.tick;this.state.transitions++;
    if(this.state.skills.length>32 && this.state.transitions%32===0)this.consolidateSkills(3);
    const context=this.signature(args.transferContext??args.context),latent=this.signature(args.latent),delta=this.signature(args.nextLatent.map((v,i)=>finite(v)-finite(args.latent[i]))),next=this.signature(args.nextLatent);
    const found=this.findSkill(args.action,context,delta);
    const lr=clamp(.035+clamp(args.verified01)*.085,.02,.14);
    let skill=found.skill,created=false,transferred=false;
    if(skill && found.score>.54){
      const wasWeak=skill.confidence01<.62;
      skill.contextPrototype=skill.contextPrototype.map((v,i)=>clamp(v*(1-lr)+context[i]!*lr));
      skill.deltaPrototype=skill.deltaPrototype.map((v,i)=>clamp(v*(1-lr)+delta[i]!*lr));
      skill.successorFeature=skill.successorFeature.map((v,i)=>clamp(v*(1-lr)+next[i]!*lr));
      skill.reward01=clamp(skill.reward01*(1-lr)+args.reward01*lr);
      skill.success01=clamp(skill.success01*.94+(args.reward01>.55?1:0)*.06);
      skill.uncertainty01=clamp(skill.uncertainty01*.92+args.predictionError01*.08);
      skill.confidence01=clamp(skill.confidence01*.92+(1-args.predictionError01)*.08);
      skill.stability01=clamp(skill.stability01*.96+args.verified01*.04);
      skill.contradiction01=clamp(skill.contradiction01*.90+Math.max(0,args.predictionError01-.35)*.10);
      skill.usage++;skill.sourceCount++;skill.lastTick=args.tick;
      transferred=!wasWeak;
    }else if(this.state.skills.length<this.maxSkills){
      skill={id:`skill-${args.action}-${args.tick}-${this.state.transitions}`,action:args.action,contextPrototype:context,deltaPrototype:delta,successorFeature:next,reward01:clamp(args.reward01),success01:args.reward01>.55?1:0,confidence01:clamp(1-args.predictionError01),uncertainty01:clamp(args.predictionError01),stability01:clamp(args.verified01),contradiction01:0,usage:1,sourceCount:1,optionLength01:.25,lastTick:args.tick};
      this.state.skills.push(skill);created=true;
    }else{
      const weakest=this.state.skills.slice().sort((a,b)=>(a.confidence01+a.stability01)-(b.confidence01+b.stability01))[0];
      if(weakest && args.reward01>weakest.reward01){
        skill={...weakest,id:`skill-${args.action}-${args.tick}-${this.state.transitions}`,action:args.action,contextPrototype:context,deltaPrototype:delta,successorFeature:next,reward01:clamp(args.reward01),success01:args.reward01>.55?1:0,confidence01:clamp(1-args.predictionError01),uncertainty01:clamp(args.predictionError01),stability01:clamp(args.verified01),contradiction01:0,usage:1,sourceCount:1,lastTick:args.tick};
        const idx=this.state.skills.indexOf(weakest);this.state.skills[idx]=skill;created=true;
      }else skill=weakest??{id:'skill-fallback',action:args.action,contextPrototype:context,deltaPrototype:delta,successorFeature:next,reward01:.5,success01:.5,confidence01:.1,uncertainty01:1,stability01:0,contradiction01:1,usage:0,sourceCount:0,optionLength01:.25,lastTick:args.tick};
    }

    const expected=skill.reward01,err=Math.abs(args.reward01-expected),similarity=found.skill?clamp(found.score):0;
    const transferGain=clamp(similarity*(1-args.predictionError01)*(.5+.5*clamp(args.verified01)));
    this.state.skillTransfers+=similarity>.58?1:0;
    this.state.successfulTransfers+=transferGain>.52?1:0;
    this.state.transfer01=clamp(this.state.transfer01*.93+transferGain*.07);
    const negative=Math.max(0,args.predictionError01-.50)*(found.skill?similarity:0);
    this.state.negativeTransfer01=clamp(this.state.negativeTransfer01*.95+negative*.05);

    const recoveryTriggered=args.predictionError01>.58;
    if(recoveryTriggered){
      this.state.recoveries++;
      const q=clamp((args.verified01*.55)+(1-args.predictionError01)*.45);
      this.state.recoveryQuality01=clamp(this.state.recoveryQuality01*.92+q*.08);
      if(q<.42)this.state.failedRecoveries++;
    }
    this.state.skillDiversity01=clamp(Math.min(1,this.state.skills.length/18)*.65+Math.min(1,new Set(this.state.skills.map(s=>s.action)).size/ACTIONS.length)*.35);
    this.state.skillFragmentation01=clamp((this.state.skills.length-Math.max(1,new Set(this.state.skills.map(s=>s.action)).size))/Math.max(1,this.maxSkills-Math.max(1,new Set(this.state.skills.map(s=>s.action)).size)));
    return {transferred,skillCreated:created,skillId:skill.id,transfer01:this.state.transfer01,negativeTransfer01:this.state.negativeTransfer01,recoveryTriggered,recoveryQuality01:this.state.recoveryQuality01};
  }

  evaluateHoldout(args:{context:number[];latent:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number}){
    this.state.holdoutEvaluations++;
    const c=this.signature(args.context),l=this.signature(args.latent),found=this.findSkill(args.action,c,l);
    const usable=!!found.skill&&found.score>.58;
    const success=usable && found.skill!.reward01>.48 && found.skill!.confidence01>.35 && args.reward01>.52 && args.predictionError01<.65;
    if(success)this.state.holdoutSuccesses++;
    const successRate=this.state.holdoutSuccesses/Math.max(1,this.state.holdoutEvaluations);
    this.state.transfer01=clamp(this.state.transfer01*.96+successRate*.04);
    return {usable,success,similarity:clamp(found.score),predictedReward01:found.skill?.reward01??.5,successRate01:successRate};
  }

  metrics(){return deep(this.state);}
}

const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
