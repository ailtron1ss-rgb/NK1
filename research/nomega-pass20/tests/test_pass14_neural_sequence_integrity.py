from pathlib import Path
import torch

from core.nomega.neural_program_synth_v13 import NeuralProgramSynthesizerV13
from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1
from core.nomega.neural_text_encoder_v1 import OrderedSubwordTextEncoderV1


def test_ordered_encoder_exposes_masked_sequence_without_changing_cls_contract():
    enc = OrderedSubwordTextEncoderV1(hidden=16, vocab=128, max_tokens=8, layers=1, heads=2).eval()
    texts = ["add two values", "subtract one value now"]
    seq, valid = enc.encode_sequence_batch(texts)
    cls = enc(texts)
    assert seq.shape == (2, 9, 16)
    assert valid.shape == (2, 9)
    assert valid[:, 0].all()
    assert torch.equal(valid[0], torch.tensor([True, True, True, True, False, False, False, False, False]))
    assert torch.allclose(seq[:, 0], cls, atol=1e-6, rtol=1e-6)


def test_batched_substrate_matches_independent_sequences():
    sub = ModernNeuralSubstrateV1(8, exc_neurons=6, inh_neurons=2, branches=2, seed=19)
    seq = torch.randn(3, 5, 8)
    mask = torch.tensor([[1, 1, 1, 1, 1], [1, 1, 1, 0, 0], [1, 1, 1, 1, 0]], dtype=torch.bool)
    batch = sub.forward_batch(seq, mask=mask)
    for i in range(3):
        single = sub(seq[i, : int(mask[i].sum())], local_plasticity=False, reset_state=False)
        n = int(mask[i].sum())
        assert torch.allclose(batch["spikes"][i, :n], single["spikes"], atol=1e-6, rtol=1e-6)
        assert torch.allclose(batch["pooled"][i], single["pooled"], atol=1e-6, rtol=1e-6)


def test_v13_raw_ordered_path_is_differentiable():
    torch.manual_seed(44)
    m = NeuralProgramSynthesizerV13(
        vocab=128, hidden=20, latent_dim=20, max_len=10, max_b=12,
        layers=1, heads=2, family_count=20, raw_sequence_tokens=8,
    )
    m.train()
    out = m.encode_text_batch(["add two values", "multiply the first two values"])
    loss = out.pow(2).mean()
    loss.backward()
    grads = [p.grad for n, p in m.named_parameters() if "raw_substrate" in n or "raw_sequence_gate" in n]
    assert grads and all(g is not None and torch.isfinite(g).all() for g in grads)


def test_v13_ordered_path_changes_with_token_order():
    torch.manual_seed(51)
    m = NeuralProgramSynthesizerV13(
        vocab=128, hidden=20, latent_dim=20, max_len=10, max_b=12,
        layers=1, heads=2, family_count=20, raw_sequence_tokens=8,
    ).eval()
    a = m.encode_text_batch(["add first then second"]).detach()
    b = m.encode_text_batch(["second then first add"]).detach()
    assert not torch.allclose(a, b, atol=1e-7, rtol=1e-7)


def test_v13_checkpoint_roundtrip_preserves_architecture_and_state(tmp_path):
    from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
    torch.manual_seed(71)
    model = NeuralProgramSynthesizerV13(
        vocab=128, hidden=20, latent_dim=20, max_len=10, max_b=12,
        layers=1, heads=2, family_count=20, raw_sequence_tokens=7, raw_sequence_scale=0.31,
    ).eval()
    path = tmp_path / "v13.pt"
    AtomicProgramTrainerV5.save(path, model)
    restored, _ = AtomicProgramTrainerV5.load(path)
    assert restored.__class__ is NeuralProgramSynthesizerV13
    assert restored.raw_sequence_tokens == 7
    assert abs(restored.raw_sequence_scale - 0.31) < 1e-12
    assert restored.state_digest() == model.state_digest()


def test_source_patch_sandbox_validates_real_candidate_without_mutating_root(tmp_path):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1, SourcePatchSandboxV1
    root = tmp_path / "repo"
    (root / "core").mkdir(parents=True)
    (root / "core" / "sample.py").write_text("VALUE = 1\n", encoding="utf-8")
    (root / "tests").mkdir()
    (root / "tests" / "test_sample.py").write_text("from core.sample import VALUE\ndef test_value():\n    assert VALUE == 2\n", encoding="utf-8")
    sandbox = SourcePatchSandboxV1(root)
    original = (root / "core" / "sample.py").read_text(encoding="utf-8")
    result = sandbox.prepare(
        [SourceEditV1("core/sample.py", "VALUE = 1", "VALUE = 2")],
        test_nodes=("tests/test_sample.py",), timeout_s=30,
    )
    assert result.status == "validated"
    assert result.compile_ok is True
    assert result.tests_ok is True
    assert result.after_hash != result.before_hash
    assert (root / "core" / "sample.py").read_text(encoding="utf-8") == original


def test_source_candidate_can_pass_governed_promotion(tmp_path):
    import json
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, EvaluationSnapshotV2, PromotionDecisionV2
    root = tmp_path / "repo"
    (root / "core").mkdir(parents=True)
    (root / "core" / "sample.py").write_text("VALUE = 1\n", encoding="utf-8")
    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[SourceEditV1("core/sample.py", "VALUE = 1", "VALUE = 2")],
        candidate_id="candidate123", timeout_s=30,
    )
    assert result["status"] == "validated"
    baseline = EvaluationSnapshotV2(0.5,0.5,0.5,0.5,0.5,0.0,0.0,1.0,1.0,1)
    candidate = EvaluationSnapshotV2(0.6,0.5,0.5,0.5,0.5,0.0,0.0,1.0,1.0,1)
    decision = PromotionDecisionV2(True, "test", {"test": True}, 0.0)
    # The real policy gate is exercised separately; this method is the final governed copy step.
    record = cp.promote_source_candidate(candidate_result=result, decision=decision)
    assert record["changed_files"] == ["core/sample.py"]
    assert (root / "core" / "sample.py").read_text(encoding="utf-8") == "VALUE = 2\n"


