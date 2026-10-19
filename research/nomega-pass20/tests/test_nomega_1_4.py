from pathlib import Path
import torch
from core.nomega.apex_brain_v4 import ApexBrainV4
from core.nomega.ood_curriculum_v5 import make_tasks_v5, split_v5
from core.nomega.long_horizon_planner_v3 import LongHorizonPlannerV3
from core.nomega.world_model_v3 import WorldModelV3
from core.nomega.skill_transfer_v4 import SkillTransferV4
from core.nomega.mobile_optimizer_v6 import MobileOptimizerV6
from core.nomega.joint_learning_v4 import JointLearningV4
from core.nomega.development_cycle_v4 import OmegaDevelopmentCycleV4
from core.nomega.project_audit_v4 import audit
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig
from core.nomega.generalist_core import encode_text


def test_apex_brain_forward_and_modalities():
    m=ApexBrainV4(['a','b'],latent_dim=16,hidden=24,vocab=256,actions=4)
    ids=encode_text('hello world',256).unsqueeze(0); out=m(ids,[torch.randn(1,16),torch.randn(1,16)])
    assert out.latent.shape==(1,16) and torch.isfinite(out.latent).all()

def test_ood_curriculum_splits_and_families():
    rows=make_tasks_v5(2,4); tr,ho,adv=split_v5(rows)
    assert tr and ho and adv and len(set(r.family for r in rows))>=8 and all(r.split=='adversarial' for r in adv)

def test_long_horizon_planner_bounded():
    m=WorldModelV3(16,4,24,3); p=LongHorizonPlannerV3(m,beam_size=3,horizon=3).plan(torch.randn(1,16),[0,1,2])
    assert len(p)==3 and all(len(x.actions)==3 and torch.isfinite(torch.tensor(x.score)) for x in p)

def test_skill_transfer_v4_composition():
    s=SkillTransferV4(); s.add('a',.92,True,['a']); s.add('b',.91,True,['b']); c=s.compose(['a','b'])
    assert c and c.verified and c.quality<.92 and s.transfer_score(c.name,'compose',.9)>0

def test_mobile_optimizer_v6_pareto():
    r=MobileOptimizerV6().recommend(4.0,False,900,500000,.8)
    assert r and r['config']['name'] in {'mid','nano'}

def test_joint_learning_v4_improves_or_runs():
    rows=make_tasks_v5(3,3); tr,ho,adv=split_v5(rows); j=JointLearningV4(sorted(set(r.family for r in rows)),latent=16,hidden=24,vocab=256,actions=4)
    b=j.evaluate(ho); rep=j.train(tr,steps=2); a=j.evaluate(ho); assert rep['steps']==2 and a['family_acc']>=0 and b['family_acc']>=0

def test_development_cycle_v4_writes_candidate(tmp_path):
    rep=OmegaDevelopmentCycleV4(tmp_path,seed=5).run(per_family=2,steps=1)
    assert Path(rep['candidate_checkpoint']).exists() and 'world_model' in rep and 'mobile' in rep and 'promotion' in rep

def test_audit_v4_counts_project():
    rep=audit(Path('.')); assert rep['modules']>0 and rep['syntax_pct']==100.0


def test_runtime_omega14_helpers(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile())
    pareto=r.omega14_mobile_pareto(900); ar=r.omega14_audit(10,10)
    assert pareto and ar['testing_pct']==100.0


def test_promotion_requires_verified_trace_signal():
    from core.nomega.development_cycle_v4 import OmegaDevelopmentCycleV4
    rep=OmegaDevelopmentCycleV4(Path('/tmp/nomega_promotion_test'),seed=17).run(per_family=2,steps=1)
    assert rep['promotion']['trace_verified_floor'] >= 0.0
    if rep['promotion']['trace_verified_floor'] < 0.50:
        assert rep['promotion']['promote'] is False
