import torch
from neurocore import NeuroWeaveV4

def test_shapes_and_gradients():
    m=NeuroWeaveV4(d_model=16,hidden=20,action_dim=8,replay_capacity=32)
    x=torch.randn(2,5,16,requires_grad=True); o,s=m(x); loss=o.latent.pow(2).mean()+o.prediction_error.mean(); loss.backward()
    assert o.latent.shape==(2,5,16); assert torch.isfinite(o.latent).all(); assert any(p.grad is not None and torch.isfinite(p.grad).all() for p in m.parameters())

def test_tri_scale_is_dynamic():
    m=NeuroWeaveV4(d_model=16,hidden=20,action_dim=8); x=torch.randn(1,6,16); o,_=m(x)
    assert not torch.allclose(o.fast[:,0],o.fast[:,-1]); assert not torch.allclose(o.slow[:,0],o.slow[:,-1])

def test_compute_is_bounded():
    m=NeuroWeaveV4(); o,_=m(torch.randn(2,4,32)); assert ((o.compute_probability>=0)&(o.compute_probability<=1)).all()

def test_replay_explicit_and_bounded():
    m=NeuroWeaveV4(d_model=16,hidden=20,action_dim=8,replay_capacity=8).eval();
    with torch.no_grad(): m(torch.randn(2,12,16),collect_replay=True)
    assert m.replay.occupancy() <= 1.0; assert m.replay.latents.shape[0]==8
