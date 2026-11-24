import torch
import torch.nn.functional as F
from neurocore.v75 import mobile_v75_config, NeuroWeaveV75, CanonicalNeuralMemoryOSV75, RuntimeStateStoreV75

def mem(seed=1):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV75(
        54,key_dim=20,value_dim=20,fast_slots=16,fast_rank=2,semantic_slots=24,semantic_rank=2,
        replay_size=16,hidden=16,long_term_hidden=16,long_term_layers=1,graph_rank=3,graph_topk=3,
        structural_rank=3,structural_topk=2,composition_rank=4,composition_horizon=3,composition_capacity=16,
        relation_rank=4,replay_capacity=16,associative_rank=4,factor_rank=6,continuum_update_interval=4,
        replay_base_interval=4.0,replay_min_interval=1.0,replay_pressure_gain=1.75,replay_update_gain=32.0,replay_budget_cap=6,
    )

def test_v75_import_and_single_owner():
    m=NeuroWeaveV75(mobile_v75_config(9))
    assert m.neural_memory_v61 is m.neural_memory_v75
    assert m.neural_memory_v70 is m.neural_memory_v75
    assert sum(p.numel() for p in m.parameters()) < 360000

def test_v75_model_update_mass_is_live():
    m=mem(2)
    s=F.normalize(torch.randn(20),dim=0); t=F.normalize(torch.randn(20),dim=0)
    for _ in range(8): m._associative_write_v72(s,t,0,1.0); m.model_time_v72.add_(1.0)
    opt=torch.optim.AdamW(m.parameters(),lr=1e-3)
    out=m.consolidate(opt,steps=1)
    assert out['v75_model_update_mass'] >= 0.0
    assert torch.isfinite(m.replay_update_mass_v75)
    assert float(m.model_time_v72.item()) >= 1.0

def test_v75_scheduler_changes_budget_with_pressure():
    m=mem(3)
    m.replay_novelty_v72.fill_(0.0)
    m.associative_conflict_v73.zero_()
    b0=m._adaptive_replay_budget_v75()
    m.replay_novelty_v72.fill_(1.0)
    m.associative_conflict_v73.fill_(1.0)
    b1=m._adaptive_replay_budget_v75()
    assert b1 >= b0
    assert float(m.replay_scheduler_interval_v75.item()) <= m.replay_base_interval_v75

def test_v75_replay_schedule_is_causal():
    m=mem(4)
    s=F.normalize(torch.randn(20),dim=0); t=F.normalize(torch.randn(20),dim=0)
    for _ in range(8): m._associative_write_v72(s,t,0,1.0); m.model_time_v72.add_(1.0)
    m.replay_last_adaptive_time_v75.fill_(m.model_time_v72.item())
    first=m.replay_associative_state_v72(m.replay_budget_v72)
    m.model_time_v72.add_(5.0)
    second=m.replay_associative_state_v72(m.replay_budget_v72)
    assert first['scheduled']==0.0
    assert second['scheduled']==1.0
    assert int(m.replay_scheduler_events_v75.item())>=1

def test_v75_checkpoint_roundtrip():
    import tempfile
    from pathlib import Path
    m=NeuroWeaveV75(mobile_v75_config(9))
    path=Path(tempfile.gettempdir())/'neurocore_v75_roundtrip.pt'
    RuntimeStateStoreV75.save(path,m,None,None)
    m2=NeuroWeaveV75(mobile_v75_config(9)); result=RuntimeStateStoreV75.load(path,m2,None,None)
    assert result['version']==75
    assert not result['shape_mismatch']
    path.unlink(missing_ok=True)
