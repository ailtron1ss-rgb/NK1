def test_strategy_recommendation_is_multi_objective(tmp_path):
    from core.nomega.continual_strategy_portfolio_v1 import ContinualStrategyPortfolioV1
    p=ContinualStrategyPortfolioV1(tmp_path)
    p.record('naive','current',delta=.30,retention=.01,cost=3,cycle_id='a')
    p.record('replay','current',delta=.20,retention=.20,cost=3,cycle_id='b')
    learning=p.recommend('current',objective='learning',candidates=('naive','replay'),budget=1)
    retention=p.recommend('current',objective='retention',candidates=('naive','replay'),budget=1)
    assert learning[0]['strategy']=='naive'
    assert retention[0]['strategy']=='replay'


def test_self_development_plan_contains_strategy_router(tmp_path):
    from core.nomega.self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
    p=SelfDevelopmentOrchestratorV1(tmp_path,seed=11131).plan({'neural_grounding':.2}, ['sum3','xor3'])
    assert 'continual_strategy_plan' in p
    assert p['continual_strategy_plan']['ranked']


def test_persistent_bank_default_is_host_portable():
    from core.persistent_bank import PersistentBank
    bank=PersistentBank()
    assert not bank.path.is_absolute()
    assert str(bank.path).endswith('runtime/nullseed_skill_bank.json')
