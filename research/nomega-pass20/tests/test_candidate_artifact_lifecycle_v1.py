from core.nomega.candidate_artifact_lifecycle_v1 import CandidateArtifactLifecycleV1


def test_candidate_lifecycle_promote_and_replay(tmp_path):
    lifecycle = CandidateArtifactLifecycleV1(tmp_path)
    first = lifecycle.register_candidate(
        candidate={"code": [[1, 0, 0], [14, 0, 0]]},
        candidate_hash="cand-a",
        cycle_id="cycle-a",
        experiment_id="exp-a",
        evaluation={"score": 0.8},
    )
    lifecycle.update_evaluation(first.artifact_id, {"gates": {"holdout_gain": True}})
    lifecycle.promote(first.artifact_id)
    context = lifecycle.replay_context()
    assert context["active_artifact_id"] == first.artifact_id
    assert context["ancestry"][0]["candidate_hash"] == "cand-a"


def test_candidate_lifecycle_rollback_restores_parent(tmp_path):
    lifecycle = CandidateArtifactLifecycleV1(tmp_path)
    a = lifecycle.register_candidate(candidate={"version": 1}, candidate_hash="a", cycle_id="a", experiment_id="a")
    lifecycle.promote(a.artifact_id)
    b = lifecycle.register_candidate(candidate={"version": 2}, candidate_hash="b", cycle_id="b", experiment_id="b")
    lifecycle.promote(b.artifact_id)
    rolled = lifecycle.rollback(reason="regression")
    assert rolled is not None
    assert rolled.status == "rolled_back"
    current = lifecycle.current()
    assert current is not None
    assert current.artifact_id == a.artifact_id
    assert current.stage == "active_restored"


def test_candidate_lifecycle_event_chain_persists(tmp_path):
    lifecycle = CandidateArtifactLifecycleV1(tmp_path)
    a = lifecycle.register_candidate(candidate={"x": 1}, candidate_hash="x", cycle_id="c", experiment_id="e")
    lifecycle.reject(a.artifact_id, reason="failed_gate")
    state = lifecycle.snapshot()
    assert len(state["history"]) >= 2
    assert state["last_event_hash"] != "GENESIS"
    assert (tmp_path / "runtime" / "candidate_artifact_events_v1.jsonl").exists()
