from core.nomega.online_stream_monitor_v1 import OnlineStreamMonitorV1

def test_stream_monitor_has_four_modes():
    m = OnlineStreamMonitorV1(window=4, micro_uncertainty=0.2, adapt_uncertainty=0.5, quarantine_uncertainty=0.9)
    assert m.decide()['mode'] == 'NO_UPDATE'
    for _ in range(4): m.observe({'uncertainty':0.3,'reward':0.9,'novelty':0.0})
    assert m.decide()['mode'] == 'MICRO_UPDATE'
    for _ in range(4): m.observe({'uncertainty':0.6,'reward':0.5,'novelty':0.2})
    assert m.decide()['mode'] == 'ADAPT'
    for _ in range(4): m.observe({'uncertainty':0.95,'reward':0.2,'novelty':0.8})
    assert m.decide()['mode'] == 'QUARANTINE'
