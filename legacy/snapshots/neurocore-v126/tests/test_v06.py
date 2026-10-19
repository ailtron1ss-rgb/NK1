import torch
from neurocore import (NeuroCoreModel, MultiTimescaleCell, GatedLinearAttention, SalienceMemory,
    LatentWorldModel, composite_loss, parameter_lesion_fraction, route_entropy)

def test_multitimescale_state_and_gate():
    c=MultiTimescaleCell(12); s=c.initial_state(2); y,s2,g=c(torch.randn(2,12),s); assert y.shape==(2,12); assert 0<=float(g.detach().min()) and float(g.detach().max())<=1; assert all(torch.isfinite(t).all() for t in (*s2,))

def test_linear_attention_stateful():
    a=GatedLinearAttention(16,4); x=torch.randn(2,5,16); y,s=a(x); z,_=a(x,state=s); assert y.shape==z.shape==(2,5,16); assert not torch.allclose(y[:,-1],z[:,-1])

def test_salience_memory_retrieval():
    m=SalienceMemory(3,8)
    for i in range(5): m.write(torch.eye(8)[i%8],torch.ones(8)*i,salience=float(i))
    r=m.retrieve(torch.eye(8)[2:3],k=2); assert r.values.shape==(1,8); assert r.indices.shape==(1,2); assert len(m)<=3

def test_world_model_ensemble_uncertainty():
    w=LatentWorldModel(8,3,ensemble=3); s,o,r,u=w(torch.randn(2,8),torch.randn(2,3)); assert s.shape==(2,8); assert o.shape==(2,1); assert r.shape==(2,1); assert u.shape==(2,1); assert (r>=0).all() and (u>=0).all()

def test_composite_loss_finite():
    m=NeuroCoreModel(d_model=8,state_size=12,n_experts=2,top_k=1,memory_capacity=4); out=m(torch.randn(2,5,8)); loss,parts=composite_loss(out,torch.randn_like(out.predicted_next)); assert torch.isfinite(loss); assert set(parts)=={'prediction','smoothness'}

def test_lesion_changes_network():
    m=NeuroCoreModel(d_model=8,state_size=12,n_experts=2,top_k=1,memory_capacity=4).eval(); x=torch.randn(1,5,8); l=parameter_lesion_fraction(m,.2); assert not torch.allclose(m(x).latent,l(x).latent)

def test_route_entropy_nonnegative():
    m=NeuroCoreModel(d_model=8,state_size=12,n_experts=2,top_k=1,memory_capacity=4); e=route_entropy(m(torch.randn(2,4,8)).route_logits); assert e>=0
