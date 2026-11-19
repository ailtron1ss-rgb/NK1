/** Domain-specific default-state factory extracted from the persistence coordinator. */
import type { ConsciousnessFacet } from '../../core/types.ts';
import { defaultIntrinsicDriveState } from '../../cognition/IntrinsicMotivationEngine.ts';
import { defaultActiveInferenceState } from '../../world/ActiveInferenceEngine.ts';
import { defaultIdentityContinuity } from '../../cognition/IdentityContinuity.ts';
import { defaultMetaCognitiveState } from '../../cognition/MetaCognitiveMonitor.ts';
import { defaultWorkspaceIgnition } from '../../cognition/WorkspaceIgnitionMetrics.ts';
import { defaultConsciousnessEvidence } from '../../cognition/ConsciousnessEvidenceLedger.ts';
import { defaultP31Consciousness } from '../../cognition/P31FunctionalConsciousness.ts';
import { defaultP32CausalSelfModel } from '../../cognition/P32CausalSelfModel.ts';
import { defaultP33Personhood } from '../../cognition/P33PersonhoodCore.ts';
import { defaultP34CausalPersonhood } from '../../cognition/P34CausalPersonhood.ts';

export const defaultConsciousnessFacet = (): ConsciousnessFacet => ({ intrinsic:defaultIntrinsicDriveState(), activeInference:defaultActiveInferenceState(), identityContinuity:defaultIdentityContinuity(), metacognition:defaultMetaCognitiveState(), workspaceIgnition:defaultWorkspaceIgnition(), consciousnessEvidence:defaultConsciousnessEvidence(), p31:defaultP31Consciousness(), p32:defaultP32CausalSelfModel(), p33:defaultP33Personhood(), p34:defaultP34CausalPersonhood(), causalExperiments:[], researchQuestionsCompleted:[] });
