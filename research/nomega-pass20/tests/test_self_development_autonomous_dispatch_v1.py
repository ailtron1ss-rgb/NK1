from pathlib import Path

from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1


def test_orchestrator_dispatches_selected_intervention(tmp_path: Path):
    orchestrator = SelfDevelopmentOrchestratorV1(tmp_path, seed=1209)
    metrics = {
        "generalist_unseen_family_future_gain": -0.2,
        "transfer_generalization": 0.0,
        "ood_coverage": 0.25,
        "raw_neural_verified_rate": 1.0,
        "repair_verified_rate": 1.0,
    }
    report = orchestrator.run_autonomous_intervention(
        metrics,
        context={
            "seeds": (1209,),
            "candidate_cap": 32,
            "source_families": ("sum3", "xor3"),
            "target_families": ("minmax3",),
        },
    )
    assert report["intervention"]["status"] == "completed"
    assert report["frontier"]["selected"]["action"] in {
        "learn_multi_source_generalist_operator_policy",
        "cross_family_repair_operator_transfer",
        "expand_paraphrase_and_holdout_families",
    }
    assert report["cycle_id"]


def test_registry_marks_interventions_canonical(tmp_path: Path):
    from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1
    report = CanonicalModuleRegistryV1(tmp_path).scan()
    # Empty roots are valid; this is a contract test for the target map itself.
    assert CanonicalModuleRegistryV1.preferred_target("development_interventions")[0] == "development_intervention_registry_v1"
