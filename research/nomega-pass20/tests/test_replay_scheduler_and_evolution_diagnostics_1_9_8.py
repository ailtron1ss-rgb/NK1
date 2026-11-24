from pathlib import Path
from core.nomega.adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
from core.nomega.replay_scheduler_v1 import TransferAwareReplaySchedulerV1
from core.nomega.evolution_diagnostics_v1 import EvolutionDiagnosticsV1


def _put(m, family, reward, key_text):
    return m.store_verified(
        family=family, text=key_text, code=[(1,0,0),(14,0,0)], reward=reward,
        source='test', cycle_id='c', status='validated', confidence=0.9
    )


def test_transfer_aware_replay_preserves_anchor_and_penalizes_negative_transfer(tmp_path):
    m=AdaptiveExperienceMemoryV3(tmp_path)
    a=_put(m,'sum3',.8,'anchor add three')
    b=_put(m,'hard',.9,'hard target')
    c=_put(m,'bad',.95,'bad transfer')
    m.observe_transfer('bad','hard',-0.9,cycle_id='x')
    m.observe_transfer('hard','hard',0.0,cycle_id='x')
    chosen=m.retrieve_replay_transfer_aware(['sum3','hard','bad'],max_items=3,current_family='hard',anchor_families=('sum3',))
    keys=[x['record']['key'] for x in chosen]
    assert a in keys
    assert c not in keys or any(x['replay_decision']['negative_transfer_risk']>0 for x in chosen if x['record']['key']==c)


def test_scheduler_persists_decision_lineage(tmp_path):
    s=TransferAwareReplaySchedulerV1(tmp_path)
    records=[{'key':'a','family':'sum3','verified':True,'status':'validated','reward':.8,'confidence':.9,'created_at':1.0,'last_used':1.0}]
    out=s.rank(records,current_family='sum3',families=('sum3',),anchor_families=('sum3',),max_items=1,now=2.0,transfer_state={})
    assert len(out)==1 and out[0].anchor
    assert s.path.exists() and s.snapshot()['decisions']


def test_evolution_diagnostics_distinguishes_retune_and_reintroduction(tmp_path):
    d=EvolutionDiagnosticsV1(tmp_path)
    ret=d.classify_edit([(1,0,0),(14,0,0)],[(1,0,0),(14,1,0)])
    assert ret['kind']=='parameter_retune'
    rein=d.classify_edit([(1,0,0)],[(1,0,0),(14,1,0)],deleted_history=[(14,1,0)])
    assert rein['kind']=='reintroduction'
    d.record(parent=[(1,0,0),(14,0,0)],child=[(1,0,0),(14,1,0)],family='sum3',outcome={'success':1},cycle_id='c')
    assert d.mechanism_summary()['traces']==1


def test_training_rows_can_use_transfer_aware_replay(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    learner=ExecutionGuidedProgramLearnerV1(tmp_path,seed=19801,hidden=20)
    learner.experience_memory.store_verified(family='sum3',text='add three',code=[(1,0,0),(14,0,0)],reward=.9,source='test',cycle_id='boot',status='validated')
    rows=learner.training_rows(('sum3',),condition_mode='canonical',include_replay=True,replay_limit=2,replay_mode='transfer_aware')
    assert rows
