from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .kda_attention import KDAAttention, KDAConfig
from .mamba3_candidate import Mamba3Candidate, Mamba3CandidateConfig
from .sparse_routing import SparseExpertRouter
from .native_sparse_attention import NativeSparseAttention
from .rwkv7_goose import RWKV7GooseLayer
from .ttt_layer import TestTimeTrainingLayer
from .mlstm_candidate import MLSTMConfig, MLSTMCandidate


@dataclass(frozen=True)
class FrontierStackConfig:
    """Opt-in integrated research stack.

    All expert modules are real implementations. The stack remains disabled in the default
    mobile trunk until a matched end-to-end qualification proves a net quality/compute gain.
    ``enabled=True`` turns on all six sequence experts plus the sparse expert router and makes every
    selected expert part of the same hidden-state execution path.
    """

    enabled: bool = False
    mamba_d_state: int = 16
    mamba_headdim: int = 16
    mamba_mimo_rank: int = 2
    kda_heads: int = 4
    nsa_heads: int = 4
    nsa_block_size: int = 16
    nsa_topk_blocks: int = 2
    nsa_max_context: int = 128
    ttt_hidden: int = 64
    ttt_lr: float = 0.03
    mlstm_heads: int = 4
    mlstm_head_dim: int = 16
    router_topk: int = 2
    router_temperature: float = 1.0
    residual_scale: float = 0.08
    latent_feedback: float = 0.15

    def __post_init__(self) -> None:
        if self.mamba_d_state <= 0 or self.mamba_headdim <= 0 or self.mamba_mimo_rank <= 0:
            raise ValueError("invalid Mamba candidate dimensions")
        if self.kda_heads <= 0 or self.nsa_heads <= 0:
            raise ValueError("attention head counts must be positive")
        if self.nsa_block_size <= 0 or self.nsa_topk_blocks <= 0 or self.nsa_max_context <= 0:
            raise ValueError("invalid NSA context configuration")
        if self.ttt_hidden <= 0 or self.ttt_lr <= 0:
            raise ValueError("invalid TTT configuration")
        if self.mlstm_heads <= 0 or self.mlstm_head_dim <= 0:
            raise ValueError("invalid mLSTM configuration")
        if not 1 <= self.router_topk <= 6:
            raise ValueError("router_topk must be in [1,6]")
        if self.router_temperature <= 0.0:
            raise ValueError("router_temperature must be > 0")
        if not 0.0 < self.residual_scale <= 1.0:
            raise ValueError("residual_scale must be in (0,1]")
        if not 0.0 <= self.latent_feedback <= 1.0:
            raise ValueError("latent_feedback must be in [0,1]")
        if self.enabled and self.latent_feedback <= 0.0:
            raise ValueError("frontier_stack requires latent_feedback > 0 so enabled frontier experts cannot become diagnostic-only")


