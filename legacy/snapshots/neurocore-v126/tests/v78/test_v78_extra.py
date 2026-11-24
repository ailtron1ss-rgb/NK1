import torch
from neurocore.v78 import NeuroWeaveV78, mobile_v78_config
from neurocore.v78.benchmark import run_external_stream_trial


def test_v78_external_stream_is_finite():
    a = run_external_stream_trial(7, False, updates_per_task=1)
    b = run_external_stream_trial(7, True, updates_per_task=1)
    for row in (a, b):
        assert all(torch.isfinite(torch.tensor(v)) for v in row['final_losses'])
        assert torch.isfinite(torch.tensor(row['last_task_delta']))


def test_v78_long_runtime_state_stays_finite():
    m = NeuroWeaveV78(mobile_v78_config(9))
    s = torch.randn(20)
    t = torch.randn(20)
    from torch.nn import functional as F
    s, t = F.normalize(s, dim=0), F.normalize(t, dim=0)
    for i in range(1000):
        m.neural_memory_v61._associative_write_v72(s, t if i % 5 else -t, 0, 1.0)
        m.neural_memory_v61.model_time_v72.add_(1.0)
        if i % 25 == 0:
            m.neural_memory_v61.replay_associative_state_v72(2)
    assert torch.isfinite(m.neural_memory_v61.associative_state_v72).all()
    assert torch.isfinite(m.neural_memory_v61.continual_interference_ema_v78)


def test_v78_replay_recovers_lesioned_fast_state():
    from neurocore.v78.benchmark import run_replay_recovery_trial
    row = run_replay_recovery_trial(780)
    assert row['replay_traces_before_lesion'] > 0
    assert row['lesion_cosine'] < row['baseline_cosine']
    assert row['recovered_cosine'] > row['lesion_cosine']
    assert row['replay_traces_before_lesion'] >= row['replayed'] or row['replayed'] > 0
