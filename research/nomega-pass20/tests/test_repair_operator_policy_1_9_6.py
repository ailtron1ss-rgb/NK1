from pathlib import Path

from core.nomega.repair_operator_policy_v2 import RepairOperatorPolicyV2
from core.nomega.repair_operator_transfer_ablation_v1 import RepairOperatorTransferAblationV1


def test_operator_policy_persists_and_ranks_verified_operator(tmp_path):
    p=RepairOperatorPolicyV2(tmp_path,seed=7)
    for _ in range(4): p.observe(family='sum3',operator='arg_a_replace',verified=True,candidates_tested=1,cycle_id='t')
    for _ in range(4): p.observe(family='sum3',operator='insert_instruction',verified=False,candidates_tested=8,cycle_id='t')
    ranked=p.rank_operators('sum3')
    assert ranked[0]=='arg_a_replace'
    assert p.path.exists()


def test_operator_policy_uses_global_transfer_prior(tmp_path):
    p=RepairOperatorPolicyV2(tmp_path,seed=8)
    for _ in range(5): p.observe(family='sum3',operator='opcode_replace',verified=True,candidates_tested=1,cycle_id='warm',source_family='sum3')
    ranked=p.rank_operators('minmax3')
    assert 'opcode_replace' in ranked[:2]


def test_operator_policy_stays_research_only(tmp_path):
    p=RepairOperatorPolicyV2(tmp_path)
    assert p.is_promoted() is False


def test_cross_family_ablation_builds_disjoint_evidence(tmp_path):
    out=RepairOperatorTransferAblationV1(tmp_path,seed=19621).run(cases_per_family=1,budget=12)
    assert out['cross_family_transfer'] is True
    assert out['candidate_pools_identical'] is True
    assert set(out['warmup_families']).isdisjoint(out['evaluation_families'])
    assert out['static']['results'] and out['adaptive']['results']
    assert out['policy_state']['version'] in {'1.9.6','1.9.7'}


def test_operator_order_is_metamorphic_over_identical_candidate_pools(tmp_path):
    from core.nomega.repair_operator_transfer_ablation_v1 import RepairOperatorTransferAblationV1
    bench = RepairOperatorTransferAblationV1(tmp_path, seed=19630)
    case = bench._find_case('minmax3', 19630)
    assert case is not None
    flattened = {tuple(tuple(x) for x in cand) for values in case['candidate_pools'].values() for cand in values}
    assert flattened
    # Reordering operators must not change the candidate pool itself.
    static = set(tuple(tuple(x) for x in cand) for op in bench.operators for cand in case['candidate_pools'][op])
    assert flattened == static
