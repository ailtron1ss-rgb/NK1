import tempfile
import torch
import torch.nn.functional as F

from neurocore.v64 import (
    V64Config,
    mobile_v64_config,
    CanonicalNeuralMemoryOSV64,
    NeuroWeaveV64,
    OrganismRuntimeV64,
    OrganismTrainerV64,
    RuntimeStateStoreV64,
    Memory100GateV64,
)


def test_v64_relation_parameters_are_real_and_separate_from_v63_temperature():
    torch.manual_seed(1)
    m = CanonicalNeuralMemoryOSV64(12, key_dim=8, value_dim=8, fast_slots=8, semantic_slots=8, hidden=20)
    assert m.semantic_relation_left.requires_grad
    assert m.semantic_relation_right.requires_grad
    assert m.semantic_relation_temperature_v64 is not m.semantic_temperature_v63
    names = [n for n, _ in m.named_parameters()]
    assert "semantic_relation_left" in names and "semantic_relation_right" in names
    assert "semantic_relation_temperature_v64_logit" in names


def test_v64_relation_path_has_causal_effect_after_maturity():
    torch.manual_seed(2)
    m = CanonicalNeuralMemoryOSV64(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18)
    k1 = F.normalize(torch.randn(6), dim=0)
    k2 = F.normalize(k1 + 0.12 * torch.randn(6), dim=0)
    v1 = F.normalize(torch.randn(6), dim=0)
    v2 = F.normalize(torch.randn(6), dim=0)
    m.write(k1, v1, strength=1.0, surprise=1.0)
    m.write(k2, v2, strength=1.0, surprise=1.0)
    with torch.no_grad():
        m.semantic_relation_left.zero_()
        m.semantic_relation_right.zero_()
        m.semantic_relation_maturity_v64.fill_(1.0)
        m.semantic_relation_gain_logit.fill_(2.0)
    q = k1.view(1, -1)
    full = m.retrieve(q)["semantic_read"].detach()
    with torch.no_grad():
        saved = m.semantic_relation_maturity_v64.clone()
        m.semantic_relation_maturity_v64.zero_()
    ablated = m.retrieve(q)["semantic_read"].detach()
    with torch.no_grad():
        m.semantic_relation_maturity_v64.copy_(saved)
    assert not torch.allclose(full, ablated)


def test_v64_repeated_semantics_merge_and_novel_semantics_allocate():
    torch.manual_seed(3)
    m = CanonicalNeuralMemoryOSV64(12, key_dim=8, value_dim=8, fast_slots=8, semantic_slots=8, hidden=20,
                                   semantic_merge_threshold=0.62)
    base_k = F.normalize(torch.randn(8), dim=0)
    base_v = torch.randn(8)
    for _ in range(12):
        m.write(F.normalize(base_k + 0.02 * torch.randn(8), dim=0),
                base_v + 0.02 * torch.randn(8), strength=1.0, surprise=0.2)
    assert int(m.semantic_duplicate_merges_v63.item()) >= 8
    assert int(m.semantic_slot_valid_v63.sum().item()) <= 4


def test_v64_conflicting_write_can_split_instead_of_overwriting():
    torch.manual_seed(4)
    m = CanonicalNeuralMemoryOSV64(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18,
                                   semantic_merge_threshold=0.55, conflict_split_threshold=0.10)
    k = F.normalize(torch.randn(6), dim=0)
    m.write(k, torch.ones(6), strength=1.0, surprise=1.0)
    m.write(k, -torch.ones(6), strength=1.0, surprise=1.0)
    assert int(m.semantic_conflict_split_count_v64.item()) >= 1


