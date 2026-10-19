import tempfile
from pathlib import Path
import torch
import torch.nn.functional as F

from neurocore.v65 import (
    V65Config,
    mobile_v65_config,
    CanonicalNeuralMemoryOSV65,
    NeuroWeaveV65,
    OrganismRuntimeV65,
    OrganismTrainerV65,
    RuntimeStateStoreV65,
)


def make_mem(seed=1, semantic_slots=24, replay_size=32):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV65(
        10, key_dim=6, value_dim=6, fast_slots=8, fast_rank=2,
        semantic_slots=semantic_slots, replay_size=replay_size, hidden=18,
    )


def test_v65_model_time_and_replay_metadata_are_real():
    m = make_mem()
    q = F.normalize(torch.randn(6), dim=0)
    y = F.normalize(torch.randn(6), dim=0)
    m.write(q, y, strength=1.0, surprise=1.0)
    assert float(m.model_time_v65.item()) > 0.0
    valid = torch.nonzero(m.replay_valid > 0.5, as_tuple=False).flatten()
    assert valid.numel() == 1
    idx = int(valid[0].item())
    assert float(m.replay_model_time_v65[idx].item()) >= 0.0
    assert 0.0 <= float(m.replay_novelty_v65[idx].item()) <= 1.0


def test_v65_age_hazard_increases_with_unreplayed_model_time():
    m = make_mem()
    for _ in range(4):
        m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=0.2)
    valid = torch.nonzero(m.replay_valid > 0.5, as_tuple=False).flatten()
    m.replay_last_replayed_v65[valid] = 0.0
    m.model_time_v65.fill_(2.0)
    old_scores = m._replay_scores_v65(valid).detach().clone()
    m.model_time_v65.fill_(20.0)
    new_scores = m._replay_scores_v65(valid).detach().clone()
    assert torch.all(new_scores >= old_scores)
    assert float((new_scores - old_scores).mean().item()) > 0.0


def test_v65_novelty_preserves_rare_replay_priority():
    m = make_mem()
    base = F.normalize(torch.randn(6), dim=0)
    m.write(base, torch.ones(6), strength=1.0, surprise=0.2)
    for _ in range(5):
        m.write(F.normalize(base + 0.01 * torch.randn(6), dim=0), torch.ones(6), strength=1.0, surprise=0.2)
    rare = F.normalize(torch.randn(6), dim=0)
    m.write(rare, -torch.ones(6), strength=1.0, surprise=1.0)
    valid = torch.nonzero(m.replay_valid > 0.5, as_tuple=False).flatten()
    scores = m._replay_scores_v65(valid)
    rare_idx = valid[torch.argmax(m.replay_novelty_v65[valid])]
    assert float(scores[(valid == rare_idx).nonzero(as_tuple=False)[0, 0]].item()) >= float(scores.mean().item())


def test_v65_anchor_is_retention_reference_not_active_read_path():
    m = make_mem()
    q = F.normalize(torch.randn(6), dim=0)
    y = F.normalize(torch.randn(6), dim=0)
    m.write(q, y, strength=1.0, surprise=1.0)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    m.consolidate(opt, steps=1)
    before = m.retrieve(q.view(1, -1))["semantic_read"].detach()
    with torch.no_grad():
        m.semantic_anchor_value_v65.add_(0.5)
    after = m.retrieve(q.view(1, -1))["semantic_read"].detach()
    assert torch.allclose(before, after)
    assert bool(m.semantic_anchor_valid_v65.any())


def test_v65_stability_penalty_has_real_gradient_effect():
    m = make_mem()
    q = F.normalize(torch.randn(6), dim=0)
    y = F.normalize(torch.randn(6), dim=0)
    m.write(q, y, strength=1.0, surprise=1.0)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    m.consolidate(opt, steps=1)
    ctx = torch.randn(10)
    m.write(ctx, y, strength=1.0, surprise=1.0)
    parts = m.memory_loss(ctx.view(1, -1), y.view(1, -1))
    assert parts["anchor_retention_v65"].item() >= 0.0
    assert torch.isfinite(parts["loss"])
    opt.zero_grad(set_to_none=True)
    parts["loss"].backward()
    assert m.semantic_key.grad is not None
    assert torch.isfinite(m.semantic_key.grad).all()


