from pathlib import Path
from core.nomega.repair_search_policy_v1 import RepairSearchPolicyV1


def test_policy_persists_verified_history_and_ranks_successful_depth(tmp_path):
    p = RepairSearchPolicyV1(tmp_path, seed=9)
    before = p.rank_depths('sum3', (1, 2, 3, 4, 5))
    for _ in range(3):
        p.observe(family='sum3', depth=4, verified=True, candidates_tested=1, cycle_id='t')
    for _ in range(3):
        p.observe(family='sum3', depth=1, verified=False, candidates_tested=6, cycle_id='t')
    after = p.rank_depths('sum3', (1, 2, 3, 4, 5))
    assert 4 in after[:2]
    assert 1 in after[-2:]
    assert p.path.exists()


def test_policy_snapshot_is_json_serializable(tmp_path):
    p = RepairSearchPolicyV1(tmp_path)
    p.observe(family='xor3', depth=2, verified=True, candidates_tested=2, cycle_id='x')
    snap = p.snapshot()
    assert snap['version'] == '1.9.5'
    assert snap['families']['xor3']['2']['successes'] == 1


def test_repair_policy_ablation_discovers_verified_case_corpus(tmp_path):
    from core.nomega.repair_policy_ablation_v1 import RepairPolicyAblationV1
    out = RepairPolicyAblationV1(tmp_path, seed=52).run(warmup=2, evaluation=2, budget=12)
    assert len(out['evaluation_cases']) == 2
    assert out['static']['results']
    assert out['adaptive']['results']
    assert out['policy_state']['version'] == '1.9.5'


def test_policy_is_research_only_until_explicit_promotion(tmp_path):
    from core.nomega.repair_search_policy_v1 import RepairSearchPolicyV1
    p = RepairSearchPolicyV1(tmp_path)
    assert p.is_promoted() is False
    p2 = RepairSearchPolicyV1(tmp_path)
    assert p2.is_promoted() is False
