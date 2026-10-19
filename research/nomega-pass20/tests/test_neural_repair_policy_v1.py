from core.nomega.neural_repair_policy_v1 import NeuralRepairPolicyV1


def test_policy_ranks_verified_repair_above_failed_candidate():
    policy = NeuralRepairPolicyV1(seed=11, ensemble=2)
    history = []
    for i in range(10):
        history.append({
            'state': {'error_class': 'runtime' if i % 2 else 'semantic_mismatch'},
            'operator': 'repair_halt' if i % 2 == 0 else 'insert_load',
            'local_verified': bool(i % 2 == 0),
            'independent_verified': bool(i % 2 == 0),
            'counterexamples': 0 if i % 2 == 0 else 4,
            'cost': 6 + i,
            'utility': 1.0 if i % 2 == 0 else 0.0,
        })
    report = policy.fit(history, epochs=16)
    assert report is not None
    candidates = [
        {'operator': 'repair_halt', 'local_verified': True, 'counterexamples': 0, 'cost': 6},
        {'operator': 'insert_load', 'local_verified': False, 'counterexamples': 4, 'cost': 20},
    ]
    ranked = policy.rank_candidates(candidates, state={'error_class': 'runtime'})
    assert ranked[0]['operator'] == 'repair_halt'
    assert ranked[0]['prediction_uncertainty'] >= 0.0


def test_policy_can_abstain_on_uncertain_prediction():
    policy = NeuralRepairPolicyV1(seed=3, ensemble=2)
    assert policy.should_abstain(predicted_success=0.1, uncertainty=0.8)
