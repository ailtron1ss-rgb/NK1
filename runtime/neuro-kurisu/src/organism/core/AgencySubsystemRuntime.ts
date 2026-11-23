import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { SelfProjectEngine } from '../cognition/evolution/SelfProjectEngine.ts';
import { AgencyDeliberationEngine } from '../cognition/evolution/AgencyDeliberationEngine.ts';
import { CognitiveBudgetManager } from '../cognition/CognitiveBudgetManager.ts';
import { CognitiveQuorumEngine } from '../system/CognitiveQuorum.ts';
import { AutonomousProjectExecutor } from '../system/AutonomousProjectExecutor.ts';
import { MultiProjectScheduler } from '../system/MultiProjectScheduler.ts';
import type { SelfProjectState } from '../cognition/evolution/SelfProjectEngine.ts';
import type { AgencyDeliberationState } from '../cognition/evolution/AgencyDeliberationEngine.ts';
import type { CognitiveBudgetState, CognitiveBudgetLedgerEntry } from '../cognition/CognitiveBudgetManager.ts';
import type { CognitiveQuorumState } from '../system/CognitiveQuorum.ts';
import type { ProjectExecutionState } from '../system/AutonomousProjectExecutor.ts';
import { P67AutonomousGoalGenesis } from '../developmental/P67AutonomousGoalGenesis.ts';
import { P68GoalEcology } from '../developmental/P68GoalEcology.ts';
import { B306AutonomousInitiativeVerificationLedger } from '../system/B306AutonomousInitiativeVerificationLedger.ts';
import { B333AutonomousGoalGenesisGate, defaultB333State } from '../system/B333AutonomousGoalGenesisGate.ts';
import { B334AutonomousProjectLifecycleGate, defaultB334State } from '../system/B334AutonomousProjectLifecycleGate.ts';
import { B335AutonomousProjectHoldoutGate, defaultB335State } from '../system/B335AutonomousProjectHoldoutGate.ts';
import { B336ProjectCausalOwnershipGate, defaultB336State } from '../system/B336ProjectCausalOwnershipGate.ts';
import { DecisionActionPipeline, type DecisionCandidateTrace } from './DecisionActionPipeline.ts';
import { LongHorizonAutonomyController } from '../system/LongHorizonAutonomyController.ts';
import { AutonomousResourceToolLifeController } from '../system/AutonomousResourceToolLifeController.ts';
import { AutonomousRuntimeLifeController } from '../system/AutonomousRuntimeLifeController.ts';
import { SelfDirectedLifeOrchestrator } from '../system/SelfDirectedLifeOrchestrator.ts';
import { AutonomousLearningMemoryGovernor } from '../system/AutonomousLearningMemoryGovernor.ts';
import { AutonomousRelationshipManager } from '../system/AutonomousRelationshipManager.ts';
import { OpenEndedSkillAcquisitionController } from '../system/OpenEndedSkillAcquisitionController.ts';
import { AutonomousSocialInitiativeEngine } from '../system/AutonomousSocialInitiativeEngine.ts';
import { LiveSelfImprovementSupervisor } from '../system/LiveSelfImprovementSupervisor.ts';

