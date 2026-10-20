/**
 * Stable JSON-document boundary for the paired holdout evaluator.
 * Input is explicit run evidence; this adapter never executes training or promotes a model.
 */
import { evaluatePairedLearningRuns } from "./paired-holdout-evaluation-workpass71.mjs";

export function evaluateLearningDocument(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new TypeError("evaluation document must be a JSON object");
  }
  if (document.schemaVersion !== 1) {
    throw new TypeError("evaluation document schemaVersion must be 1");
  }
  if (!Array.isArray(document.baseline) || !Array.isArray(document.candidate)) {
    throw new TypeError("evaluation document must include baseline and candidate run arrays");
  }
  const options = document.options ?? {};
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("options must be an object when supplied");
  }
  const evaluation = evaluatePairedLearningRuns({
    baseline: document.baseline,
    candidate: document.candidate,
    ...options
  });
  return {
    schemaVersion: 1,
    kind: "nk1.learning-evaluation-report",
    evaluation
  };
}
