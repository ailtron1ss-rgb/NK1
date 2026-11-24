import tempfile
from pathlib import Path
import torch
import torch.nn.functional as F

from neurocore.v67 import mobile_v67_config, NeuroWeaveV67, OrganismTrainerV67, OrganismRuntimeV67, RuntimeStateStoreV67
from neurocore.v68 import mobile_v68_config, CanonicalNeuralMemoryOSV68, NeuroWeaveV68, OrganismTrainerV68, OrganismRuntimeV68, RuntimeStateStoreV68


def mem(seed=1, slots=24, replay=32):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV68(10, key_dim=6, value_dim=6, fast_slots=8, fast_rank=2, semantic_slots=slots, replay_size=replay, hidden=18, graph_rank=4, graph_topk=min(5, slots), structural_rank=4, structural_topk=min(3, slots-1))


def test_v68_new_parameters_are_trainable_and_budgeted():
    m=mem(1)
    params=sum(p.numel() for p in m.parameters())
    names=dict(m.named_parameters())
    assert params < 90_000
    for n in ("replay_policy_left_v68","context_route_left_v68","predictive_left_v68"):
        assert n in names and names[n].requires_grad


def test_v68_predictive_bridge_learns_repeated_sequence():
    m=mem(2)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3]=1
        m.semantic_key[:3]=F.normalize(torch.eye(6)[:3],dim=-1)
    a=F.normalize(torch.tensor([1.,0,0,0,0,0]),dim=0)
    b=F.normalize(torch.tensor([0.,1.,0,0,0,0]),dim=0)
    c=F.normalize(torch.tensor([0.,0.,1.,0,0,0]),dim=0)
    for _ in range(8):
        m._record_predictive_bridge_v68(0, 1, 1.0)
        m._record_predictive_bridge_v68(1, 2, 1.0)
    assert float(m.predictive_bridge_repeat_v68.sum()) >= 8.0
    loss0=float(m._predictive_bridge_loss_v68().item())
    opt=torch.optim.AdamW(m.parameters(),lr=2e-3)
    for _ in range(12):
        p=m._predictive_bridge_loss_v68(); opt.zero_grad(set_to_none=True); p.backward(); opt.step()
    loss1=float(m._predictive_bridge_loss_v68().item())
    assert loss1 <= loss0 + 1e-6


def test_v68_replay_policy_changes_selection_scores():
    m=mem(3,replay=16)
    anchors=[F.normalize(torch.randn(6),dim=0) for _ in range(4)]
    targets=[F.normalize(torch.randn(6),dim=0) for _ in range(4)]
    for i in range(16):
        m.write(anchors[i%4],targets[i%4],strength=1.0,surprise=.1 if i<12 else 1.0)
    valid=torch.nonzero(m.replay_valid>.5,as_tuple=False).flatten()
    old=m._replay_scores_v65(valid); new=m._replay_policy_score_v68(valid)
    assert torch.isfinite(new).all()
    assert float((new-old).abs().mean().item()) > 0.0


def test_v68_key_retrieve_uses_contextual_route_and_returns_uncertainty_fields():
    m=mem(4)
    q=F.normalize(torch.randn(6),dim=0); t=F.normalize(torch.randn(6),dim=0)
    for _ in range(5): m.write(q,t,strength=1.0,surprise=.6)
    r=m.retrieve(q.view(1,-1))
    assert torch.isfinite(r["read"]).all()
    assert r["read"].shape[-1] == 6
    assert torch.isfinite(m.context_uncertainty_v68)
    assert torch.isfinite(m.hypothesis_entropy_v68)


def test_v68_lesion_regrowth_is_real():
    m=mem(5)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3]=1
        m.semantic_structural_repeat_v67[0,1]=6
        m.semantic_structural_utility_v67[0,1]=1
        m.semantic_structural_mask_v67[0,1]=1
    out=m.lesion_structural_edges(.5)
    assert out["lesioned"] >= 1
    reg=m.regrow_structural_edges()
    assert reg["regrown"] >= 1
    assert float(m.structural_regrowth_count_v68.item()) >= 1


def test_v68_mobile_runtime_single_owner():
    cfg=mobile_v68_config(9); model=NeuroWeaveV68(cfg)
    owners=[n for n,_ in model.named_modules() if n.startswith("neural_memory") and "." not in n]
    assert owners == ["neural_memory_v61"]
    assert model.neural_memory_v67 is model.neural_memory_v61
    tr=OrganismTrainerV68(model); rt=OrganismRuntimeV68(model,tr)
    out=rt.step(torch.randn(1,9))
    for k in ("v68_context_uncertainty","v68_predictive_bridge_loss","v68_hypothesis_entropy"):
        assert torch.isfinite(out[k]).all()


def test_v68_checkpoint_migration_from_v67():
    cfg67=mobile_v67_config(9); model67=NeuroWeaveV67(cfg67); tr67=OrganismTrainerV67(model67); rt67=OrganismRuntimeV67(model67,tr67)
    with torch.no_grad(): model67.neural_memory_v61.semantic_key[0].copy_(F.normalize(torch.randn(model67.neural_memory_v61.key_dim),dim=0))
    with tempfile.NamedTemporaryFile(suffix=".pt") as f:
        RuntimeStateStoreV67.save(Path(f.name),model67,tr67,rt67)
        model68=NeuroWeaveV68(mobile_v68_config(9)); tr68=OrganismTrainerV68(model68); rt68=OrganismRuntimeV68(model68,tr68)
        RuntimeStateStoreV68.load(Path(f.name),model68,tr68,rt68)
        assert torch.allclose(model68.neural_memory_v61.semantic_key[0],model67.neural_memory_v61.semantic_key[0],atol=1e-6)


def test_v68_memory_loss_integrates_scheduler_and_predictive_terms():
    m=mem(7,replay=16)
    q=F.normalize(torch.randn(6),dim=0); t=F.normalize(torch.randn(6),dim=0)
    for _ in range(6): m.write(q,t,strength=1.0,surprise=.4)
    ctx=torch.randn(m.input_dim); p=m.memory_loss(ctx.view(1,-1),t.view(1,-1))
    assert "predictive_bridge_v68" in p
    assert "replay_policy_calibration_v68" in p
    assert torch.isfinite(p["loss"]).all()
    opt=torch.optim.AdamW(m.parameters(),lr=1e-3); opt.zero_grad(); p["loss"].backward(); opt.step()


def test_v68_long_stream_finite_and_stateful():
    m=mem(8)
    opt=torch.optim.AdamW(m.parameters(),lr=1e-3)
    anchors=[F.normalize(torch.randn(6),dim=0) for _ in range(6)]
    vals=[F.normalize(torch.randn(6),dim=0) for _ in range(6)]
    for i in range(72):
        j=i%6
        m.write(anchors[j]+.015*torch.randn(6),vals[j],strength=1.,surprise=.8 if i%13==0 else .1)
        if i%18==17: m.consolidate(opt,steps=1)
    d=m.diagnostics()
    for k in ("v68_replay_policy_seen","v68_context_route_effect","v68_context_uncertainty","v68_predictive_bridge_loss"):
        assert torch.isfinite(d[k]).all()
    assert float(m.replay_policy_seen_v68.item()) > 0


def test_v68_does_not_create_second_memory_owner():
    cfg=mobile_v68_config(9); model=NeuroWeaveV68(cfg)
    top=[n for n,_ in model.named_modules() if n.startswith("neural_memory") and "." not in n]
    assert top == ["neural_memory_v61"]
