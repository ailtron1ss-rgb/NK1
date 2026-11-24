from core.nomega.adaptive_environment_forge_v2 import AdaptiveEnvironmentForgeV2

def test_adaptive_forge_creates_distinct_partitions(tmp_path):
    r = AdaptiveEnvironmentForgeV2(tmp_path, seed=31).forge_targeted('sum3', bottleneck_score=.9, uncertainty=.8, count=12)
    assert r.accepted >= 3
    assert r.train + r.holdout + r.ood == r.accepted
    assert r.ood >= 1

def test_adaptive_forge_rejects_duplicate_rows(tmp_path):
    r1 = AdaptiveEnvironmentForgeV2(tmp_path, seed=31).forge_targeted('sum3', bottleneck_score=.9, uncertainty=.8, count=12)
    r2 = AdaptiveEnvironmentForgeV2(tmp_path, seed=31).forge_targeted('sum3', bottleneck_score=.9, uncertainty=.8, count=12)
    assert r2.novelty <= r1.novelty
