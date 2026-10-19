import torch
from neurocore.v18 import NeuroWeaveV11

def test_v11_shapes_and_finite():
    torch.manual_seed(0); m=NeuroWeaveV11(d=8,hidden=16,action_dim=4,capacity=8,max_experts=6,top_k=2)
    x=torch.randn(4,12,8); y,s=m(x,commit_memory=True)
    assert y['latent'].shape==(4,12,8); assert y['route_probs'].shape==(4,12,2); assert y['expert_credit'].shape==(4,12,6)
    assert torch.isfinite(y['latent']).all(); assert torch.isfinite(y['evidence']).all(); assert (s.expert_active.sum(-1)>=1).all()

def test_v11_gradients():
    torch.manual_seed(1); m=NeuroWeaveV11(d=8,hidden=16,action_dim=4,max_experts=6); x=torch.randn(4,10,8,requires_grad=True); o,_=m(x,commit_memory=False); loss=o['latent'][:,-1].pow(2).mean()+o['prediction_error'].mean()+o['world_uncertainty'].mean(); loss.backward(); gs=[p.grad for p in m.parameters() if p.grad is not None]; assert gs and all(torch.isfinite(g).all() for g in gs); assert sum((g.abs()>1e-9).any().item() for g in gs)/len(gs)>.75

def test_retrieval_conditioned_recurrence_is_sensitive():
    torch.manual_seed(2); m=NeuroWeaveV11(d=8,hidden=16); st=m.initial_state(2,'cpu',torch.float32); x=torch.randn(2,8)
    o1,_=m.step(x,st,commit_memory=False); st2=m.initial_state(2,'cpu',torch.float32); st2.context.fill_(1.0); o2,_=m.step(x,st2,commit_memory=False); assert (o1['latent']-o2['latent']).abs().mean()>1e-6

def test_structure_change_is_state_only_and_bounded():
    torch.manual_seed(3); m=NeuroWeaveV11(d=8,hidden=16,max_experts=6); st=m.initial_state(3,'cpu',torch.float32); st.expert_credit[:,0]=1.0; st.expert_credit[:,1:]=0.0; ns=m.propose_structure(st.expert_credit,st.expert_active); assert (ns.sum(-1)>=1).all() and (ns<=1).all()
