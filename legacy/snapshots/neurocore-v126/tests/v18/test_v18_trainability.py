from tools.v18.train_v18 import train_once

def test_v18_trainable_smoke():
    rows=[train_once(t,0,steps=6) for t in ('identity','running_mean','delayed_copy','change_point')]
    assert all(r.final<r.initial for r in rows); assert all(r.grad_fraction>.5 for r in rows); assert all(r.param_delta>0 for r in rows)
