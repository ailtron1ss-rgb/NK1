import tempfile
from pathlib import Path
import torch
import torch.nn.functional as F

from neurocore.v66 import (
    V66Config, mobile_v66_config, CanonicalNeuralMemoryOSV66,
    NeuroWeaveV66, OrganismRuntimeV66, OrganismTrainerV66, RuntimeStateStoreV66,
)


def make_mem(seed=1, semantic_slots=24, replay_size=32):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV66(
        10, key_dim=6, value_dim=6, fast_slots=8, fast_rank=2,
        semantic_slots=semantic_slots, replay_size=replay_size, hidden=18,
        graph_rank=4, graph_topk=min(5, semantic_slots),
    )


def test_v66_transition_field_is_real_and_persistent():
    m = make_mem()
    ys = [F.normalize(torch.randn(6), dim=0) for _ in range(4)]
    for i in range(4):
        m.write(F.normalize(torch.randn(6), dim=0), ys[i], strength=1.0, surprise=0.9)
    assert int(m.semantic_graph_edge_updates_v66.item()) >= 3
    assert float(m.semantic_transition_ema_v66.sum().item()) > 0.0
    assert float(m.semantic_graph_maturity_v66.item()) > 0.0


def test_v66_graph_has_real_gradient_path():
    m = make_mem()
    for _ in range(5):
        m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=0.8)
    out = m.memory_loss(torch.randn(10).view(1, -1), torch.randn(6).view(1, -1))
    assert torch.isfinite(out["graph_topology_v66"])
    assert torch.isfinite(out["loss"])
    out["loss"].backward()
    assert m.semantic_graph_left_v66.grad is not None
    assert torch.isfinite(m.semantic_graph_left_v66.grad).all()


def test_v66_graph_route_changes_active_semantic_read():
    m = make_mem()
    q1 = F.normalize(torch.randn(6), dim=0)
    q2 = F.normalize(torch.randn(6), dim=0)
    v1 = F.normalize(torch.randn(6), dim=0)
    v2 = F.normalize(torch.randn(6), dim=0)
    m.write(q1, v1, strength=1.0, surprise=1.0)
    m.write(q2, v2, strength=1.0, surprise=1.0)
    m.semantic_graph_maturity_v66.fill_(1.0)
    with torch.no_grad():
        m.semantic_graph_gain_logit_v66.fill_(6.0)
        valid = m.semantic_slot_valid_v63 > 0.5
        slots = torch.nonzero(valid, as_tuple=False).flatten()
        a, b = int(slots[0]), int(slots[-1])
        m.semantic_transition_ema_v66.zero_()
        m.semantic_transition_mass_v66.zero_()
        m.semantic_transition_ema_v66[a, b] = 1.0
        m.semantic_transition_mass_v66[a] = 1.0
    ab = m.graph_ablation(q1)
    assert ab["graph_maturity"] > 0.9
    assert ab["semantic_read_delta"] > 1e-7


def test_v66_two_hop_graph_is_bounded_and_finite():
    m = make_mem(7, semantic_slots=16, replay_size=24)
    for _ in range(8):
        m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=0.7)
    m.semantic_graph_maturity_v66.fill_(1.0)
    r = m.retrieve(F.normalize(torch.randn(6), dim=0).view(1, -1))["semantic_read"]
    assert torch.isfinite(r).all()
    assert float(r.norm().item()) < 10.0


def test_v66_transfer_aware_replay_prefers_contextually_related_sample():
    m = make_mem(8, semantic_slots=12, replay_size=8)
    with torch.no_grad():
        m.replay_valid.zero_()
        m.replay_valid[:2] = 1.0
        m.replay_priorities[:2] = 1.0
        m.replay_last_replayed_v65[:2] = 0.0
        m.model_time_v65.fill_(20.0)
        current = F.normalize(torch.randn(6), dim=0)
        near = current + 0.01 * torch.randn(6)
        far = -current
        m.current_context_key_v66.copy_(current)
        m.replay_key_v66[0].copy_(F.normalize(near, dim=0))
        m.replay_key_v66[1].copy_(F.normalize(far, dim=0))
    valid = torch.tensor([0, 1], dtype=torch.long)
    scores = m._replay_scores_v66(valid)
    assert scores[0] > scores[1]


