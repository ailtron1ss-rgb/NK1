from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class GradientArbitrationConfig:
    """Opt-in objective-gradient conflict arbitration.

    This is deliberately a research mechanism. It operates on gradients of the existing
    objective components and adds no parameters or memory owner. The default is off so that
    historical/current baselines remain unchanged until a qualification gate promotes it.
    """

    enabled: bool = False
    method: str = "pcgrad"
    probe_parameter_patterns: Tuple[str, ...] = (
        "trunk.spine.state_to_hidden.2.weight",
        "trunk.spine.state_to_hidden.2.bias",
        "trunk.spine.q_proj.weight",
        "trunk.spine.k_proj.weight",
        "trunk.predictor.0.weight",
    )
    min_conflict_cosine: float = -1e-6
    projection_strength: float = 1.0
    normalize_objectives: bool = True
    anchor_objective: str = "memory_loss"
    anchor_weight: float = 0.55
    post_update_alignment: bool = False
    post_update_alignment_strength: float = 1.0
    post_update_alignment_passes: int = 8

    def __post_init__(self) -> None:
        if self.method not in {"pcgrad", "conflict_weighted", "anchor_project"}:
            raise ValueError("method must be 'pcgrad', 'conflict_weighted', or 'anchor_project'")
        if not 0.0 <= self.projection_strength <= 1.0:
            raise ValueError("projection_strength must be in [0,1]")
        if self.min_conflict_cosine > 0.0:
            raise ValueError("min_conflict_cosine must be <= 0")
        if not self.probe_parameter_patterns:
            raise ValueError("at least one probe parameter pattern is required")
        if not 0.0 <= self.anchor_weight <= 1.0:
            raise ValueError("anchor_weight must be in [0,1]")
        if not 0.0 <= self.post_update_alignment_strength <= 1.0:
            raise ValueError("post_update_alignment_strength must be in [0,1]")
        if self.post_update_alignment_passes < 1:
            raise ValueError("post_update_alignment_passes must be >= 1")


