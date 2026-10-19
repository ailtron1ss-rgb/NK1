from dataclasses import replace
import torch
from neurocore.current import (CausalTrunkConfig, CurrentConfig, NeuroCoreCurrent,
    TemporalCreditConfig, ThreeFactorFastWeight, ThreeFactorPlasticityConfig,
    HiPPOCreditConfig, ProductKeyMemoryConfig, ProductKeySparseMemory, ProductKeySparseDeltaMemory,
    heavy_tail_activation, long_horizon_fast_credit, sparse_delta_memory_probe)


def test_v120_adaptive_hybrid_real():
    tc=TemporalCreditConfig(enabled=True,mode="adaptive_hybrid",normalize_trace=False,hippo=HiPPOCreditConfig(enabled=True))
    op=ThreeFactorPlasticityConfig(enabled=True,learning_rate=0.1,modulatory_gate_enabled=False)
    l=ThreeFactorFastWeight(16,8,op,temporal_credit=tc)
    z=torch.zeros(2,8); x=torch.randn(2,16)
    l.update(x,z,z)
    for _ in range(3): l.update(torch.randn_like(x),z,z)
    assert torch.isfinite(l.fast_weight).all() and float(l.last_hippo_norm)>0


def test_v120_sparse_delta_memory():
    m=ProductKeySparseDeltaMemory(16,ProductKeyMemoryConfig(subkey_size=8,slots_per_subkey=8,topk_per_subkey=2,value_dim=20))
    k=torch.randn(2,16); v=torch.randn(2,20); before=m.read(k); st=m.write(k,v); after=m.read(k)
    assert st["written_slots"]>0 and st["mean_delta_gain"]>0 and not torch.allclose(before,after)


def test_v120_learned_m0_is_actually_trainable():
    cfg=ProductKeyMemoryConfig(subkey_size=8,slots_per_subkey=8,topk_per_subkey=2,value_dim=20,learned_initial_state=True)
    m=ProductKeySparseMemory(16,cfg)
    q=torch.randn(2,16); target=torch.randn(2,20)
    read=m.read(q)
    ((read-target)**2).mean().backward()
    assert m._initial_values.grad is not None
    assert float(m._initial_values.grad.abs().sum()) > 0.0


def test_v120_heavy_tail_finite():
    x=torch.tensor([[-3.,-1.,0.,1.,3.]])
    y=heavy_tail_activation(x)-1
    assert torch.isfinite(y).all() and y[0,2].item()==0.0


def test_v120_default_param_count_unchanged_by_disabled_candidates():
    a=NeuroCoreCurrent(CurrentConfig(trunk=CausalTrunkConfig()))
    b=NeuroCoreCurrent(CurrentConfig(trunk=replace(CausalTrunkConfig(),product_key_memory_blend=0.0)))
    assert sum(p.numel() for p in a.parameters())==sum(p.numel() for p in b.parameters())


def test_v120_chunked_training_finite_and_gradients():
    m=NeuroCoreCurrent(CurrentConfig.mobile(9)).train()
    x=torch.randn(2,10,9); g=torch.randn(2,10,8); t=torch.randn(2,9,20)
    out=m.forward_learning_chunked(x,g,chunk_length=5,target_latent_sequence=t)
    out["loss"].backward()
    assert torch.isfinite(out["loss"]).item()
    assert all(torch.isfinite(p.grad).all() for p in m.parameters() if p.grad is not None)


def test_v120_qualification_probes_finite():
    row=long_horizon_fast_credit(mode="adaptive_hybrid",delay=32,seed=120)
    assert all(torch.isfinite(torch.tensor(v)) for v in row.values())
    row=sparse_delta_memory_probe(seed=120)
    assert row["written_slots"]>0
