import torch
import torch.nn.functional as F
from neurocore.v74 import mobile_v74_config,NeuroWeaveV74,CanonicalNeuralMemoryOSV74

def mem(seed=1):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV74(54,key_dim=20,value_dim=20,fast_slots=16,fast_rank=2,semantic_slots=24,semantic_rank=2,replay_size=16,hidden=16,long_term_hidden=16,long_term_layers=1,graph_rank=3,graph_topk=3,structural_rank=3,structural_topk=2,composition_rank=4,composition_horizon=3,composition_capacity=16,relation_rank=4,replay_capacity=16,associative_rank=4,factor_rank=6,continuum_update_interval=4)

def test_v74_single_owner_and_bounded_slow_state():
    m=NeuroWeaveV74(mobile_v74_config(9)); assert m.neural_memory_v61 is m.neural_memory_v74; assert m.neural_memory_v61.associative_slow_left_v74.shape[-1] <= 4; assert m.neural_memory_v61.associative_slow_left_v74.numel() + m.neural_memory_v61.associative_slow_singular_v74.numel() + m.neural_memory_v61.associative_slow_right_v74.numel() < m.neural_memory_v61.associative_state_v72.numel(); assert sum(p.numel() for p in m.parameters())<350000

def test_v74_slow_state_requires_consolidation_and_survives_fast_lesion():
    m=mem(2); s=F.normalize(torch.randn(20),dim=0); t=F.normalize(torch.randn(20),dim=0)
    for _ in range(8): m._associative_write_v72(s,t,0,1.0); m.model_time_v72.add_(1.0)
    assert m.associative_slow_valid_v74.sum().item()==0
    opt=torch.optim.AdamW(m.parameters(),lr=1e-3); m.consolidate(opt,steps=1)
    slow=float((m.associative_slow_left_v74.norm()+m.associative_slow_singular_v74.norm()+m.associative_slow_right_v74.norm()).item()); assert slow>0
    m.associative_state_v72.zero_(); m.associative_valid_v72.zero_(); pred=m._associative_predict_v72(s.view(1,-1),0)
    slow_pred=m.read_slow_v74(s.view(1,-1),0); assert torch.isfinite(pred).all(); assert torch.isfinite(slow_pred).all(); assert float(pred.norm().item())>0.0; assert float(F.cosine_similarity(slow_pred,t.view(1,-1)).item())>0.95

def test_v74_slow_update_is_bounded_and_counted():
    m=mem(3); s=F.normalize(torch.randn(20),dim=0); t=F.normalize(torch.randn(20),dim=0)
    for _ in range(5): m._associative_write_v72(s,t,0,1.0); m.model_time_v72.add_(1.0)
    opt=torch.optim.AdamW(m.parameters(),lr=1e-3); a=m.consolidate(opt,steps=1); b=m.consolidate(opt,steps=1)
    assert int(m.associative_slow_updates_v74.item())>=2; assert torch.isfinite(m.associative_slow_left_v74).all() and torch.isfinite(m.associative_slow_singular_v74).all() and torch.isfinite(m.associative_slow_right_v74).all(); assert a['associative_continuum_v74_updated']==1.0

def test_v74_parameter_route_is_live():
    m=mem(4); s=F.normalize(torch.randn(20),dim=0); t=F.normalize(torch.randn(20),dim=0)
    for _ in range(8): m._associative_write_v72(s,t,0,1.0); m.model_time_v72.add_(1.0)
    opt=torch.optim.AdamW(m.parameters(),lr=1e-3); m.consolidate(opt,1); m.associative_state_v72.zero_(); m.associative_valid_v72.zero_(); p1=m._associative_predict_v72(s.view(1,-1),0)
    with torch.no_grad(): m.continuum_mix_v74=0.0
    p2=m._associative_predict_v72(s.view(1,-1),0)
    assert float((p1-p2).norm().item())>1e-7
