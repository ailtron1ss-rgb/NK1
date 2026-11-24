from core.nomega.canonical_consolidation_planner_v1 import CanonicalConsolidationPlannerV1


def test_consolidation_planner_groups_versioned_siblings(tmp_path):
    core = tmp_path / "core" / "nomega"
    core.mkdir(parents=True)
    (core / "foo_v1.py").write_text("class Foo:\n    def run(self): return 1\n", encoding="utf-8")
    (core / "foo_v2.py").write_text("class Foo:\n    def run(self): return 2\n", encoding="utf-8")
    plan = CanonicalConsolidationPlannerV1(tmp_path).plan()
    assert plan.versioned_modules == 2
    assert plan.families == 1
    assert plan.candidates[0].family == "foo"
    assert plan.candidates[0].recommendation in {"behavioral_proof", "adapter", "research_only"}
    assert plan.singleton_versioned_modules == 0
    assert (tmp_path / "runtime" / "canonical_consolidation_plan_v1.json").exists()


def test_consolidation_planner_detects_exact_duplicates(tmp_path):
    core = tmp_path / "core" / "nomega"
    core.mkdir(parents=True)
    content = "class Foo:\n    def run(self): return 1\n"
    (core / "foo_v1.py").write_text(content, encoding="utf-8")
    (core / "foo_v2.py").write_text(content, encoding="utf-8")
    plan = CanonicalConsolidationPlannerV1(tmp_path).plan()
    assert plan.exact_merge_groups == 1
    assert plan.candidates[0].recommendation == "exact_merge"
    assert set(plan.candidates[0].exact_duplicates) == {"foo_v1", "foo_v2"}
