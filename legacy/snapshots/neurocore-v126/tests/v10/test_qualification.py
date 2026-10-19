from neurocore.baseline_suite_v10 import MatchedGRU,MatchedSSM,LinearAttentionBaseline

def test_baseline_forward():
    import torch
    x=torch.randn(2,4,16)
    for m in (MatchedGRU(16,16),MatchedSSM(16,16),LinearAttentionBaseline(16)):
        y=m(x); assert y.shape==x.shape; assert torch.isfinite(y).all()