def test_v65_long_horizon_writes_and_consolidation():
    m = make_mem(6, semantic_slots=32, replay_size=64)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    base = F.normalize(torch.randn(6), dim=0)
    target = F.normalize(torch.randn(6), dim=0)
    for i in range(96):
        q = F.normalize(base + 0.02 * torch.randn(6), dim=0)
        y = target + 0.03 * torch.randn(6)
        m.write(q, y, strength=1.0, surprise=0.75 if i % 11 == 0 else 0.1)
        if i % 24 == 23:
            stats = m.consolidate(opt, steps=1)
            assert stats["steps"] >= 1
    read = m.retrieve(base.view(1, -1))["semantic_read"][0]
    score = float((F.cosine_similarity(read.view(1, -1), target.view(1, -1)).item() + 1) / 2)
    assert torch.isfinite(read).all()
    assert score >= 0.45
    assert int(m.long_horizon_write_count_v65.item()) == 96


def test_v65_runtime_has_single_memory_owner():
    cfg = mobile_v65_config(9)
    model = NeuroWeaveV65(cfg)
    owners = [n for n, _ in model.named_modules() if n.startswith("neural_memory") and "." not in n]
    assert owners == ["neural_memory_v61"]
    assert model.neural_memory_v60 is model.neural_memory_v61
    assert model.neural_memory_v63 is model.neural_memory_v61
    assert model.neural_memory_v64 is model.neural_memory_v61
    runtime = OrganismRuntimeV65(model, OrganismTrainerV65(model))
    out = runtime.step(torch.randn(1, 9))
    assert torch.isfinite(out["v65_model_time"]).all()


def test_v65_checkpoint_roundtrip_persists_long_horizon_state():
    cfg = mobile_v65_config(9)
    model = NeuroWeaveV65(cfg)
    trainer = OrganismTrainerV65(model)
    runtime = OrganismRuntimeV65(model, trainer)
    mem = model.neural_memory_v61
    with torch.no_grad():
        mem.model_time_v65.fill_(123.5)
        mem.anchor_update_count_v65.fill_(11)
        mem.rare_event_replay_count_v65.fill_(17)
        mem.long_horizon_write_count_v65.fill_(91)
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV65.save(Path(f.name), model, trainer, runtime)
        model2 = NeuroWeaveV65(cfg)
        trainer2 = OrganismTrainerV65(model2)
        runtime2 = OrganismRuntimeV65(model2, trainer2)
        RuntimeStateStoreV65.load(Path(f.name), model2, trainer2, runtime2)
        mem2 = model2.neural_memory_v61
        assert abs(float(mem2.model_time_v65.item()) - 123.5) < 1e-5
        assert int(mem2.anchor_update_count_v65.item()) == 11
        assert int(mem2.rare_event_replay_count_v65.item()) == 17
        assert int(mem2.long_horizon_write_count_v65.item()) == 91


def test_v65_parameter_count_is_bounded_for_mobile_profile():
    cfg = mobile_v65_config(9)
    model = NeuroWeaveV65(cfg)
    total = sum(p.numel() for p in model.parameters())
    mem = model.neural_memory_v61
    mem_params = sum(p.numel() for p in mem.parameters())
    assert total < 650_000
    assert mem_params < 60_000


def test_v65_can_migrate_v64_checkpoint_prefix_into_larger_bank():
    from neurocore.v64 import NeuroWeaveV64, OrganismTrainerV64, RuntimeStateStoreV64
    cfg64 = __import__("neurocore.v64", fromlist=["mobile_v64_config"]).mobile_v64_config(9)
    cfg65 = mobile_v65_config(9)
    model64 = NeuroWeaveV64(cfg64)
    with torch.no_grad():
        mem64 = model64.neural_memory_v61
        mem64.semantic_slot_valid_v63[:3] = 1.0
        mem64.semantic_key[:3].copy_(torch.arange(mem64.semantic_key[:3].numel()).view_as(mem64.semantic_key[:3]))
        mem64.replay_valid[:4] = 1.0
    trainer64 = OrganismTrainerV64(model64)
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV64.save(Path(f.name), model64, trainer64, None)
        model65 = NeuroWeaveV65(cfg65)
        trainer65 = OrganismTrainerV65(model65)
        RuntimeStateStoreV65.load(Path(f.name), model65, trainer65, None)
        mem65 = model65.neural_memory_v61
        assert torch.allclose(mem65.semantic_key[:3], mem64.semantic_key[:3])
        assert torch.allclose(mem65.semantic_slot_valid_v63[:3], torch.ones(3))
        assert float(mem65.replay_valid[:4].sum().item()) >= 4.0
