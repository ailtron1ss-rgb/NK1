/** Domain-specific default-state factory extracted from the persistence coordinator. */
import type { EmbodimentFacet } from '../../core/types.ts';
import { defaultBodyState } from '../../body/EmbodiedBody.ts';
import { defaultPerceptionRoutingState } from '../../body/PerceptionRouter.ts';
import { defaultMultimodalState } from '../../body/MultimodalPerception.ts';
import { defaultPerceptualEvidence } from '../../body/PerceptualEvidenceCompiler.ts';
import { defaultCameraEvidenceState } from '../../body/CameraEvidenceProcessor.ts';
import { defaultP35SemanticWorldBody } from '../../body/P35SemanticWorldBody.ts';
import { defaultP37EmbodiedSensorium } from '../../body/P37EmbodiedSensorium.ts';
import { defaultP40SemanticIntelligence } from '../../cognition/P40SemanticIntelligence.ts';
import { defaultP41SemanticPerception } from '../../cognition/P41SemanticPerception.ts';
import { defaultP41NativePerception } from '../../cognition/P41NativePerception.ts';
import { defaultP41TemporalPerception } from '../../cognition/P41TemporalPerceptionModel.ts';
import { defaultP42 } from '../../cognition/P42UnifiedEmbodiedExperience.ts';
import { defaultP43 } from '../../cognition/P43EmbodiedImageryWorkspace.ts';

export const defaultEmbodimentFacet = (): EmbodimentFacet => ({ body:defaultBodyState(), bodyEvents:[], sleepSessions:[], lastSensorAt:0, sensorFailures:0, perceptionRouting:defaultPerceptionRoutingState(), multimodal:defaultMultimodalState(), toolAudit:[], p35:defaultP35SemanticWorldBody(), p37:defaultP37EmbodiedSensorium(), p40SemanticIntelligence:defaultP40SemanticIntelligence(), p41SemanticPerception:defaultP41SemanticPerception(), p41NativePerception:defaultP41NativePerception(), p41TemporalPerception:defaultP41TemporalPerception(), p42Experience:defaultP42(), p43Imagery:defaultP43(), perceptualEvidence:defaultPerceptualEvidence(), cameraEvidence:defaultCameraEvidenceState() });
