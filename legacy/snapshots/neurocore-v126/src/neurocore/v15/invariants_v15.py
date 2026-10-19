import torch

def assert_finite_tree(d):
    for v in d.values():
        if torch.is_tensor(v): assert torch.isfinite(v).all()
def assert_probability(p): assert torch.allclose(p.sum(-1),torch.ones_like(p.sum(-1)),atol=1e-5)
def assert_bounded(x,lo=0,hi=1): assert bool((x>=lo).all() and (x<=hi).all())
def assert_monotonic_capacity(k,cap): assert k<=cap
