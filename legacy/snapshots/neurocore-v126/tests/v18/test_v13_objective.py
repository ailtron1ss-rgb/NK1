import torch
from neurocore.v18 import NeuroWeaveV13, frontier_loss


def test_frontier_loss_is_finite_and_backpropagates():
    torch.manual_seed(220)
    m = NeuroWeaveV13(d=8, hidden=16, max_experts=4, top_k=1, world_horizon=1, world_candidates=2)
    y = m(torch.randn(4, 7, 8), commit_memory=False)
    loss = frontier_loss(y, torch.randn(4, 8))
    assert torch.isfinite(loss)
    loss.backward()
    nonzero = sum(int(p.grad is not None and torch.isfinite(p.grad).all()) for p in m.parameters() if p.requires_grad)
    assert nonzero > 0
