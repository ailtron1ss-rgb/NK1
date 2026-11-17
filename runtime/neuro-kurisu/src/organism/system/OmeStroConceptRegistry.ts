export type OmeStroArea = 'cognition' | 'development' | 'neural-adaptation';
export type OmeStroStatus = 'existing_partial' | 'foundation_added' | 'research_gated';

export interface OmeStroConcept {
  id: number;
  key: string;
  title: string;
  area: OmeStroArea;
  status: OmeStroStatus;
  integratesWith: string[];
  boundary: string;
}

const concept = (
  id: number,
  key: string,
  title: string,
  area: OmeStroArea,
  status: OmeStroStatus,
  integratesWith: string[],
  boundary: string,
): OmeStroConcept => ({ id, key, title, area, status, integratesWith, boundary });

/**
 * The 32-item OmeStro register is an implementation map, not a declaration
 * that every underlying research claim or neural capability is complete.
 * status describes the current NK1 integration boundary.
 */
export const OMESTRO_CONCEPTS: readonly OmeStroConcept[] = Object.freeze([
  concept(1, 'neuro-forge', 'NeuroForge — safe external-source assimilation', 'development', 'existing_partial',
    ['ExternalProjectResearchTool', 'ResearchSourceLineage', 'SBOM/license review'],
    'Source intake exists in research workflows; legal clearance, donor-wide file assimilation and full release parity remain separate gates.'),
  concept(2, 'dyadic-mind', 'Dyadic Mind — consented shared task context', 'cognition', 'foundation_added',
    ['UserModelEvidenceModel', 'intent contracts'],
    'Shares only task scope and explicit goals; human identity, private episodes and permissions remain separate.'),
  concept(3, 'proof-carrying-skills', 'Proof-Carrying Skills', 'development', 'existing_partial',
    ['VerifiedOutcomeLedger', 'IndependentSkillCandidateEvaluator', 'VerifiedSkillPromotion'],
    'Existing signed outcomes and promotion gates remain authoritative; this layer must not replace their evidence model.'),
  concept(4, 'undo-first-intelligence', 'Undo-First Intelligence', 'cognition', 'foundation_added',
    ['ActionGateway', 'idempotency receipts', 'FileStateStore'],
    'Produces a preflight compensation plan; it does not execute side effects or claim that an irreversible action can be undone.'),
  concept(5, 'cognitive-immune-system', 'Cognitive Immune System', 'cognition', 'existing_partial',
    ['CognitiveImmuneSystem', 'EvidenceFirewall', 'IntegritySentinel'],
    'Existing quarantine and integrity mechanisms are reused; broader semantic-degradation detection still needs calibrated signals.'),
  concept(6, 'shared-future', 'Shared Future — scenario branches and revisit triggers', 'cognition', 'foundation_added',
    ['FutureSimulator', 'CounterfactualWorldCompiler'],
    'Scenario outputs are hypotheses with assumptions and triggers, not predictions presented as facts.'),
  concept(7, 'developmental-genome', 'Developmental Genome — versioned structural contract', 'development', 'foundation_added',
    ['BehavioralGenome', 'InvariantEngine', 'StateMigrations'],
    'Candidate graph changes require a separate aspect branch, dependency validation, migration, tests and rollback.'),
  concept(8, 'chrono-truth', 'ChronoTruth — bi-temporal evidence ledger', 'cognition', 'foundation_added',
    ['MemoryFabric', 'P65EpistemicLedger'],
    'Stores low-risk, consented facts with valid-time and recorded-time; corrections append evidence and preserve prior knowledge snapshots.'),
  concept(9, 'negative-space-memory', 'Negative Space Memory — rejected alternatives', 'cognition', 'foundation_added',
    ['DecisionSemanticEvidence', 'MemoryFabric'],
    'Stores bounded decision metadata and reopen triggers, not private raw conversations or permanent prohibitions.'),
  concept(10, 'mechanism-serendipity', 'Mechanism Serendipity — cross-domain causal analogies', 'development', 'foundation_added',
    ['CausalExperimentEngine', 'WorldCausalCalibration'],
    'Analogy ranking creates testable hypotheses only; similarity is not causal proof.'),
  concept(11, 'cognitive-parliament', 'Cognitive Parliament — role-separated review', 'development', 'foundation_added',
    ['CognitiveQuorum', 'IndependentEvaluationEvidence'],
    'Role labels and votes cannot substitute for independent evidence, replication, safety and audit checks.'),
  concept(12, 'intent-compiler', 'Intent Compiler — explicit work contracts', 'cognition', 'foundation_added',
    ['ToolInputContract', 'ActionGateway', 'AutonomousPlanner'],
    'Missing acceptance criteria and permissions remain explicit blockers; the compiler does not invent authority.'),
  concept(13, 'open-loop-radar', 'Open Loop Radar — commitments and expiry', 'cognition', 'foundation_added',
    ['CommitmentRepair', 'OpenLoopRadar'],
    'Tracks due/review/expiry state with explicit ownership and close conditions; stale items are surfaced rather than silently closed.'),
  concept(14, 'invention-loop', 'The Invention Loop — preregister, test, replicate', 'development', 'existing_partial',
    ['IntrinsicExperimentGenerator', 'P25ScientificDevelopmentEngine', 'ScientificMethodEngine'],
    'Experiment generation and evaluation exist; the new protocol binds preregistration, holdout isolation and independent replication.'),
  concept(15, 'world-forge', 'World Forge — procedural split-safe test worlds', 'development', 'foundation_added',
    ['WorldEnvironment', 'CounterfactualWorldCompiler', 'VerifiedOutcomeLedger'],
    'Dataset identities are separated across train/validation/holdout; a generated world is not evidence until executed and verified.'),
  concept(16, 'synaptic-commons', 'Synaptic Commons — share verified reusable artifacts', 'development', 'foundation_added',
    ['VersionedSkillCandidateStore', 'VerifiedSkillPromotion'],
    'Exports contracts/tests/metadata only by default; personal episode memories and credentials are excluded.'),
  concept(17, 'morphogenesis', 'Morphogenesis — branch-isolated architecture evolution', 'development', 'foundation_added',
    ['NeuralMorphogenesisEngine', 'SandboxedSelfRewriteEngine', 'InvariantEngine'],
    'The protocol validates graph and rollback contracts; it does not mutate the live architecture.'),
  concept(18, 'science-republic', 'Science Republic — independent research roles', 'development', 'foundation_added',
    ['P25ScientificDevelopmentEngine', 'HostOwnedIndependentEvaluationServices'],
    'Discoverer, theorist, experimentalist, replicator, skeptic, auditor and safety roles have separate evidence duties.'),
  concept(19, 'developmental-multiverse', 'Developmental Multiverse — isolated candidate comparison', 'development', 'existing_partial',
    ['ShadowOrganism', 'P55DevelopmentalForkUniverse'],
    'Shadow forks exist; this layer standardizes matched environment fingerprints and evidence-based import eligibility.'),
  concept(20, 'constitution-evolution', 'Constitution Evolution — guarded invariant revisions', 'development', 'foundation_added',
    ['P69ConstitutionalArbiter', 'InvariantEngine'],
    'Immutable safety and provenance invariants cannot be removed by a candidate genome or a majority vote.'),
  concept(21, 'consequence-ecology', 'Consequence Ecology — delayed causal exposure', 'cognition', 'foundation_added',
    ['FutureSimulator', 'WorldAgencyLearningCausalBridge'],
    'Propagates bounded expected-impact paths; uncertain downstream effects remain labelled as estimates.'),
  concept(22, 'substrate-independence', 'Substrate Independence — portable state and fallback', 'cognition', 'existing_partial',
    ['SubstratePortabilityEngine', 'ModelSwitchBenchmark', 'ModelSwitchContinuity'],
    'Routing continuity exists; migration requires state round-trip and target-specific benchmark evidence before promotion.'),
  concept(23, 'neuro-plastic-core', 'Neuro-Plastic Core — offline LoRA/QLoRA candidates', 'neural-adaptation', 'research_gated',
    ['P28PlasticitySubstrate', 'LearningExperimentPlan'],
    'No production transformer-weight trainer is claimed; adapters need immutable datasets, independent holdout and base-model fallback.'),
  concept(24, 'layer-force', 'Layer Force — calibrated activation steering', 'neural-adaptation', 'research_gated',
    ['P28PlasticitySubstrate', 'NeuralPlasticityBenchmarkSuite'],
    'Requires an instrumented model backend, layer-level activation access, paired-seed calibration and hard bypass.'),
  concept(25, 'adaptive-synaptic-matrix', 'Adaptive Synaptic Matrix — gated adapter routing', 'neural-adaptation', 'foundation_added',
    ['NeuralEcologyRouter', 'P40ModelEcology'],
    'This layer routes only externally validated adapter manifests; it does not load arbitrary weights or update a model itself.'),
  concept(26, 'hyper-plastic-network', 'Hyper-Plastic Network — bounded low-rank generation', 'neural-adaptation', 'research_gated',
    ['P28PlasticitySubstrate', 'NeuralPlasticityBenchmarkSuite'],
    'Generated parameters remain ephemeral candidates until independent evaluation and ablation pass.'),
  concept(27, 'test-time-neuroplasticity', 'Test-Time Neuroplasticity — ephemeral session updates', 'neural-adaptation', 'foundation_added',
    ['P28PlasticitySubstrate', 'OrganismState'],
    'A bounded TTL session buffer is implemented; updates are isolated, resettable and never silently consolidated.'),
  concept(28, 'neural-prosthesis', 'Neural Prosthesis — residual trainable modules', 'neural-adaptation', 'research_gated',
    ['HybridNeuroCognitiveLoop', 'NeuralPlasticityBenchmarkSuite'],
    'P28 names a cognitive plasticity substrate; this does not mean transformer residual adapters are already wired into inference.'),
  concept(29, 'sparse-plasticity', 'Sparse Plasticity — allowlisted parameter updates', 'neural-adaptation', 'foundation_added',
    ['PlasticityHomeostasisGovernor', 'NeuralMorphogenesisEngine'],
    'Only an explicit allowlist can be selected; protected parameters and oversized masks are rejected.'),
  concept(30, 'neural-micro-adapters', 'Neural Micro-Adapters — small skill adapters', 'neural-adaptation', 'foundation_added',
    ['VerifiedSkillPromotion', 'NeuralEcologyRouter'],
    'Lifecycle and routing contracts are supplied; trained model artifacts still require a compatible backend and evaluation evidence.'),
  concept(31, 'cognitive-to-neural-bridge', 'Cognitive-to-Neural Bridge — bounded state controls', 'neural-adaptation', 'foundation_added',
    ['OrganismState', 'P28PlasticitySubstrate', 'NeuralEcologyRouter'],
    'Only a small normalized control vector is emitted; model-specific application is a separate opt-in backend integration.'),
  concept(32, 'neurocore-neural-jit', 'NeuroCore Neural JIT — evidence-compiled skill capsules', 'neural-adaptation', 'research_gated',
    ['VerifiedOutcomeLedger', 'P23LearningEngine', 'VerifiedSkillPromotion'],
    'This foundation emits inert parameterized capsules from verified traces; native transformer/JIT compilation is not claimed.'),
]);

