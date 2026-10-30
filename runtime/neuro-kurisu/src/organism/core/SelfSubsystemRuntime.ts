import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { IdentityContinuityEngine, defaultIdentityContinuity } from '../cognition/IdentityContinuity.ts';
import { SelfAuthorshipEngine, defaultSelfAuthorship } from '../cognition/SelfAuthorship.ts';
import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../cognition/P31FunctionalConsciousness.ts';
import { P32CausalSelfModelEngine, defaultP32CausalSelfModel } from '../cognition/P32CausalSelfModel.ts';
import { P33PersonhoodCore, defaultP33Personhood } from '../cognition/P33PersonhoodCore.ts';
import { P34CausalPersonhoodEngine, defaultP34CausalPersonhood } from '../cognition/P34CausalPersonhood.ts';
import { P60IdentityGuardian } from '../system/P60IdentityGuardian.ts';
import { P71SelfConsistencyModel } from '../cognition/P71SelfConsistencyModel.ts';
import { P76IdentityLifeOS } from '../system/P76IdentityLifeOS.ts';
import { P78AutobiographicalSelfContinuity } from '../developmental/P78AutobiographicalSelfContinuity.ts';
import { P2702PersistentPersonalityDynamics } from '../cognition/P2702PersistentPersonalityDynamics.ts';
import { P80UnifiedSelfState } from '../cognition/P80UnifiedSelfState.ts';
import { P48FunctionalAwarenessCore } from '../cognition/P48FunctionalAwarenessCore.ts';
import { P49TemporalLifeEngine } from '../developmental/P49TemporalLifeEngine.ts';
import { P84AutobiographicalContinuityFabric } from '../developmental/P84AutobiographicalContinuityFabric.ts';
import { P54LongHorizonEvidence } from '../developmental/P54LongHorizonEvidence.ts';
import { P55DevelopmentalForkUniverse } from '../developmental/P55DevelopmentalForkUniverse.ts';
import { P56IntegratedDevelopmentalMind, defaultP56 } from '../developmental/P56IntegratedDevelopmentalMind.ts';
import { P58CognitiveKernel, defaultP58 } from '../cognition/P58CognitiveKernel.ts';
import { P61IntegratedMindKernel, defaultP61 } from '../cognition/P61IntegratedMindKernel.ts';
import { P63DevelopmentalOperatingSystem, defaultP63 } from '../developmental/P63DevelopmentalOperatingSystem.ts';
import { P64IntegratedOrganismDynamics, defaultP64 } from '../cognition/P64IntegratedOrganismDynamics.ts';
import { P74IntegratedOrganismKernel, defaultP74 } from '../cognition/P74IntegratedOrganismKernel.ts';
import { P81PredictiveAttention, defaultP81 } from '../cognition/P81PredictiveAttention.ts';
import { AutonomousPersonhoodKernel } from '../system/AutonomousPersonhoodKernel.ts';
import { IdentityContinuityGuard } from '../system/IdentityContinuityGuard.ts';
import { AutonomousValueFormationEngine } from '../system/AutonomousValueFormationEngine.ts';
import { AutobiographicalLifeNarrativeEngine } from '../system/AutobiographicalLifeNarrativeEngine.ts';
import { P39ContinuousArtificialLifeEngine, defaultP39ContinuousLife } from '../learning/P39ContinuousArtificialLife.ts';
import { P40ModelEcologyEngine, defaultP40ModelEcology } from '../learning/P40ModelEcology.ts';

