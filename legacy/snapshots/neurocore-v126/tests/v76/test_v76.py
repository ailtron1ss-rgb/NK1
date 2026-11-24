import tempfile
from pathlib import Path
import torch
import torch.nn.functional as F

from neurocore.v76 import mobile_v76_config, NeuroWeaveV76, CanonicalNeuralMemoryOSV76, RuntimeStateStoreV76


def mem(seed=1):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV76(
        54,key_dim=20,value_dim=20,fast_slots=16,fast_rank=2,semantic_slots=24,semantic_rank=2,
        replay_size=16,hidden=16,long_term_hidden=16,long_term_layers=1,graph_rank=3,graph_topk=3,
        structural_rank=3,structural_topk=2,composition_rank=4,composition_horizon=3,composition_capacity=16,
        relation_rank=4,replay_capacity=16,associative_rank=4,factor_rank=6,continuum_update_interval=4,
        replay_base_interval=4.0,replay_min_interval=1.0,replay_pressure_gain=1.75,replay_update_gain=32.0,
        replay_budget_cap=6,replay_exploit_ratio=0.55,replay_novelty_weight=0.26,replay_conflict_weight=0.24,
        replay_age_weight=0.18,replay_coverage_weight=0.22,protected_loss_weight=0.035,
        protected_max_samples=6,protected_min_conflict=0.22,
    )


def seed_replay(m):
    with torch.no_grad():
        m.semantic_slot_valid_v63[:12] = 1
        m.semantic_key[:12] = F.normalize(torch.randn(12,20), dim=-1)
        for i in range(12):
            m._record_composition_path_v73([i%8,(i+1)%8,(i+2)%8], 0.5 + 0.05*i)
            m.model_time_v72.add_(1.0)


def test_v76_single_owner_and_package_surface():
    m=NeuroWeaveV76(mobile_v76_config(9))
    assert m.neural_memory_v61 is m.neural_memory_v76
    assert m.neural_memory_v61 is m.neural_memory_v74
    assert sum(p.numel() for p in m.parameters()) < 380000


def test_v76_portfolio_contains_exploit_and_explore_slots():
    m=mem(2); seed_replay(m)
    valid=torch.nonzero(m.composition_replay_valid_v71>0.5).flatten()
    chosen=m._select_replay_portfolio_v76(valid, min(6, int(valid.numel())))
    assert 1 <= chosen.numel() <= 6
    assert int(m.replay_portfolio_events_v76.item()) >= 1
    assert int(m.replay_portfolio_exploit_v76.item()) >= 1
    assert int(m.replay_portfolio_explore_v76.item()) >= 0


def test_v76_priority_responds_to_novelty_and_age():
    m=mem(3); seed_replay(m)
    valid=torch.nonzero(m.composition_replay_valid_v71>0.5).flatten()
    before=m._replay_priority_v76(valid)
    m.replay_novelty_v72[valid[0]] = 1.0
    m.composition_replay_last_seen_v71[valid[0]] = 0.0
    after=m._replay_priority_v76(valid)
    assert float(after[0]) > float(before[0])


def test_v76_protected_teacher_loss_has_gradient_path():
    m=mem(4); seed_replay(m)
    s=F.normalize(torch.randn(20), dim=0); t=F.normalize(torch.randn(20), dim=0)
    for _ in range(8):
        m._associative_write_v72(s,t,0,1.0); m.model_time_v72.add_(1.0)
    opt=torch.optim.AdamW(m.parameters(), lr=1e-3)
    m.consolidate(opt, steps=1)
    m.protected_min_conflict_v76 = 0.5
    loss=m._protected_teacher_loss_v76()
    assert torch.isfinite(loss)
    assert loss.requires_grad
    loss.backward()
    grads=[p.grad for p in m.parameters() if p.grad is not None]
    assert any(torch.isfinite(g).all() and float(g.abs().sum())>0 for g in grads)


def test_v76_replay_is_live_and_updates_portfolio_diagnostics():
    m=mem(5); seed_replay(m)
    out=m.replay_associative_state_v72(6)
    assert out['replayed'] > 0
    assert torch.isfinite(m.associative_state_v72).all()
    assert float(m.replay_portfolio_diversity_v76.item()) >= 0.0


def test_v76_checkpoint_roundtrip():
    m=NeuroWeaveV76(mobile_v76_config(9))
    path=Path(tempfile.gettempdir())/'neurocore_v76_roundtrip.pt'
    RuntimeStateStoreV76.save(path,m,None,None)
    m2=NeuroWeaveV76(mobile_v76_config(9))
    result=RuntimeStateStoreV76.load(path,m2,None,None)
    assert result['version']==76
    assert not result['shape_mismatch']
    assert not result['unexpected_tensors']
    path.unlink(missing_ok=True)


def test_v76_long_sequence_stays_finite():
    m=mem(7)
    seed_replay(m)
    for i in range(500):
        m.model_time_v72.add_(1.0)
        if i % 10 == 0:
            m.replay_associative_state_v72()
    tensors=[m.associative_state_v72,m.associative_conflict_v73,m.associative_slow_left_v74,m.replay_pressure_v75,m.replay_portfolio_diversity_v76]
    assert all(torch.isfinite(x).all() for x in tensors)
