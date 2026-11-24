import torch
from neurocore import EventEncoder, ModalityEvent, LatentWorldModel, LowRankAdapter, BoundedReplay


def test_multimodal_shared_latent_contract():
    enc = EventEncoder({"vision": 10, "audio": 6, "text": 8}, d_model=12)
    z = enc([ModalityEvent(torch.randn(2, 10), "vision"), ModalityEvent(torch.randn(2, 6), "audio")])
    assert z.shape == (2, 12)
    assert torch.isfinite(z).all()


def test_world_model_rollout_shapes():
    wm = LatentWorldModel(d_model=12, action_dim=4)
    states, outcomes, risks, uncertainty = wm.rollout(torch.randn(2, 12), torch.randn(2, 5, 4))
    assert states.shape == (2, 5, 12)
    assert outcomes.shape == (2, 5, 1)
    assert risks.shape == (2, 5, 1)
    assert uncertainty.shape == (2, 5, 1)
    assert (risks >= 0).all() and (uncertainty >= 0).all()


def test_low_rank_adapter_starts_identity():
    a = LowRankAdapter(12, rank=3)
    x = torch.randn(4, 12)
    assert torch.allclose(a(x), x)


def test_replay_is_bounded():
    r = BoundedReplay(3)
    for _ in range(5): r.add(torch.randn(2), torch.randn(2))
    assert len(r.items) == 3
    s = r.sample(2)
    assert s is not None and s.x.shape[0] == 2
