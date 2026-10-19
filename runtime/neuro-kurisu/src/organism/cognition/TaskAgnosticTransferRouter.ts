import type { ActionKind } from '../core/types.ts';
import type { TransferableSkill } from './TransferableEmbodiedSkillSystem.ts';
import { cosineSimilarity as cosine } from '../core/NumericPrimitives.ts';
const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));

const deep=<T>(x:T):T=>structuredClone(x);

export interface TaskAgnosticTransferRouterState {
  version:1;
  tick:number;
  evaluations:number;
  successfulTransfers:number;
  harmfulTransfers:number;
  abstentions:number;
  utilitySamples:number;
  meanUtility01:number;
  calibration01:number;
  coverage01:number;
  transfer01:number;
  negativeTransfer01:number;
  abstractionUtility01:number;
  selectedSkillId:string|null;
  selectedAction:ActionKind|null;
  selectedConfidence01:number;
  lastUtility01:number;
  lastSpecificity01:number;
  lastAbstractness01:number;
  lastTaskFreeScore01:number;
}

const defaultState=():TaskAgnosticTransferRouterState=>({version:1,tick:0,evaluations:0,successfulTransfers:0,harmfulTransfers:0,abstentions:0,utilitySamples:0,meanUtility01:.5,calibration01:.5,coverage01:0,transfer01:0,negativeTransfer01:0,abstractionUtility01:.5,selectedSkillId:null,selectedAction:null,selectedConfidence01:0,lastUtility01:.5,lastSpecificity01:0,lastAbstractness01:0,lastTaskFreeScore01:0});

export class TaskAgnosticTransferRouter {
  private state=defaultState();
  snapshot(){return deep(this.state);}
  restore(raw?:Partial<TaskAgnosticTransferRouterState>|null){const d=defaultState(),r:any=raw??{};this.state={...d,...deep(r),version:1,meanUtility01:clamp(Number(r.meanUtility01??d.meanUtility01)),calibration01:clamp(Number(r.calibration01??d.calibration01)),coverage01:clamp(Number(r.coverage01??0)),transfer01:clamp(Number(r.transfer01??0)),negativeTransfer01:clamp(Number(r.negativeTransfer01??0)),abstractionUtility01:clamp(Number(r.abstractionUtility01??.5)),selectedConfidence01:clamp(Number(r.selectedConfidence01??0)),lastUtility01:clamp(Number(r.lastUtility01??.5)),lastSpecificity01:clamp(Number(r.lastSpecificity01??0)),lastAbstractness01:clamp(Number(r.lastAbstractness01??0)),lastTaskFreeScore01:clamp(Number(r.lastTaskFreeScore01??0))};}

  private scoreSkill(skill:TransferableSkill,context:number[],goalSignal01:number):{utility:number;specificity:number;abstractness:number;taskFree:number}{
    const ctx=clamp((cosine(skill.contextPrototype,context)+1)*.5),delta=skill.deltaPrototype.length?clamp((cosine(skill.deltaPrototype,context.slice(0,skill.deltaPrototype.length))+1)*.5):.5;
    const specificity=clamp(ctx*.60+delta*.40);
    const diversity=Math.min(1,Math.max(0,skill.usage)/18);
    const abstractness=clamp(.35+(.65*(1-specificity))*.6+diversity*.25+skill.optionLength01*.15);
    const utility=clamp(skill.confidence01*.28+skill.success01*.22+skill.reward01*.18+skill.stability01*.10+(1-skill.contradiction01)*.10+(1-skill.uncertainty01)*.07+goalSignal01*.05);
    const taskFree=clamp(.50*utility+.25*specificity+.15*abstractness+.10*(1-skill.contradiction01));
    return {utility,specificity,abstractness,taskFree};
  }

  beforeDecision(args:{tick:number;context:number[];skills:TransferableSkill[];actionUtilities:Record<ActionKind,number>;goalSignal01:number;uncertainty01:number;negativeTransfer01:number;computeBudget01:number}):{actionBias:Record<ActionKind,number>;selectedSkillId:string|null;selectedAction:ActionKind|null;selectedConfidence01:number;coverage01:number;abstain:boolean;taskFreeScore01:number;utility01:number}{
    this.state.tick=args.tick;this.state.evaluations++;
    const context=args.context.slice(0,24);
    const ranked=args.skills.map(s=>{const q=this.scoreSkill(s,context,args.goalSignal01);return {s,q};}).sort((a,b)=>b.q.taskFree-a.q.taskFree);
    const best=ranked[0];
    const confidence=best?clamp(best.q.taskFree*(1-args.uncertainty01*.55)*(1-args.negativeTransfer01*.45)):0;
    const threshold=.46+args.uncertainty01*.12+args.negativeTransfer01*.08;
    const abstain=!best||confidence<threshold||best.q.utility<.44;
    if(abstain)this.state.abstentions++;
    else this.state.successfulTransfers += best.q.taskFree>.62?1:0;
    if(best){this.state.selectedSkillId=best.s.id;this.state.selectedAction=best.s.action;this.state.selectedConfidence01=confidence;this.state.lastUtility01=best.q.utility;this.state.lastSpecificity01=best.q.specificity;this.state.lastAbstractness01=best.q.abstractness;this.state.lastTaskFreeScore01=best.q.taskFree;this.state.utilitySamples++;this.state.meanUtility01=clamp(this.state.meanUtility01*.96+best.q.utility*.04);this.state.abstractionUtility01=clamp(this.state.abstractionUtility01*.95+(best.q.abstractness*.5+best.q.utility*.5)*.05);}
    const evaluated=Math.max(1,Math.min(8,Math.floor(2+args.computeBudget01*6)));
    const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
    for(const item of ranked.slice(0,evaluated)){
      const action=item.s.action;
      const gain=clamp(item.q.taskFree*(abstain?.45:1))-.5;
      bias[action]=clamp((bias[action]??0)+gain*.055,-.065,.065);
    }
    this.state.coverage01=clamp(this.state.coverage01*.985+(abstain?0:1)*.015);
    this.state.transfer01=clamp(this.state.transfer01*.95+confidence*.05);
    return {actionBias:bias,selectedSkillId:best?.s.id??null,selectedAction:best?.s.action??null,selectedConfidence01:confidence,coverage01:this.state.coverage01,abstain,taskFreeScore01:best?.q.taskFree??0,utility01:best?.q.utility??.5};
  }

  afterOutcome(args:{selectedSkillId:string|null;reward01:number;verified01:number;predictionError01:number;counterfactualReward01?:number}):void{
    if(!args.selectedSkillId)return;
    const success=clamp(args.reward01*.65+args.verified01*.25+(1-args.predictionError01)*.10);
    const harmful=args.reward01<.40&&args.verified01<.5;
    if(harmful)this.state.harmfulTransfers++;
    const expected=this.state.lastUtility01;
    const absErr=Math.abs(expected-success);
    this.state.calibration01=clamp(this.state.calibration01*.95+(1-absErr)*.05);
    this.state.meanUtility01=clamp(this.state.meanUtility01*.96+success*.04);
    this.state.negativeTransfer01=clamp(this.state.negativeTransfer01*.97+(harmful?Math.max(.15,1-success):0)*.03);
    this.state.transfer01=clamp(this.state.transfer01*.95+success*.05);
  }
  metrics(){return deep(this.state);}
}
export const defaultTaskAgnosticTransferRouter=():TaskAgnosticTransferRouterState=>defaultState();
