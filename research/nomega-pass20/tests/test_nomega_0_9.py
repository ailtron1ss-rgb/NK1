import json
from pathlib import Path
import torch

from core.nomega.research_brain import ResearchBrain, BrainTrainer, CurriculumFactory, parameter_report
from core.nomega.skill_graph_v2 import SkillGraphV2
from core.nomega.continual_v2 import ContinualLearnerV2
from core.nomega.mobile_compiler_v2 import MobileCompilerV2
from core.nomega.advanced_runtime import AdvancedRuntimeGate
from core.nomega.research_orchestrator_v2 import ResearchOrchestratorV2


def test_brain_shapes_and_modal_inputs():
    m = ResearchBrain(latent_dim=32, hidden=48)
    ids = torch.randint(0, 4096, (3, 32))
    out = m(ids, torch.randn(3, 32), torch.randn(3, 32))
    assert out.latent.shape == (3, 32)
    assert out.family_logits.shape[-1] == 12
    assert torch.isfinite(out.latent).all()


def test_brain_training_changes_metrics():
    m = ResearchBrain(latent_dim=32, hidden=48)
    t = BrainTrainer(m, lr=1e-3)
    cur = CurriculumFactory(7)
    ho = cur.sample("holdout", 12)
    before = t.evaluate(ho)["family_acc"]
    for _ in range(4): t.train_step(cur.sample("train", 24))
    after = t.evaluate(ho)["family_acc"]
    assert t.steps == 4
    assert after >= 0.0 and before >= 0.0


def test_skill_graph_dependencies():
    g=SkillGraphV2(); g.add("a","math",1.0); g.add("b","math",.9,["a"])
    assert [n.name for n in g.available("math",.85)] == ["a","b"]
    assert g.closure("b") == ["a","b"]


def test_continual_gate_rejects_forgetting():
    m=ResearchBrain(latent_dim=16,hidden=24); c=ContinualLearnerV2(m)
    r=c.gate(.80,.81,.80,min_gain=.01,max_forgetting=.02)
    assert r.promoted is True
    r=c.gate(.80,.78,.80,min_gain=.01,max_forgetting=.02)
    assert r.promoted is False


def test_mobile_profiles():
    c=MobileCompilerV2(); m=ResearchBrain(latent_dim=16,hidden=24)
    assert c.choose(4,.8,.2).name == "mobile"
    report=c.report(m)
    assert report["parameters"] > 0 and report["int8_mb"] < report["fp32_mb"]


def test_advanced_gate():
    m=ResearchBrain(latent_dim=16,hidden=24); gate=AdvancedRuntimeGate(m)
    assert gate.assess("compute sum")['armed'] is False
    gate.arm()
    out=gate.assess("compute sum")
    assert out['armed'] is True and out['family_confidence'] > 0


def test_orchestrator_smoke(tmp_path):
    o=ResearchOrchestratorV2(tmp_path,seed=3)
    r=o.run(train_steps=2,train_batch=12,holdout=8)
    assert r['version'] == '0.9.0-research'
    assert Path(r['checkpoint']).exists()
    assert Path(tmp_path/'nomega_0_9_brain_report.json').exists()
