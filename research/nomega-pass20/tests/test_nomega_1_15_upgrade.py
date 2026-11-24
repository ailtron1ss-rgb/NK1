from __future__ import annotations

import json
from pathlib import Path
import pytest
import torch

from core.nomega.program_ir_v1 import parse_text_to_sketch, sketch_distance, from_task_spec
from core.nomega.execution_budget_policy_v1 import ExecutionBudgetPolicyV1
from core.nomega.causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, EvaluationSnapshotV2, EvidenceQuorumV1
from core.nomega.neural_program_synth_v9 import NeuralProgramSynthesizerV9
from core.nomega.version import PROJECT_VERSION
from core.nomega.task_spec_v1 import parse_task_spec
from core.nomega.mobile_runtime_benchmark_v2 import MobileRuntimeBenchmarkV2
from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
from core.nomega.grounding_bridge_v1 import GroundingBridgeV1
from core.nomega.architecture_health_v1 import ArchitectureHealthScannerV1
from core.nomega.matched_evidence_v1 import MatchedEvidenceAnalyzerV1
from core.nomega.neural_program_repair_v1 import NeuralProgramRepairV1


def test_program_sketch_is_canonical_and_structural():
    a = parse_text_to_sketch('add the first three values')
    b = parse_text_to_sketch('return the sum of three inputs')
    assert a.family == 'sum3'
    assert len(a.signature) == 20
    assert sketch_distance(a, a) == 0.0
    assert sketch_distance(a, b) == 2.0


def test_execution_budget_is_budget_bounded():
    p = ExecutionBudgetPolicyV1()
    low = p.decide(uncertainty=.05, novelty=.02, semantic_valid=True, estimated_exec_ms=10, remaining_budget_ms=100)
    high = p.decide(uncertainty=.95, novelty=.95, semantic_valid=False, estimated_exec_ms=10, remaining_budget_ms=25)
    assert low.executions == 0
    assert high.executions <= 2
    assert high.estimated_cost_ms <= 25


def test_hash_chained_ledger_detects_tampering(tmp_path):
    ledger = CausalEvidenceLedgerV1(tmp_path/'ledger.jsonl')
    ledger.append('before', {'score': .1})
    ledger.append('after', {'score': .2})
    assert ledger.verify()['valid'] is True
    p = tmp_path/'ledger.jsonl'
    lines = p.read_text().splitlines()
    row = json.loads(lines[0]); row['payload']['score'] = .9
    lines[0] = json.dumps(row)
    p.write_text('\n'.join(lines)+'\n')
    assert ledger.verify()['valid'] is False


def snap(**kw):
    base = dict(score=.5, verified_rate=.6, holdout=.6, ood=.6, adversarial=.6, restart_delta=0.0, negative_transfer=0.0, latency_ms=100.0, memory_mb=50.0, seed=1)
    base.update(kw)
    return EvaluationSnapshotV2(**base)


def test_control_plane_requires_real_nonregression(tmp_path):
    cp = SelfEvolutionControlPlaneV2(tmp_path)
    quorum = EvidenceQuorumV1(seed_count=3, independent_runs=2, trajectory_hashes=3, provenance_sources=2, holdout_id="h1", ood_id="o1")
    matched={"accepted": True}
    good = cp.assess(snap(), snap(score=.6, holdout=.7, verified_rate=.6, ood=.65, adversarial=.65), multi_seed_evidence=True, evidence_quorum=quorum, matched_effect=matched)
    bad = cp.assess(snap(), snap(score=.6, holdout=.7, verified_rate=.5))
    assert good.accepted is True
    assert bad.accepted is False


def test_control_plane_rejects_same_artifact(tmp_path):
    cp = SelfEvolutionControlPlaneV2(tmp_path)
    f = tmp_path/'same.pt'; f.write_bytes(b'x')
    with pytest.raises(ValueError):
        cp.promote(candidate_path=f, baseline_path=f, baseline=snap(), candidate=snap(holdout=.7))