class FrontierIntegrationStack(nn.Module):
    """Single orchestrator for the six frontier components.

    Six neural sequence experts process the same current hidden token. A learned sparse expert
    router selects a small subset and their outputs form one residual mixture, avoiding multiple
    parallel output owners. MoBA-style block selection exists separately in ``MoBABlockSelector``.
    Decontamination lives outside this neural owner because it validates the code/state surface.
    """

    COMPONENT_NAMES = ("mamba3", "kda", "rwkv7", "nsa", "ttt", "mlstm")

    def __init__(self, d_model: int, cfg: FrontierStackConfig) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.cfg = cfg
        if self.d_model % cfg.mamba_headdim != 0:
            raise ValueError("d_model must be divisible by mamba_headdim")
        if self.d_model % cfg.kda_heads != 0 or self.d_model % cfg.nsa_heads != 0:
            raise ValueError("d_model must be divisible by KDA and NSA head counts")
        if self.d_model != cfg.mlstm_heads * cfg.mlstm_head_dim:
            raise ValueError("d_model must equal mlstm_heads * mlstm_head_dim")

        self.mamba3 = Mamba3Candidate(
            d_model,
            Mamba3CandidateConfig(
                d_state=cfg.mamba_d_state,
                headdim=cfg.mamba_headdim,
                mimo_rank=cfg.mamba_mimo_rank,
            ),
        )
        self.kda = KDAAttention(d_model, KDAConfig(num_heads=cfg.kda_heads))
        self.rwkv7 = RWKV7GooseLayer(d_model)
        self.nsa = NativeSparseAttention(
            d_model,
            num_heads=cfg.nsa_heads,
            block_size=cfg.nsa_block_size,
            top_k_blocks=cfg.nsa_topk_blocks,
            max_context=cfg.nsa_max_context,
        )
        self.ttt = TestTimeTrainingLayer(d_model, d_hidden=cfg.ttt_hidden, lr=cfg.ttt_lr)
        self.mlstm = MLSTMCandidate(d_model, MLSTMConfig(num_heads=cfg.mlstm_heads, head_dim=cfg.mlstm_head_dim))
        self.router = SparseExpertRouter(
            d_model,
            num_experts=len(self.COMPONENT_NAMES),
            top_k=cfg.router_topk,
            temperature=cfg.router_temperature,
        )

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> dict[str, Any]:
        # Recurrent expert states are allocated lazily on first real execution. The router is sparse,
        # so eagerly materializing all expert states wastes mobile RAM and creates no neural benefit.
        return {name: None for name in self.COMPONENT_NAMES}

    @staticmethod
    def _select_state(value: Any, indices: Tensor) -> Any:
        if torch.is_tensor(value):
            return value.index_select(0, indices)
        if isinstance(value, dict):
            return {k: FrontierIntegrationStack._select_state(v, indices) for k, v in value.items()}
        if isinstance(value, tuple):
            return tuple(FrontierIntegrationStack._select_state(v, indices) for v in value)
        return value

    @staticmethod
    def _merge_state(base: Any, updated: Any, indices: Tensor) -> Any:
        if base is None:
            return updated
        if torch.is_tensor(base):
            merged = base.clone()
            merged.index_copy_(0, indices, updated)
            return merged
        if isinstance(base, dict):
            return {k: FrontierIntegrationStack._merge_state(base[k], updated[k], indices) for k in base}
        if isinstance(base, tuple):
            return tuple(FrontierIntegrationStack._merge_state(b, u, indices) for b, u in zip(base, updated))
        return updated

    def step(
        self,
        x: Tensor,
        state: Optional[dict[str, Any]] = None,
        *,
        uncertainty: Optional[Tensor] = None,
    ) -> tuple[Tensor, dict[str, Any], dict[str, Tensor]]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)

        uncertainty_sample = None if uncertainty is None else uncertainty.reshape(x.size(0))
        router_weights, selected, entropy = self.router(x, uncertainty_sample)
        expert_modules = (self.mamba3, self.kda, self.rwkv7, self.nsa, self.ttt, self.mlstm)
        expert_outputs = [x.new_zeros(x.shape) for _ in expert_modules]
        next_state: dict[str, Any] = dict(state)
        execution_counts: list[int] = []
        nsa_fraction = x.new_zeros(x.size(0))
        nsa_blocks = x.new_zeros(x.size(0))
        ttt_inner_loss = x.new_zeros(x.size(0))

        # Actual sparse expert execution: unselected rows never enter an expert. Their recurrent
        # state is carried forward unchanged. This turns MoBA routing into a real compute-control
        # mechanism instead of evaluating all experts and masking their outputs afterwards.
        for expert_idx, (name, module) in enumerate(zip(self.COMPONENT_NAMES, expert_modules)):
            row_mask = (selected == expert_idx).any(dim=-1)
            indices = row_mask.nonzero(as_tuple=False).flatten()
            execution_counts.append(int(indices.numel()))
            if indices.numel() == 0:
                continue
            x_sel = x.index_select(0, indices)
            state_sel = self._select_state(state.get(name), indices)
            if name == "mamba3":
                y_sel, state_sel_next = module.step(x_sel, state_sel)
            elif name == "kda":
                y_sel, state_sel_next = module.step(x_sel, state_sel)
            elif name == "rwkv7":
                y_sel, state_sel_next = module.step(x_sel, state_sel)
            elif name == "nsa":
                y_sel, state_sel_next, nsa_diag = module.step(x_sel, state_sel)
                nsa_fraction = nsa_fraction.index_copy(0, indices, nsa_diag["selection_fraction"])
                nsa_blocks = nsa_blocks.index_copy(0, indices, nsa_diag["num_blocks"])
            elif name == "ttt":
                y_sel, state_sel_next, ttt_diag = module.step(x_sel, state_sel)
                ttt_inner_loss = ttt_inner_loss.index_copy(0, indices, ttt_diag)
            else:
                y_sel, state_sel_next = module.step(x_sel, state_sel)
            expert_outputs[expert_idx] = expert_outputs[expert_idx].index_copy(0, indices, y_sel)
            base_state = state.get(name)
            if base_state is None:
                # The first activation of an expert is lazy, but its resulting recurrent state must
                # immediately become batch-shaped so later router choices can address any row safely.
                full_initial = module.initial_state(x.size(0), x.device, x.dtype)
                next_state[name] = self._merge_state(full_initial, state_sel_next, indices)
            else:
                next_state[name] = self._merge_state(base_state, state_sel_next, indices)

        stacked = torch.stack(expert_outputs, dim=1)
        fused = torch.sum(stacked * router_weights.unsqueeze(-1), dim=1)
        # Parameter-free normalization avoids an extra competing output head while preserving the
        # expert mixture as an actual residual transformation of the canonical hidden state.
        out = x + float(self.cfg.residual_scale) * F.layer_norm(fused, (self.d_model,))
        diagnostics = {
            "router_weights": router_weights,
            "router_selected": selected.to(torch.float32),
            "router_entropy": entropy,
            "nsa_selection_fraction": nsa_fraction,
            "nsa_num_blocks": nsa_blocks,
            "ttt_inner_loss": ttt_inner_loss,
            "frontier_effect_norm": torch.linalg.vector_norm(out - x, dim=-1),
            "expert_execution_counts": x.new_tensor(execution_counts, dtype=torch.float32).unsqueeze(0).expand(x.size(0), -1),
            "expert_execution_fraction": x.new_full(
                (x.size(0),),
                float(sum(execution_counts)) / max(1, x.size(0) * len(expert_modules)),
            ),
            "expert_execution_fraction_per_expert": x.new_tensor(execution_counts, dtype=torch.float32) / max(1, x.size(0)),
            "expert_compute_cost_units": x.new_tensor([2.0, 2.0, 1.5, 3.0, 2.5, 4.0], dtype=torch.float32, device=x.device),
        }
        # Run a cheap diagnostic-only NSA/TTT probe only for already-selected rows would duplicate
        # work, so their primary outputs own the values. Detailed per-step diagnostics are exposed
        # by the modules themselves and qualification probes.
        return out, next_state, diagnostics

    def forward(
        self,
        x: Tensor,
        state: Optional[dict[str, Any]] = None,
        *,
        uncertainty: Optional[Tensor] = None,
    ) -> tuple[Tensor, dict[str, Any], dict[str, Tensor]]:
        """Run the same causal step path over ``[B,T,D]`` without creating a second executor.

        Diagnostics are aggregated over time for scalar/per-step tensors while router weights and
        selections are exposed from the final token. This keeps ``nn.Module`` semantics usable for
        training/prefill and preserves the exact recurrent state carry of ``step``.
        """
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        if uncertainty is not None and tuple(uncertainty.shape) not in {(x.size(0), x.size(1)), (x.size(0), x.size(1), 1)}:
            raise ValueError("uncertainty must be [B,T] or [B,T,1]")
        current = state
        outputs: list[Tensor] = []
        per_step: list[dict[str, Tensor]] = []
        for t in range(x.size(1)):
            u_t = None if uncertainty is None else uncertainty[:, t].reshape(x.size(0))
            y_t, current, diag_t = self.step(x[:, t], current, uncertainty=u_t)
            outputs.append(y_t)
            per_step.append(diag_t)
        stacked = torch.stack(outputs, dim=1)
        last = per_step[-1]
        scalar_mean_keys = (
            "router_entropy",
            "nsa_selection_fraction",
            "nsa_num_blocks",
            "ttt_inner_loss",
            "frontier_effect_norm",
        )
        diagnostics: dict[str, Tensor] = dict(last)
        for key in scalar_mean_keys:
            diagnostics[f"{key}_mean"] = torch.stack([d[key] for d in per_step], dim=1).mean(dim=1)
        counts = torch.stack([d["expert_execution_counts"] for d in per_step], dim=1)
        diagnostics["expert_execution_counts_sequence"] = counts
        diagnostics["expert_execution_fraction_per_expert"] = counts.sum(dim=(0, 1)) / float(x.size(0) * x.size(1))
        diagnostics["expert_execution_fraction"] = diagnostics["expert_execution_fraction_per_expert"].mean().reshape(1).expand(x.size(0))
        return stacked, current, diagnostics

    @torch.no_grad()
    def serialize_state(self, state: Optional[dict[str, Any]]) -> dict[str, Any] | None:
        if state is None:
            return None
        def cpu_value(value: Any) -> Any:
            if torch.is_tensor(value):
                return value.detach().cpu()
            if isinstance(value, dict):
                return {k: cpu_value(v) for k, v in value.items()}
            if isinstance(value, tuple):
                return tuple(cpu_value(v) for v in value)
            return value
        return cpu_value(state)

    def deserialize_state(self, payload: Optional[dict[str, Any]], device: torch.device, dtype: torch.dtype) -> dict[str, Any] | None:
        if payload is None:
            return None
        def move(value: Any) -> Any:
            if torch.is_tensor(value):
                target_dtype = dtype if (value.is_floating_point() or value.is_complex()) else value.dtype
                return value.to(device=device, dtype=target_dtype)
            if isinstance(value, dict):
                return {k: move(v) for k, v in value.items()}
            if isinstance(value, tuple):
                return tuple(move(v) for v in value)
            return value
        return move(payload)
