import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { CapabilityRegistry } from '../system/CapabilityRegistry.ts';
import { IntegritySentinel } from '../system/IntegritySentinel.ts';
import { ReplayEngine } from '../system/ReplayEngine.ts';
import { AdvancedResilienceEngine } from '../learning/AdvancedResilienceEngine.ts';
import { P69ConstitutionalArbiter } from '../cognition/P69ConstitutionalArbiter.ts';
import { P72LifeCycleOrchestrator } from '../system/P72LifeCycleOrchestrator.ts';
import { P73CapabilityEvolutionLedger } from '../system/P73CapabilityEvolutionLedger.ts';
import { SelfGovernanceEngine } from '../cognition/evolution/SelfGovernanceEngine.ts';
import { BehavioralInfluenceLedger, defaultBehavioralInfluenceLedger } from '../system/BehavioralInfluenceLedger.ts';
import { RealityEvidenceLedger } from '../system/RealityEvidenceLedger.ts';
import { SelfModelValidationEngine, defaultSelfModelValidation } from '../system/SelfModelValidationEngine.ts';
import { FailureRecoveryCertification, defaultFailureRecoveryCertification } from '../system/FailureRecoveryCertification.ts';
import { CognitiveDomainClosure, type CognitiveDomainMarkSet, type CognitiveDomain } from '../system/CognitiveDomainClosure.ts';
import { CausalDomainClosureLedger, defaultCausalDomainClosureLedger, type CausalDomainClosureSnapshot } from '../system/CausalDomainClosureLedger.ts';
import { CognitiveParliament, type ParliamentTrustPort, type ParliamentEvidenceReference, type ParliamentRisk } from '../system/CognitiveParliament.ts';
import { CognitiveParliamentDispatcher, type ParliamentDispatchResult, type ParliamentRoleExecutorMap } from '../system/CognitiveParliamentDispatcher.ts';
import type { P69Input } from '../cognition/P69ConstitutionalArbiter.ts';

