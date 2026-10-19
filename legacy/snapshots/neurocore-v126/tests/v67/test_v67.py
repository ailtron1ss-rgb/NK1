import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v66 import mobile_v66_config, NeuroWeaveV66, OrganismTrainerV66, OrganismRuntimeV66, RuntimeStateStoreV66
from neurocore.v67 import (
    V67Config,
    mobile_v67_config,
    CanonicalNeuralMemoryOSV67,
    NeuroWeaveV67,
    OrganismRuntimeV67,
    OrganismTrainerV67,
    RuntimeStateStoreV67,
)


def make_mem(seed=1, semantic_slots=24, replay_size=32):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV67(
        10, key_dim=6, value_dim=6, fast_slots=8, fast_rank=2,
        semantic_slots=semantic_slots, replay_size=replay_size, hidden=18,
        graph_rank=4, graph_topk=min(5, semantic_slots),
        structural_rank=4, structural_topk=min(3, semantic_slots - 1),
    )


def test_v67_repeat_evidence_controls_structural_activation():
    m = make_mem()
    with torch.no_grad():
        m.semantic_slot_valid_v63[:2] = 1.0
        for _ in range(2):
            m._record_structural_transition_v67(0, 1, 1.0)
        m._update_structural_topology_v67()
        assert float(m.semantic_structural_mask_v67[0, 1].item()) == 0.0
        m._record_structural_transition_v67(0, 1, 1.0)
        m._update_structural_topology_v67()
        assert float(m.semantic_structural_repeat_v67[0, 1].item()) >= 3.0
        assert float(m.semantic_structural_mask_v67[0, 1].item()) == 1.0


def test_v67_growth_prune_and_rewire_state_is_real():
    m = make_mem(2)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1.0
        for _ in range(4):
            m._record_structural_transition_v67(0, 1, 1.0)
        m._update_structural_topology_v67()
        grew = int(m.semantic_structural_growth_count_v67.item())
        assert grew >= 1
        m.semantic_structural_repeat_v67[0, 1] = 0.0
        m.semantic_structural_utility_v67[0, 1] = 0.0
        m.semantic_structural_last_seen_v67[0, 1] = -1.0
        m._update_structural_topology_v67()
        assert int(m.semantic_structural_prune_count_v67.item()) >= 1
        assert m.semantic_structural_mask_v67[0, 1].item() == 0.0


def test_v67_structural_route_has_causal_effect():
    m = make_mem(3)
    q = F.normalize(torch.randn(6), dim=0)
    t = F.normalize(torch.randn(6), dim=0)
    m.write(q, t, strength=1.0, surprise=1.0)
    m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=1.0)
    with torch.no_grad():
        valid = torch.nonzero(m.semantic_slot_valid_v63 > 0.5, as_tuple=False).flatten()
        a, b = int(valid[0]), int(valid[1])
        m.semantic_structural_mask_v67.zero_()
        m.semantic_structural_mask_v67[a, b] = 1.0
        m.semantic_structural_repeat_v67[a, b] = 5.0
        m.semantic_structural_utility_v67[a, b] = 1.0
        m.semantic_structural_maturity_v67.fill_(1.0)
        m.semantic_structural_gain_logit_v67.fill_(6.0)
    out = m.structural_ablation(q)
    assert out["active_edges"] >= 1.0
    assert out["structural_maturity"] > 0.9
    assert out["semantic_read_delta"] > 1e-8


def test_v67_pattern_separation_is_trainable():
    m = make_mem(4, semantic_slots=12)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1.0
        m.semantic_key[:3] = torch.tensor([[1., 0., 0., 0., 0., 0.], [0.98, .02, 0, 0, 0, 0], [0, 1., 0, 0, 0, 0]])
        m.semantic_value[:3] = torch.randn(3, 6)
    before = float(m._pattern_separation_loss_v67().item())
    parts = m.memory_loss(torch.randn(10).view(1, -1), torch.randn(6).view(1, -1))
    parts["loss"].backward()
    assert torch.isfinite(parts["structural_pattern_separation_v67"])
    assert before > 0.0
    assert m.semantic_key.grad is not None
    assert m.semantic_structural_left_v67.grad is not None


def test_v67_bidirectional_signal_is_finite_and_present():
    m = make_mem(5)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1.0
        m.semantic_structural_mask_v67[0, 1] = 1.0
        m.semantic_structural_mask_v67[1, 2] = 1.0
    x = m._bidirectional_structure_loss_v67()
    assert torch.isfinite(x)
    p = m.memory_loss(torch.randn(10).view(1, -1), torch.randn(6).view(1, -1))
    assert "structural_bidirectional_v67" in p


