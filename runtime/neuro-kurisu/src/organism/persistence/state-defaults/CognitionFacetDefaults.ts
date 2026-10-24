/** Domain-specific default-state factory extracted from the persistence coordinator. */
import { defaultCognitiveField } from '../../cognition/CognitiveField.ts';
import { defaultContradictionReservoir } from '../../cognition/ContradictionReservoir.ts';
import { defaultCognitiveBudget } from '../../cognition/CognitiveBudgetManager.ts';
import { defaultCognitiveImmune } from '../../cognition/CognitiveImmuneSystem.ts';
import { defaultSourceMonitor } from '../../memory/SourceMonitor.ts';
import { defaultSkillLibrary } from '../../learning/ProceduralSkillLibrary.ts';
import { defaultScientificMethod } from '../../learning/ScientificMethodEngine.ts';
import { defaultLearnedResidual } from '../../world/LearnedResidualWorldModel.ts';
import { defaultContextualWorld } from '../../world/ContextualWorldModel.ts';
import { defaultPerceptionState } from '../../cognition/PerceptionEngine.ts';
import { defaultP27NeuralWorld } from '../../cognition/P27NeuralWorldFoundation.ts';

export const defaultCognitionFacet = () => ({ perception: defaultPerceptionState(), cognitiveField:defaultCognitiveField(), contradictions:defaultContradictionReservoir(), budget:defaultCognitiveBudget(), immune:defaultCognitiveImmune(), sources:defaultSourceMonitor(), skills:defaultSkillLibrary(), scientific:defaultScientificMethod(), residualWorld:defaultLearnedResidual(), contextualWorld:defaultContextualWorld(), p27:defaultP27NeuralWorld() });