export interface AutonomousDecisionReceipt {
  id:string;
  tick:number;
  at:number;
  trigger:string;
  source:'external'|'endogenous';
  driveContributions:Record<string,number>;
  dominantDrive:string|null;
  goalId:string|null;
  goalSource:'internal'|'external'|'none';
  candidates:Array<{action:string;score:number;confidence01:number}>;
  selectedAction:string|null;
  confidence01:number;
  resourceCost01:number;
  safety:{authorized:boolean;reason:string};
  outcome?:{success01:number;reward01:number;surprise01:number;at:number};
  learning?:{accepted:boolean;gain01:number;note:string};
}
export interface DecisionReceiptState {
  version:1;
  created:number;
  closed:number;
  receipts:AutonomousDecisionReceipt[];
}
const defaultDecisionReceiptState=():DecisionReceiptState=>({version:1,created:0,closed:0,receipts:[]});
const receiptText=(value:unknown,limit=180)=>typeof value==='string'?value.replace(/[\\u0000-\\u001f\\u007f]/g,' ').trim().slice(0,limit):'';
const receiptNumber=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
const receiptClamp=(value:unknown)=>Math.max(0,Math.min(1,receiptNumber(value,0)));
const receiptOwn=(value:object,key:string):unknown=>{
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
};
const receiptPlain=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  try{const proto=Object.getPrototypeOf(value);return proto===Object.prototype||proto===null;}catch{return false;}
};
function restoreDecisionReceipt(raw:unknown):AutonomousDecisionReceipt|null{
  try{
    if(!receiptPlain(raw))return null;
    const id=receiptText(receiptOwn(raw,'id'),160);
    const tick=receiptNumber(receiptOwn(raw,'tick'),-1);
    const at=receiptNumber(receiptOwn(raw,'at'),-1);
    const source=receiptOwn(raw,'source');
    const goalSource=receiptOwn(raw,'goalSource');
    const safetyRaw=receiptOwn(raw,'safety');
    if(!id||!Number.isSafeInteger(tick)||tick<0||at<0
      ||(source!=='external'&&source!=='endogenous')
      ||(goalSource!=='internal'&&goalSource!=='external'&&goalSource!=='none')
      ||!receiptPlain(safetyRaw))return null;
    const drivesRaw=receiptOwn(raw,'driveContributions');
    const driveContributions:Record<string,number>={};
    if(receiptPlain(drivesRaw)){
      for(const key of ['epistemic','novelty','competence','coherence','social','homeostatic']){
        const value=receiptOwn(drivesRaw,key);
        if(typeof value==='number'&&Number.isFinite(value))driveContributions[key]=receiptClamp(value);
      }
    }
    const candidatesRaw=receiptOwn(raw,'candidates');
    const candidates:Array<{action:string;score:number;confidence01:number}>=[];
    if(Array.isArray(candidatesRaw)){
      const length=Math.min(8,candidatesRaw.length);
      for(let i=0;i<length;i++){
        const descriptor=Object.getOwnPropertyDescriptor(candidatesRaw,String(i));
        const candidate=descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
        if(!receiptPlain(candidate))continue;
        const action=receiptText(receiptOwn(candidate,'action'),48);
        if(!action)continue;
        candidates.push({
          action,
          score:receiptNumber(receiptOwn(candidate,'score'),0),
          confidence01:receiptClamp(receiptOwn(candidate,'confidence01')),
        });
      }
    }
    const outcomeRaw=receiptOwn(raw,'outcome');
    let outcome:AutonomousDecisionReceipt['outcome'];
    if(receiptPlain(outcomeRaw)){
      const outcomeAt=receiptNumber(receiptOwn(outcomeRaw,'at'),-1);
      if(outcomeAt>=0)outcome={
        success01:receiptClamp(receiptOwn(outcomeRaw,'success01')),
        reward01:receiptClamp(receiptOwn(outcomeRaw,'reward01')),
        surprise01:receiptClamp(receiptOwn(outcomeRaw,'surprise01')),
        at:outcomeAt,
      };
    }
    const learningRaw=receiptOwn(raw,'learning');
    let learning:AutonomousDecisionReceipt['learning'];
    if(receiptPlain(learningRaw))learning={
      accepted:receiptOwn(learningRaw,'accepted')===true,
      gain01:receiptClamp(receiptOwn(learningRaw,'gain01')),
      note:receiptText(receiptOwn(learningRaw,'note'),120),
    };
    return {
      id,tick,at,trigger:receiptText(receiptOwn(raw,'trigger'),120),
      source,driveContributions,dominantDrive:receiptText(receiptOwn(raw,'dominantDrive'),32)||null,
      goalId:receiptText(receiptOwn(raw,'goalId'),160)||null,goalSource,candidates,
      selectedAction:receiptText(receiptOwn(raw,'selectedAction'),48)||null,
      confidence01:receiptClamp(receiptOwn(raw,'confidence01')),
      resourceCost01:receiptClamp(receiptOwn(raw,'resourceCost01')),
      safety:{authorized:receiptOwn(safetyRaw,'authorized')===true,reason:receiptText(receiptOwn(safetyRaw,'reason'),120)||'unknown'},
      ...(outcome?{outcome}:{}),...(learning?{learning}:{}),
    };
  }catch{return null;}
}

/** Bounded canonical evidence log; explanations are projections of stored facts, never generated narratives. */
export class AutonomousDecisionReceiptLog {
  private state=defaultDecisionReceiptState();

  restore(raw?:unknown):void{
    try{
      if(!receiptPlain(raw)||receiptOwn(raw,'version')!==1){this.state=defaultDecisionReceiptState();return;}
      const itemsRaw=receiptOwn(raw,'receipts');
      const receipts:AutonomousDecisionReceipt[]=[];
      if(Array.isArray(itemsRaw)){
        const length=Math.min(96,itemsRaw.length);
        for(let i=Math.max(0,itemsRaw.length-length);i<itemsRaw.length;i++){
          const descriptor=Object.getOwnPropertyDescriptor(itemsRaw,String(i));
          const value=descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
          const receipt=restoreDecisionReceipt(value);
          if(receipt&&!receipts.some(item=>item.id===receipt.id))receipts.push(receipt);
        }
      }
      this.state={
        version:1,
        created:Math.max(receipts.length,Math.floor(receiptNumber(receiptOwn(raw,'created'),receipts.length))),
        closed:Math.max(receipts.filter(item=>item.outcome).length,Math.floor(receiptNumber(receiptOwn(raw,'closed'),0))),
        receipts,
      };
    }catch{this.state=defaultDecisionReceiptState();}
  }

