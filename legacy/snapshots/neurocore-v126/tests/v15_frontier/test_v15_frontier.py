import torch
import torch.nn.functional as F
from neurocore.v15_frontier import NeuroWeaveV15, V15Config, frontier_loss_v15, LifeCycleTrainerV15


def make():
    return NeuroWeaveV15(V15Config(d=8, hidden=16, action_dim=3, memory_capacity=6, replay_capacity=7,
                                   semantic_capacity=5, max_experts=4, top_k=1, world_candidates=3,
                                   max_horizon=3, deep_threshold=0.2))


def test_forward_and_all_new_signals_finite():
    torch.manual_seed(1501); m=make(); y=m(torch.randn(4,10,8),commit_memory=True)
    for k,v in y.items():
        if torch.is_tensor(v): assert torch.isfinite(v).all(), k
    assert y["latent_v15"].shape == (4,10,8)
    assert y["compute_allocation_v15"].shape[-1] == 4


def test_semantic_memory_bounded_and_populated():
    torch.manual_seed(1502); m=make(); y=m(torch.randn(4,16,8),commit_memory=True); s=y["_final_state"]
    assert s.semantic_keys.shape == (4,5,8)
    assert (s.semantic_strength > 0).sum() > 0
    assert s.semantic_strength.max() <= 1.0001


def test_successor_representation_changes_and_is_bounded():
    torch.manual_seed(1503); m=make(); y=m(torch.randn(3,12,8),commit_memory=False); s=y["_final_state"]
    assert torch.linalg.matrix_norm(s.successor,dim=(-2,-1)).mean() > 0
    assert torch.linalg.matrix_norm(s.successor,dim=(-2,-1)).max() <= 5.0001


def test_counterfactual_intervention_is_nonconstant():
    torch.manual_seed(1504); m=make(); y=m(torch.randn(8,9,8),commit_memory=False)
    a=y["counterfactual_advantage_v15"]
    assert torch.isfinite(a).all()
    assert a.std() > 1e-7


def test_compute_allocation_is_a_distribution():
    torch.manual_seed(1505); m=make(); y=m(torch.randn(5,8,8),commit_memory=False)
    p=y["compute_allocation_v15"]
    assert torch.allclose(p.sum(-1), torch.ones_like(p[...,0]), atol=1e-5)
    assert (p >= 0).all()


def test_health_scaling_is_bounded():
    torch.manual_seed(1506); m=make(); y=m(torch.randn(4,8,8),commit_memory=False)
    s=y["safe_plasticity_scale_v15"]
    assert s.min() >= 0 and s.max() <= 1.0001


def test_frontier_loss_backpropagates():
    torch.manual_seed(1507); m=make(); y=m(torch.randn(4,8,8),commit_memory=False)
    loss=frontier_loss_v15(y,torch.randn(4,8)); assert torch.isfinite(loss); loss.backward()
    grads=[p.grad for p in m.parameters() if p.requires_grad]
    assert any(g is not None and torch.isfinite(g).all() and g.abs().sum()>0 for g in grads)


def test_life_cycle_trainer_is_real_update():
    torch.manual_seed(1508); m=make(); y=m(torch.randn(3,14,8),commit_memory=True); s=y["_final_state"]
    tr=LifeCycleTrainerV15(m,lr=3e-3)
    before=float(m.next_head_v15.weight.detach().clone().abs().sum())
    l=tr.step(s,6); after=float(m.next_head_v15.weight.detach().abs().sum())
    assert torch.isfinite(l); assert abs(after-before)>1e-8


def test_recall_signal_learns():
    torch.manual_seed(1509); m=make(); x=torch.randn(12,10,8); target=x[:,1]
    opt=torch.optim.AdamW(m.parameters(),lr=2e-3)
    with torch.no_grad(): init=F.mse_loss(m(x,commit_memory=False)["latent_v15"][:,-1],target).item()
    for _ in range(4):
        opt.zero_grad(set_to_none=True); y=m(x,commit_memory=False); loss=F.mse_loss(y["latent_v15"][:,-1],target); loss.backward(); torch.nn.utils.clip_grad_norm_(m.parameters(),1.0); opt.step()
    with torch.no_grad(): final=F.mse_loss(m(x,commit_memory=False)["latent_v15"][:,-1],target).item()
    assert final < init