/** BIG PASS 51: physical owner for identity, personhood and self-continuity state. */
export class SelfSubsystemRuntime {
  readonly systemName='self' as const;
  readonly dependencies=['memory', 'world'] as const;
  readonly systemCapabilities=['state', 'identity', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly identityContinuity = new IdentityContinuityEngine();
  readonly selfAuthorship = new SelfAuthorshipEngine();
  readonly p31Consciousness = new P31FunctionalConsciousnessEngine();
  readonly p32CausalSelf = new P32CausalSelfModelEngine();
  readonly p33Personhood = new P33PersonhoodCore();
  readonly p34Personhood = new P34CausalPersonhoodEngine();
  readonly p60IdentityGuardian = new P60IdentityGuardian();
  readonly p71SelfConsistency = new P71SelfConsistencyModel();
  readonly p76IdentityLifeOS = new P76IdentityLifeOS();
  readonly p78AutobiographicalSelfContinuity = new P78AutobiographicalSelfContinuity();
  /** Canonical owner for slowly adapting character traits, values and relationship priors. */
  readonly p2702PersistentPersonality = new P2702PersistentPersonalityDynamics();
  readonly p80UnifiedSelfState = new P80UnifiedSelfState();
  readonly p48Awareness = new P48FunctionalAwarenessCore();
  readonly p49TemporalLife = new P49TemporalLifeEngine();
  readonly p84AutobiographicalContinuity = new P84AutobiographicalContinuityFabric();


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p54LongHorizonEvidence = new P54LongHorizonEvidence();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p55DevelopmentalForkUniverse = new P55DevelopmentalForkUniverse();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p56IntegratedDevelopmentalMind = new P56IntegratedDevelopmentalMind();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p58CognitiveKernel = new P58CognitiveKernel();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p61IntegratedMind = new P61IntegratedMindKernel();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p63DevelopmentalOperatingSystem = new P63DevelopmentalOperatingSystem();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p64IntegratedOrganismDynamics = new P64IntegratedOrganismDynamics();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p74IntegratedOrganismKernel = new P74IntegratedOrganismKernel();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p81PredictiveAttention = new P81PredictiveAttention();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousPersonhood = new AutonomousPersonhoodKernel();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly identityContinuityGuard = new IdentityContinuityGuard();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousValueFormation = new AutonomousValueFormationEngine();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autobiographicalLifeNarrative = new AutobiographicalLifeNarrativeEngine();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p39Life = new P39ContinuousArtificialLifeEngine();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p40ModelEcology = new P40ModelEcologyEngine();
  restoreFromPersisted(input: { consciousness?: any; learning?: any; advanced?: any }) {
    const consciousness=input.consciousness ?? {}; const learning=input.learning ?? {}; const advanced=input.advanced ?? {};
    this.restore({ identityContinuity:consciousness.identityContinuity, selfAuthorship:learning.selfAuthorship,
      p31:consciousness.p31, p32:consciousness.p32, p33:consciousness.p33, p34:consciousness.p34,
      p60:advanced.p60IdentityGuardian, p71:advanced.p71SelfConsistency, p76:advanced.p76IdentityLifeOS,
      p78:advanced.p78AutobiographicalSelfContinuity, p2702:advanced.p2702PersistentPersonality, p80:advanced.p80UnifiedSelfState, p48:advanced.p48Awareness, p49:advanced.p49TemporalLife, p84:advanced.p84AutobiographicalContinuity });
  }

  restore(input: {
    identityContinuity?: ReturnType<typeof defaultIdentityContinuity>;
    selfAuthorship?: ReturnType<typeof defaultSelfAuthorship>;
    p31?: ReturnType<typeof defaultP31Consciousness>;
    p32?: ReturnType<typeof defaultP32CausalSelfModel>;
    p33?: ReturnType<typeof defaultP33Personhood>;
    p34?: ReturnType<typeof defaultP34CausalPersonhood>;
    p60?: unknown;
    p71?: unknown;
    p76?: unknown;
    p78?: unknown;
    p2702?: unknown;
    p80?: unknown;
    p48?: unknown;
    p49?: unknown;
    p84?: unknown;
  }) {
    this.identityContinuity.restore(input.identityContinuity);
    this.selfAuthorship.restore(input.selfAuthorship);
    this.p31Consciousness.restore(input.p31);
    this.p32CausalSelf.restore(input.p32);
    this.p33Personhood.restore(input.p33);
    this.p34Personhood.restore(input.p34);
    this.p60IdentityGuardian.restore(input.p60 as any);
    this.p71SelfConsistency.restore(input.p71 as any);
    this.p76IdentityLifeOS.restore(input.p76 as any);
    this.p78AutobiographicalSelfContinuity.restore(input.p78 as any);
    this.p2702PersistentPersonality.restore(input.p2702 as any);
    this.p80UnifiedSelfState.restore(input.p80 as any);
    this.p48Awareness.restore(input.p48 as any);
    this.p49TemporalLife.restore(input.p49 as any);
    this.p84AutobiographicalContinuity.restore(input.p84 as any);
  }

  snapshot() {
    return {
      identityContinuity: this.identityContinuity.snapshot(),
      selfAuthorship: this.selfAuthorship.snapshot(),
      p31: this.p31Consciousness.snapshot(),
      p32: this.p32CausalSelf.snapshot(),
      p33: this.p33Personhood.snapshot(),
      p34: this.p34Personhood.snapshot(),
      p60: this.p60IdentityGuardian.snapshot(),
      p71: this.p71SelfConsistency.snapshot(),
      p76: this.p76IdentityLifeOS.snapshot(),
      p78: this.p78AutobiographicalSelfContinuity.snapshot(),
      p2702PersistentPersonality: this.p2702PersistentPersonality.snapshot(),
      p80: this.p80UnifiedSelfState.snapshot(),
      p48: this.p48Awareness.snapshot(),
      p49: this.p49TemporalLife.snapshot(),
      p84: this.p84AutobiographicalContinuity.snapshot(),
    };
  }
}
