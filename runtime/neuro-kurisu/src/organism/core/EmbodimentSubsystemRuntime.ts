import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { MultimodalPerception } from '../body/MultimodalPerception.ts';
import { PerceptionEngine } from '../cognition/PerceptionEngine.ts';
import { P35SemanticWorldBodyEngine } from '../body/P35SemanticWorldBody.ts';
import { P37EmbodiedSensoriumEngine } from '../body/P37EmbodiedSensorium.ts';
import { P40SemanticIntelligenceEngine } from '../cognition/P40SemanticIntelligence.ts';
import { P41SemanticPerceptionEngine } from '../cognition/P41SemanticPerception.ts';
import { P41NativePerceptionEngine } from '../cognition/P41NativePerception.ts';
import { P41TemporalPerceptionModel } from '../cognition/P41TemporalPerceptionModel.ts';
import { P42UnifiedEmbodiedExperienceEngine } from '../cognition/P42UnifiedEmbodiedExperience.ts';
import { P43EmbodiedImageryWorkspace } from '../cognition/P43EmbodiedImageryWorkspace.ts';
import { P66InteroceptiveHomeostasis } from '../cognition/P66InteroceptiveHomeostasis.ts';
import { defaultPerceptionRoutingState, routePerception, sanitizePerceptionRoutingState, type PerceptionRoutingState } from '../body/PerceptionRouter.ts';
import type { PerceptionEvent } from '../cognition/PerceptionEngine.ts';
import type { OrganismBodyState } from '../body/EmbodiedBody.ts';
import { defaultCameraEvidenceState, type CameraEvidence } from '../body/CameraEvidenceProcessor.ts';
import { InteroceptiveStateEstimator } from '../system/InteroceptiveStateEstimator.ts';
import { ActivePerceptionExecutor, defaultActivePerceptionExecutor, type ActivePerceptionModality } from '../system/ActivePerceptionExecutor.ts';
import { ActivePerceptionNeuralSubstrate } from '../cognition/ActivePerceptionNeuralSubstrate.ts';
import { PerceptualEvidenceCompiler, defaultPerceptualEvidence } from '../body/PerceptualEvidenceCompiler.ts';
import type { TrustedObservationAdmission } from '../system/SignedObservationAdmissionAuthority.ts';
import { countOr, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitOr } from '../body/RestoreSanitizers.ts';
/** Keep the owner-specific restore type while reading an untrusted persisted value. */
function restoreOwnerState<T>(owner: { restore(state?: T | null): unknown }, value: unknown): void {
  owner.restore(value as T | null | undefined);
}


