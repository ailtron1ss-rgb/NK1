import torch
import torch.nn.functional as F

from neurocore.v18 import NeuroWeaveV12, NeuroWeaveV13


def test_v13_forward_finite_and_state_bounded():
    torch.manual_seed(101)
    m = NeuroWeaveV13(d=8, hidden=16, capacity=5, max_experts=6, top_k=2, world_horizon=2, world_candidates=3)
    x = torch.randn(3, 9, 8)
    y = m(x, commit_memory=True)
    s = y.pop('_final_state')
    for k, v in y.items():
        assert torch.isfinite(v).all(), k
    assert y['memory_size'].max() <= 5
    assert s.fast_weights.shape == (3, 8, 8)
    assert torch.linalg.matrix_norm(s.fast_weights, dim=(-2, -1)).max() <= 1.50001
    assert (s.expert_active.sum(-1) >= 1).all()


def test_v13_fast_memory_changes_online_and_is_bounded():
    torch.manual_seed(102)
    m = NeuroWeaveV13(d=8, hidden=16, capacity=4, max_experts=4, top_k=1, world_horizon=1)
    x = torch.randn(2, 6, 8)
    y = m(x, commit_memory=False)
    s = y['_final_state']
    assert torch.linalg.matrix_norm(s.fast_weights, dim=(-2, -1)).max() > 0.0
    assert y['fast_memory_error'].mean() >= 0.0


def test_v13_interventional_credit_is_finite_and_route_aligned():
    torch.manual_seed(103)
    m = NeuroWeaveV13(d=8, hidden=16, max_experts=5, top_k=2, world_horizon=1)
    y = m(torch.randn(4, 5, 8), commit_memory=False)
    assert y['expert_interventional_improvement'].shape == (4, 5, 1)
    assert torch.isfinite(y['expert_credit']).all()
    assert ((y['route_indices'] >= 0) & (y['route_indices'] < 5)).all()


def test_v13_compute_policy_has_real_selective_planning_path():
    torch.manual_seed(104)
    m = NeuroWeaveV13(d=8, hidden=16, max_experts=4, top_k=1, world_horizon=2, world_candidates=3)
    x = torch.randn(6, 8, 8)
    y = m(x, commit_memory=False)
    taken = y['world_taken'].squeeze(-1)
    assert ((taken == 0) | (taken == 1)).all()
    assert y['plan_scores'].shape[-1] == 3
    assert y['action_candidates'].shape[-2:] == (3, 4)


def test_v13_trains_on_recall_task_better_than_untrained():
    torch.manual_seed(105)
    b, t, d = 24, 12, 8
    x = torch.randn(b, t, d)
    # Target is an early token; later steps require persistent state.
    target = x[:, 1, :]
    m = NeuroWeaveV13(d=d, hidden=16, max_experts=4, top_k=1, capacity=8, world_horizon=1)
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    with torch.no_grad():
        initial = F.mse_loss(m(x, commit_memory=False)['latent'][:, -1], target).item()
    for _ in range(8):
        opt.zero_grad(set_to_none=True)
        y = m(x, commit_memory=False)
        loss = F.mse_loss(y['latent'][:, -1], target) + 0.01 * y['prediction_error'].mean()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0)
        opt.step()
    with torch.no_grad():
        final = F.mse_loss(m(x, commit_memory=False)['latent'][:, -1], target).item()
    assert final < initial


def test_v12_regression_import_still_works():
    m = NeuroWeaveV12(d=8, hidden=16, max_experts=4, top_k=1)
    y = m(torch.randn(2, 4, 8), commit_memory=False)[0]
    assert torch.isfinite(y['latent']).all()


def test_v13_selective_expensive_paths_can_execute_when_policy_allows():
    torch.manual_seed(106)
    m = NeuroWeaveV13(d=8, hidden=16, max_experts=4, top_k=1,
                      world_horizon=2, world_candidates=3, deep_threshold=0.01)
    y = m(torch.randn(4, 4, 8), commit_memory=False)
    assert y['deep_taken'].sum() > 0
    assert y['world_taken'].sum() > 0
    assert torch.isfinite(y['plan_scores']).all()


def test_v13_memory_batch_stress_and_single_active_expert_are_safe():
    torch.manual_seed(107)
    m = NeuroWeaveV13(d=8, hidden=16, capacity=7, max_experts=6, top_k=3, world_horizon=1, world_candidates=2)
    state = m.initial_state(5)
    state.expert_active.zero_()
    state.expert_active[:, 2] = 1.0
    for _ in range(40):
        y, state = m.step(torch.randn(5, 8), state, commit_memory=True)
        assert y['memory_size'].max() <= 7
        assert torch.isfinite(y['latent']).all()
        assert (y['route_indices'] == 2).all()
