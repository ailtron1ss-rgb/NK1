from tools.benchmark_1_26_online_continual import STRATEGIES, build_report

def test_benchmark_schema_and_strategy_registry():
    assert set(STRATEGIES) == {'naive','static_replay','adaptive_replay','adaptive_replay_anchor','adaptive_replay_anchor_interference'}
    r=build_report(seed=1,strategy='naive',families=['sum3'])
    for key in ('seed','strategy','phases','retention','plasticity_gap','rollbacks','restart_equivalence','compute_steps'):
        assert key in r


def test_real_sequential_benchmark_runs_multiple_families():
    from tools.benchmark_1_26_online_continual import run
    r=run(seed=1,strategy='adaptive_replay_anchor_interference',families=['sum3','xor3'])
    assert len(r['phases']) == 2
    assert r['compute_steps'] == 24
    assert r['restart_equivalence'] is True
