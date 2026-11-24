import torch
import torch.nn.functional as F
from neurocore.v16_frontier import NeuroWeaveV16, V16Config, frontier_loss_v16, OrganismTrainerV16

def make():
    return NeuroWeaveV16(V16Config(d=8,hidden=16,action_dim=3,memory_capacity=6,replay_capacity=7,semantic_capacity=5,max_experts=4,top_k=1,world_candidates=3,max_horizon=3,deep_threshold=0.2))

def test_v16_forward_finite_and_goal_path():
    torch.manual_seed(1601); m=make(); x=torch.randn(3,9,8); g=torch.randn(3,8); y=m(x,goal=g,commit_memory=True)
    for k,v in y.items():
        if torch.is_tensor(v): assert torch.isfinite(v).all(), k
    assert y["goal_latent_v16"].shape==(3,9,8); assert y["action_v16"].shape==(3,9,3)

def test_v16_self_model_is_nontrivial():
    torch.manual_seed(1602); m=make(); y=m(torch.randn(4,10,8),commit_memory=False)
    assert y["self_model_error_v16"].mean()>0; assert y["self_health_v16"].min()>=0 and y["self_health_v16"].max()<=1

def test_v16_goal_utility_changes_with_goal():
    torch.manual_seed(1603); m=make(); x=torch.randn(6,8,8); g1=torch.ones(6,8); g2=-g1
    y1=m(x,goal=g1,commit_memory=False); y2=m(x,goal=g2,commit_memory=False)
    assert not torch.allclose(y1["goal_advantage_v16"],y2["goal_advantage_v16"])

def test_v16_intrinsic_drive_is_bounded():
    torch.manual_seed(1604); m=make(); y=m(torch.randn(5,8,8),commit_memory=False)
    d=y["intrinsic_drive_v16"]; assert d.min()>=0 and d.max()<=1.0001

def test_v16_state_persists_life_and_goal():
    torch.manual_seed(1605); m=make(); s=m.initial_state(2); y,s2=m.step(torch.randn(2,8),s,goal=torch.randn(2,8),commit_memory=False)
    assert torch.all(s2.life_step == 1.0) and s2.goal.shape==(2,8) and s2.self_prediction.shape==(2,8)

def test_v16_loss_backpropagates():
    torch.manual_seed(1606); m=make(); y=m(torch.randn(4,8,8),goal=torch.randn(4,8),commit_memory=False)
    loss=frontier_loss_v16(y,torch.randn(4,8)); assert torch.isfinite(loss); loss.backward()
    assert any(p.grad is not None and torch.isfinite(p.grad).all() and p.grad.abs().sum()>0 for p in m.parameters())

def test_v16_trainer_updates_real_parameters():
    torch.manual_seed(1607); m=make(); y=m(torch.randn(3,10,8),goal=torch.randn(3,8),commit_memory=False); tr=OrganismTrainerV16(m)
    before=m.self_model.net[0].weight.detach().clone(); l=tr.step(y); after=m.self_model.net[0].weight.detach()
    assert torch.isfinite(l); assert not torch.allclose(before,after)

def test_v16_recall_learns():
    torch.manual_seed(1608); m=make(); x=torch.randn(10,10,8); tgt=x[:,1]; opt=torch.optim.AdamW(m.parameters(),lr=2e-3)
    with torch.no_grad(): init=F.mse_loss(m(x,commit_memory=False)["latent_v16"][:,-1],tgt).item()
    for _ in range(4):
        opt.zero_grad(set_to_none=True); y=m(x,commit_memory=False); loss=F.mse_loss(y["latent_v16"][:,-1],tgt); loss.backward(); torch.nn.utils.clip_grad_norm_(m.parameters(),1.0); opt.step()
    with torch.no_grad(): final=F.mse_loss(m(x,commit_memory=False)["latent_v16"][:,-1],tgt).item()
    assert final<init
