import torch
import torch.nn.functional as F

from neurocore.v19 import NeuroWeaveV14, V14Config, frontier_loss_v14


def make():
    return NeuroWeaveV14(V14Config(d=8, hidden=16, action_dim=4, memory_capacity=6,
                                   replay_capacity=7, max_experts=5, top_k=1,
                                   world_candidates=3, max_horizon=3, deep_threshold=0.2))


def test_v14_forward_finite_and_bounded():
    torch.manual_seed(1401)
    m = make()
    y = m(torch.randn(4, 10, 8), commit_memory=True)
    s = y["_final_state"]
    for k, v in y.items():
        if torch.is_tensor(v):
            assert torch.isfinite(v).all(), k
    assert s.fast_synapse.shape == (4, 8, 8)
    assert s.stable_synapse.shape == (4, 8, 8)
    assert torch.linalg.matrix_norm(s.fast_synapse, dim=(-2,-1)).max() <= 1.3501
    assert torch.linalg.matrix_norm(s.stable_synapse, dim=(-2,-1)).max() <= 1.3501
    assert s.replay_keys.shape == (4, 7, 8)


def test_v14_two_timescale_synapse_actually_changes():
    torch.manual_seed(1402)
    m = make()
    y = m(torch.randn(3, 8, 8), commit_memory=False)
    s = y["_final_state"]
    assert torch.linalg.matrix_norm(s.fast_synapse, dim=(-2,-1)).mean() > 0
    assert torch.linalg.matrix_norm(s.stable_synapse, dim=(-2,-1)).mean() > 0
    assert y["synaptic_error"].mean() >= 0


def test_v14_replay_is_written_and_sampleable():
    torch.manual_seed(1403)
    m = make()
    y = m(torch.randn(2, 9, 8), commit_memory=True)
    s = y["_final_state"]
    assert y["replay_fill"].max() > 0
    k, t, p = m.replay_batch(s, count=4)
    assert k.shape == (2, 4, 8)
    assert t.shape == (2, 4, 8)
    assert p.shape == (2, 4, 1)
    assert torch.isfinite(m.micro_dream_loss(s, 4))


def test_v14_temporal_credit_tracks_delayed_change():
    torch.manual_seed(1404)
    m = make()
    y = m(torch.randn(4, 12, 8), commit_memory=False)
    assert y["eligibility_norm"].max() > 0
    assert torch.isfinite(y["delayed_expert_credit"]).all()
    assert y["delayed_expert_credit"].shape[-1] == 1


def test_v14_adaptive_planning_has_valid_horizons():
    torch.manual_seed(1405)
    m = make()
    y = m(torch.randn(5, 8, 8), commit_memory=False)
    h = y["planning_horizon"]
    assert h.min() >= 1
    assert h.max() <= 3
    assert y["plan_scores_v14"].shape[-1] == 3
    assert y["plan_uncertainty_v14"].shape[-2:] == (3, 1)


def test_v14_recovery_responds_to_corruption():
    torch.manual_seed(1406)
    m = make()
    s = m.initial_state(3)
    # Force state drift through corrupted context while keeping the tensor shape valid.
    s.base.context = torch.randn_like(s.base.context) * 8
    y, ns = m.step(torch.randn(3, 8) * 3, s, commit_memory=False)
    assert y["repair_strength"].min() >= 0
    assert y["repair_strength"].max() <= 0.8501
    assert torch.isfinite(ns.base.context).all()


def test_v14_loss_backpropagates_into_predictive_stack():
    torch.manual_seed(1407)
    m = make()
    x = torch.randn(4, 7, 8)
    y = m(x, commit_memory=False)
    loss = frontier_loss_v14(y, torch.randn(4, 8), torch.randn(4, 8))
    assert torch.isfinite(loss)
    loss.backward()
    pred_grads = [p.grad for n,p in m.named_parameters() if p.requires_grad and ("next_predictor" in n or "next_head" in n)]
    ctrl_grads = [p.grad for n,p in m.named_parameters() if p.requires_grad and "compute_value" in n]
    assert pred_grads and all(g is not None and torch.isfinite(g).all() for g in pred_grads)
    assert ctrl_grads and all(g is not None and torch.isfinite(g).all() for g in ctrl_grads)


def test_v14_learns_recall_signal():
    torch.manual_seed(1408)
    b,t,d = 16,10,8
    x = torch.randn(b,t,d)
    target = x[:,1]
    m = make()
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    with torch.no_grad():
        init = F.mse_loss(m(x, commit_memory=False)["latent"][:,-1], target).item()
    for _ in range(4):
        opt.zero_grad(set_to_none=True)
        y = m(x, commit_memory=False)
        loss = F.mse_loss(y["latent"][:,-1], target) + 0.02 * y["temporal_error"].mean()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0)
        opt.step()
    with torch.no_grad():
        final = F.mse_loss(m(x, commit_memory=False)["latent"][:,-1], target).item()
    assert final < init


def test_v14_energy_limits_expensive_path_when_depleted():
    torch.manual_seed(1409)
    m = make()
    s = m.initial_state(4)
    s.base.energy.zero_()
    y, _ = m.step(torch.randn(4,8), s, commit_memory=False)
    assert y["planning_taken_v14"].sum() == 0
    assert y["deep_taken_v14"].sum() == 0

from neurocore.v19 import MicroDreamTrainerV14


def test_v14_micro_dream_trainer_reduces_replay_loss_or_keeps_it_stable():
    torch.manual_seed(1410)
    m = make()
    y = m(torch.randn(3, 14, 8), commit_memory=True)
    s = y["_final_state"]
    trainer = MicroDreamTrainerV14(m, lr=3e-3)
    before = float(m.micro_dream_loss(s, 6).item())
    for _ in range(4):
        trainer.step(s, 6)
    after = float(m.micro_dream_loss(s, 6).item())
    assert torch.isfinite(torch.tensor(after))
    assert after <= before * 1.05
