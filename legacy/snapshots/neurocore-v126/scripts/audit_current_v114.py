from __future__ import annotations
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
import torch
from dataclasses import replace
from neurocore.current import NeuroCoreCurrent, CurrentConfig, CausalTrunkConfig, ThreeFactorPlasticityConfig, UncertaintyWriteConfig

def _run(model, online_target=False):
    named=list(model.named_modules()); forward_called=set(); custom_called=set(); handles=[]
    for n,mod in named:
        if n and len(list(mod.children()))==0:
            handles.append(mod.register_forward_hook(lambda mod, inp, out, _n=n: forward_called.add(_n)))
    orig_upd=model.trunk.spine.online_plasticity.update
    orig_unc=model.trunk.spine.uncertainty_write_controller.update
    def upd(*a,**kw): custom_called.add("trunk.spine.online_plasticity"); return orig_upd(*a,**kw)
    def unc(*a,**kw): custom_called.add("trunk.spine.uncertainty_write_controller"); return orig_unc(*a,**kw)
    model.trunk.spine.online_plasticity.update=upd
    model.trunk.spine.uncertainty_write_controller.update=unc
    x=torch.randn(1,12,9); g=torch.randn(1,12,8)
    targets=torch.randn(1,11,20) if online_target else None
    out=model.forward_learning(x,g,target_latent_sequence=targets)
    out["loss"].backward()
    for h in handles: h.remove()
    leaves=[n for n,mod in named if n and len(list(mod.children()))==0]
    trainable=[p for p in model.parameters() if p.requires_grad]
    active_params=[p for p in trainable if p.grad is not None and torch.isfinite(p.grad).all() and float(p.grad.abs().sum())>0]
    custom_cfg={
      "trunk.spine.online_plasticity": bool(model.cfg.trunk.online_plasticity.enabled),
      "trunk.spine.uncertainty_write_controller": bool(model.cfg.trunk.uncertainty_write.enabled),
    }
    report={
      "forward_called":sorted(forward_called),
      "custom_called":sorted(custom_called),
      "configured_custom":custom_cfg,
      "leaf_forward_fraction":len(forward_called)/max(1,len(leaves)),
      "leaf_logical_fraction":len(forward_called|custom_called)/max(1,len(leaves)),
      "trainable_parameters":sum(p.numel() for p in trainable),
      "gradient_element_fraction":sum(p.numel() for p in active_params)/max(1,sum(p.numel() for p in trainable)),
      "gradient_parameter_fraction":len(active_params)/max(1,len(trainable)),
    }
    return report

def main():
    torch.manual_seed(113)
    base=NeuroCoreCurrent()
    default=_run(base, online_target=False)
    active_cfg=CurrentConfig(trunk=CausalTrunkConfig(online_plasticity=ThreeFactorPlasticityConfig(enabled=True, modulatory_gate_enabled=True), uncertainty_write=UncertaintyWriteConfig(enabled=True)))
    active=_run(NeuroCoreCurrent(active_cfg), online_target=True)
    report={"version":114,"default":default,"active_research_mode":active,"legacy_import_candidates":[]}
    print(json.dumps(report,indent=2))
    Path(ROOT/"evidence/V114_CURRENT_AUDIT.json").write_text(json.dumps(report,indent=2),encoding='utf-8')
if __name__=='__main__': main()