export function getOmeStroConcept(id: number): OmeStroConcept | null {
  return OMESTRO_CONCEPTS.find(item => item.id === id) ?? null;
}

export function getOmeStroImplementationSummary() {
  const counts = { existing_partial: 0, foundation_added: 0, research_gated: 0 };
  for (const item of OMESTRO_CONCEPTS) counts[item.status] += 1;
  return {
    version: 1 as const,
    total: OMESTRO_CONCEPTS.length,
    counts,
    concepts: OMESTRO_CONCEPTS.map(item => ({ id: item.id, key: item.key, status: item.status })),
    complete: false as const,
    reason: 'The registry maps all 32 concepts; research-gated neural capabilities require backend and independent evaluation evidence.',
  };
}

export function validateOmeStroConceptRegistry(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (OMESTRO_CONCEPTS.length !== 32) errors.push('expected-32-concepts');
  const ids = new Set<number>();
  const keys = new Set<string>();
  for (const item of OMESTRO_CONCEPTS) {
    if (!Number.isSafeInteger(item.id) || item.id < 1 || item.id > 32 || ids.has(item.id)) errors.push('invalid-or-duplicate-id:' + item.id);
    if (!item.key || keys.has(item.key)) errors.push('invalid-or-duplicate-key:' + item.key);
    if (!item.title || !item.integratesWith.length || !item.boundary) errors.push('incomplete-concept:' + item.id);
    ids.add(item.id);
    keys.add(item.key);
  }
  for (let id = 1; id <= 32; id += 1) if (!ids.has(id)) errors.push('missing-id:' + id);
  return { valid: errors.length === 0, errors };
}
