from neurocore.v17.trainability import run_grid, summary

def test_trainability_grid_minimum():
    rows=run_grid(seeds=(0,),tasks=('identity','delayed_copy','running_mean'))
    assert len(rows)==9
    s=summary(rows)
    for v in s.values():
        assert v['mean_grad_nonzero_fraction'] > 0.5
        assert v['mean_param_delta_l2'] > 0
        assert v['mean_final'] < v['mean_initial']

def test_neuroweave_is_trainable_on_memory_task():
    rows=run_grid(seeds=(0,1),tasks=('delayed_copy',))
    nw=[r for r in rows if r.model=='NeuroWeaveV10']
    assert all(r.final_loss < r.initial_loss for r in nw)
