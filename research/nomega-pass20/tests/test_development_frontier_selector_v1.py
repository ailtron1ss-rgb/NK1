from pathlib import Path

from core.nomega.development_frontier_selector_v1 import DevelopmentFrontierSelectorV1


def test_frontier_selector_penalizes_repeated_failed_intervention(tmp_path: Path):
    root = tmp_path
    state = root / 'runtime'
    state.mkdir(parents=True)
    (state / 'unified_development_state_v1.json').write_text(
        '{"version":"x","interventions":{},"cycles":['
        '{"bottleneck":"search_efficiency","intervention":"learn_candidate_priority_under_equal_budget","gain":0.0,"accepted":false},'
        '{"bottleneck":"search_efficiency","intervention":"learn_candidate_priority_under_equal_budget","gain":0.0,"accepted":false},'
        '{"bottleneck":"search_efficiency","intervention":"learn_candidate_priority_under_equal_budget","gain":0.0,"accepted":false}'
        ']}', encoding='utf-8'
    )
    selector = DevelopmentFrontierSelectorV1(root)
    decision = selector.select({
        'normalized_search_cost': 0.9,
        'raw_neural_verified_rate': 0.95,
        'repair_verified_rate': 0.95,
        'ood_coverage': 0.95,
    })
    assert decision.ranked
    repeated = [r for r in decision.ranked if r.name == 'search_efficiency']
    assert repeated
    assert repeated[0].repetition_penalty > 0.0
