from pathlib import Path
import json


def test_calibrated_router_builds_frontier_and_risk_aware_selection(tmp_path):
    from core.nomega.continual_strategy_portfolio_v1 import ContinualStrategyPortfolioV1
    from core.nomega.calibrated_strategy_router_v1 import CalibratedStrategyRouterV1
    p = ContinualStrategyPortfolioV1(tmp_path, seed=12001)
    p.record('naive', 'mul2', delta=.30, retention=.02, cost=3, cycle_id='a')
    p.record('naive', 'mul2', delta=.28, retention=.03, cost=3, cycle_id='b')
    p.record('replay', 'mul2', delta=.22, retention=.18, cost=3, cycle_id='c')
    p.record('replay', 'mul2', delta=.24, retention=.17, cost=3, cycle_id='d')
    r = CalibratedStrategyRouterV1(tmp_path)
    out = r.recommend('mul2', objective='balanced', budget=2, risk_tolerance=.5)
    assert out['frontier']
    assert out['selected']
    assert {x['strategy'] for x in out['selected']} <= {'naive', 'replay', 'ewc', 'agem', 'gradient_aligned'}


def test_router_calibration_is_computed_from_prediction_outcome_pairs(tmp_path):
    from core.nomega.calibrated_strategy_router_v1 import CalibratedStrategyRouterV1
    r = CalibratedStrategyRouterV1(tmp_path)
    r.record_prediction(decision_id='d1', strategy='naive', family='x', predicted_success=.9, predicted_delta=.2)
    r.record_prediction(decision_id='d2', strategy='naive', family='x', predicted_success=.1, predicted_delta=-.1)
    r.record_outcome(decision_id='d1', actual_delta=.2)
    r.record_outcome(decision_id='d2', actual_delta=-.05)
    rep = r.calibration_report()
    assert rep['n'] == 2
    assert rep['brier'] >= 0.0
    assert rep['ece'] >= 0.0
    assert rep['delta_mae'] >= 0.0


def test_evolution_islands_preserve_diversity_and_migrate(tmp_path):
    from core.nomega.evolution_islands_v1 import EvolutionIslandControllerV1
    c = EvolutionIslandControllerV1(tmp_path, islands=4, migration_interval=1, seed=12002)
    candidates = []
    for i, op in enumerate(('a','b','c','d','e','f','g','h')):
        candidates.append({'operator': op, 'code': [(i % 7, i % 3, (i+1) % 4)], 'source': 'raw_local', 'novelty': 1.0 if i else 0.0})
    selected = c.route_pool('sum3', candidates, budget=4)
    assert len(selected) == 4
    assert len({int(x.get('island_id')) for x in selected}) >= 2
    for row in selected[:4]:
        c.observe_verified(family='sum3', candidate=row, verified=True, success=.9, cost=1, cycle_id='cycle')
    stats = c.stats()
    assert stats['verified_observations'] >= 4
    assert stats['migrations'] >= 1


def test_orchestrator_exposes_calibrated_router_and_islands(tmp_path):
    from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
    o = SelfDevelopmentOrchestratorV1(tmp_path, seed=12003)
    plan = o.plan({'neural_grounding': .2}, ['sum3', 'xor3'], current_family='sum3')
    assert 'calibrated_strategy_plan' in plan
    assert 'evolution_island_plan' in plan
    snap = o.snapshot()
    assert 'calibrated_router' in snap
    assert 'evolution_islands' in snap


def test_long_horizon_benchmark_state_contract(tmp_path):
    from core.nomega.long_horizon_development_benchmark_v1 import LongHorizonDevelopmentBenchmarkV1
    # Contract-only invocation to avoid counting a unit test as the expensive research benchmark.
    b = LongHorizonDevelopmentBenchmarkV1(tmp_path, seed=12004, hidden=8)
    assert b.VERSION == '1.12.0'
    assert b.path.name == 'nomega_long_horizon_benchmark_v1.json'


def test_router_gate_refuses_negative_meta_router_evidence(tmp_path):
    from core.nomega.strategy_router_gate_v1 import StrategyRouterGateV1
    g = StrategyRouterGateV1(tmp_path)
    out = g.promotion_gate(calibrated_score=5/9, baseline_score=7/9, same_budget=True, folds=3)
    assert out['passed'] is False
    assert g.snapshot()['enabled'] is False
    choice = g.recommend('sum3', objective='learning', budget=1)
    assert choice['router_source'] == 'scalar_portfolio'
