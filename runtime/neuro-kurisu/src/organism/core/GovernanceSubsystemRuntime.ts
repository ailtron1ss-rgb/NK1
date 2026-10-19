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

/** BIG PASS 51: physical owner for capability, integrity, resilience and constitutional governance. */
export class GovernanceSubsystemRuntime {
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
