import torch
from neurocore.v17_frontier import NeuroWeaveV17, V17Config, FrontierTrainerV17

def test_v17_forward_finite_and_shapes():
    m=NeuroWeaveV17(V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=4,max_experts=4,top_k=1,world_candidates=2,max_horizon=2))
    x=torch.randn(3,7,8); goal=torch.randn(3,8)
    o=m(x,goal=goal)
    assert o['latent_v17'].shape==(3,7,8)
    assert torch.isfinite(o['latent_v17']).all()
    assert torch.isfinite(o['world_next_v17']).all()

def test_exact_cache_bounded():
    m=NeuroWeaveV17(V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=3,max_experts=4,top_k=1))
    x=torch.randn(2,20,8); o=m(x)
    s=o['_final_state']; assert s.cache_keys.shape==(2,3,8); assert (s.cache_age>=0).all(); assert torch.isfinite(s.cache_keys).all()

def test_memory_uncertainty_updates():
    m=NeuroWeaveV17(V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=4,max_experts=4,top_k=1))
    st=m.initial_state(2); x=torch.randn(2,4,8); o=m(x,state=st); s=o['_final_state']
    assert torch.isfinite(s.memory).all() and torch.isfinite(s.memory_cov).all()
    assert (s.memory_cov>0).all()

def test_selective_compute_is_per_sample():
    m=NeuroWeaveV17(V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=4,max_experts=4,top_k=1))
    x=torch.randn(4,5,8); o=m(x)
    p=o['compute_allocation_v17']; assert p.shape[:2]==(4,5); assert torch.allclose(p.sum(-1),torch.ones_like(p.sum(-1)),atol=1e-4)

def test_world_auxiliary_training_changes_parameters():
    m=NeuroWeaveV17(V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=4,max_experts=4,top_k=1))
    opt=torch.optim.AdamW(m.world.parameters(),lr=1e-3); z=torch.randn(4,8); a=torch.randn(4,3); y=torch.randn(4,8)
    before=[p.detach().clone() for p in m.world.parameters()]; pred,_,_,_=m.world.transition(z,a); loss=torch.nn.functional.mse_loss(pred,y); opt.zero_grad(); loss.backward(); opt.step()
    delta=sum((p.detach()-b).abs().sum().item() for p,b in zip(m.world.parameters(),before)); assert delta>0

def test_frontier_trainer_updates():
    m=NeuroWeaveV17(V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=4,max_experts=4,top_k=1))
    x=torch.randn(2,5,8); o=m(x); tr=FrontierTrainerV17(m); before=sum(p.detach().norm().item() for p in m.world.parameters()); tr.step(o,torch.randn(2,8)); after=sum(p.detach().norm().item() for p in m.world.parameters()); assert abs(after-before)>1e-8