  open(input:{
    id:string;tick:number;at:number;trigger:string;source:'external'|'endogenous';
    driveContributions:Record<string,number>;dominantDrive?:string|null;goalId?:string|null;
    goalSource:'internal'|'external'|'none';candidates:Array<{action:string;score:number;confidence:number}>;
    selectedAction?:string|null;confidence01?:number;resourceCost01?:number;
    safety:{authorized:boolean;reason:string};
  }):AutonomousDecisionReceipt{
    const existing=this.state.receipts.find(item=>item.id===input.id);
    if(existing)return structuredClone(existing);
    const driveContributions:Record<string,number>={};
    for(const key of ['epistemic','novelty','competence','coherence','social','homeostatic']){
      const value=input.driveContributions[key];
      if(Number.isFinite(value))driveContributions[key]=receiptClamp(value);
    }
    const receipt:AutonomousDecisionReceipt={
      id:receiptText(input.id,160)||`receipt:${input.tick}`,
      tick:Math.max(0,Math.floor(receiptNumber(input.tick,0))),
      at:Math.max(0,receiptNumber(input.at,0)),
      trigger:receiptText(input.trigger,120),
      source:input.source==='external'?'external':'endogenous',
      driveContributions,
      dominantDrive:receiptText(input.dominantDrive,32)||null,
      goalId:receiptText(input.goalId,160)||null,
      goalSource:input.goalSource,
      candidates:(Array.isArray(input.candidates)?input.candidates:[]).slice(0,8).flatMap(candidate=>{
        const action=receiptText(candidate?.action,48);
        return action?[{action,score:receiptNumber(candidate.score,0),confidence01:receiptClamp(candidate.confidence)}]:[];
      }),
      selectedAction:receiptText(input.selectedAction,48)||null,
      confidence01:receiptClamp(input.confidence01),
      resourceCost01:receiptClamp(input.resourceCost01),
      safety:{authorized:input.safety.authorized===true,reason:receiptText(input.safety.reason,120)||'unknown'},
    };
    this.state.receipts=[...this.state.receipts,receipt].slice(-96);
    this.state.created=Math.min(Number.MAX_SAFE_INTEGER,this.state.created+1);
    return structuredClone(receipt);
  }

  close(tick:number,input:{success01:number;reward01:number;surprise01:number;at:number}):boolean{
    const receipt=[...this.state.receipts].reverse().find(item=>item.tick===tick&&!item.outcome);
    if(!receipt||!Number.isFinite(input.at)||input.at<receipt.at)return false;
    receipt.outcome={success01:receiptClamp(input.success01),reward01:receiptClamp(input.reward01),surprise01:receiptClamp(input.surprise01),at:input.at};
    this.state.closed=Math.min(Number.MAX_SAFE_INTEGER,this.state.closed+1);
    return true;
  }

  recordLearning(tick:number,input:{accepted:boolean;gain01:number;note:string}):boolean{
    const receipt=[...this.state.receipts].reverse().find(item=>item.tick===tick);
    if(!receipt)return false;
    receipt.learning={accepted:input.accepted===true,gain01:receiptClamp(input.gain01),note:receiptText(input.note,120)};
    return true;
  }

