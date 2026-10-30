import type { ActionKind } from '../core/types.ts';
import { P2702PersistentPersonalityDynamics } from './P2702PersistentPersonalityDynamics.ts';
import { SelfModelEngine } from './SelfModelV2.ts';
import { P78AutobiographicalSelfContinuity, type P78Event, type P78State } from '../developmental/P78AutobiographicalSelfContinuity.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
type EvidenceSource='world-transition'|'external-verification'|'internal';

export interface PersonalityOutcomeRecord {
  event:P78Event;
  action:ActionKind;
  reward01:number;
  goalAlignment01:number;
  predictionError01:number;
  identityGap01:number;
  relationshipId?:string;
  /** Optional compact identity estimate from the canonical self-state owner. */
  identityVector?:number[];
}

export interface PersonalityOutcomeResult {
  newEvent:boolean;
  evidenceAccepted:boolean;
  evidenceReason:'accepted'|'duplicate-event'|'outcome-not-independent'|'unsupported-receipt-namespace';
  p78:P78State;
  personality:ReturnType<P2702PersistentPersonalityDynamics['snapshot']>;
  selfModel:ReturnType<SelfModelEngine['snapshot']>;
  selfModelUpdate:ReturnType<SelfModelEngine['learnGoalOutcome']>|null;
}

/**
 * Stateless composition membrane between autobiographical evidence, persistent
 * personality dynamics, and the single SelfModelEngine owned by MemorySubsystemRuntime.
 * It owns no shadow state: P78, P2702 and SelfModel remain their canonical owners.
 */
export class PersonalitySelfModelBridge {
  constructor(
    private readonly autobiography:P78AutobiographicalSelfContinuity,
    private readonly personality:P2702PersistentPersonalityDynamics,
    private readonly selfModel:SelfModelEngine,
  ) {}

  prepareDecision(input:Parameters<P2702PersistentPersonalityDynamics['beforeDecision']>[0]) {
    const personality=this.personality.beforeDecision(input);
    const selfModelActionBias=Object.fromEntries(ACTIONS.map(action=>[action,this.selfModel.actionBias(action)])) as Record<ActionKind,number>;
    const actionBias=Object.fromEntries(ACTIONS.map(action=>[action,Math.max(-.10,Math.min(.10,(personality.actionBias[action]??0)+selfModelActionBias[action]))])) as Record<ActionKind,number>;
    return {personality,selfModelActionBias,actionBias};
  }

  recordOutcome(input:PersonalityOutcomeRecord):PersonalityOutcomeResult {
    const before=this.autobiography.snapshot();
    const p78=this.autobiography.observe([input.event]);
    const newEvent=p78.samples>before.samples;
    if(!newEvent){
      return {
        newEvent:false,evidenceAccepted:false,evidenceReason:'duplicate-event',
        p78,personality:this.personality.snapshot(),selfModel:this.selfModel.snapshot(),selfModelUpdate:null,
      };
    }

    const evidenceRef=String(input.event.evidenceRef??'').trim().slice(0,240);
    const source:EvidenceSource=evidenceRef.startsWith('world-transition:')
      ? 'world-transition'
      : evidenceRef.startsWith('external-verification:')
        ? 'external-verification'
        : 'internal';
    const p78Verified=Boolean(
      p78.verifiedOutcomeSamples>before.verifiedOutcomeSamples &&
      input.event.evidenceStatus==='verified-independent'
    );
    // P78 checks provenance shape; this boundary additionally allow-lists trusted receipt issuers.
    const evidenceAccepted=p78Verified&&source!=='internal';
    const evidenceReason:PersonalityOutcomeResult['evidenceReason']=evidenceAccepted
      ? 'accepted'
      : input.event.evidenceStatus!=='verified-independent' || !input.event.evidenceRef
        ? 'outcome-not-independent'
        : 'unsupported-receipt-namespace';

    this.personality.afterOutcome({
      tick:input.event.tick,reward01:input.reward01,verified01:evidenceAccepted?1:0,
      predictionError01:input.predictionError01,identityGap01:input.identityGap01,
      action:input.action,relationshipId:input.relationshipId,identityVector:input.identityVector,
    });
    const selfModelUpdate=this.selfModel.learnGoalOutcome({
      action:input.action,goalAlignment01:input.goalAlignment01,reward01:input.reward01,tick:input.event.tick,
      evidence:{
        verified:p78Verified,independent:p78Verified,source,
        evidenceRef:p78Verified?evidenceRef:undefined,
      },
    });
    return {
      newEvent:true,evidenceAccepted,evidenceReason,p78,
      personality:this.personality.snapshot(),selfModel:this.selfModel.snapshot(),selfModelUpdate,
    };
  }
}