/** BIG PASS 51: physical owner for capability, integrity, resilience and constitutional governance. */
export class GovernanceSubsystemRuntime {
  readonly cognitiveParliament: CognitiveParliament;
  readonly cognitiveParliamentDispatcher: CognitiveParliamentDispatcher;
  constructor(input: {
    parliamentTrustPort?: ParliamentTrustPort;
    parliamentRoleExecutors?: ParliamentRoleExecutorMap;
  } = {}) {
    this.cognitiveParliament = new CognitiveParliament(input.parliamentTrustPort);
    this.cognitiveParliamentDispatcher = new CognitiveParliamentDispatcher(
      this.cognitiveParliament,
      input.parliamentRoleExecutors,
    );
  }
  readonly systemName='governance' as const;
  readonly dependencies=['self'] as const;
  readonly systemCapabilities=['governance', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly capabilities = new CapabilityRegistry();
  readonly integrity = new IntegritySentinel();
  readonly replay = new ReplayEngine();
  readonly resilience = new AdvancedResilienceEngine();
  readonly p69ConstitutionalArbiter = new P69ConstitutionalArbiter();
  readonly p72LifeCycle = new P72LifeCycleOrchestrator();
  readonly p73CapabilityLedger = new P73CapabilityEvolutionLedger();
  readonly selfGovernance = new SelfGovernanceEngine();


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly behavioralInfluenceLedger = new BehavioralInfluenceLedger();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly realityEvidenceLedger = new RealityEvidenceLedger(384);
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly selfModelValidation = new SelfModelValidationEngine();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly failureRecoveryCertification = new FailureRecoveryCertification();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly cognitiveDomainClosure = new CognitiveDomainClosure(16);
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly causalDomainClosureLedger = new CausalDomainClosureLedger(32);
  /**
   * Runs the specialist parliament for one exact candidate, then passes only an
   * approved candidate through P69. This method selects an action; it does not
   * execute it. ActionGateway remains the only side-effect boundary.
   */
  async deliberateAndArbitrate(input: {
    candidateId: string;
    risk: ParliamentRisk;
    task: string;
    evidenceReferences?: ParliamentEvidenceReference[];
    p69Input: P69Input;
    timeoutMs?: number;
    maxConcurrent?: number;
    maxTotalTokens?: number;
  }): Promise<{
    status: 'parliament-not-approved' | 'candidate-not-in-p69-set' | 'p69-selected' | 'p69-safe-fallback' | 'p69-diverted';
    parliament: ParliamentDispatchResult;
    arbitration: ReturnType<P69ConstitutionalArbiter['arbitrate']> | null;
  }> {
    // Capture the exact constitutional candidate set before asynchronous role execution.
    // The caller may continue its cognitive cycle while the six specialists are running;
    // P69 must arbitrate the same immutable candidate data the request was bound to.
    let p69InputSnapshot:P69Input;
    try {
      p69InputSnapshot=structuredClone(input.p69Input);
    } catch {
      throw new Error('cognitive-parliament-p69-candidate-snapshot-invalid');
    }
    const p69Candidates=Array.isArray(p69InputSnapshot?.candidates)?p69InputSnapshot.candidates:[];
    const candidateIds=p69Candidates.map(candidate=>candidate?.id);
    const candidateIdsUnique=candidateIds.every(id=>typeof id==='string'&&id.trim().length>0)&&
      new Set(candidateIds).size===candidateIds.length;
    const matchingCandidateCount=p69Candidates.filter(candidate=>candidate?.id===input.candidateId).length;
    const candidateExists = candidateIdsUnique && matchingCandidateCount===1;
    if (!candidateExists) {
      // Produce a bounded invalid-input receipt without spending model calls on a
      // candidate that cannot be represented unambiguously in the P69 candidate set.
      const parliament=await this.cognitiveParliamentDispatcher.dispatch({
        candidateId:'',risk:input.risk,task:input.task,evidenceReferences:[],
        timeoutMs:input.timeoutMs,maxConcurrent:input.maxConcurrent,maxTotalTokens:input.maxTotalTokens,
      });
      return { status: 'candidate-not-in-p69-set', parliament, arbitration: null };
    }
    const parliament = await this.cognitiveParliamentDispatcher.dispatch({
      candidateId: input.candidateId,
      risk: input.risk,
      task: input.task,
      evidenceReferences: input.evidenceReferences,
      timeoutMs: input.timeoutMs,
      maxConcurrent: input.maxConcurrent,
      maxTotalTokens: input.maxTotalTokens,
    });
    if (parliament.decision.status !== 'approved') {
      return { status: 'parliament-not-approved', parliament, arbitration: null };
    }
    // A positive Parliament verdict authorizes only its exact candidate plus the
    // constitutional low-risk escape actions. Other model-proposed candidates
    // are never silently promoted into the approved set.
    const safeActions=new Set(['rest','wait','defer']);
    const allowedCandidates=p69Candidates.filter(candidate=>
      candidate.id===input.candidateId||safeActions.has(candidate.action));
    const allowedIds=new Set(allowedCandidates.map(candidate=>candidate.id));
    const arbitration = this.p69ConstitutionalArbiter.arbitrate({
      ...p69InputSnapshot,
      candidates:allowedCandidates,
    });
    const chosenId=arbitration.chosen?.id??null;
    return {
      status:chosenId===input.candidateId?'p69-selected':
        chosenId&&allowedIds.has(chosenId)&&safeActions.has(allowedCandidates.find(candidate=>candidate.id===chosenId)?.action??'')
          ?'p69-safe-fallback':'p69-diverted',
      parliament,
      arbitration,
    };
  }

  /**
   * Cycle-facing gate. If Parliament does not approve, P69 may still choose only
   * a bounded protective fallback; an unreviewed candidate cannot become the
   * selected intent through an older argmax/fallback path.
   */
  async deliberateCycleCandidate(input: {
    candidateId:string;
    risk:ParliamentRisk;
    task:string;
    evidenceReferences?:ParliamentEvidenceReference[];
    p69Input:P69Input;
    timeoutMs?:number;
    maxConcurrent?:number;
    maxTotalTokens?:number;
  }): Promise<{
    status:'p69-selected'|'p69-safe-fallback'|'parliament-blocked'|'candidate-not-in-p69-set';
    parliament:ParliamentDispatchResult;
    arbitration:ReturnType<P69ConstitutionalArbiter['arbitrate']>|null;
    selectedCandidate:P69Input['candidates'][number]|null;
  }> {
    const snapshot=structuredClone(input.p69Input);
    const attempted=await this.deliberateAndArbitrate(input);
    let arbitration=attempted.arbitration;
    if(!arbitration){
      const safeCandidates=snapshot.candidates.filter(candidate=>
        ['rest','wait','defer'].includes(candidate.action));
      // Even when no safe action exists, obtain P69's constraint/telemetry frame
      // over an empty candidate set. This keeps downstream diagnostics total while
      // deliberately selecting no action.
      arbitration=this.p69ConstitutionalArbiter.arbitrate({
        ...snapshot,candidates:safeCandidates,requestedAction:null,
      });
    }
    const chosenId=arbitration?.chosen?.id??null;
    const chosen=snapshot.candidates.find(candidate=>candidate.id===chosenId)??null;
    const safeChosen=Boolean(chosen&&['rest','wait','defer'].includes(chosen.action));
    const approvedChosen=Boolean(chosen&&chosen.id===input.candidateId&&attempted.status==='p69-selected');
    const selectedCandidate=approvedChosen||safeChosen?structuredClone(chosen):null;
    const status: 'p69-selected'|'p69-safe-fallback'|'parliament-blocked'|'candidate-not-in-p69-set' =
      attempted.status==='candidate-not-in-p69-set'?'candidate-not-in-p69-set':
      approvedChosen?'p69-selected':safeChosen?'p69-safe-fallback':'parliament-blocked';
    return {status,parliament:attempted.parliament,arbitration,selectedCandidate};
  }

  restoreFromPersisted(input: { advanced?: any }) {
    const advanced=input.advanced ?? {};
    this.resilience.restore(advanced.advancedResilience);
    this.p69ConstitutionalArbiter.restore(advanced.p69ConstitutionalArbiter);
    this.p72LifeCycle.restore(advanced.p72LifeCycle);
    this.p73CapabilityLedger.restore(advanced.p73CapabilityLedger);
    this.selfGovernance.restore(advanced.selfGovernance);
  }

  snapshot() {
    return {
      capabilities: this.capabilities.snapshot(),
      advancedResilience: this.resilience.snapshot(),
      p69ConstitutionalArbiter: this.p69ConstitutionalArbiter.snapshot(),
      p72LifeCycle: this.p72LifeCycle.snapshot(),
      p73CapabilityLedger: this.p73CapabilityLedger.snapshot(),
      selfGovernance: this.selfGovernance.snapshot(),
    };
  }
}