def test_v64_importance_traces_are_updated_by_real_gradients():
    torch.manual_seed(5)
    m = CanonicalNeuralMemoryOSV64(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18)
    m.write(torch.randn(10), torch.randn(6), strength=1.0, surprise=1.0)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    before = m.semantic_key_importance_v64.clone()
    parts = m.memory_loss(torch.randn(4, 10), torch.randn(4, 6))
    opt.zero_grad(set_to_none=True)
    parts["loss"].backward()
    m._record_importance_from_gradients()
    assert torch.isfinite(m.semantic_key_importance_v64).all()
    assert not torch.allclose(before, m.semantic_key_importance_v64)


def test_v64_consolidation_reduces_or_preserves_loss_and_updates_maturity():
    torch.manual_seed(6)
    m = CanonicalNeuralMemoryOSV64(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18,
                                   consolidation_budget_min=1, consolidation_budget_max=3)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    x = torch.randn(10)
    y = torch.randn(6)
    for _ in range(10):
        m.write(x, y, strength=1.0, surprise=1.0)
    pre = float(m.memory_loss(x.view(1, -1), y.view(1, -1))["loss"].item())
    stats = m.consolidate(opt, steps=1)
    post = float(m.memory_loss(x.view(1, -1), y.view(1, -1))["loss"].item())
    assert 1 <= stats["steps"] <= 3
    assert torch.isfinite(torch.tensor(post))
    assert float(m.semantic_relation_maturity_v64.item()) >= 0.0
    assert post <= pre + 0.35


def test_v64_verified_reconsolidation_changes_canonical_content():
    torch.manual_seed(7)
    m = CanonicalNeuralMemoryOSV64(10, key_dim=6, value_dim=6, fast_slots=8, semantic_slots=8, hidden=18)
    q = F.normalize(torch.randn(6), dim=0)
    old = F.normalize(torch.randn(6), dim=0)
    new = F.normalize(torch.randn(6), dim=0)
    m.write(q, old, strength=1.0, surprise=1.0)
    before = m.semantic_value.detach().clone()
    out = m.reconsolidate(q.view(1, -1), new.view(1, -1), confidence=1.0)
    after = m.semantic_value.detach().clone()
    assert out["updated_slots"] >= 1.0
    assert not torch.allclose(before, after)
    assert int(m.semantic_verified_update_count_v64.item()) >= 1


def test_v64_single_registered_memory_owner_and_runtime_loop():
    torch.manual_seed(8)
    cfg = mobile_v64_config(9)
    model = NeuroWeaveV64(cfg)
    names = [n for n, _ in model.named_modules() if "neural_memory" in n]
    assert "neural_memory_v61" in names
    assert "neural_memory_v63" not in names
    assert model.neural_memory_v63 is model.neural_memory_v61
    trainer = OrganismTrainerV64(model)
    runtime = OrganismRuntimeV64(model, trainer)
    out = runtime.step(torch.randn(1, 9))
    assert "v64_relation_maturity" in out
    assert torch.isfinite(out["v64_relation_maturity"]).all()


def test_v64_checkpoint_roundtrip_persists_new_state():
    torch.manual_seed(9)
    cfg = mobile_v64_config(9)
    model = NeuroWeaveV64(cfg)
    trainer = OrganismTrainerV64(model)
    runtime = OrganismRuntimeV64(model, trainer)
    with torch.no_grad():
        model.neural_memory_v61.semantic_relation_maturity_v64.fill_(0.73)
        model.neural_memory_v61.semantic_reconsolidation_count_v64.fill_(4)
        model.neural_memory_v61.semantic_verified_update_count_v64.fill_(7)
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV64.save(f.name, model, trainer, runtime)
        model2 = NeuroWeaveV64(cfg)
        trainer2 = OrganismTrainerV64(model2)
        runtime2 = OrganismRuntimeV64(model2, trainer2)
        RuntimeStateStoreV64.load(f.name, model2, trainer2, runtime2)
        mem2 = model2.neural_memory_v61
        assert torch.allclose(mem2.semantic_relation_maturity_v64, torch.tensor(0.73), atol=1e-5)
        assert int(mem2.semantic_reconsolidation_count_v64.item()) == 4
        assert int(mem2.semantic_verified_update_count_v64.item()) == 7


