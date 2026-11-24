from pathlib import Path
from core.nomega.task_generator_v3 import make_tasks_v3, split_v3
from core.nomega.program_equivalence_v2 import ProgramEquivalenceV2
from core.nomega.skill_versioning import VersionedSkillRegistry
from core.nomega.trace_replay_v2 import TraceReplayV2
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig
from core.nomega.frontier_evaluator import FrontierEvaluator


def test_v3_generator_has_independent_splits_and_adversarial():
    rows=make_tasks_v3(3,2,2,1); tr,ho,adv=split_v3(rows)
    assert tr and ho and adv
    assert all(x.split=='adversarial' for x in adv)
    assert any(x.compositional for x in rows)


def test_extended_symbolic_families_verify():
    r=NOmegaRuntime(Path('.'),NOMEGAConfig.mobile())
    cases=[('add two values then clamp the result between 10 and 20',{'a':7,'b':8,'lo':10,'hi':20,'op':'sum_then_clamp','expected':15}),('xor two integers and return the parity of the resulting bits',{'a':3,'b':5,'op':'xor_then_parity','expected':0}),('compute (first minus second) times third and add 2',{'a':5,'b':2,'c':4,'k':2,'op':'nested_arithmetic','expected':14})]
    for text,ctx in cases:
        out=r.infer(text,ctx); assert out['verified'] is True


def test_program_equivalence_counterexample_engine():
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    rep=ProgramEquivalenceV2().check(code,code)
    assert rep['equivalent'] is True and rep['counterexample_count']==0


def test_versioned_skill_registry_tracks_regressions():
    s=VersionedSkillRegistry(); s.publish('sum',[(1,0,0)],1.0,True,3,3); s.publish('sum',[(1,0,0)],0.7,True,2,3)
    assert s.stats()['versions']==2 and len(s.regressions())>=1


def test_trace_replay_prioritizes_failures():
    rep=TraceReplayV2().rank([{'verified':True,'confidence':.9},{'verified':False,'confidence':.2}])
    assert rep[0].index==1


def test_frontier_benchmark_smoke():
    r=NOmegaRuntime(Path('.'),NOMEGAConfig.mobile()); rep=r.frontier_benchmark(); assert rep['total_cases']>0
