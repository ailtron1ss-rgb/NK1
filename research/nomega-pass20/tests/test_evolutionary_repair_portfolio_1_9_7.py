from core.nomega.evolutionary_repair_portfolio_v1 import EvolutionaryRepairPortfolioV1


def test_portfolio_is_bounded_and_diverse(tmp_path):
    p=EvolutionaryRepairPortfolioV1(tmp_path,seed=1977)
    raw=[(1,0,0),(1,1,1),(3,0,1),(14,0,0)]
    pool=p.build_pool('sum3',raw,budget=12,adaptive=True)
    assert pool and len(pool)<=12
    assert len({tuple(tuple(x) for x in r['code']) for r in pool})==len(pool)
    assert all(r['source'] in {'raw_local','verified_archive_parent'} for r in pool)


def test_portfolio_can_reuse_verified_archive_parent(tmp_path):
    from core.nomega.evolution_archive_v1 import EvolutionArchiveV1
    a=EvolutionArchiveV1(tmp_path)
    code=[(1,0,0),(1,1,1),(3,0,1),(14,0,0)]
    a.add(family='sum3',operator='baseline_verified',code=code,verified=True,success=1.0,search_cost=0,complexity=.1,source='baseline_verified',cycle_id='c')
    p=EvolutionaryRepairPortfolioV1(tmp_path,seed=1978)
    pool=p.build_pool('sum3',code,budget=24,adaptive=True)
    assert pool
    assert any(r['source']=='verified_archive_parent' for r in pool)