def test_v9_semantic_encoder_is_executable():
    torch.manual_seed(1)
    model = NeuralProgramSynthesizerV9(vocab=512, hidden=24, latent_dim=24, max_len=12, max_b=16, layers=1, heads=2, family_count=20)
    out = model.encode_text_batch(['add the first three values', 'xor three values'])
    assert out.shape == (2, 24)
    code = model.generate('add the first three values', family_id=0, max_len=6)
    assert isinstance(code, list) and len(code) > 0
    assert all(int(row[0]) in {0,1,2,3,13,14} for row in code)


def test_version_source_is_present():
    assert PROJECT_VERSION == '1.32.0-dev'


def test_taskspec_and_program_ir_share_one_source_of_truth():
    spec = parse_task_spec('add the first three values')
    ir = from_task_spec(spec)
    assert ir.family == spec.family
    assert ir.family_id == spec.family_id
    assert tuple(ir.operators) == tuple(spec.operators)
    assert ir.signature == from_task_spec(spec).signature


def test_mobile_benchmark_provenance_is_real(tmp_path):
    result = MobileRuntimeBenchmarkV2().run(lambda: 3 + 4, warmup=1, iterations=3)
    assert result['measurement_class'] in {'HOST_MEASURED', 'DEVICE_MEASURED'}
    assert result['latency_ms']['p95'] >= result['latency_ms']['min']
    assert result['latency_ms']['p99'] >= result['latency_ms']['p95']
    assert result['iterations'] == 3


def test_orchestrator_logs_control_plane_and_ledger(tmp_path):
    orch = SelfDevelopmentOrchestratorV1(tmp_path, seed=7)
    plan = orch.plan({'neural_grounding': .2, 'pure_neural_verified_rate': 0.0}, ['sum3','xor3'])
    row = orch.record_cycle('test-cycle', {'neural_grounding': .2, 'pure_neural_verified_rate': 0.0}, plan)
    assert row['cycle_id'] == 'test-cycle'
    snap = orch.snapshot()
    assert snap['control_plane']['version'] == orch.control_plane.VERSION
    assert snap['evidence_ledger']['integrity']['valid'] is True


def test_runtime_evolution_gate_requires_multi_seed_evidence():
    from core.nomega.runtime import NOmegaRuntime, NOMEGAConfig
    rt = NOmegaRuntime(Path('runtime'), NOMEGAConfig.mobile())
    base = dict(score=.5, verified_rate=.5, holdout=.5, ood=.5, adversarial=.5, restart_delta=0.0, negative_transfer=0.0, latency_ms=1.0, memory_mb=1.0, seed=1)
    cand = dict(base, score=.6, holdout=.7, ood=.55, adversarial=.55)
    decision = rt.omega15_self_evolution_assess(base, cand)
    assert decision['accepted'] is False
    assert 'multi_seed_evidence' in decision['reason']


def test_grounding_bridge_preserves_evidence_track_and_budget():
    decision = GroundingBridgeV1().route('add the first three values', uncertainty=.4, novelty=.3, estimated_exec_ms=5, remaining_budget_ms=20)
    assert decision.route == 'typed_sketch_assisted'
    assert decision.track == 'TASKSPEC_ASSISTED'
    assert decision.family == 'sum3'
    assert decision.sketch_signature
    assert decision.execution_budget.estimated_cost_ms <= 20


def test_grounding_bridge_abstains_on_unknown_semantics():
    decision = GroundingBridgeV1().route('perform an unsupported symbolic transformation', allow_task_spec_assist=True)
    assert decision.track == 'PURE_NEURAL'
    assert decision.route == 'pure_neural_abstain_or_recheck'
    assert decision.semantic_valid is False


def test_architecture_health_scanner_reports_structural_risks(tmp_path):
    report = ArchitectureHealthScannerV1(Path('.')).scan()
    assert report.package_modules > 150
    assert report.import_edges > 100
    assert report.versioned_modules >= 100
    assert report.cycle_count >= 0


