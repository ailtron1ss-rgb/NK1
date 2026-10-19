from pathlib import Path

from core.nomega.neural_self_optimization_controller_v2 import NeuralSelfOptimizationControllerV2


def _history(n=12):
    rows=[]
    for i in range(n):
        rows.append({
            'state': {
                'new_gain': 0.05 + 0.01*i,
                'retention': 0.92 - 0.01*(i%3),
                'ood': 0.90 - 0.005*(i%2),
                'uncertainty': 0.15 + 0.01*(i%4),
                'interference': 0.10 + 0.02*(i%3),
                'plasticity': 0.80 + 0.01*(i%2),
                'budget': 100.0,
                'baseline_utility': 0.40 + 0.02*(i%3),
                'incumbent_lr': 0.025,
                'incumbent_replay_ratio': 0.25,
                'incumbent_anchor_weight': 0.10,
            },
            'config': {
                'lr': 0.01 + 0.002*(i%4),
                'steps': 8 + (i%3),
                'replay_ratio': 0.25 + 0.05*(i%3),
                'anchor_weight': 0.10 + 0.05*(i%2),
                'interference_threshold': 0.70 + 0.05*(i%2),
                'batch_size': 8,
            },
            'utility': 0.40 + 0.03*i,
            'baseline_utility': 0.40 + 0.02*(i%3),
            'budget': 100.0,
        })
    return rows


def test_v2_fits_state_conditioned_policy_and_returns_uncertainty(tmp_path: Path):
    c = NeuralSelfOptimizationControllerV2(tmp_path, seed=7, ensemble=2)
    report = c.fit(_history(), epochs=4)
    assert report is not None
    assert report.samples == 12
    action = c.propose(
        [
            {'name':'safe','budget':100.0,'config':{'lr':0.01,'steps':10,'replay_ratio':0.35,'anchor_weight':0.15,'interference_threshold':0.75,'batch_size':8}},
            {'name':'expensive','budget':150.0,'config':{'lr':0.03,'steps':15,'replay_ratio':0.50,'anchor_weight':0.05,'interference_threshold':0.50,'batch_size':8}},
        ],
        state=_history()[-1]['state'],
        baseline_budget=100.0,
    )
    assert action['name'] == 'safe'
    assert 0.0 <= action['prediction_uncertainty'] < 2.0


def test_v2_external_gate_requires_equal_budget_and_retention(tmp_path: Path):
    c = NeuralSelfOptimizationControllerV2(tmp_path)
    decision = c.gate(
        baseline={'utility':0.50,'budget':100.0,'retention':0.90,'ood':0.90,'restart_ok':1.0},
        candidate={'utility':0.55,'budget':100.0,'retention':0.70,'ood':0.90,'restart_ok':1.0},
    )
    assert decision.accepted is False
    assert 'retention_regression' in decision.reasons


def test_v2_meta_learning_can_rank_equal_budget_candidates(tmp_path: Path):
    c = NeuralSelfOptimizationControllerV2(tmp_path, seed=19, ensemble=2)
    c.fit(_history(), epochs=6)
    state = dict(_history()[-1]['state'])
    candidates = []
    for j, lr in enumerate((0.006, 0.010, 0.016)):
        candidates.append({'name':f'cand{j}','budget':100.0,'config':{'lr':lr,'steps':10,'replay_ratio':0.35,'anchor_weight':0.15,'interference_threshold':0.75,'batch_size':8}})
    chosen = c.propose(candidates, state=state, baseline_budget=100.0)
    assert chosen['budget'] == 100.0
    assert 'predicted_utility' in chosen
    assert 'prediction_uncertainty' in chosen


def test_v2_can_defer_when_uncertainty_dominates_expected_gain(tmp_path: Path):
    c = NeuralSelfOptimizationControllerV2(tmp_path)
    decision = c.should_defer(predicted_advantage=-0.01, uncertainty=0.60, min_advantage=0.0, max_uncertainty=0.50)
    assert decision is True
