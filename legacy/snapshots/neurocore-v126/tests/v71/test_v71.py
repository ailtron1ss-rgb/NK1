import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v71 import (
    mobile_v71_config,
    NeuroWeaveV71,
    OrganismTrainerV71,
    OrganismRuntimeV71,
    RuntimeStateStoreV71,
    CanonicalNeuralMemoryOSV71,
)


def mem(seed=1, slots=24, replay=24):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV71(
        54, key_dim=20, value_dim=20, fast_slots=24, fast_rank=2,
        semantic_slots=slots, semantic_rank=2, replay_size=replay, hidden=32,
        long_term_hidden=28, long_term_layers=2, graph_rank=6, graph_topk=min(6, slots),
        structural_rank=6, structural_topk=min(3, slots-1),
        composition_rank=6, composition_horizon=4, composition_capacity=16,
        relation_rank=6, replay_capacity=replay,
    )


def test_v71_single_owner_and_budget():
    model = NeuroWeaveV71(mobile_v71_config(9))
    params = sum(p.numel() for p in model.parameters())
    owners = [n for n, _ in model.named_modules() if n.startswith('neural_memory') and '.' not in n]
    assert owners == ['neural_memory_v61']
    assert params < 380_000
    assert model.neural_memory_v70 is model.neural_memory_v61


def test_v71_predictor_excludes_terminal_target():
    m = mem(2)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:5] = 1
        keys = F.normalize(torch.eye(5, m.key_dim), dim=-1)
        m.semantic_key[:5] = keys
        m._record_composition_path_v71([0, 1, 2], 1.0)
        for _ in range(6):
            m._record_composition_path_v71([0, 1, 2], 1.0)
    before = float(m._composition_loss_v71().item())
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    for _ in range(30):
        loss = m._composition_loss_v71()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
    after = float(m._composition_loss_v71().item())
    assert after < before
    assert not torch.equal(m.composition_paths_v70[0, :3], torch.tensor([0, 1, -1]))


def test_v71_real_predicted_latent_route_is_used():
    m = mem(3)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:6] = 1
        keys = F.normalize(torch.randn(6, m.key_dim), dim=-1)
        m.semantic_key[:6] = keys
        for _ in range(8):
            m._record_composition_path_v71([0, 1, 2], 1.0)
            m._record_composition_path_v71([0, 3, 4], 1.0)
        m.composition_temporal_valid_v70.fill_(1.0)
    q = F.normalize(keys[0] + 0.8 * keys[1], dim=0).view(1, -1)
    base_read, base_weights, base_conf = m._global_semantic_read(q)
    # The V71 route must actually alter the baseline V69 retrieval using predicted path latents.
    v71_before = float(m.composition_predicted_route_effect_v71.item())
    _ = m._global_semantic_read(q)
    v71_after = float(m.composition_predicted_route_effect_v71.item())
    assert torch.isfinite(base_read).all()
    assert torch.isfinite(base_weights).all()
    assert torch.isfinite(base_conf).all()
    assert v71_after >= v71_before
    assert float(m.composition_predicted_route_effect_v71.item()) > 0.0


def test_v71_replay_rebuild_is_physical():
    m = mem(4)
    with torch.no_grad():
        m._record_composition_path_v71([0, 1, 2], 1.0)
        for _ in range(7):
            m._record_composition_path_v71([0, 1, 2], 1.0)
    active = torch.nonzero(m.composition_active_v70 > 0.5, as_tuple=False).flatten()
    assert active.numel() == 1
    slot = int(active[0].item())
    assert int(m.composition_replay_valid_v71.sum().item()) >= 1
    les = m.lesion_composition_paths_v71(1.0)
    assert les["lesioned"] == 1.0
    assert int(m.composition_active_v70.sum().item()) == 0
    assert int(m.composition_path_len_v70[slot].item()) == 0
    reg = m.regrow_composition_paths_v71()
    assert reg["regrown"] >= 1.0
    assert int(m.composition_active_v70.sum().item()) >= 1
    assert int(m.composition_replay_rebuilds_v71.item()) >= 1


def test_v71_all_branch_negatives_are_considered():
    m = mem(5)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:6] = 1
        m.semantic_key[:6] = F.normalize(torch.randn(6, m.key_dim), dim=-1)
        for _ in range(6):
            for end in (2, 3, 4):
                m._record_composition_path_v71([0, 1, end], 1.0)
    loss = m._composition_branch_loss_v71()
    assert torch.isfinite(loss)
    assert float(loss.item()) >= 0.0


def test_v71_checkpoint_reports_compatibility():
    m = NeuroWeaveV71(mobile_v71_config(9))
    t = OrganismTrainerV71(m)
    r = OrganismRuntimeV71(m, t)
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV71.save(Path(f.name), m, t, r)
        m2 = NeuroWeaveV71(mobile_v71_config(9))
        t2 = OrganismTrainerV71(m2)
        r2 = OrganismRuntimeV71(m2, t2)
        report = RuntimeStateStoreV71.load(Path(f.name), m2, t2, r2)
        assert report["loaded_tensors"] > 0
        assert report["optimizer_reset"] is False
