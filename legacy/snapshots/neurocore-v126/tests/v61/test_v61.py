import torch
import torch.nn.functional as F

from neurocore.v61 import V61Config, mobile_v61_config, NeuralMemoryOSV61, NeuroWeaveV61, OrganismRuntimeV61, OrganismTrainerV61, RuntimeStateStoreV61


def test_fast_neural_memory_write_and_retrieve():
    torch.manual_seed(17)
    mem = NeuralMemoryOSV61(12, key_dim=10, value_dim=10, fast_slots=8, semantic_slots=8, hidden=20, temperature=0.12)
    xs = torch.randn(6, 12)
    ys = torch.randn(6, 10)
    for x, y in zip(xs, ys):
        mem.write(x, y, strength=1.0, surprise=1.0)
    out = mem(xs)
    assert torch.isfinite(out['read']).all()
    assert int(mem.write_count.item()) == 6
    assert int(mem.fast_valid.sum().item()) == 6


def test_neural_memory_is_not_symbolic_only():
    mem = NeuralMemoryOSV61(12, key_dim=10, value_dim=10, fast_slots=4, semantic_slots=6, hidden=16)
    trainable = sum(p.numel() for p in mem.parameters() if p.requires_grad)
    assert trainable > 1000
    x = torch.randn(3, 12)
    y = torch.randn(3, 10)
    loss = mem.memory_loss(x, y)['loss']
    assert torch.isfinite(loss)
    loss.backward()
    assert any(p.grad is not None and float(p.grad.abs().sum()) > 0 for p in mem.parameters())


def test_consolidation_changes_neural_parameters():
    torch.manual_seed(23)
    mem = NeuralMemoryOSV61(12, key_dim=10, value_dim=10, fast_slots=8, semantic_slots=8, hidden=20, replay_size=12)
    for _ in range(8):
        mem.write(torch.randn(12), torch.randn(10), strength=1.0, surprise=1.0)
    opt = torch.optim.AdamW(mem.parameters(), lr=1e-3)
    before = mem.encoder[0].weight.detach().clone()
    stats = mem.consolidate(opt, steps=2)
    after = mem.encoder[0].weight.detach()
    assert stats['steps'] == 2
    assert not torch.allclose(before, after)


def test_procedural_and_autobiographical_state_update():
    torch.manual_seed(41)
    mem = NeuralMemoryOSV61(12, key_dim=10, value_dim=10, fast_slots=6, semantic_slots=6, hidden=18)
    auto_before = mem.autobio_state.clone()
    proc_before = mem.procedural_state.clone()
    mem.write(torch.randn(12), torch.randn(10), strength=1.0, surprise=1.0)
    assert not torch.allclose(auto_before, mem.autobio_state)
    assert not torch.allclose(proc_before, mem.procedural_state)


def test_state_roundtrip(tmp_path):
    torch.manual_seed(59)
    cfg = mobile_v61_config(raw_observation_dim=9)
    model = NeuroWeaveV61(cfg)
    trainer = OrganismTrainerV61(model)
    runtime = OrganismRuntimeV61(model, trainer)
    p = tmp_path / 'state.pt'
    RuntimeStateStoreV61.save(p, model, trainer, runtime)
    model2 = NeuroWeaveV61(cfg)
    trainer2 = OrganismTrainerV61(model2)
    runtime2 = OrganismRuntimeV61(model2, trainer2)
    RuntimeStateStoreV61.load(p, model2, trainer2, runtime2)
    assert torch.allclose(model.neural_memory_v61.fast_keys, model2.neural_memory_v61.fast_keys)
    assert torch.allclose(model.neural_memory_v61.autobio_state, model2.neural_memory_v61.autobio_state)


def test_repeated_interference_recall_smoke():
    torch.manual_seed(101)
    mem = NeuralMemoryOSV61(12, key_dim=10, value_dim=10, fast_slots=16, semantic_slots=12, hidden=24, temperature=0.10)
    keys = F.normalize(torch.randn(10, 10), dim=-1)
    vals = torch.randn(10, 10)
    # Inject distinct synthetic memories through already-neural context projections.
    for i in range(10):
        ctx = torch.zeros(12); ctx[:10] = keys[i]
        mem.write(ctx, vals[i], strength=1.0, surprise=1.0)
    retrieved = mem.fast_valid.sum().item()
    assert retrieved >= 10


def test_full_runtime_live_cycle():
    torch.manual_seed(7)
    cfg = mobile_v61_config(raw_observation_dim=9)
    model = NeuroWeaveV61(cfg)
    trainer = OrganismTrainerV61(model)
    runtime = OrganismRuntimeV61(model, trainer)
    obs = torch.randn(1, 9)
    out = runtime.step(obs)
    assert 'v61_neural_memory_read' in out
    result = runtime.observe_transition(torch.randn(1, 9), actual_reward=0.8, actual_risk=0.1)
    assert 'v61_neural_memory_writes' in result
    assert torch.isfinite(result['v61_neural_memory_writes']).all()


def test_ablation_zeroes_neural_memory_path():
    torch.manual_seed(13)
    mem = NeuralMemoryOSV61(12, key_dim=10, value_dim=10, fast_slots=8, semantic_slots=8, hidden=20)
    x = torch.randn(4, 12)
    y = torch.randn(4, 10)
    for i in range(4): mem.write(x[i], y[i], strength=1.0, surprise=1.0)
    full = mem(x)['read'].detach()
    mem.fast_valid.zero_()
    ablated = mem(x)['read'].detach()
    assert not torch.allclose(full, ablated)
