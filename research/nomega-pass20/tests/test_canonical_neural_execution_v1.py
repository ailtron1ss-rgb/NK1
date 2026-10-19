from pathlib import Path

from core.nomega.canonical_neural_execution_v1 import CanonicalNeuralProgramBridgeV1


def test_bridge_is_explicitly_unavailable_without_checkpoint(tmp_path: Path):
    bridge = CanonicalNeuralProgramBridgeV1(
        tmp_path,
        seed=17,
        hidden=16,
        latent_dim=16,
        max_len=8,
        max_b=16,
    )
    assert not bridge.available
    assert bridge.load_error == "checkpoint_missing"


def test_bridge_training_creates_canonical_checkpoint_and_can_propose(tmp_path: Path):
    bridge = CanonicalNeuralProgramBridgeV1(
        tmp_path,
        seed=19,
        hidden=16,
        latent_dim=16,
        max_len=8,
        max_b=16,
    )
    report = bridge.fit(
        families=("sum3",),
        epochs=1,
        variants_per_family=1,
        max_examples=1,
    )
    assert bridge.available
    assert Path(report["checkpoint"]).exists()
    candidate = bridge.propose("sum three values", family="sum3", beam_size=1, max_len=8)
    assert candidate is not None
    assert candidate.family == "sum3"
    assert candidate.source == "pure_neural_v13"
    assert candidate.checkpoint_digest


def test_checkpoint_roundtrip_preserves_canonical_model_signature(tmp_path: Path):
    bridge = CanonicalNeuralProgramBridgeV1(
        tmp_path,
        seed=23,
        hidden=16,
        latent_dim=16,
        max_len=8,
        max_b=16,
    )
    bridge.fit(families=("sum3",), epochs=1, variants_per_family=1, max_examples=1)
    fresh = CanonicalNeuralProgramBridgeV1(
        tmp_path,
        seed=23,
        hidden=16,
        latent_dim=16,
        max_len=8,
        max_b=16,
    )
    assert fresh.available
    assert fresh.model_signature()["state_digest"] == bridge.model_signature()["state_digest"]



class _StubNeuralBridge:
    def propose(self, text, *, family=None, beam_size=2, max_len=None):
        from core.nomega.canonical_neural_execution_v1 import NeuralCandidateV1
        return NeuralCandidateV1(
            family=str(family),
            program=[(1, 1, 1)],
            model_version="stub",
            checkpoint_digest="stub-digest",
            source="pure_neural_v13",
        )


def test_executable_spine_reserves_slot_for_neural_candidate(tmp_path: Path):
    from core.nomega.executable_spine_v2 import ExecutableSpineV2

    spine = ExecutableSpineV2(tmp_path, seed=31, max_candidates=2, neural_bridge=_StubNeuralBridge())
    candidates = spine._portfolio_candidates("sum3")
    assert candidates
    assert any(source == "pure_neural_v13" for source, _ in candidates)


def test_executable_spine_keeps_deterministic_path_when_neural_generation_fails(tmp_path: Path):
    class _Broken:
        def propose(self, *args, **kwargs):
            raise RuntimeError("synthetic-neural-failure")

    from core.nomega.executable_spine_v2 import ExecutableSpineV2

    spine = ExecutableSpineV2(tmp_path, seed=33, max_candidates=2, neural_bridge=_Broken())
    candidates = spine._portfolio_candidates("sum3")
    assert candidates
    assert spine.last_neural_error == "RuntimeError: synthetic-neural-failure"
    assert any(source == "template" for source, _ in candidates)


def test_executable_spine_appends_hash_chained_execution_evidence(tmp_path: Path):
    from core.nomega.causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
    from core.nomega.executable_spine_v2 import ExecutableSpineV2

    ledger = CausalEvidenceLedgerV1(tmp_path / "runtime" / "evidence.jsonl")
    spine = ExecutableSpineV2(tmp_path, seed=37, max_candidates=4, evidence_ledger=ledger)
    result = spine.run("sum three values", context={"tape": [2, 3, 4], "expected": 9})
    assert result["contract"]["status"] == "verified"
    integrity = ledger.verify()
    assert integrity["valid"] is True
    assert integrity["records"] == 1
    lines = (tmp_path / "runtime" / "evidence.jsonl").read_text(encoding="utf-8").splitlines()
    assert '"kind": "execution_cycle"' in lines[0]
    assert '"candidate_source": "template"' in lines[0]



def test_training_emits_matched_multi_seed_effect_and_ledger_record(tmp_path: Path):
    from core.nomega.causal_evidence_ledger_v1 import CausalEvidenceLedgerV1

    ledger = CausalEvidenceLedgerV1(tmp_path / "runtime" / "evidence.jsonl")
    bridge = CanonicalNeuralProgramBridgeV1(
        tmp_path, seed=41, hidden=16, latent_dim=16, max_len=8, max_b=16, evidence_ledger=ledger
    )
    report = bridge.train_and_measure(
        families=("sum3",),
        epochs=1,
        variants_per_family=1,
        max_examples=1,
        evaluation_seeds=(101, 202),
    )
    effect = report.evidence["matched_multi_seed_effect"]
    assert [row["seed"] for row in effect] == [101, 202]
    assert "causal_claim_status" in report.evidence
    integrity = ledger.verify()
    assert integrity["valid"] is True
    assert integrity["records"] == 1
    assert '"kind": "neural_program_training"' in (tmp_path / "runtime" / "evidence.jsonl").read_text(encoding="utf-8")


def test_runtime_neural_training_api_wires_bridge_into_live_spine(tmp_path: Path):
    from core.nomega.config import NOMEGAConfig
    from core.nomega.runtime import NOmegaRuntime

    cfg = NOMEGAConfig(latent_dim=24, router_hidden=16, memory_dim=24, max_reason_steps=1)
    runtime = NOmegaRuntime(tmp_path, cfg)
    report = runtime.omega20_neural_program_train(
        families=("sum3",), epochs=1, variants_per_family=1, max_examples=1,
        evaluation_seeds=(111, 222),
    )
    assert report["version"] == "canonical-neural-execution-v1"
    assert runtime.core.executable_spine.neural_bridge is runtime.core.canonical_neural_program
    status = runtime.omega20_neural_program_status()
    assert status["available"] is True


def test_execution_guided_fit_continues_from_existing_checkpoint(tmp_path: Path):
    bridge = CanonicalNeuralProgramBridgeV1(
        tmp_path,
        seed=43,
        hidden=16,
        latent_dim=16,
        max_len=8,
        max_b=16,
    )
    first = bridge.fit(families=("sum3",), epochs=1, variants_per_family=1, max_examples=1)
    before = bridge.checkpoint_digest
    row = ("sum three values", [(1, 0, 0), (1, 1, 1), (3, 0, 1), (1, 3, 2), (3, 0, 3), (13, 0, 0), (14, 0, 0)], 0)
    guided = bridge.fit_execution_guided([row], epochs=1, max_examples=1)
    assert first["checkpoint_digest"] == before
    assert guided["report"]["training_source"] == "execution_guided_verified_repair"
    assert guided["report"]["rows_hash"]
    assert guided["checkpoint_digest"] != before
