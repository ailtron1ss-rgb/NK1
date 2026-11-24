import torch
from neurocore.v17.research_modules import NeuralResearchStack

def test_research_stack_shapes_and_gradients():
    torch.manual_seed(0)
    m=NeuralResearchStack(d=8,action_dim=4)
    h=torch.randn(6,8,requires_grad=True); pe=torch.rand(6,1); nov=torch.rand(6,1); unc=torch.rand(6,1); st=torch.rand(6,1); a=torch.randn(6,4); s=torch.randn(6,8); ref=torch.zeros_like(h)
    out,pen=m(h,(pe,nov,unc,st),a,s,ref)
    loss=out.replay.mean()+out.importance.mean()+out.plasticity.mean()+out.next_state.pow(2).mean()+out.reward.pow(2).mean()+out.uncertainty.mean()+pen
    loss.backward()
    assert out.next_state.shape==(6,8)
    assert out.slow_state.shape==(6,8)
    assert torch.isfinite(loss)
    grads=[p.grad for p in m.parameters() if p.grad is not None]
    assert grads and all(torch.isfinite(g).all() for g in grads)
