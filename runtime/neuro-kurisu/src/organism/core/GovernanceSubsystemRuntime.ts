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
    status: 'parliament-not-approved' | 'candidate-not-in-p69-set' | 'p69-selected' | 'p69-diverted';
    parliament: ParliamentDispatchResult;
    arbitration: ReturnType<P69ConstitutionalArbiter['arbitrate']> | null;
  }> {
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
    const candidateExists = Array.isArray(input.p69Input?.candidates) &&
      input.p69Input.candidates.some(candidate => candidate && candidate.id === input.candidateId);
    if (!candidateExists) {
      return { status: 'candidate-not-in-p69-set', parliament, arbitration: null };
    }
    const arbitration = this.p69ConstitutionalArbiter.arbitrate(input.p69Input);
    return {
      status: arbitration.chosen?.id === input.candidateId ? 'p69-selected' : 'p69-diverted',
      parliament,
      arbitration,
    };
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
