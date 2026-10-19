from pathlib import Path
import torch
from core.nomega.config import NOMEGAConfig
from core.nomega.runtime import NOmegaRuntime
from core.nomega.task_generator_v4 import make_tasks_v4, split_v4
from core.nomega.joint_learning_v2 import JointGeneralistV2, TraceAlignment
from core.nomega.world_model_v2 import MultiStepWorldModel
from core.nomega.multimodal_grounding_v2 import GroundingAlignerV2
from core.nomega.mobile_optimizer_v4 import MobileOptimizerV4
from core.nomega.memory_v2 import MemoryConsolidatorV2


def test_v4_curriculum_has_compositional_and_adversarial_holdout():
    rows=make_tasks_v4(9,2,2,1); tr,ho,adv=split_v4(rows)
    assert len(tr)>0 and len(ho)>0 and len(adv)>0
    assert any(x.compositional for x in rows)
    assert all(x.split=='adversarial' for x in adv)
    assert len(set(x.family for x in rows)) >= 15


def test_joint_generalist_trains_and_saves(tmp_path):
    rows=make_tasks_v4(11,2,1,1); tr,ho,adv=split_v4(rows)
    families=sorted(set(x.family for x in rows))
    j=JointGeneralistV2(families,latent_dim=48,hidden=48,vocab=512,actions=8)
    before=j.evaluate(ho+adv); rep=j.train(tr,None,steps=2); after=j.evaluate(ho+adv)
    path=j.save(tmp_path/'candidate.pt',{'before':before,'after':after})
    assert rep['loss'] >= 0 and after['family_acc'] >= 0 and Path(path).exists()


def test_world_model_multistep_rollout_is_finite():
    m=MultiStepWorldModel(dim=16,actions=4,hidden=24)
    z=torch.randn(2,16); acts=torch.tensor([0,1,2])
    states,uncs,rewards=m.rollout(z,acts)
    assert len(states)==4 and all(torch.isfinite(x).all() for x in states)
    assert all(torch.isfinite(x).all() for x in uncs+rewards)


def test_multimodal_alignment_head():
    a=GroundingAlignerV2(16,24)
    t=torch.randn(4,16); i=torch.randn(4,16); x=a.contrastive(*a.forward(t,i)[:2])
    assert torch.isfinite(x) and float(x)>=0


def test_mobile_optimizer_returns_safe_profile():
    r=MobileOptimizerV4().choose(4.0,False,900,500000)
    assert r['needs_pruning'] is True and r['recommended_precision'] in {'int8','int4'}


def test_memory_consolidator_promotes_verified_repeats():
    from core.nomega.memory import CognitiveMemory
    m=CognitiveMemory(16,16)
    m.put('verified procedure','episode',.9,True,key='a')
    m.put('verified procedure','episode',.95,True,key='b')
    rep=MemoryConsolidatorV2(min_support=2).consolidate(m)
    assert rep['promoted']>=1


def test_runtime_omega12_helpers(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile())
    opt=r.omega12_mobile_optimize(900)
    mem=r.omega12_memory_consolidate()
    assert 'target' in opt and 'size' in mem
