from core.nomega.metaproductivity_v1 import MetaproductivityTrackerV1

def test_metaproductivity_rewards_productive_lineages(tmp_path):
    t = MetaproductivityTrackerV1(tmp_path)
    t.record(candidate_hash='a', parent_hash=None, cycle_id='c0', verified_gain=.0, compute_cost=1.0, repair_success=False, transfer_gain=0.0)
    t.record(candidate_hash='b', parent_hash='a', cycle_id='c1', verified_gain=.1, compute_cost=1.0, repair_success=True, transfer_gain=.05, accepted=True, status='promoted')
    t.record(candidate_hash='c', parent_hash='a', cycle_id='c2', verified_gain=.1, compute_cost=1.0, repair_success=False, transfer_gain=.02, accepted=True, status='promoted')
    report = t.report('a')
    assert report.descendant_yield > 0.0
    assert report.verified_gain_per_compute > 0.0
    assert report.diversity > 0.0
