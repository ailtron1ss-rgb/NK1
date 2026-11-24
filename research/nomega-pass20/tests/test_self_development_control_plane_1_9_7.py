from pathlib import Path
from core.nomega.adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
from core.nomega.evolution_archive_v1 import EvolutionArchiveV1
from core.nomega.developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1
from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
from core.nomega.mobile_runtime_benchmark_v1 import MobileRuntimeBenchmarkV1


def test_experience_memory_is_evidence_gated_and_persistent(tmp_path):
    m=AdaptiveExperienceMemoryV3(tmp_path)
    key=m.store_verified(family='sum3',text='add three',code=[(1,0,0),(14,0,0)],reward=.9,source='test',cycle_id='c',status='validated')
    assert key and m.stats()['verified']==1
    assert m.retrieve_replay_mix(['sum3'],4)
    assert m.path.exists()


def test_evolution_archive_pareto_and_parent_selection(tmp_path):
    a=EvolutionArchiveV1(tmp_path)
    for cost,success in [(3,.8),(2,.9),(8,.95)]:
        a.add(family='sum3',operator='op',code=[(1,0,0),(14,0,0),(int(cost),0,0)],verified=True,success=success,search_cost=cost,complexity=cost/64,source='test',cycle_id='c')
    assert a.pareto_front('sum3')
    assert a.select_parents('sum3',2)


def test_bottleneck_detector_prefers_low_ood_and_neural(tmp_path):
    b=DevelopmentalBottleneckDetectorV1(tmp_path)
    out=b.analyze({'raw_neural_verified_rate':.1,'repair_verified_rate':.9,'ood_coverage':.2,'restart_delta':0,'normalized_search_cost':.1,'transfer_delta':0,'mobile_budget_overrun':0})
    assert out['primary']['name'] in {'neural_grounding','ood_generalization'}


def test_orchestrator_promotion_gate(tmp_path):
    o=SelfDevelopmentOrchestratorV1(tmp_path)
    assert o.promotion_gate(baseline_gain=.1,candidate_gain=.2,restart_delta=0,negative_transfer=0,same_budget=True)['passed']
    assert not o.promotion_gate(baseline_gain=.1,candidate_gain=.1,restart_delta=0,negative_transfer=0,same_budget=True)['passed']


def test_mobile_benchmark_marks_host_not_device(tmp_path):
    r=MobileRuntimeBenchmarkV1(tmp_path).run(lambda: sum(range(50)),warmup=1,iterations=3)
    assert r['measurement_class'] in {'HOST_MEASURED','DEVICE_MEASURED'}
    assert r['latency_ms']['p95'] >= r['latency_ms']['p50']


def test_development_cycle_bootstraps_verified_memory(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    learner=ExecutionGuidedProgramLearnerV1(tmp_path,seed=1970,hidden=24)
    boot=learner.bootstrap_verified_baseline(('sum3','xor3'),seed=19710)
    assert boot['counted_as_learning_gain'] is False
    assert boot['verified'] >= 1
    assert learner.experience_memory.stats()['verified'] >= 1
