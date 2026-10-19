from pathlib import Path

from core.nomega.development_intervention_registry_v1 import DevelopmentInterventionRegistryV1


def test_registry_lists_canonical_actions(tmp_path: Path):
    registry = DevelopmentInterventionRegistryV1(tmp_path)
    actions = {row.action for row in registry.specs()}
    assert 'learn_multi_source_generalist_operator_policy' in actions
    assert 'cross_family_repair_operator_transfer' in actions
    assert 'evolve_verified_capability' in actions


def test_registry_rejects_unknown_without_promoting(tmp_path: Path):
    result = DevelopmentInterventionRegistryV1(tmp_path).dispatch('unknown_action')
    assert result.status == 'unsupported'
    assert result.promotion_eligible is False
    assert result.intervention_id


def test_registry_generalist_probe_has_hidden_metrics(tmp_path: Path):
    result = DevelopmentInterventionRegistryV1(tmp_path, seed=1201).dispatch(
        'learn_multi_source_generalist_operator_policy',
        {'seeds': (1201,), 'candidate_cap': 64, 'source_families': ('sum3', 'xor3'), 'target_families': ('minmax3',)}
    )
    assert result.status == 'completed'
    assert 'generalist_unseen_family_future_gain' in result.metrics
    assert result.promotion_eligible is False


def test_registry_reuses_cached_research_without_recomputing(tmp_path: Path):
    registry = DevelopmentInterventionRegistryV1(tmp_path, seed=1201)
    context = {
        'seeds': (1201,),
        'candidate_cap': 16,
        'source_families': ('sum3', 'xor3'),
        'target_families': ('minmax3',),
    }
    first = registry.dispatch('learn_multi_source_generalist_operator_policy', context)
    cached = registry.dispatch('learn_multi_source_generalist_operator_policy', {**context, 'reuse_cached': True})
    assert first.status == 'completed'
    assert cached.status == 'cached'
    assert cached.intervention_id == first.intervention_id
    assert cached.summary["selected_candidates"][0]["selected_candidate_hash"] == first.summary["selected_candidates"][0]["selected_candidate_hash"]
    assert cached.metrics == first.metrics
