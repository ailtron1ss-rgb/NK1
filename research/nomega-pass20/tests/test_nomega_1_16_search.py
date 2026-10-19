from pathlib import Path
import tempfile
import torch

from core.nomega.neural_program_synth_v10 import NeuralProgramSynthesizerV10
from core.nomega.semantic_repair_v2 import semantic_targeted_mutations
from core.nomega.verifier_guided_search_v1 import VerifierGuidedSearchV1
from core.nomega.grounding_recovery_controller_v1 import GroundingRecoveryControllerV1


def test_targeted_repair_is_semantic_and_bounded():
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    rows=semantic_targeted_mutations(code, "xor three values", limit=12)
    assert rows
    assert len(rows) <= 12
    assert any(any(op == 5 for op,_,_ in row) for row in rows)


def test_verifier_guided_search_selects_verified_candidate():
    engine=VerifierGuidedSearchV1()
    result=engine.search(
        [("bad", [(1,0,0)], 0.9), ("good", [(1,0,1),(14,0,0)], 0.4)],
        lambda c: (1.0 if len(c) > 1 else 0.0, len(c) > 1),
        max_evaluations=2,
    )
    assert result.selected_accepted
    assert result.selected == [(1,0,1),(14,0,0)]


def test_v10_candidate_portfolio_and_reproducible_signature():
    torch.manual_seed(7)
    model=NeuralProgramSynthesizerV10(hidden=32,layers=1,heads=2,max_len=12,max_b=16)
    rows=model.generate_candidates("add the first three values", family_id=0, beam_size=2, candidates=4)
    assert rows
    assert len(rows) <= 4
    assert all(code and code[-1][0] == 14 for _,code in rows)
    assert model.checkpoint_signature()["version"] == "typed-sketch-search-v10"


def test_recovery_controller_budget_is_bounded():
    with tempfile.TemporaryDirectory() as d:
        ctrl=GroundingRecoveryControllerV1(Path(d), seed=1)
        code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
        result=ctrl.recover(code,"sum3",uncertainty=0.8,novelty=0.8,estimated_exec_ms=2.0,remaining_budget_ms=12.0,max_candidates=4)
        assert result.candidates_tested >= 1
        assert result.remaining_budget_ms >= 0
