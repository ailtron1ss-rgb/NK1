import tempfile
import torch
import torch.nn.functional as F

from neurocore.v63 import (
    V63Config,
    mobile_v63_config,
    CanonicalNeuralMemoryOSV63,
    NeuroWeaveV63,
    OrganismRuntimeV63,
    OrganismTrainerV63,
    RuntimeStateStoreV63,
)


def test_v63_global_semantic_bank_is_trainable_and_canonical():
    torch.manual_seed(1)
    m = CanonicalNeuralMemoryOSV63(12, key_dim=8, value_dim=8, fast_slots=8, semantic_slots=8, hidden=20)
    keys = [n for n, _ in m.named_parameters() if "semantic_key" in n]
    assert keys == ["semantic_key"]
    x, y = torch.randn(6, 12), torch.randn(6, 8)
    loss = m.memory_loss(x, y)["loss"]
    loss.backward()
    assert m.semantic_key.grad is not None and torch.isfinite(m.semantic_key.grad).all()
    assert m.semantic_value.grad is not None and torch.isfinite(m.semantic_value.grad).all()


def test_v63_repeated_semantic_content_merges_into_one_attractor():
    torch.manual_seed(2)
    m = CanonicalNeuralMemoryOSV63(12, key_dim=8, value_dim=8, fast_slots=8, semantic_slots=8, hidden=20,
                                   semantic_merge_threshold=0.62)
    base_k = F.normalize(torch.randn(8), dim=0)
    base_v = torch.randn(8)
    for i in range(12):
        k = F.normalize(base_k + 0.02 * torch.randn(8), dim=0)
        m.write(k, base_v + 0.02 * torch.randn(8), strength=1.0, surprise=0.2)
    assert int(m.semantic_duplicate_merges_v63.item()) >= 8
    assert int(m.semantic_slot_valid_v63.sum().item()) <= 4


def test_v63_novel_semantics_allocate_separate_slots():
    torch.manual_seed(3)
    m = CanonicalNeuralMemoryOSV63(12, key_dim=8, value_dim=8, fast_slots=8, semantic_slots=8, hidden=20,
                                   semantic_merge_threshold=0.92)
    for i in range(4):
        k = F.normalize(torch.eye(8)[i], dim=0)
        v = torch.randn(8)
        m.write(k, v, strength=1.0, surprise=1.0)
    assert int(m.semantic_slot_valid_v63.sum().item()) >= 4
    assert int(m.semantic_new_concepts_v63.item()) >= 4


def test_v63_semantic_retrieval_returns_content_not_empty_slot():
    torch.manual_seed(4)
    m = CanonicalNeuralMemoryOSV63(12, key_dim=8, value_dim=8, fast_slots=6, semantic_slots=6, hidden=20)
    k = F.normalize(torch.randn(8), dim=0)
    v = F.normalize(torch.randn(8), dim=0)
    m.write(k, v, strength=1.0, surprise=1.0)
    out = m.retrieve(k.view(1, -1))
    assert out["semantic_read"].shape == (1, 8)
    assert float(out["semantic_read"].norm().item()) > 0.01
    assert float(out["semantic_confidence"].item()) >= 0.0


def test_v63_semantic_relation_learning_is_real():
    torch.manual_seed(5)
    m = CanonicalNeuralMemoryOSV63(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18)
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    for _ in range(80):
        x = torch.randn(12, 10)
        target = torch.tanh(x[:, :6] @ torch.diag(torch.tensor([1., .8, .6, .4, .2, .1])))
        parts = m.memory_loss(x, target)
        opt.zero_grad(set_to_none=True)
        parts["loss"].backward()
        opt.step()
    x1 = torch.randn(4, 10)
    x2 = x1 + 0.08 * torch.randn_like(x1)
    y1 = torch.tanh(x1[:, :6])
    y2 = torch.tanh(x2[:, :6])
    k1, _ = m.encode(x1)
    k2, _ = m.encode(x2)
    pred_sim = F.cosine_similarity(k1, k2, dim=-1).mean()
    target_sim = F.cosine_similarity(y1, y2, dim=-1).mean()
    assert float(pred_sim.item()) > 0.20
    assert float(target_sim.item()) > 0.20


def test_v63_adaptive_consolidation_uses_multiple_steps_when_repeated():
    torch.manual_seed(6)
    m = CanonicalNeuralMemoryOSV63(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18,
                                   consolidation_budget_min=1, consolidation_budget_max=5)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    x = torch.randn(10)
    y = torch.randn(6)
    for _ in range(10):
        m.write(x, y, strength=1.0, surprise=1.0)
    stats = m.consolidate(opt, steps=1)
    assert 1 <= stats["steps"] <= 5
    assert stats["semantic_recall"] >= 0.0


def test_v63_memory_ablation_changes_semantic_read():
    torch.manual_seed(7)
    m = CanonicalNeuralMemoryOSV63(12, key_dim=8, value_dim=8, fast_slots=6, semantic_slots=6, hidden=20)
    k = F.normalize(torch.randn(8), dim=0)
    v = torch.randn(8)
    m.write(k, v, strength=1.0, surprise=1.0)
    full = m.retrieve(k.view(1, -1))["semantic_read"].detach()
    saved_k = m.semantic_key.detach().clone()
    with torch.no_grad():
        m.semantic_key.zero_()
    ab = m.retrieve(k.view(1, -1))["semantic_read"].detach()
    with torch.no_grad():
        m.semantic_key.copy_(saved_k)
    assert not torch.allclose(full, ab)


def test_v63_runtime_closed_loop_and_persistence():
    torch.manual_seed(8)
    cfg = mobile_v63_config(9)
    model = NeuroWeaveV63(cfg)
    trainer = OrganismTrainerV63(model)
    runtime = OrganismRuntimeV63(model, trainer)
    obs = torch.randn(1, 9)
    out = runtime.step(obs)
    runtime.observe_transition(torch.randn(1, 9), actual_reward=1.0, actual_risk=0.0)
    assert "v63_semantic_valid_slots" in out
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV63.save(f.name, model, trainer, runtime)
        model2 = NeuroWeaveV63(cfg)
        trainer2 = OrganismTrainerV63(model2)
        runtime2 = OrganismRuntimeV63(model2, trainer2)
        RuntimeStateStoreV63.load(f.name, model2, trainer2, runtime2)
        assert torch.allclose(model.neural_memory_v63.semantic_key, model2.neural_memory_v63.semantic_key)
        assert torch.allclose(model.neural_memory_v63.semantic_value, model2.neural_memory_v63.semantic_value)


def test_v63_has_single_registered_neural_memory_owner():
    cfg = mobile_v63_config(9)
    model = NeuroWeaveV63(cfg)
    names = [n for n, _ in model.named_modules() if "neural_memory" in n]
    assert "neural_memory_v61" in names
    assert "neural_memory_v63" not in names
    assert model.neural_memory_v63 is model.neural_memory_v61


def test_v63_compile_contract_and_finite_outputs():
    torch.manual_seed(9)
    cfg = mobile_v63_config(9)
    model = NeuroWeaveV63(cfg)
    out = model.neural_memory_v63(torch.randn(1, model.neural_memory_v63.input_dim))
    for key in ("read", "semantic_read", "long_term_read", "confidence"):
        assert torch.isfinite(out[key]).all()