def test_evidence_quorum_rejects_single_source_promotion():
    cp = SelfEvolutionControlPlaneV2(Path('.'))
    weak = EvidenceQuorumV1(seed_count=3, independent_runs=1, trajectory_hashes=1, provenance_sources=1, holdout_id='h', ood_id='o')
    decision = cp.assess(snap(), snap(holdout=.7), multi_seed_evidence=True, evidence_quorum=weak)
    assert decision.accepted is False
    assert decision.gates['evidence_quorum'] is False


def test_evidence_quorum_accepts_independent_provenance():
    cp = SelfEvolutionControlPlaneV2(Path('.'))
    q = EvidenceQuorumV1(seed_count=3, independent_runs=2, trajectory_hashes=3, provenance_sources=2, holdout_id='h', ood_id='o')
    decision = cp.assess(snap(), snap(holdout=.7), multi_seed_evidence=True, evidence_quorum=q)
    assert decision.gates['evidence_quorum'] is True


def test_matched_evidence_rejects_regression_even_with_positive_mean():
    effect = MatchedEvidenceAnalyzerV1.analyze([1,2,3], [.2,.8,.1], [.3,.7,.2])
    result = MatchedEvidenceAnalyzerV1.require(effect, min_mean_gain=.01)
    assert result['accepted'] is False
    assert result['gates']['no_regressions'] is False


def test_matched_evidence_requires_paired_positive_gain():
    effect = MatchedEvidenceAnalyzerV1.analyze([1,2,3], [.2,.2,.2], [.25,.23,.24])
    result = MatchedEvidenceAnalyzerV1.require(effect, min_mean_gain=.01)
    assert result['accepted'] is True
    assert result['effect']['regression_count'] == 0


def test_control_plane_requires_matched_effect_for_promotion():
    cp = SelfEvolutionControlPlaneV2(Path('.'))
    q = EvidenceQuorumV1(seed_count=3, independent_runs=2, trajectory_hashes=3, provenance_sources=2, holdout_id='h', ood_id='o')
    decision = cp.assess(snap(), snap(holdout=.7), multi_seed_evidence=True, evidence_quorum=q)
    assert decision.accepted is False
    assert decision.gates['matched_effect'] is False


def test_neural_local_repair_stays_separate_from_pure_neural(tmp_path):
    repair = NeuralProgramRepairV1(tmp_path, seed=4)
    original = [(1,0,0),(1,1,1),(3,0,1),(1,1,2),(3,0,1),(13,0,0),(14,0,0)]
    result = repair.repair(original, 'sum3', max_candidates=4)
    assert result.source == 'neural_candidate_local_mutation'
    assert result.candidates_tested >= 1
    assert isinstance(result.code, list)


def test_neural_skill_retrieval_requires_execution_verification(tmp_path):
    from core.nomega.neural_skill_retrieval_v1 import NeuralSkillRetrievalV1
    original = [(1,0,0),(1,1,1),(3,0,1),(1,1,2),(3,0,1),(13,0,0),(14,0,0)]
    result = NeuralSkillRetrievalV1(tmp_path, seed=9).search(original, 'sum3', max_candidates=4)
    assert result.candidates_tested >= 1
    assert result.source in {'neural_candidate', 'verified_skill_retrieval'}
    assert isinstance(result.code, list)


def test_grounding_recovery_controller_is_budgeted(tmp_path):
    from core.nomega.grounding_recovery_controller_v1 import GroundingRecoveryControllerV1
    original = [(1,0,0),(1,1,1),(3,0,1),(1,1,2),(3,0,1),(13,0,0),(14,0,0)]
    result = GroundingRecoveryControllerV1(tmp_path, seed=10).recover(
        original, 'sum3', estimated_exec_ms=2.0, remaining_budget_ms=20.0, max_candidates=4,
    )
    assert result.track
    assert result.candidates_tested >= 1
    assert result.remaining_budget_ms >= 0.0
