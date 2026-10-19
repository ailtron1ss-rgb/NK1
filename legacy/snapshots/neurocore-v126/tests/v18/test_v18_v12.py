import time
import torch
import torch.nn.functional as F
from neurocore.v18 import NeuroWeaveV11, NeuroWeaveV12


def test_v12_shapes_finite_and_memory_bounded():
    torch.manual_seed(10)
    m = NeuroWeaveV12(d=8, hidden=16, action_dim=4, capacity=6, max_experts=6, top_k=2)
    x = torch.randn(3, 12, 8)
    y, s = m(x, commit_memory=True)
    assert y['latent'].shape == (3, 12, 8)
    assert y['route_probs'].shape == (3, 12, 2)
    assert y['route_indices'].shape == (3, 12, 2)
    assert torch.isfinite(y['latent']).all()
    assert torch.isfinite(y['world_uncertainty']).all()
    assert y['memory_size'].max() <= 6
    assert (s.expert_active.sum(-1) >= 1).all()


def test_v12_sparse_router_only_selected_experts_receive_gradients():
    torch.manual_seed(11)
    m = NeuroWeaveV12(d=8, hidden=16, max_experts=4, top_k=1)
    x = torch.randn(4, 5, 8)
    y, _ = m(x, commit_memory=False)
    loss = y['latent'][:, -1].pow(2).mean()
    loss.backward()
    used = set(y['route_indices'][:, :, 0].reshape(-1).tolist())
    nonzero = []
    for i, expert in enumerate(m.experts.experts):
        gs = []
        for p in expert.parameters():
            if p.grad is not None:
                gs.append(float(p.grad.abs().sum()))
        nonzero.append(any(v > 0 for v in gs))
    assert all(nonzero[i] for i in used)
    assert sum(nonzero) == len(used)


def test_v12_compute_gate_is_per_sample_not_batch_global():
    torch.manual_seed(12)
    m = NeuroWeaveV12(d=8, hidden=16, deep_threshold=0.5)
    x = torch.randn(2, 1, 8)
    y, _ = m(x, commit_memory=False)
    assert y['deep_taken'].shape == (2, 1, 1)


def test_v11_v12_core_trainability_smoke():
    torch.manual_seed(13)
    x = torch.randn(12, 10, 8)
    target = x.mean(1)
    rows = []
    for Core in (NeuroWeaveV11, NeuroWeaveV12):
        m = Core(d=8, hidden=16, action_dim=4, capacity=8, max_experts=4, top_k=2)
        opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
        with torch.no_grad():
            p0 = m(x, commit_memory=False)[0]['latent'][:, -1]
            initial = F.mse_loss(p0, target).item()
        for _ in range(8):
            opt.zero_grad(set_to_none=True)
            p = m(x, commit_memory=False)[0]['latent'][:, -1]
            loss = F.mse_loss(p, target) + 0.01 * m(x, commit_memory=False)[0]['prediction_error'].mean()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0)
            opt.step()
        with torch.no_grad():
            final = F.mse_loss(m(x, commit_memory=False)[0]['latent'][:, -1], target).item()
        rows.append((initial, final))
    assert all(f < i for i, f in rows)


def test_v12_runtime_path_is_finite():
    torch.manual_seed(14)
    m = NeuroWeaveV12(d=8, hidden=16, max_experts=6, top_k=2)
    x = torch.randn(8, 20, 8)
    t0 = time.perf_counter()
    y, _ = m(x, commit_memory=False)
    elapsed = time.perf_counter() - t0
    assert elapsed > 0
    assert torch.isfinite(y['latent']).all()