def test_v67_write_records_multiple_batch_edges_without_self_only():
    m = make_mem(6)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1.0
        m.semantic_key[:3] = torch.eye(6)[:3]
    keys = torch.stack([torch.eye(6)[0], torch.eye(6)[1], torch.eye(6)[2]])
    vals = torch.stack([torch.eye(6)[0], torch.eye(6)[1], torch.eye(6)[2]])
    m.write(keys, vals, strength=1.0, surprise=0.8)
    assert float(m.semantic_structural_repeat_v67.sum().item()) >= 2.0


def test_v67_mobile_runtime_has_single_canonical_owner():
    cfg = mobile_v67_config(9)
    model = NeuroWeaveV67(cfg)
    owners = [n for n, _ in model.named_modules() if n.startswith("neural_memory") and "." not in n]
    assert owners == ["neural_memory_v61"]
    assert model.neural_memory_v66 is model.neural_memory_v61
    runtime = OrganismRuntimeV67(model, OrganismTrainerV67(model))
    out = runtime.step(torch.randn(1, 9))
    for k in ("v67_structural_maturity", "v67_structural_active_edges", "v67_structural_route_effect"):
        assert torch.isfinite(out[k]).all()


def test_v67_checkpoint_migrates_from_v66():
    cfg66 = mobile_v66_config(9)
    model66 = NeuroWeaveV66(cfg66)
    trainer66 = OrganismTrainerV66(model66)
    runtime66 = OrganismRuntimeV66(model66, trainer66)
    mem66 = model66.neural_memory_v61
    with torch.no_grad():
        mem66.semantic_graph_maturity_v66.fill_(0.61)
        mem66.semantic_key[0].copy_(F.normalize(torch.randn(mem66.key_dim), dim=0))
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV66.save(Path(f.name), model66, trainer66, runtime66)
        cfg67 = mobile_v67_config(9)
        model67 = NeuroWeaveV67(cfg67)
        trainer67 = OrganismTrainerV67(model67)
        runtime67 = OrganismRuntimeV67(model67, trainer67)
        RuntimeStateStoreV67.load(Path(f.name), model67, trainer67, runtime67)
        mem67 = model67.neural_memory_v61
        assert torch.allclose(mem67.semantic_key[0], mem66.semantic_key[0], atol=1e-6)
        assert abs(float(mem67.semantic_graph_maturity_v66.item()) - 0.61) < 1e-6
        assert float(mem67.semantic_structural_mask_v67.sum().item()) == 0.0


def test_v67_parameter_budget_and_finite_diagnostics():
    cfg = mobile_v67_config(9)
    model = NeuroWeaveV67(cfg)
    total = sum(p.numel() for p in model.parameters())
    assert total < 700_000
    mem = model.neural_memory_v61
    assert sum(p.numel() for p in mem.parameters()) < 80_000
    d = mem.diagnostics()
    for k in ("v67_structural_maturity", "v67_structural_active_edges", "v67_repeat_mass", "v67_pattern_separation_loss"):
        assert torch.isfinite(d[k]).all()


def test_v67_longish_stream_stays_finite_and_structural_state_moves():
    m = make_mem(9, semantic_slots=24, replay_size=32)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    anchors = [F.normalize(torch.randn(6), dim=0) for _ in range(5)]
    targets = [F.normalize(torch.randn(6), dim=0) for _ in range(5)]
    for i in range(50):
        j = i % 5
        m.write(anchors[j] + 0.02 * torch.randn(6), targets[j], strength=1.0, surprise=0.6 if i % 7 == 0 else 0.1)
        if i % 10 == 9:
            m.consolidate(opt, steps=1)
    d = m.diagnostics()
    assert torch.isfinite(d["v67_structural_maturity"]).all()
    assert float(d["v67_repeat_mass"].item()) > 0.0


def test_v67_graph_and_pattern_ablation_are_not_decorative():
    m = make_mem(10)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1.0
        m.semantic_key[:3] = F.normalize(torch.randn(3, 6), dim=-1)
        m.semantic_structural_mask_v67[0, 1] = 1.0
        m.semantic_structural_mask_v67[1, 2] = 1.0
        m.semantic_structural_repeat_v67[0, 1] = 6.0
        m.semantic_structural_repeat_v67[1, 2] = 6.0
        m.semantic_structural_utility_v67[0, 1] = 1.0
        m.semantic_structural_utility_v67[1, 2] = 1.0
        m.semantic_structural_maturity_v67.fill_(1.0)
        m.semantic_graph_maturity_v66.fill_(1.0)
        m.semantic_structural_gain_logit_v67.fill_(6.0)
    q = m.semantic_key[0].detach()
    ab = m.structural_ablation(q)
    assert max(ab["semantic_read_delta"], ab["semantic_weight_delta"]) > 1e-8
    loss = m._pattern_separation_loss_v67()
    assert torch.isfinite(loss)
