import torch
from neurocore.v17_frontier import NeuroWeaveV17, V17Config

def cfg():
    return V17Config(d=8,hidden=16,action_dim=3,memory_capacity=12,replay_capacity=8,semantic_capacity=6,exact_cache=4,max_experts=4,top_k=1,world_candidates=2,max_horizon=2)

def test_training_loss_is_finite_and_has_gradients():
    m=NeuroWeaveV17(cfg()); x=torch.randn(3,8,8); out=m(x,commit_memory=False); loss=m.training_loss(out)
    assert torch.isfinite(loss); loss.backward()
    grads=[p.grad for p in m.world.parameters() if p.grad is not None]
    assert grads and all(torch.isfinite(g).all() for g in grads)

def test_multi_step_world_objective_improves_after_updates():
    torch.manual_seed(2); m=NeuroWeaveV17(cfg()); opt=torch.optim.AdamW(list(m.world.parameters())+list(m.integration.parameters()),lr=2e-3)
    x=torch.randn(4,10,8)
    with torch.no_grad():
        out=m(x,commit_memory=False); before=float(m.training_loss(out))
    for _ in range(20):
        out=m(x,commit_memory=False); loss=m.training_loss(out); opt.zero_grad(); loss.backward(); opt.step()
    with torch.no_grad():
        out=m(x,commit_memory=False); after=float(m.training_loss(out))
    assert after < before
