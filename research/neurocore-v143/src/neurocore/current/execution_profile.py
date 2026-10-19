from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, Iterable, Optional

import torch
from torch import nn, Tensor


@dataclass
class ModuleExecutionStat:
    calls: int = 0
    tensor_elements_in: int = 0
    tensor_elements_out: int = 0
    nonfinite_outputs: int = 0


class ExecutionProfiler:
    """Low-overhead module execution tracer for current-path qualification.

    It records only runtime evidence. No tensors are retained after each hook, so this profiler
    cannot become a hidden memory owner. The output is designed to answer: what actually ran?
    """

    def __init__(self, model: nn.Module) -> None:
        self.model = model
        self.stats: Dict[str, ModuleExecutionStat] = {}
        self._handles: list[torch.utils.hooks.RemovableHandle] = []

    @staticmethod
    def _elements(value) -> int:
        if torch.is_tensor(value):
            return int(value.numel())
        if isinstance(value, (list, tuple)):
            return sum(ExecutionProfiler._elements(v) for v in value)
        if isinstance(value, dict):
            return sum(ExecutionProfiler._elements(v) for v in value.values())
        return 0

    def _pre(self, name: str):
        def hook(_module: nn.Module, inputs: tuple[object, ...]) -> None:
            stat = self.stats.setdefault(name, ModuleExecutionStat())
            stat.calls += 1
            stat.tensor_elements_in += self._elements(inputs)
        return hook

    def _post(self, name: str):
        def hook(_module: nn.Module, _inputs, output) -> None:
            stat = self.stats.setdefault(name, ModuleExecutionStat())
            stat.tensor_elements_out += self._elements(output)
            tensors = []
            def collect(v):
                if torch.is_tensor(v):
                    tensors.append(v)
                elif isinstance(v, (list, tuple)):
                    for x in v: collect(x)
                elif isinstance(v, dict):
                    for x in v.values(): collect(x)
            collect(output)
            for t in tensors:
                if not bool(torch.isfinite(t).all()):
                    stat.nonfinite_outputs += 1
        return hook

    def __enter__(self):
        for name, module in self.model.named_modules():
            if not name:
                continue
            self.stats[name] = ModuleExecutionStat()
            self._handles.append(module.register_forward_pre_hook(self._pre(name)))
            self._handles.append(module.register_forward_hook(self._post(name)))
        return self

    def __exit__(self, exc_type, exc, tb):
        for handle in self._handles:
            handle.remove()
        self._handles.clear()
        return False

    def report(self) -> dict:
        called = {k: v for k, v in self.stats.items() if v.calls}
        named = dict(self.model.named_modules())
        leaf_names = [name for name, module in named.items() if name and len(list(module.children())) == 0]
        called_leaf = [name for name in leaf_names if self.stats.get(name, ModuleExecutionStat()).calls]
        trainable = {name: int(p.numel()) for name, p in self.model.named_parameters() if p.requires_grad}
        parameter_owner = {}
        for name, p in self.model.named_parameters():
            if not p.requires_grad:
                continue
            owner = name.rsplit('.', 1)[0] if '.' in name else name
            while owner and owner not in named:
                owner = owner.rsplit('.', 1)[0] if '.' in owner else ''
            parameter_owner[name] = owner or '<root>'
        called_names = {name for name, stat in self.stats.items() if stat.calls}
        def owner_or_descendant_called(owner: str) -> bool:
            if owner in called_names:
                return True
            prefix = owner + "."
            return any(name.startswith(prefix) for name in called_names)
        called_parameter_names = [name for name, owner in parameter_owner.items() if owner_or_descendant_called(owner)]
        total_trainable = sum(trainable.values())
        called_trainable = sum(int(dict(self.model.named_parameters())[name].numel()) for name in called_parameter_names)
        return {
            "module_count": len(self.stats),
            "called_module_count": len(called),
            "called_module_fraction": float(len(called) / max(1, len(self.stats))),
            "leaf_module_count": len(leaf_names),
            "called_leaf_module_count": len(called_leaf),
            "called_leaf_module_fraction": float(len(called_leaf) / max(1, len(leaf_names))),
            "trainable_parameter_count": int(total_trainable),
            "called_trainable_parameter_count": int(called_trainable),
            "called_trainable_parameter_fraction": float(called_trainable / max(1, total_trainable)),
            "modules": {k: asdict(v) for k, v in self.stats.items()},
            "trainable_parameters_by_name": trainable,
            "trainable_parameter_owners": parameter_owner,
        }


def gradient_coverage(model: nn.Module) -> dict[str, float | int]:
    params = [(n, p) for n, p in model.named_parameters() if p.requires_grad]
    used = [(n, p) for n, p in params if p.grad is not None and torch.isfinite(p.grad).all() and float(p.grad.detach().abs().sum().item()) > 0.0]
    return {
        "trainable_parameters": int(sum(p.numel() for _, p in params)),
        "gradient_parameters": int(sum(p.numel() for _, p in used)),
        "gradient_parameter_fraction": float(sum(p.numel() for _, p in used) / max(1, sum(p.numel() for _, p in params))),
        "trainable_tensors": len(params),
        "gradient_tensors": len(used),
        "gradient_tensor_fraction": float(len(used) / max(1, len(params))),
    }
