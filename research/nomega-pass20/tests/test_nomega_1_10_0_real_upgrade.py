from pathlib import Path


def test_gradient_alignment_replay_rank_is_real_and_persistent(tmp_path):
    import torch
    from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
    from core.nomega.gradient_alignment_replay_v1 import GradientAlignmentReplayV1
    model=NeuralProgramSynthesizerV2(hidden=12,latent_dim=12,max_len=8,max_b=16,layers=1,heads=2)
    rows=[('task=sum3 ops=ADD>ADD refs=x0,x1,x2',[(1,0,1),(1,0,2),(14,0,0)],0),
          ('task=sum3 ops=ADD>ADD refs=x0,x1,x2',[(1,0,2),(1,0,3),(14,0,0)],0)]
    r=GradientAlignmentReplayV1(tmp_path)
    out=r.rank(model,rows[:1],rows,limit=1)
    assert len(out)==1
    assert r.snapshot()['stats']['calls']==1


def test_causal_development_planner_explores_unknown_and_prefers_evidence(tmp_path):
    from core.nomega.causal_self_model_v1 import CausalSelfModelV1
    from core.nomega.causal_development_planner_v1 import CausalDevelopmentPlannerV1
    m=CausalSelfModelV1(tmp_path)
    for i,d in enumerate((.1,.2,.15)):
        m.record(bottleneck='neural_grounding',intervention='good',target='ood_coverage',baseline=.1,outcome=.1+d,cycle_id=str(i))
    p=CausalDevelopmentPlannerV1(tmp_path,exploration=.05)
    out=p.recommend('neural_grounding','ood_coverage',['good','unknown'],budget=2)
    assert out['selected'][0]['intervention']=='good'


def test_unlearning_precision_recall_benchmark_is_non_decorative(tmp_path):
    from core.nomega.unlearning_benchmark_v1 import UnlearningBenchmarkV1
    out=UnlearningBenchmarkV1(tmp_path).run_fixed()
    assert out['precision']==1.0
    assert out['recall']==1.0
    assert out['beneficial_retained']==4


def test_multiscale_consolidation_assigns_fast_medium_slow_and_quarantine(tmp_path):
    from core.nomega.multiscale_consolidation_v1 import MultiTimescaleConsolidationV1
    c=MultiTimescaleConsolidationV1(tmp_path)
    out=c.consolidate([
      {'key':'a','verified':False,'reward':.2,'uses':0,'status':'candidate'},
      {'key':'b','verified':True,'reward':.6,'uses':1,'status':'validated'},
      {'key':'c','verified':True,'reward':.9,'uses':3,'status':'trusted'},
      {'key':'d','verified':True,'reward':.9,'uses':3,'status':'quarantined'},
    ])
    assert out['counts']=={'fast':1,'medium':1,'slow':1,'quarantine':1}


def test_gradient_aligned_training_path_is_opt_in(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2
    learner=ExecutionGuidedProgramLearnerV1(tmp_path,seed=1201,hidden=12)
    rows=learner.training_rows(('sum3',),condition_mode='typed',include_replay=False)[:3]
    model=NeuralProgramSynthesizerV2(hidden=12,latent_dim=12,max_len=8,max_b=16,layers=1,heads=2)
    trainer=NeuralProgramTrainerV2(model,seed=1202)
    report=trainer.fit(rows,epochs=2,max_examples=3,teacher_forcing_start=1.0,teacher_forcing_end=1.0,
                       replay_controller=learner.fixed_replay_schedule,
                       replay_provider=lambda n: rows, replay_ranker=learner.gradient_alignment_replay.rank,
                       replay_max_items=1)
    assert report.replay_events >= 1
    assert report.replay_hook_errors == 0


def test_fixed_replay_scheduler_triggers_equal_budget(tmp_path):
    from core.nomega.fixed_replay_schedule_v1 import FixedReplayScheduleV1
    c=FixedReplayScheduleV1(tmp_path)
    assert c.decide(step=1,parameter_delta=1.0,loss=1.0).trigger
    assert c.snapshot()['events']

def test_gradient_alignment_ablation_is_causal_component_experiment(tmp_path):
    from core.nomega.gradient_alignment_ablation_v1 import GradientAlignmentAblationV1
    out=GradientAlignmentAblationV1(tmp_path).run_fixed(seeds=(41,42),steps=1)
    assert len(out['rows'])==2
    assert 'mean_causal_gain' in out
    assert out['promotion'] in {'research-only','component-only-positive'}