def test_v66_topology_loss_has_trainable_learning_signal():
    m = make_mem(12, semantic_slots=12, replay_size=16)
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    # Create a directed pattern repeatedly so the empirical successor target is nontrivial.
    for _ in range(18):
        m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=0.9)
    before = float(m._graph_topology_loss_v66()[0].item())
    for _ in range(4):
        parts = m.memory_loss(torch.randn(10).view(1, -1), torch.randn(6).view(1, -1))
        opt.zero_grad(set_to_none=True)
        parts['loss'].backward()
        torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0)
        opt.step()
    after = float(m._graph_topology_loss_v66()[0].item())
    assert torch.isfinite(torch.tensor(before)) and torch.isfinite(torch.tensor(after))
    assert after <= before + 1e-4
    # The exact magnitude is not assumed, but the graph parameters receive a real gradient.
    assert m.semantic_graph_left_v66.grad is not None
    assert float(m.semantic_graph_left_v66.grad.norm().item()) > 0.0


def test_v66_memory_loss_combines_topology_without_second_memory_owner():
    m = make_mem()
    for _ in range(6):
        m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=0.6)
    parts = m.memory_loss(torch.randn(10).view(1, -1), torch.randn(6).view(1, -1))
    assert "graph_successor_v66" in parts
    assert "graph_transition_v66" in parts
    assert float(parts["graph_entropy_v66"].item()) >= 0.0
    assert torch.isfinite(parts["loss"])


def test_v66_runtime_has_single_canonical_memory_owner():
    cfg = mobile_v66_config(9)
    model = NeuroWeaveV66(cfg)
    owners = [n for n, _ in model.named_modules() if n.startswith("neural_memory") and "." not in n]
    assert owners == ["neural_memory_v61"]
    assert model.neural_memory_v65 is model.neural_memory_v61
    runtime = OrganismRuntimeV66(model, OrganismTrainerV66(model))
    out = runtime.step(torch.randn(1, 9))
    assert torch.isfinite(out["v66_graph_maturity"]).all()


def test_v66_checkpoint_roundtrip_persists_graph_state():
    cfg = mobile_v66_config(9)
    model = NeuroWeaveV66(cfg)
    trainer = OrganismTrainerV66(model)
    runtime = OrganismRuntimeV66(model, trainer)
    mem = model.neural_memory_v61
    with torch.no_grad():
        mem.semantic_graph_maturity_v66.fill_(0.73)
        mem.semantic_graph_edge_updates_v66.fill_(41)
        mem.transfer_replay_count_v66.fill_(12)
        mem.semantic_transition_ema_v66[0, 1] = 0.9
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV66.save(Path(f.name), model, trainer, runtime)
        model2 = NeuroWeaveV66(cfg)
        trainer2 = OrganismTrainerV66(model2)
        runtime2 = OrganismRuntimeV66(model2, trainer2)
        RuntimeStateStoreV66.load(Path(f.name), model2, trainer2, runtime2)
        mem2 = model2.neural_memory_v61
        assert abs(float(mem2.semantic_graph_maturity_v66.item()) - 0.73) < 1e-5
        assert int(mem2.semantic_graph_edge_updates_v66.item()) == 41
        assert int(mem2.transfer_replay_count_v66.item()) == 12
        assert abs(float(mem2.semantic_transition_ema_v66[0, 1].item()) - 0.9) < 1e-5


def test_v66_parameter_budget_is_mobile_bounded():
    cfg = mobile_v66_config(9)
    model = NeuroWeaveV66(cfg)
    total = sum(p.numel() for p in model.parameters())
    mem = model.neural_memory_v61
    mem_params = sum(p.numel() for p in mem.parameters())
    assert total < 700_000
    assert mem_params < 70_000


def test_v66_runtime_diagnostics_are_finite_after_longish_stream():
    m = make_mem(11, semantic_slots=24, replay_size=32)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    for i in range(40):
        m.write(F.normalize(torch.randn(6), dim=0), F.normalize(torch.randn(6), dim=0), strength=1.0, surprise=0.9 if i % 7 == 0 else 0.15)
        if i % 10 == 9:
            m.consolidate(opt, steps=1)
    d = m.diagnostics()
    for key in ("v66_graph_maturity", "v66_graph_route_effect", "v66_transfer_signal", "v66_graph_edge_mass"):
        assert torch.isfinite(d[key]).all()