/** BIG PASS 51: physical owner for sensor, perception and embodied-experience state. */
export class EmbodimentSubsystemRuntime {
  readonly systemName='embodiment' as const;
  readonly dependencies=[] as const;
  readonly systemCapabilities=['state', 'perception', 'embodiment', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly multimodal = new MultimodalPerception();
  readonly perception = new PerceptionEngine();
  readonly p35SemanticWorldBody = new P35SemanticWorldBodyEngine();
  readonly p37EmbodiedSensorium = new P37EmbodiedSensoriumEngine();
  readonly p40SemanticIntelligence = new P40SemanticIntelligenceEngine();
  readonly p41SemanticPerception = new P41SemanticPerceptionEngine();
  readonly p41NativePerception = new P41NativePerceptionEngine();
  readonly p41TemporalPerception = new P41TemporalPerceptionModel();
  readonly p42Experience = new P42UnifiedEmbodiedExperienceEngine();
  readonly p43Imagery = new P43EmbodiedImageryWorkspace();
  readonly p66InteroceptiveHomeostasis = new P66InteroceptiveHomeostasis();
  private perceptionRouting: PerceptionRoutingState = defaultPerceptionRoutingState();


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly interoceptiveStateEstimator = new InteroceptiveStateEstimator();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly activePerceptionExecutor = new ActivePerceptionExecutor();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly activePerceptionNeural = new ActivePerceptionNeuralSubstrate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly perceptualEvidence = new PerceptualEvidenceCompiler();
  /** Ownership extraction: camera evidence belongs to the embodied sensor boundary. */
  readonly cameraEvidence = {
    state: defaultCameraEvidenceState(),
    snapshot: () => structuredClone(this.cameraEvidence.state),
    // A corrupted snapshot must not spread NaN/strings into the camera counters or
    // the last-evidence row that later novelty/quality math reads. Rebuild from
    // validated primitives and re-derive the optional last row through own data.
    restore: (raw:any) => {
      const d=defaultCameraEvidenceState();
      const r=isPlainDataRecord(raw)?raw:{};
      const last=ownDataValue(r,'last');
      this.cameraEvidence.state={
        version:1,
        captures:countOr(ownDataValue(r,'captures'),d.captures),
        lastAt:timestampOr(ownDataValue(r,'lastAt'),d.lastAt),
        last:isPlainDataRecord(last)?last as unknown as CameraEvidence:null,
        previousHash:stringOr(ownDataValue(r,'previousHash'),d.previousHash,128),
        semanticVisionAvailable:ownDataValue(r,'semanticVisionAvailable')===true,
        semanticFrames:countOr(ownDataValue(r,'semanticFrames'),d.semanticFrames),
        unresolvedSemanticRequests:countOr(ownDataValue(r,'unresolvedSemanticRequests'),d.unresolvedSemanticRequests),
        cumulativeNovelty01:unitOr(ownDataValue(r,'cumulativeNovelty01'),d.cumulativeNovelty01),
      };
    },
    record: (e:CameraEvidence) => { const st=this.cameraEvidence.state; st.captures++; st.lastAt=e.at; st.previousHash=st.last?.sha256 ?? st.previousHash; st.last=e; st.cumulativeNovelty01=Math.max(0,Math.min(1,Number.isFinite(st.cumulativeNovelty01*.9+e.novelty01*.1)?st.cumulativeNovelty01*.9+e.novelty01*.1:0)); }
  };

  /** Host-signed observations enter only through the exact in-process admission capability. */
  recordAdmittedObservation(admission:TrustedObservationAdmission) {
    return this.perceptualEvidence.recordTrustedExternalEvidence(admission);
  }
  /** Canonical consent revocation drops observed status and clears derived trust gauges. */
  revokeAdmittedObservation(observationId:string) {
    return this.perceptualEvidence.revokeTrustedExternalEvidence(observationId);
  }

  restoreFromPersisted(input: { cognition?: any; embodiment?: any; advanced?: any }) {
    const root=isPlainDataRecord(input)?input:{};
    const cognitionValue=ownDataValue(root,'cognition');
    const embodimentValue=ownDataValue(root,'embodiment');
    const advancedValue=ownDataValue(root,'advanced');
    const cognition=isPlainDataRecord(cognitionValue)?cognitionValue:{};
    const embodiment=isPlainDataRecord(embodimentValue)?embodimentValue:{};
    const advanced=isPlainDataRecord(advancedValue)?advancedValue:{};
    restoreOwnerState(this.perception,ownDataValue(cognition,'perception'));
    restoreOwnerState(this.multimodal,ownDataValue(embodiment,'multimodal'));
    restoreOwnerState(this.perceptualEvidence,ownDataValue(embodiment,'perceptualEvidence'));
    restoreOwnerState(this.p35SemanticWorldBody,ownDataValue(embodiment,'p35'));
    restoreOwnerState(this.p37EmbodiedSensorium,ownDataValue(embodiment,'p37'));
    restoreOwnerState(this.p40SemanticIntelligence,ownDataValue(embodiment,'p40SemanticIntelligence'));
    // Accept both the stable facet names and this owner's snapshot names. Older
    // persisted projections use the long names; snapshot() emits the short names.
    restoreOwnerState(this.p41SemanticPerception,
      ownDataValue(embodiment,'p41SemanticPerception') ?? ownDataValue(embodiment,'p41Semantic'));
    restoreOwnerState(this.p41NativePerception,
      ownDataValue(embodiment,'p41NativePerception') ?? ownDataValue(embodiment,'p41Native'));
    restoreOwnerState(this.p41TemporalPerception,
      ownDataValue(embodiment,'p41TemporalPerception') ?? ownDataValue(embodiment,'p41Temporal'));
    restoreOwnerState(this.p42Experience,
      ownDataValue(embodiment,'p42Experience') ?? ownDataValue(embodiment,'p42'));
    restoreOwnerState(this.p43Imagery,
      ownDataValue(embodiment,'p43Imagery') ?? ownDataValue(embodiment,'p43'));
    restoreOwnerState(this.p66InteroceptiveHomeostasis,ownDataValue(advanced,'p66InteroceptiveHomeostasis'));
    this.perceptionRouting = sanitizePerceptionRoutingState(ownDataValue(embodiment,'perceptionRouting'));
  }

  routePerception(event: PerceptionEvent, body?: OrganismBodyState) { this.perceptionRouting = routePerception(event, body, this.perceptionRouting); return this.perceptionRouting; }
  perceptionRoutingSnapshot(){ return { ...this.perceptionRouting }; }

  snapshot() { return {
    multimodal:this.multimodal.snapshot(), perceptualEvidence:this.perceptualEvidence.snapshot(), perception:this.perception.snapshot(), p35:this.p35SemanticWorldBody.snapshot(),
    p37:this.p37EmbodiedSensorium.snapshot(), p40SemanticIntelligence:this.p40SemanticIntelligence.snapshot(),
    p41Semantic:this.p41SemanticPerception.snapshot(), p41Native:this.p41NativePerception.snapshot(),
    p41Temporal:this.p41TemporalPerception.snapshot(), p42:this.p42Experience.snapshot(), p43:this.p43Imagery.snapshot(), p66InteroceptiveHomeostasis:this.p66InteroceptiveHomeostasis.snapshot(), perceptionRouting:this.perceptionRoutingSnapshot(),
  }; }
}
