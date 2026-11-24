import torch

from neurocore.current import (
    CausalTrunk, CausalTrunkConfig, NeuroCoreCurrent, OrganismRuntimeCurrent,
    TemporalCreditConfig, ThreeFactorPlasticityConfig, CurrentConfig, RuntimeStateStoreCurrent,
)

def _model(cfg=None):
    return NeuroCoreCurrent(cfg or CurrentConfig.mobile(9))

def test_chunked_sequence_matches_unbroken_forward():
    torch.manual_seed(113)
    m = _model()
    x = torch.randn(1, 12, 9)
    g = torch.randn(1, 12, 8)
    a = m.trunk.forward_sequence(x, g)
    m2 = _model(); m2.load_state_dict(m.state_dict())
    b = m2.trunk.forward_sequence_chunked(x, g, chunk_length=4, detach_between_chunks=False)
    assert torch.allclose(a["latent"], b["latent"], atol=1e-5, rtol=1e-5)
    assert torch.allclose(a["state"], b["state"], atol=1e-5, rtol=1e-5)

def test_runtime_state_roundtrip_preserves_multiscale():
    torch.manual_seed(113)
    m = _model(); r=OrganismRuntimeCurrent(m)
    for _ in range(5): r.step(torch.randn(9))
    payload = r.state_dict(); runtime_internal=m.trunk.runtime_state_dict()
    m2=_model(); r2=OrganismRuntimeCurrent(m2)
    m2.load_state_dict(m.state_dict())
    m2.trunk.load_runtime_state_dict(runtime_internal); r2.load_state_dict(payload)
    x=torch.randn(9)
    a=r.step(x)["latent"]; b=r2.step(x)["latent"]
    assert torch.allclose(a,b,atol=1e-6,rtol=1e-6)

def test_selective_credit_mode_is_real_and_bounded():
    tc=TemporalCreditConfig(enabled=True, mode="selective", selective_floor=0.2)
    cfg=CurrentConfig(trunk=CausalTrunkConfig(temporal_credit=tc, online_plasticity=ThreeFactorPlasticityConfig(enabled=True)))
    m=_model(cfg); torch.manual_seed(113)
    h=torch.randn(2,64); pred=torch.randn(2,20); target=torch.randn(2,20)
    m.trunk.spine.online_plasticity.update(h,pred,target)
    assert torch.isfinite(m.trunk.spine.online_plasticity.fast_weight).all()

def test_parameter_gradient_coverage_is_complete():
    torch.manual_seed(113); m=_model()
    out=m.forward_learning(torch.randn(2,8,9), torch.randn(2,8,8), target_latent_sequence=torch.randn(2,7,20))
    out["loss"].backward()
    trainable=[p for p in m.parameters() if p.requires_grad]
    assert all(p.grad is not None for p in trainable)
    assert all(torch.isfinite(p.grad).all() for p in trainable)


def test_long_sequence_with_online_plasticity_no_autograd_version_error():
    torch.manual_seed(113)
    op=ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=False)
    cfg=CurrentConfig(trunk=CausalTrunkConfig(online_plasticity=op))
    m=_model(cfg); out=m.forward_learning(torch.randn(2,48,9), torch.randn(2,48,8), target_latent_sequence=torch.randn(2,47,20)); out["loss"].backward()
    assert all(p.grad is not None for p in m.parameters() if p.requires_grad)

def test_chunked_learning_supports_long_horizon_training():
    torch.manual_seed(113); m=_model()
    out=m.trunk.forward_learning_chunked(torch.randn(1,24,9), torch.randn(1,24,8), chunk_length=6, target_latent_sequence=torch.randn(1,23,20))
    out["loss"].backward()
    assert torch.isfinite(out["loss"])

def test_runtime_state_is_not_duplicated_in_store():
    torch.manual_seed(113); m=_model(); r=OrganismRuntimeCurrent(m); r.step(torch.randn(9))
    from pathlib import Path
    path=Path("/tmp/neurocore_v114_runtime.pt")
    RuntimeStateStoreCurrent.save(path,m,runtime=r)
    payload=torch.load(path,map_location="cpu",weights_only=False)
    assert "trunk_runtime" not in payload
    assert "trunk_runtime" in payload["runtime"]
    path.unlink(missing_ok=True)


def test_trunk_state_does_not_contain_removed_action_head():
    m=_model()
    assert not any("memory_to_action" in k for k in m.state_dict())

def test_chunked_tbptt_with_online_plasticity_is_finite():
    torch.manual_seed(114)
    op=ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=False)
    cfg=CurrentConfig(trunk=CausalTrunkConfig(online_plasticity=op))
    m=_model(cfg)
    out=m.trunk.forward_learning_chunked(torch.randn(1,40,9), torch.randn(1,40,8), chunk_length=8, target_latent_sequence=torch.randn(1,39,20), detach_between_chunks=True)
    out["loss"].backward()
    assert torch.isfinite(out["loss"])


def test_post_update_alignment_removes_probe_update_conflicts():
    from dataclasses import replace
    from neurocore.current import GradientArbitrationConfig, OrganismTrainerCurrent
    torch.manual_seed(113)
    cfg = replace(CurrentConfig.mobile(9), gradient_arbitration=GradientArbitrationConfig(enabled=True, method="pcgrad", post_update_alignment=True, post_update_alignment_passes=8))
    model = _model(cfg).train(); trainer = OrganismTrainerCurrent(model)
    out = trainer.learning_step_arbitrated(torch.randn(2,8,9), torch.randn(2,8,8), target_latent_sequence=torch.randn(2,7,20))
    assert out["gradient_arbitration_post_align_applied"] == 1.0
    assert out["gradient_arbitration_post_align_conflict_rate"] <= out["gradient_arbitration_update_conflict_rate"]
    assert torch.isfinite(torch.cat([p.detach().reshape(-1) for p in model.parameters()])).all()