class GradientArbitrator:
    """Resolve conflicts between existing objective gradients on a small shared parameter probe.

    PCGrad is used as a bounded research-time surgery step: pairwise conflicting objective
    gradients are projected away from one another before aggregation. Because we only modify
    gradients for selected shared parameters, the mechanism stays cheap enough for ablation
    experiments and cannot silently create a second learning subsystem.
    """

    def __init__(self, config: GradientArbitrationConfig) -> None:
        self.config = config
        self.events = 0
        self.conflict_pairs = 0
        self.last_conflict_rate = 0.0
        self.last_mean_cosine = 0.0
        self.last_objective_count = 0
        self.last_probe_parameter_count = 0
        self.last_objective_names: List[str] = []
        self.last_objective_vectors: List[Tensor] = []
        self.last_selected_parameter_names: List[str] = []
        self.last_update_conflict_rate = 0.0
        self.last_update_mean_cosine = 0.0
        self.last_update_pair_count = 0

    @staticmethod
    def _flatten(grads: Sequence[Optional[Tensor]], params: Sequence[nn.Parameter]) -> Tensor:
        chunks = []
        for g, p in zip(grads, params):
            if g is None:
                chunks.append(torch.zeros(p.numel(), device=p.device, dtype=torch.float32))
            else:
                chunks.append(g.detach().reshape(-1).float())
        if not chunks:
            return torch.zeros(0)
        return torch.cat(chunks)

    @staticmethod
    def _pack(vector: Tensor, template_grads: Sequence[Optional[Tensor]], params: Sequence[nn.Parameter]) -> List[Optional[Tensor]]:
        packed: List[Optional[Tensor]] = []
        offset = 0
        for g, p in zip(template_grads, params):
            n = p.numel()
            piece = vector[offset:offset+n]
            if piece.numel() != n:
                raise RuntimeError("gradient vector packing mismatch")
            if g is None:
                packed.append(piece.view_as(p).to(device=p.device, dtype=p.dtype))
            else:
                packed.append(piece.view_as(g).to(device=g.device, dtype=g.dtype))
            offset += n
        if offset != vector.numel():
            raise RuntimeError("gradient vector packing mismatch")
        return packed

    def _select_parameters(self, named_parameters: Iterable[Tuple[str, nn.Parameter]]) -> List[Tuple[str, nn.Parameter]]:
        selected: List[Tuple[str, nn.Parameter]] = []
        for name, param in named_parameters:
            if not param.requires_grad:
                continue
            if any(name == pattern or name.endswith(pattern) for pattern in self.config.probe_parameter_patterns):
                selected.append((name, param))
        return selected

    def inspect_conflicts(
        self,
        objective_losses: Mapping[str, Tensor],
        named_parameters: Iterable[Tuple[str, nn.Parameter]],
    ) -> Dict[str, object]:
        selected = self._select_parameters(named_parameters)
        names = list(objective_losses)
        vectors: List[Tensor] = []
        for name in names:
            grads = torch.autograd.grad(
                objective_losses[name],
                [p for _, p in selected],
                retain_graph=True,
                allow_unused=True,
            )
            vectors.append(self._flatten(grads, [p for _, p in selected]))
        if not vectors or not vectors[0].numel():
            return {
                "objective_names": names,
                "selected_parameters": [n for n, _ in selected],
                "cosine_matrix": [],
                "conflict_pairs": 0,
                "conflict_rate": 0.0,
                "mean_off_diagonal_cosine": 0.0,
            }
        stacked = torch.stack([torch.nn.functional.normalize(v, dim=0, eps=1e-8) for v in vectors], dim=0)
        cosine = stacked @ stacked.transpose(0, 1)
        pairs = []
        conflict = 0
        total_pairs = 0
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                c = float(cosine[i, j].item())
                pairs.append((names[i], names[j], c))
                total_pairs += 1
                conflict += int(c < float(self.config.min_conflict_cosine))
        off = cosine[~torch.eye(len(names), dtype=torch.bool, device=cosine.device)]
        return {
            "objective_names": names,
            "selected_parameters": [n for n, _ in selected],
            "cosine_matrix": cosine.detach().cpu().tolist(),
            "pairs": pairs,
            "conflict_pairs": conflict,
            "conflict_rate": float(conflict / max(1, total_pairs)),
            "mean_off_diagonal_cosine": float(off.mean().item()) if off.numel() else 1.0,
        }

    def capture_update_probe(self, named_parameters: Iterable[Tuple[str, nn.Parameter]]) -> Dict[str, Tensor]:
        """Capture selected parameters immediately before the optimizer transformation."""
        selected = self._select_parameters(named_parameters)
        return {name: p.detach().clone() for name, p in selected}

    def measure_applied_update(self, before: Mapping[str, Tensor], named_parameters: Iterable[Tuple[str, nn.Parameter]]) -> Dict[str, float]:
        """Measure whether the *actual* optimizer update remains aligned with each objective.

        This is diagnostic only: it does not alter optimizer state or parameters. It is motivated by
        2026 work showing that gradient surgery can be undone by optimizer transformations (GUM/GUA).
        """
        selected = dict(self._select_parameters(named_parameters))
        if not before or not self.last_objective_vectors:
            self.last_update_conflict_rate = 0.0
            self.last_update_mean_cosine = 0.0
            self.last_update_pair_count = 0
            return {"update_conflict_rate": 0.0, "update_mean_cosine": 0.0, "update_pair_count": 0.0}
        chunks=[]
        for name in self.last_selected_parameter_names:
            if name in selected and name in before:
                chunks.append((selected[name].detach() - before[name]).reshape(-1).float())
        update = torch.cat(chunks) if chunks else torch.zeros(0)
        if not update.numel() or float(update.norm().item()) <= 0.0:
            self.last_update_conflict_rate = 0.0
            self.last_update_mean_cosine = 0.0
            self.last_update_pair_count = 0
            return {"update_conflict_rate": 0.0, "update_mean_cosine": 0.0, "update_pair_count": 0.0}
        u = torch.nn.functional.normalize(update, dim=0, eps=1e-8)
        cos = torch.stack([torch.dot(u, torch.nn.functional.normalize(v, dim=0, eps=1e-8)) for v in self.last_objective_vectors])
        conflicts = int((cos < float(self.config.min_conflict_cosine)).sum().item())
        count = int(cos.numel())
        self.last_update_conflict_rate = float(conflicts / max(1, count))
        self.last_update_mean_cosine = float(cos.mean().item())
        self.last_update_pair_count = count
        return {
            "update_conflict_rate": self.last_update_conflict_rate,
            "update_mean_cosine": self.last_update_mean_cosine,
            "update_pair_count": float(count),
        }

    @torch.no_grad()
    def apply_post_update_alignment(
        self,
        before: Mapping[str, Tensor],
        named_parameters: Iterable[Tuple[str, nn.Parameter]],
        optimizer: torch.optim.Optimizer,
    ) -> Dict[str, float]:
        """Research-only projection of the applied AdamW learning update.

        The projection is applied after AdamW only to the selected probe parameters. Decoupled
        weight decay is preserved separately. Optimizer moment state is intentionally *not*
        rewritten here, so this mechanism is candidate-only until a state-aligned variant is
        qualified against long-horizon training.
        """
        if not self.config.post_update_alignment or not self.last_objective_vectors or not before:
            return {"applied": 0.0, "raw_conflict_rate": self.last_update_conflict_rate, "post_conflict_rate": self.last_update_conflict_rate, "projection_delta": 0.0}
        selected = dict(self._select_parameters(named_parameters))
        names = [n for n in self.last_selected_parameter_names if n in selected and n in before]
        if not names:
            return {"applied": 0.0, "raw_conflict_rate": self.last_update_conflict_rate, "post_conflict_rate": self.last_update_conflict_rate, "projection_delta": 0.0}
        groups_by_id = {}
        for group in optimizer.param_groups:
            for p in group["params"]:
                groups_by_id[id(p)] = group
        updates=[]; decays=[]; refs=[]
        for name in names:
            p=selected[name]
            group=groups_by_id.get(id(p), {})
            lr=float(group.get("lr", 0.0)); wd=float(group.get("weight_decay", 0.0))
            total=(p.detach()-before[name].to(device=p.device,dtype=p.dtype)).reshape(-1).float()
            decay=(-lr*wd*before[name].to(device=p.device,dtype=p.dtype)).reshape(-1).float()
            updates.append(total); decays.append(decay); refs.append(p)
        total_update=torch.cat(updates); total_decay=torch.cat(decays); learning=total_update-total_decay
        original=learning.clone()
        work=learning.clone()
        threshold=float(self.config.min_conflict_cosine)
        strength=float(self.config.post_update_alignment_strength)
        directions=[torch.nn.functional.normalize(v.to(work.device),dim=0,eps=1e-8) for v in self.last_objective_vectors]
        for _ in range(int(self.config.post_update_alignment_passes)):
            changed=False
            for gv in directions:
                dot=torch.dot(work,gv)
                if float(dot.item()) < threshold:
                    work = work - strength * dot * gv
                    changed=True
            if not changed:
                break
        projection_delta=float((work-original).norm().item()/max(float(original.norm().item()),1e-8))
        aligned=work+total_decay
        offset=0
        for name,p in zip(names, refs):
            n=p.numel(); piece=aligned[offset:offset+n].to(device=p.device,dtype=p.dtype).view_as(p)
            p.copy_(before[name].to(device=p.device,dtype=p.dtype)+piece)
            offset += n
        u=torch.nn.functional.normalize(work,dim=0,eps=1e-8)
        cos=torch.stack([torch.dot(u,torch.nn.functional.normalize(v.to(u.device),dim=0,eps=1e-8)) for v in self.last_objective_vectors])
        post_conf=float((cos < threshold).float().mean().item()) if cos.numel() else 0.0
        return {"applied":1.0,"raw_conflict_rate":self.last_update_conflict_rate,"post_conflict_rate":post_conf,"projection_delta":projection_delta}

    def arbitrate(
        self,
        objective_losses: Mapping[str, Tensor],
        objective_weights: Mapping[str, float],
        named_parameters: Iterable[Tuple[str, nn.Parameter]],
    ) -> Dict[str, object]:
        selected = self._select_parameters(named_parameters)
        params = [p for _, p in selected]
        names = [k for k in objective_losses if float(objective_weights.get(k, 0.0)) != 0.0]
        if not self.config.enabled or not params or len(names) < 2:
            return {"applied": False, "reason": "disabled_or_insufficient_objectives"}

        raw: List[List[Optional[Tensor]]] = []
        vectors: List[Tensor] = []
        for name in names:
            grads = list(torch.autograd.grad(objective_losses[name], params, retain_graph=True, allow_unused=True))
            raw.append(grads)
            vector = self._flatten(grads, params)
            if not vector.numel():
                return {"applied": False, "reason": "empty_probe_gradient", "objective_names": names}
            vectors.append(vector)

        if self.config.normalize_objectives:
            normed = [v / v.norm().clamp_min(1e-8) for v in vectors]
        else:
            normed = vectors

        matrix = torch.stack([torch.nn.functional.normalize(v, dim=0, eps=1e-8) for v in normed])
        self.last_objective_names = list(names)
        self.last_objective_vectors = [v.detach().clone() for v in matrix]
        self.last_selected_parameter_names = [n for n, _ in selected]
        cosine = matrix @ matrix.transpose(0, 1)
        pair_count = 0
        conflict_count = 0
        adjusted = [v.clone() for v in normed]
        base_weights = torch.tensor([float(objective_weights[n]) for n in names], dtype=adjusted[0].dtype, device=adjusted[0].device)

        if self.config.method == "pcgrad":
            for i in range(len(adjusted)):
                for j in range(len(adjusted)):
                    if i == j:
                        continue
                    dot = torch.dot(adjusted[i], adjusted[j])
                    pair_count += 1
                    if float(dot.item()) < float(self.config.min_conflict_cosine):
                        denom = adjusted[j].dot(adjusted[j]).clamp_min(1e-8)
                        adjusted[i] = adjusted[i] - float(self.config.projection_strength) * dot / denom * adjusted[j]
                        conflict_count += 1
        elif self.config.method == "anchor_project":
            anchor_name = self.config.anchor_objective if self.config.anchor_objective in names else names[0]
            anchor_idx = names.index(anchor_name)
            anchor = adjusted[anchor_idx]
            non_anchor_indices = [i for i in range(len(adjusted)) if i != anchor_idx]
            if non_anchor_indices:
                other_w = None
                other = torch.zeros_like(anchor)
                total_other_weight = 0.0
                for i in non_anchor_indices:
                    w = float(objective_weights.get(names[i], 0.0))
                    other = other + w * adjusted[i]
                    total_other_weight += w
                other = other / max(total_other_weight, 1e-8)
                dot = torch.dot(other, anchor)
                pair_count = 1
                if float(dot.item()) < float(self.config.min_conflict_cosine):
                    denom = anchor.dot(anchor).clamp_min(1e-8)
                    other = other - float(self.config.projection_strength) * dot / denom * anchor
                    conflict_count = 1
                else:
                    conflict_count = 0
                anchor_w = float(self.config.anchor_weight)
                combined = anchor_w * anchor + (1.0 - anchor_w) * other
            else:
                combined = anchor
                pair_count = 0
        else:
            # Conflict-weighted mode only changes the objective mixture. Highly conflicting
            # objectives are smoothly down-weighted; no parameters are added and no gradients
            # are projected. This is a lower-cost comparison arm for ablation.
            degree = torch.zeros(len(adjusted), device=matrix.device)
            for i in range(len(adjusted)):
                conflicts = (cosine[i] < float(self.config.min_conflict_cosine)).float()
                degree[i] = conflicts.sum() - conflicts[i]
            scale = 1.0 / (1.0 + degree)
            adjusted = [g * scale[i] for i, g in enumerate(adjusted)]
            conflict_count = int((cosine < float(self.config.min_conflict_cosine)).sum().item())
            pair_count = len(adjusted) * (len(adjusted) - 1)

        if self.config.method != "anchor_project":
            weights = torch.tensor([float(objective_weights[n]) for n in names], dtype=adjusted[0].dtype, device=adjusted[0].device)
            combined = torch.stack(adjusted, dim=0)
            combined = (combined * weights[:, None]).sum(dim=0) / weights.sum().clamp_min(1e-8)
        original_weighted = (torch.stack(normed, dim=0) * base_weights[:, None]).sum(dim=0) / base_weights.sum().clamp_min(1e-8)
        projection_delta = float((combined - original_weighted).norm().item() / max(float(original_weighted.norm().item()), 1e-8))

        packed = self._pack(combined, raw[0], params)
        for p, g in zip(params, packed):
            p.grad = g

        self.events += 1
        self.conflict_pairs += conflict_count
        self.last_conflict_rate = float(conflict_count / max(1, pair_count))
        off = cosine[~torch.eye(len(names), dtype=torch.bool, device=cosine.device)]
        self.last_mean_cosine = float(off.mean().item()) if off.numel() else 1.0
        self.last_objective_count = len(names)
        self.last_probe_parameter_count = sum(p.numel() for p in params)
        return {
            "applied": True,
            "method": self.config.method,
            "objective_names": names,
            "conflict_pairs": int(conflict_count),
            "pair_count": int(pair_count),
            "conflict_rate": self.last_conflict_rate,
            "mean_cosine": self.last_mean_cosine,
            "probe_parameter_count": int(self.last_probe_parameter_count),
            "projection_delta": projection_delta,
        }

    def state_dict(self) -> dict:
        return {
            "events": int(self.events),
            "conflict_pairs": int(self.conflict_pairs),
            "last_conflict_rate": float(self.last_conflict_rate),
            "last_mean_cosine": float(self.last_mean_cosine),
            "last_objective_count": int(self.last_objective_count),
            "last_probe_parameter_count": int(self.last_probe_parameter_count),
        }

    def load_state_dict(self, state: Optional[dict]) -> None:
        state = state or {}
        self.events = int(state.get("events", 0))
        self.conflict_pairs = int(state.get("conflict_pairs", 0))
        self.last_conflict_rate = float(state.get("last_conflict_rate", 0.0))
        self.last_mean_cosine = float(state.get("last_mean_cosine", 0.0))
        self.last_objective_count = int(state.get("last_objective_count", 0))
        self.last_probe_parameter_count = int(state.get("last_probe_parameter_count", 0))