  latest():AutonomousDecisionReceipt|null{
    const value=this.state.receipts[this.state.receipts.length-1];
    return value?structuredClone(value):null;
  }
  forTick(tick:number):AutonomousDecisionReceipt|null{
    const value=[...this.state.receipts].reverse().find(item=>item.tick===tick);
    return value?structuredClone(value):null;
  }
  explain(tick?:number):{tick:number;answer:string;receipt:AutonomousDecisionReceipt}|null{
    const receipt=tick===undefined?this.latest():this.forTick(tick);
    if(!receipt)return null;
    const drives=Object.entries(receipt.driveContributions).map(([key,value])=>`${key}=${value.toFixed(2)}`).join(', ')||'not recorded';
    const candidates=receipt.candidates.map(item=>`${item.action}(${item.score.toFixed(2)})`).join(', ')||'none recorded';
    const outcome=receipt.outcome
      ?`Outcome: success ${receipt.outcome.success01.toFixed(2)}, reward ${receipt.outcome.reward01.toFixed(2)}, surprise ${receipt.outcome.surprise01.toFixed(2)}.`
      :'Outcome: not observed yet.';
    const learning=receipt.learning
      ?`Learning: ${receipt.learning.accepted?'accepted':'not accepted'}, gain ${receipt.learning.gain01.toFixed(2)} (${receipt.learning.note||'no note'}).`
      :'Learning consequence not yet recorded.';
    const answer=[
      `Decision at tick ${receipt.tick}; trigger: ${receipt.trigger}; source: ${receipt.source}.`,
      `Dominant drive: ${receipt.dominantDrive??'not recorded'}; drives: ${drives}.`,
      `Goal: ${receipt.goalId??'none'} (${receipt.goalSource}); candidates: ${candidates}.`,
      `Selected action: ${receipt.selectedAction??'none'}; confidence: ${receipt.confidence01.toFixed(2)}; resource cost: ${receipt.resourceCost01.toFixed(2)}.`,
      `Safety: ${receipt.safety.authorized?'authorized':'not authorized'} (${receipt.safety.reason}).`,
      outcome,learning,
    ].join(' ');
    return {tick:receipt.tick,answer,receipt};
  }
  diagnostics(){return {created:this.state.created,closed:this.state.closed,retained:this.state.receipts.length,open:this.state.receipts.filter(item=>!item.outcome).length};}
  snapshot():DecisionReceiptState{return structuredClone(this.state);}
}

/**
 * BIG PASS 49: physical ownership boundary for agency/evolution runtime.
 * OrganismCore coordinates this subsystem but no longer owns these engines directly.
 */
export class AgencySubsystemRuntime {
  readonly systemName='agency' as const;
  readonly dependencies=['self', 'world', 'governance'] as const;
  readonly systemCapabilities=['state', 'agency', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly selfProjects = new SelfProjectEngine();
  readonly deliberation = new AgencyDeliberationEngine();
  readonly budget = new CognitiveBudgetManager();
  readonly quorum = new CognitiveQuorumEngine();
  readonly projectExecutor = new AutonomousProjectExecutor();
  readonly projectScheduler = new MultiProjectScheduler();
  readonly p67AutonomousGoalGenesis = new P67AutonomousGoalGenesis();
  readonly p68GoalEcology = new P68GoalEcology();


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b306AutonomousInitiativeVerification = new B306AutonomousInitiativeVerificationLedger();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b333AutonomousGoalGenesis = new B333AutonomousGoalGenesisGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b334AutonomousProjectLifecycle = new B334AutonomousProjectLifecycleGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b335AutonomousProjectHoldout = new B335AutonomousProjectHoldoutGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b336ProjectCausalOwnership = new B336ProjectCausalOwnershipGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly decisionActionPipeline = new DecisionActionPipeline();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly longHorizonAutonomy = new LongHorizonAutonomyController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousResourceToolLife = new AutonomousResourceToolLifeController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousRuntimeLife = new AutonomousRuntimeLifeController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly selfDirectedLife = new SelfDirectedLifeOrchestrator();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousLearningMemory = new AutonomousLearningMemoryGovernor();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousRelationships = new AutonomousRelationshipManager();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly openEndedSkillAcquisition = new OpenEndedSkillAcquisitionController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousSocialInitiative = new AutonomousSocialInitiativeEngine();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly liveSelfImprovementSupervisor = new LiveSelfImprovementSupervisor();
  restore(input: {
    selfProjects?: SelfProjectState;
    agency?: AgencyDeliberationState;
    budget?: CognitiveBudgetState & { ledger?: CognitiveBudgetLedgerEntry[] };
    quorum?: Partial<CognitiveQuorumState>;
    executor?: Partial<ProjectExecutionState> | null;
    p67?: unknown; p68?: unknown;
  }) {
    this.selfProjects.restore(input.selfProjects);
    this.deliberation.restore(input.agency);
    this.budget.restore(input.budget);
    this.quorum.restore(input.quorum);
    this.projectExecutor.restore(input.executor);
    this.p67AutonomousGoalGenesis.restore(input.p67 as any);
    this.p68GoalEcology.restore(input.p68 as any);
  }

  snapshot() {
    return {
      selfProjects: this.selfProjects.snapshot(),
      agency: this.deliberation.snapshot(),
      budget: this.budget.snapshot(),
      quorum: this.quorum.snapshot(),
      executor: this.projectExecutor.snapshot(),
      p67: this.p67AutonomousGoalGenesis.snapshot(),
      p68: this.p68GoalEcology.snapshot(),
    };
  }
}
