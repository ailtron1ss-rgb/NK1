from __future__ import annotations

from pathlib import Path


def _evidence():
    return {
        "benchmark_id": "coalition-v1", "verified_rate": 1.0, "holdout": 1.0,
        "ood": 1.0, "adversarial": 1.0, "restart_delta": 0.0,
        "multi_seed_count": 3, "independent_runs": 2, "equal_budget": True,
        "trajectory_hashes": ["a", "b", "c"], "provenance_sources": 2,
    }


def test_coalition_audit_masks_repeatedly_harmful_skill_for_target_family(tmp_path: Path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    bank = SkillBank(governance=SkillGovernanceV1(tmp_path))
    good = bank.admit("good", [(1,0,3),(14,0,0)], "sum3", 1.0, _evidence())["skill_id"]
    bad = bank.admit("bad", [(1,0,0),(14,0,0)], "sum3", 1.0, _evidence())["skill_id"]
    for i in range(3):
        # Actual evaluator supplied the measured score: removing `bad` raises
        # target-family score from 0.80 to 0.95.
        out = bank.record_coalition_audit("unseen_sum", [good, bad], 0.80, {good:0.80, bad:0.95}, evaluation_id=f"e{i}")
        assert bad in out["measured"]
    assert bad in bank.masked_for_family("unseen_sum")
    ids = [row["skill_id"] for row in bank.coalition_rank("unseen_sum")]
    assert bad not in ids and good in ids


def test_coalition_evidence_round_trip(tmp_path: Path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    a = SkillBank(governance=SkillGovernanceV1(tmp_path))
    sid = a.admit("good", [(1,0,3),(14,0,0)], "sum3", 1.0, _evidence())["skill_id"]
    a.record_coalition_audit("sum3", [sid], 1.0, {sid:0.9}, evaluation_id="e0")
    b = SkillBank(governance=SkillGovernanceV1(tmp_path))
    b.load(a.export())
    assert b.coalition_state["sum3"][sid]["attempts"] == 1
    assert b.coalition_rank("sum3")[0]["skill_id"] == sid


def test_partial_provenance_cannot_activate_reusable_skill(tmp_path: Path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    ev = _evidence(); ev["provenance_sources"] = 1
    bank = SkillBank(governance=SkillGovernanceV1(tmp_path))
    out = bank.admit("one source", [(1,0,3),(14,0,0)], "sum3", 1.0, ev)
    assert out["status"] == "probation"


def test_canonical_runtime_retrieval_respects_target_family_mask(tmp_path: Path):
    from core.nomega.config import NOMEGAConfig
    from core.nomega.runtime import NOmegaRuntime
    from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
    cfg = NOMEGAConfig(
        latent_dim=16, memory_dim=16, router_hidden=16, world_model_hidden=16, max_reason_steps=1,
        generalist_influence=0.0, hybrid_reasoner_influence=0.0, sparse_moe_influence=0.0,
        enable_executable_spine_v2=False,
    )
    runtime = NOmegaRuntime(tmp_path, cfg)
    good = ProgramAcquisitionCoreV2(tmp_path, seed=1).templates("sum3")[0]
    bad = [(1, 0, 0), (14, 0, 0)]
    ev = runtime.core.skill_governance.inspect(_evidence()).to_dict()
    runtime.core.skill_bank.admit("good", good, "sum3", 1.0, _evidence())
    bad_id = runtime.core.skill_bank.admit("bad", bad, "sum3", 1.0, _evidence())["skill_id"]
    runtime.core.skill_lifecycle.observe_coalition(
        family="sum3", coalition_skill_ids=[bad_id], coalition_score=0.70,
        leave_one_out_scores={bad_id:0.95}, evaluation_id="target-0", min_observations=1, mask_threshold=0.02,
    )
    hits = runtime.core.skill_lifecycle.coalition("sum3", max_items=8)
    assert all(row["skill_id"] != bad_id for row in hits)