def test_v64_mobile_outputs_are_finite_and_gate_is_mechanistic():
    torch.manual_seed(10)
    cfg = mobile_v64_config(9)
    mem = CanonicalNeuralMemoryOSV64(
        input_dim=cfg.latent_dim_v46 + cfg.d + cfg.memory_value_dim_v55 + cfg.drive_dim_v57,
        key_dim=cfg.neural_memory_key_dim_v61,
        value_dim=cfg.neural_memory_value_dim_v61,
        fast_slots=cfg.neural_memory_fast_slots_v61,
        fast_rank=cfg.neural_memory_fast_rank_v61,
        semantic_slots=cfg.neural_memory_semantic_slots_v61,
        semantic_rank=cfg.neural_memory_semantic_rank_v61,
        hidden=cfg.neural_memory_hidden_v61,
        temperature=cfg.neural_memory_temperature_v61,
        fast_decay=cfg.neural_memory_fast_decay_v61,
        semantic_decay=cfg.neural_memory_semantic_decay_v61,
        replay_size=cfg.neural_memory_replay_size_v61,
        autobiographical_decay=cfg.neural_memory_autobio_decay_v61,
        procedural_decay=cfg.neural_memory_procedural_decay_v61,
        topk=cfg.neural_memory_topk_v61,
        long_term_hidden=cfg.neural_memory_long_term_hidden_v61,
        long_term_layers=cfg.neural_memory_long_term_layers_v61,
        long_term_mix=cfg.neural_memory_long_term_mix_v61,
        router_hidden=cfg.neural_memory_router_hidden_v61,
        router_temperature=cfg.neural_memory_router_temperature_v61,
        conflict_threshold=cfg.neural_memory_conflict_threshold_v61,
        types=cfg.neural_memory_types_v62,
        type_dim=cfg.neural_memory_type_dim_v62,
        typed_semantic_slots=cfg.neural_memory_typed_semantic_slots_v62,
        hopfield_steps=cfg.neural_memory_hopfield_steps_v62,
        hopfield_beta=cfg.neural_memory_hopfield_beta_v62,
        hopfield_residual=cfg.neural_memory_hopfield_residual_v62,
        energy_replay_weight=cfg.neural_memory_energy_replay_weight_v62,
        consolidation_gate=cfg.neural_memory_consolidation_gate_v62,
        protection=cfg.neural_memory_protection_v62,
        conflict_replay_weight=cfg.neural_memory_conflict_replay_weight_v62,
        replay_priority_floor=cfg.neural_memory_replay_priority_floor_v62,
        semantic_merge_threshold=cfg.neural_semantic_merge_threshold_v63,
        semantic_update_floor=cfg.neural_semantic_update_floor_v63,
        semantic_max_update=cfg.neural_semantic_max_update_v63,
        semantic_similarity_weight=cfg.neural_semantic_similarity_weight_v63,
        semantic_reconstruction_weight=cfg.neural_semantic_reconstruction_weight_v63,
        semantic_contrastive_weight=cfg.neural_semantic_contrastive_weight_v63,
        semantic_conflict_weight=cfg.neural_semantic_conflict_weight_v63,
        consolidation_budget_min=cfg.neural_semantic_consolidation_budget_min_v63,
        consolidation_budget_max=cfg.neural_semantic_consolidation_budget_max_v63,
        relation_rank=cfg.neural_semantic_relation_rank_v64,
    )
    opt = torch.optim.AdamW(mem.parameters(), lr=1e-3)
    gate = Memory100GateV64(mem, opt)
    mem.write(F.normalize(torch.randn(mem.key_dim), dim=0), F.normalize(torch.randn(mem.value_dim), dim=0), strength=1.0, surprise=1.0)
    result = gate.run(seed=10)
    assert all(torch.isfinite(torch.tensor(result[k])) for k in gate.REQUIRED)
    assert 0.0 <= result["gate_percent"] <= 100.0
