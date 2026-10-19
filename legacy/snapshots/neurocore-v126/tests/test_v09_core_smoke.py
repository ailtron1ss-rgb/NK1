import torch
from neurocore import NeuroWeaveV3

def test_v3_reference_smoke():
    torch.manual_seed(123)
    m=NeuroWeaveV3(d_model=24,fast_state=32,memory_capacity=32,n_experts=3,action_dim=10)
    x=torch.randn(2,5,24); a=torch.randn(2,5,10)
    out,st,_=m(x,actions=a)
    assert out.latent.shape==(2,5,24)
    assert torch.all(st.step==5)
    loss=(out.latent.pow(2).mean()+out.self_prediction.pow(2).mean())
    loss.backward()
    assert sum(p.grad is not None for p in m.parameters())>50