def test_source_promotion_rejects_stale_candidate(tmp_path):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, PromotionDecisionV2
    root = tmp_path / "repo"
    (root / "core").mkdir(parents=True)
    target = root / "core" / "sample.py"
    target.write_text("VALUE = 1\n", encoding="utf-8")
    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[SourceEditV1("core/sample.py", "VALUE = 1", "VALUE = 2")],
        candidate_id="stale_candidate", timeout_s=30,
    )
    target.write_text("VALUE = 99\n", encoding="utf-8")
    decision = PromotionDecisionV2(True, "test", {"test": True}, 0.0)
    try:
        cp.promote_source_candidate(candidate_result=result, decision=decision)
    except RuntimeError as exc:
        assert "stale source candidate" in str(exc)
    else:
        raise AssertionError("stale candidate was promoted")
    assert target.read_text(encoding="utf-8") == "VALUE = 99\n"


def test_source_promotion_rolls_back_on_partial_commit_failure(tmp_path, monkeypatch):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, PromotionDecisionV2
    root = tmp_path / "repo"
    (root / "core").mkdir(parents=True)
    (root / "core" / "a.py").write_text("A = 1\n", encoding="utf-8")
    (root / "core" / "b.py").write_text("B = 1\n", encoding="utf-8")
    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[
            SourceEditV1("core/a.py", "A = 1", "A = 2"),
            SourceEditV1("core/b.py", "B = 1", "B = 2"),
        ], timeout_s=30,
    )
    decision = PromotionDecisionV2(True, "test", {"test": True}, 0.0)
    import os
    original_replace = os.replace
    calls = {"n": 0}
    def flaky_replace(src, dst):
        if str(dst).endswith("b.py"):
            raise OSError("forced commit failure")
        calls["n"] += 1
        return original_replace(src, dst)
    monkeypatch.setattr(os, "replace", flaky_replace)
    try:
        cp.promote_source_candidate(candidate_result=result, decision=decision)
    except OSError:
        pass
    else:
        raise AssertionError("partial promotion failure was not raised")
    assert (root / "core" / "a.py").read_text(encoding="utf-8") == "A = 1\n"
    assert (root / "core" / "b.py").read_text(encoding="utf-8") == "B = 1\n"


def test_source_promotion_has_real_rollback(tmp_path):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, PromotionDecisionV2
    root = tmp_path / "repo"
    (root / "core").mkdir(parents=True)
    target = root / "core" / "sample.py"
    target.write_text("VALUE = 1\n", encoding="utf-8")
    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[SourceEditV1("core/sample.py", "VALUE = 1", "VALUE = 2")],
        candidate_id="rollback_candidate", timeout_s=30,
    )
    record = cp.promote_source_candidate(
        candidate_result=result, decision=PromotionDecisionV2(True, "test", {"test": True}, 0.0)
    )
    assert target.read_text(encoding="utf-8") == "VALUE = 2\n"
    rolled = cp.rollback_source_promotion(record=record)
    assert target.read_text(encoding="utf-8") == "VALUE = 1\n"
    assert rolled["result_hash"] == cp._tree_hash(root)


def test_structural_controller_preserves_ei_reachability_during_pruning():
    from core.nomega.structural_plasticity_controller_v1 import StructuralPlasticityControllerV1
    from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1
    s = ModernNeuralSubstrateV1(4, exc_neurons=2, inh_neurons=2, seed=18)
    s.synapse_mask.fill_(0.0)
    s.synapse_mask[:, 0] = 1.0
    s.synapse_mask[:, 2] = 1.0
    s.synapse_utility.fill_(1.0)
    c = StructuralPlasticityControllerV1(seed=18)
    plan = c.propose(s, max_prune=8, max_grow=0, min_active_fraction=0.25)
    for row, col in plan.prune:
        assert col not in {0, 2}


def test_source_sandbox_can_create_new_module_and_rollback_it(tmp_path):
    from core.nomega.source_patch_sandbox_v1 import SourceEditV1, SourcePatchSandboxV1
    from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, PromotionDecisionV2
    root = tmp_path / "repo"
    (root / "core").mkdir(parents=True)
    (root / "core" / "__init__.py").write_text("", encoding="utf-8")
    sandbox = SourcePatchSandboxV1(root)
    result = sandbox.prepare(
        [SourceEditV1("core/new_capability.py", "", "VALUE = 42\n", create_if_missing=True)],
        timeout_s=30,
    )
    assert result.status == "validated"
    assert result.compile_ok is True
    assert (Path(result.candidate_root) / "core" / "new_capability.py").read_text(encoding="utf-8") == "VALUE = 42\n"

    cp = SelfEvolutionControlPlaneV2(root)
    result = cp.evaluate_source_candidate(
        edits=[SourceEditV1("core/new_capability.py", "", "VALUE = 42\n", create_if_missing=True)],
        candidate_id="create_module_candidate", timeout_s=30,
    )
    record = cp.promote_source_candidate(
        candidate_result=result, decision=PromotionDecisionV2(True, "test", {"test": True}, 0.0)
    )
    assert (root / "core" / "new_capability.py").is_file()
    cp.rollback_source_promotion(record=record)
    assert not (root / "core" / "new_capability.py").exists()
