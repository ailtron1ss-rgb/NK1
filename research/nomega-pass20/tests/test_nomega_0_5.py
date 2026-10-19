import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

import torch
from core.nomega import NOMEGAConfig, NOmegaCore
from core.nomega.dual_runtime import DualRuntime
from core.nomega.program_runtime import synthetic_tasks
from core.nomega.budget_manager import BudgetManager
from core.nomega.planner import TaskPlanner
from core.nomega.tools import default_registry
from core.nomega.deploy import parameter_report
from core.nomega.research import run_research_suite


def test_dual_runtime_agreement_for_sum():
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    tasks=synthetic_tasks("sum",seed=3,n=4)
    r=DualRuntime().check(code,tasks)
    assert r["compiled"]
    assert r["tiny_accuracy"] >= 0.99
    assert r["hvm_accuracy"] >= 0.99
    assert r["semantic_agreement"] >= 0.99


def test_memory_consolidates_verified_episode():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    c.memory.put("verified concept",kind="episode",reward=1.0,verified=True)
    r=c.memory.consolidate()
    assert r["promoted"] == 1
    assert c.memory.retrieve("verified concept",1)[0]["kind"] == "semantic"


def test_budget_under_thermal_pressure_is_more_conservative():
    bm=BudgetManager(4.0,True)
    normal=bm.for_request(.7,.5,.9,.2)
    hot=bm.for_request(.7,.8,.15,.95)
    assert hot.max_steps <= normal.max_steps
    assert hot.max_candidates <= normal.max_candidates


def test_planner_and_safe_tools():
    plan=TaskPlanner().plan("write a program to sum", "program", {})
    assert plan and plan[-1].action == "verify"
    tools=default_registry()
    out=tools.call("calculator",a=12,b=7,op="mul")
    assert out["ok"] and out["result"] == 84
    assert not tools.call("python_eval",code="1+1")["ok"]


def test_mobile_parameter_report_is_compact():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    rep=parameter_report(c)
    assert rep["parameters"] < 500000
    assert rep["int8_weight_mb"] < rep["fp32_mb"]


def test_research_suite_contract():
    r=run_research_suite()
    assert r["suite"] == "nomega-research"
    assert r["main"]["n"] >= 6
    assert "ablation" in r
    assert "no_memory" in r["ablation"]


def test_curriculum_has_disjoint_holdout_ids():
    from core.nomega.curriculum import generate_curriculum
    tasks = generate_curriculum(7, per_family=3)
    train = {t.task_id for t in tasks if t.split == "train"}
    hold = {t.task_id for t in tasks if t.split == "holdout"}
    assert train and hold and train.isdisjoint(hold)


def test_replay_roundtrip(tmp_path):
    from core.nomega.replay import ReplayBuffer, ReplayItem
    p = tmp_path / "replay.json"
    b = ReplayBuffer(8, 3)
    b.add(ReplayItem("sum", {"a":1,"b":2}, "symbolic", 1.0, "sum"))
    b.save(p)
    c = ReplayBuffer(8, 3)
    assert c.load(p)
    assert len(c.items) == 1 and c.items[0].target_expert == "symbolic"


def test_joint_harness_returns_evaluation(tmp_path):
    from core.nomega.joint_learning import JointLearningHarness
    r = JointLearningHarness(tmp_path, seed=3).run(train_limit=4, holdout_limit=2, router_epochs=1)
    assert "baseline" in r and "candidate" in r and "collect" in r


def test_memory_program_consolidation():
    from core.nomega.memory_program import consolidate_verified_procedures
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    for i in range(2):
        c.memory.put(f"proc {i}", kind="episode", reward=1.0, verified=True, metadata={"program_signature":"ADD"})
    r=consolidate_verified_procedures(c.memory)
    assert r["promoted"] == 1
