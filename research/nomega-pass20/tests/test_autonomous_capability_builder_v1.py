from pathlib import Path

from core.nomega.autonomous_capability_builder_v1 import AutonomousCapabilityBuilderV1
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2


def _broken_sum3(code):
    out = [tuple(x) for x in code]
    for i, (op, a, b) in enumerate(out):
        if op in {3, 4, 5, 15, 17, 18}:
            out[i] = (5 if op == 3 else 3, a, b)
            return out
    raise AssertionError("template does not contain a repairable arithmetic opcode")


def test_builder_promotes_only_after_matched_verified_gates(tmp_path: Path):
    acq = ProgramAcquisitionCoreV2(tmp_path, seed=71)
    candidate = [tuple(x) for x in acq.templates("sum3")[0]]
    baseline = _broken_sum3(candidate)
    report = AutonomousCapabilityBuilderV1(tmp_path, seed=26071, max_candidates=16).build(
        family="sum3",
        candidate_code=candidate,
        baseline_code=baseline,
        seeds=(71, 72, 73),
        context={"test": True},
    )
    assert report["accepted"] is True
    assert report["promotion_eligible"] is True
    assert report["artifact_id"]
    assert report["restart_consistent"] is True
    assert report["verified_seed_fraction"] == 1.0
    assert Path(report["archive_path"]).exists()
    assert Path(report["manifest_path"]).exists()


def test_builder_substrate_guidance_preserves_promotion_and_reduces_exact_search(tmp_path: Path):
    acq = ProgramAcquisitionCoreV2(tmp_path, seed=171)
    candidate = [tuple(x) for x in acq.templates("sum3")[0]]
    baseline = _broken_sum3(candidate)
    guided = AutonomousCapabilityBuilderV1(tmp_path, seed=31071, max_candidates=8).build(
        family="sum3", candidate_code=candidate, baseline_code=baseline, seeds=(171, 172, 173), substrate_guided=True
    )
    unguided = AutonomousCapabilityBuilderV1(tmp_path, seed=31071, max_candidates=8).build(
        family="sum3", candidate_code=candidate, baseline_code=baseline, seeds=(171, 172, 173), substrate_guided=False
    )
    assert guided["accepted"] is True
    assert guided["substrate_guided"] is True
    assert guided["substrate_predicted_evaluations"] > 0
    assert guided["mean_holdout_gain"] == unguided["mean_holdout_gain"]
    assert guided["mean_ood_gain"] == unguided["mean_ood_gain"]
    assert guided["substrate_exact_train_evaluations"] < unguided["substrate_exact_train_evaluations"]
