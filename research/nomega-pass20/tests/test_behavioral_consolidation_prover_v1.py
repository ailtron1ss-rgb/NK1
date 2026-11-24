from pathlib import Path

from core.nomega.behavioral_consolidation_prover_v1 import BehavioralConsolidationProverV1


def test_prover_generates_conservative_pair_report(tmp_path: Path):
    core = tmp_path / "core" / "nomega"
    core.mkdir(parents=True)
    (tmp_path / "runtime").mkdir(parents=True)
    (tmp_path / "core" / "__init__.py").write_text("", encoding="utf-8")
    (tmp_path / "core" / "nomega" / "__init__.py").write_text("", encoding="utf-8")
    (core / "demo_v1.py").write_text("class DemoV1:\n    def run(self, x=1):\n        return x\n", encoding="utf-8")
    (core / "demo_v2.py").write_text("class DemoV2:\n    def run(self, x=1):\n        return x + 0\n", encoding="utf-8")
    prover = BehavioralConsolidationProverV1(tmp_path)
    proof = prover.prove("demo")
    assert proof.modules == ("demo_v1", "demo_v2")
    assert proof.api_overlap == 1.0
    assert proof.method_overlap == 1.0
    assert proof.recommendation == "behavioral_proof_ready"
