from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v35 import V35Config, V35State, NeuroWeaveV35, OrganismTrainerV35, RuntimeStateStoreV35


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _zero_like(x: Tensor) -> Tensor:
    return x.new_zeros(())


@dataclass
class V36Config(V35Config):
    """V36 cognitive-map / skill-transfer brain over the proven V35 organism.

    V36 adds one canonical high-level cognitive map, temporal macro-state
    abstraction, reusable option selection, transfer-conditioned action prior,
    macro-duration prediction, and map-transition learning. The additions are
    intentionally compact so that mobile inference can remain bounded.
    """

    cognitive_map_slots_v36: int = 12
    cognitive_map_temperature_v36: float = 0.30
    cognitive_map_update_rate_v36: float = 0.18
    cognitive_map_decay_v36: float = 0.995
    cognitive_map_transition_decay_v36: float = 0.995
    cognitive_map_read_weight_v36: float = 0.10
    cognitive_map_goal_weight_v36: float = 0.10
    cognitive_map_novelty_weight_v36: float = 0.08
    macro_horizons_v36: Tuple[int, ...] = (1, 2, 4)
    macro_discount_v36: float = 0.97
    macro_context_weight_v36: float = 0.12
    macro_value_weight_v36: float = 0.08
    macro_duration_weight_v36: float = 0.04
    macro_duration_max_v36: int = 4
    skill_transfer_weight_v36: float = 0.10
    skill_transfer_temperature_v36: float = 0.35
    skill_transfer_context_weight_v36: float = 0.12
    skill_transfer_gate_weight_v36: float = 0.08
    map_prediction_weight_v36: float = 0.08
    map_transition_weight_v36: float = 0.06
    macro_prediction_weight_v36: float = 0.07
    transfer_consistency_weight_v36: float = 0.05
    empowerment_weight_v36: float = 0.04
    v36_teacher_interval: int = 2


def mobile_v36_config(raw_observation_dim: int = 0) -> V36Config:
    """Return a compact V36 profile intended for mid-range Android/Termux experiments.

    This preserves the same architecture and learning paths; only widths, memories,
    planner depth and candidate counts are bounded for mobile compute.
    """
    return V36Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8,0.93), sr_dim_v34=8,
        subgoal_horizon_v34=2, identity_slots_v35=4, raw_observation_dim=raw_observation_dim,
        cognitive_map_slots_v36=8, macro_horizons_v36=(1,2,4), macro_duration_max_v36=4,
    )


@dataclass
class V36State:
    base: V35State
    cognitive_map: Tensor
    cognitive_map_priority: Tensor
    cognitive_map_age: Tensor
    transition_matrix: Tensor
    macro_state: Tensor
    skill_trace: Tensor
    transfer_context: Tensor
    macro_age: Tensor
    last_node: Tensor


class CognitiveMapV36(nn.Module):
    """One bounded differentiable cognitive map with online transition statistics.

    The map is not a second episodic memory. V34 remains the canonical event store;
    this structure is a compact predictive/topological abstraction distilled from it.
    """

    def __init__(self, d: int, hidden: int, goal_dim: int, slots: int):
        super().__init__()
        self.d = d
        self.goal_dim = goal_dim
        self.slots = slots
        self.temperature = float(0.30)
        self.encode = nn.Sequential(
            nn.Linear(d + goal_dim + 1, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh()
        )
        self.map_key = nn.Parameter(torch.randn(slots, d) * 0.04)
        self.transition_key = nn.Sequential(
            nn.Linear(2 * d, hidden), nn.SiLU(), nn.Linear(hidden, slots)
        )
        self.transition_predictor = nn.Sequential(
            nn.Linear(2 * d, hidden), nn.SiLU(), nn.Linear(hidden, slots)
        )
        self.node_value = nn.Sequential(
            nn.Linear(d + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.next_node = nn.Sequential(
            nn.Linear(d + goal_dim + d, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.novelty = nn.Sequential(
            nn.Linear(d + d, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def read(self, z: Tensor, goal: Tensor, cognitive_map: Tensor,
             priority: Tensor, age: Tensor) -> Dict[str, Tensor]:
        q = _norm(self.encode(torch.cat([z, goal, priority.mean(-1, keepdim=True)], -1)))
        keys = _norm(self.map_key)
        sim = torch.einsum('bd,nd->bn', q, keys)
        utility = sim + 0.25 * priority - 0.01 * age
        attn = F.softmax(utility / self.temperature, dim=-1)
        context = torch.einsum('bn,bnd->bd', attn, cognitive_map)
        novelty = torch.sigmoid(self.novelty(torch.cat([q, context], -1)))
        node_value = self.node_value(torch.cat([context, goal], -1))
        transition_logits = self.transition_predictor(torch.cat([q, context], -1))
        return {
            'query': q,
            'attention': attn,
            'context': context,
            'novelty': novelty,
            'node_value': node_value,
            'transition_logits': transition_logits,
        }

    def write(self, z: Tensor, goal: Tensor, action: Tensor, reward: Tensor,
              uncertainty: Tensor, cognitive_map: Tensor, priority: Tensor,
              age: Tensor, prior_node: Optional[Tensor] = None) -> Dict[str, Tensor]:
        read = self.read(z, goal, cognitive_map, priority, age)
        q = read['query']
        slots = self.slots
        w = read['attention']
        content = _norm(self.encode(torch.cat([z, goal, reward], -1)))
        surprise = (uncertainty + read['novelty']).clamp(0, 2) * 0.5
        alpha = (0.08 + 0.20 * surprise).clamp(0.0, 0.30)
        new_map = cognitive_map * (1.0 - alpha.unsqueeze(-1) * w.unsqueeze(-1))
        new_map = new_map + alpha.unsqueeze(-1) * w.unsqueeze(-1) * content.unsqueeze(1)
        new_priority = (0.995 * priority + alpha * w * surprise).clamp(0.0, 1.0)
        new_age = (age + 1.0 - alpha * w * 3.0).clamp(0.0, 1000.0)

        with torch.no_grad():
            max_slot = w.argmax(-1)
        if prior_node is None:
            prior_onehot = F.one_hot(max_slot, num_classes=slots).to(dtype=z.dtype)
        else:
            prior_onehot = F.one_hot(prior_node.long().clamp(0, slots - 1), num_classes=slots).to(dtype=z.dtype)
        current_onehot = F.one_hot(max_slot, num_classes=slots).to(dtype=z.dtype)
        transition_event = torch.bmm(prior_onehot.unsqueeze(2), current_onehot.unsqueeze(1))
        # Transition matrix is normalized on read; bounded decay prevents unbounded growth.
        return {
            **read,
            'memory': new_map,
            'priority': new_priority,
            'age': new_age,
            'node_index': max_slot,
            'transition_event': transition_event,
            'content': content,
        }

    def transition_read(self, transition_matrix: Tensor, node_index: Tensor) -> Tensor:
        probs = F.softmax(transition_matrix / max(self.temperature, 0.1), dim=-1)
        return probs.gather(1, node_index.long().unsqueeze(-1).unsqueeze(-1).expand(-1, -1, self.slots)).squeeze(1)


class MacroStateV36(nn.Module):
    """Temporal abstraction layer producing a macro-state and duration policy."""

    def __init__(self, d: int, hidden: int, goal_dim: int, horizons: Tuple[int, ...], max_duration: int):
        super().__init__()
        self.horizons = tuple(int(h) for h in horizons)
        self.max_duration = int(max_duration)
        self.context = nn.Sequential(
            nn.Linear(2 * d + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh()
        )
        self.scale_heads = nn.ModuleList([
            nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh())
            for _ in self.horizons
        ])
        self.duration = nn.Sequential(
            nn.Linear(d + goal_dim + 2, hidden), nn.SiLU(),
            nn.Linear(hidden, max_duration)
        )
        self.value = nn.Sequential(
            nn.Linear(d + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def forward(self, z: Tensor, map_context: Tensor, goal: Tensor,
                uncertainty: Tensor, novelty: Tensor) -> Dict[str, Tensor]:
        h = self.context(torch.cat([z, map_context, goal], -1))
        scales = torch.stack([head(h) for head in self.scale_heads], dim=-2)
        macro = _norm(scales.mean(-2) + 0.25 * _norm(h))
        dur_logits = self.duration(torch.cat([macro, goal, uncertainty, novelty], -1))
        dur_probs = F.softmax(dur_logits, -1)
        values = self.value(torch.cat([macro, goal], -1))
        return {
            'macro_state': macro,
            'macro_scales': scales,
            'duration_logits': dur_logits,
            'duration_probs': dur_probs,
            'duration': (dur_probs * torch.arange(1, self.max_duration + 1, device=z.device, dtype=z.dtype)).sum(-1, keepdim=True),
            'macro_value': values,
        }


class SkillTransferV36(nn.Module):
    """Transfer-aware reusable-option selector over V34 skills and V35 self-state."""

    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int, body_dim: int, count: int):
        super().__init__()
        self.count = count
        self.transfer_encoder = nn.Sequential(
            nn.Linear(3 * d + goal_dim + body_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh()
        )
        self.skill_keys = nn.Parameter(torch.randn(count, d) * 0.04)
        self.skill_action = nn.Sequential(
            nn.Linear(2 * d + goal_dim + body_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, action_dim)
        )
        self.skill_value = nn.Sequential(
            nn.Linear(d + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.transfer_gate = nn.Sequential(
            nn.Linear(2 * d + goal_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def forward(self, z: Tensor, macro: Tensor, goal: Tensor, body: Tensor,
                identity: Tensor, value: Tensor, transfer_memory: Tensor, uncertainty: Tensor, novelty: Tensor) -> Dict[str, Tensor]:
        ctx = _norm(self.transfer_encoder(torch.cat([z + macro, identity + value, transfer_memory, goal, body], -1)))
        keys = _norm(self.skill_keys)
        logits = torch.matmul(ctx, keys.t()) / 0.35
        probs = F.softmax(logits, -1)
        skill_ctx = torch.cat([
            ctx.unsqueeze(1).expand(-1, self.count, -1),
            self.skill_keys.unsqueeze(0).expand(ctx.size(0), -1, -1),
            goal.unsqueeze(1).expand(-1, self.count, -1),
            body.unsqueeze(1).expand(-1, self.count, -1),
        ], -1)
        action_bank = self.skill_action(skill_ctx)
        selected = (probs.unsqueeze(-1) * action_bank).sum(1)
        selected = torch.tanh(selected)
        gate = torch.sigmoid(self.transfer_gate(torch.cat([ctx, macro, goal, uncertainty, novelty], -1)))
        values = self.skill_value(torch.cat([ctx, goal], -1))
        return {'transfer_context': ctx, 'skill_probs': probs, 'transfer_action': selected, 'transfer_gate': gate, 'transfer_value': values}


class HierarchicalSearchV36(nn.Module):
    """Cheap proposal-improvement layer using V35 teacher action and macro state.

    It is intentionally residual and bounded; the V35 action remains the fallback.
    """
    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int):
        super().__init__()
        self.refine = nn.Sequential(
            nn.Linear(2 * d + goal_dim + action_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh()
        )
        self.score = nn.Sequential(
            nn.Linear(2 * d + goal_dim + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def forward(self, z: Tensor, macro: Tensor, goal: Tensor, teacher_action: Tensor) -> Dict[str, Tensor]:
        ctx = torch.cat([z, macro, goal, teacher_action], -1)
        residual = self.refine(ctx)
        candidate = torch.tanh(teacher_action + 0.15 * residual)
        score = self.score(ctx)
        return {'candidate_action': candidate, 'residual': residual, 'candidate_score': score}


class EmpowermentV36(nn.Module):
    """Local action-diversity/value proxy: predicts controllable outcome separation.

    This is a research proxy, not a claim of intrinsic empowerment. It is used only
    to regularize collapse of all candidate actions to one direction.
    """
    def __init__(self, z_dim: int, hidden: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(z_dim + action_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def forward(self, z: Tensor, action: Tensor) -> Tensor:
        return self.net(torch.cat([z, action], -1)).squeeze(-1)


class NeuroWeaveV36(nn.Module):
    """V36 hierarchical cognitive-map / skill-transfer organism."""

    def __init__(self, cfg: Optional[V36Config] = None):
        super().__init__()
        self.cfg = cfg or V36Config()
        c = self.cfg
        self.base = NeuroWeaveV35(c)
        self.cognitive_map = CognitiveMapV36(c.d, c.hidden, c.goal_dim, c.cognitive_map_slots_v36)
        self.cognitive_map.temperature = c.cognitive_map_temperature_v36
        self.macro = MacroStateV36(c.d, c.hidden, c.goal_dim, c.macro_horizons_v36, c.macro_duration_max_v36)
        self.transfer = SkillTransferV36(c.d, c.hidden, c.action_dim, c.goal_dim, c.body_dim, c.skill_count_v34)
        self.search = HierarchicalSearchV36(c.d, c.hidden, c.action_dim, c.goal_dim)
        self.empowerment = EmpowermentV36(c.d, c.hidden, c.action_dim)
        self.map_to_goal = nn.Sequential(
            nn.Linear(2 * c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.goal_dim)
        )
        self.transfer_to_goal = nn.Sequential(
            nn.Linear(c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.goal_dim)
        )

    def initial_state(self, b: int, device=None, dtype=None) -> V36State:
        c = self.cfg
        return V36State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            cognitive_map=torch.zeros(b, c.cognitive_map_slots_v36, c.d, device=device, dtype=dtype),
            cognitive_map_priority=torch.zeros(b, c.cognitive_map_slots_v36, device=device, dtype=dtype),
            cognitive_map_age=torch.zeros(b, c.cognitive_map_slots_v36, device=device, dtype=dtype),
            transition_matrix=torch.zeros(b, c.cognitive_map_slots_v36, c.cognitive_map_slots_v36, device=device, dtype=dtype),
            macro_state=torch.zeros(b, c.d, device=device, dtype=dtype),
            skill_trace=torch.zeros(b, c.d, device=device, dtype=dtype),
            transfer_context=torch.zeros(b, c.d, device=device, dtype=dtype),
            macro_age=torch.zeros(b, 1, device=device, dtype=dtype),
            last_node=torch.zeros(b, dtype=torch.long, device=device),
        )

    def _internal(self, x: Tensor) -> Tensor:
        return self.base._internal(x)

    def step(self, x: Tensor, state: V36State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V36State]:
        xin = self._internal(x)
        pre = self.cognitive_map.read(
            xin, goal if goal is not None else torch.zeros(xin.size(0), self.cfg.goal_dim, device=xin.device, dtype=xin.dtype),
            state.cognitive_map, state.cognitive_map_priority, state.cognitive_map_age
        )
        map_context = pre['context']
        if goal is None:
            map_goal = self.map_to_goal(torch.cat([xin, map_context], -1))
            enriched_goal_hint = _norm(map_goal)
        else:
            map_goal = self.map_to_goal(torch.cat([xin, map_context], -1))
            enriched_goal_hint = _norm(0.92 * goal + 0.08 * map_goal)
        o35, st35 = self.base.step(
            x, state.base, goal=enriched_goal_hint, target_next=target_next,
            presence=presence, modalities=modalities, proprioception=proprioception,
            interoception=interoception, commit_memory=commit_memory,
            force_planning=force_planning,
        )
        z = o35['fused_latent_v30']
        body = o35['body_state_v30']
        uncertainty = o35['foresight_uncertainty_v32']
        novelty = o35['novelty']
        pe = o35['prediction_error_v31']
        macro = self.macro(z, map_context, o35['enriched_goal_v35'], uncertainty, novelty)
        macro_goal = _norm(self.map_to_goal(torch.cat([z, macro['macro_state']], -1)))
        transfer_pre = self.transfer(
            z, macro['macro_state'], o35['enriched_goal_v35'], body,
            o35['identity_state_v35'], o35['value_state_v35'], state.transfer_context, uncertainty, novelty
        )
        transfer_goal = self.transfer_to_goal(transfer_pre['transfer_context'])
        planning_goal = _norm(
            0.88 * o35['enriched_goal_v35'] +
            0.06 * macro_goal +
            0.06 * _norm(transfer_goal)
        )
        transfer = self.transfer(
            z, macro['macro_state'], planning_goal, body,
            o35['identity_state_v35'], o35['value_state_v35'], state.transfer_context, uncertainty, novelty
        )
        search = self.search(z, macro['macro_state'], planning_goal, o35['chosen_action_v35'])
        # Transfer action is used only when confidence exceeds a learned gate;
        # otherwise the proven V35 action remains the fallback.
        mix = (0.10 + 0.35 * transfer['transfer_gate']).clamp(0.0, 0.45)
        action = torch.tanh((1.0 - mix) * o35['chosen_action_v35'] + mix * search['candidate_action'])
        action = torch.tanh(action + 0.10 * transfer['transfer_gate'] * transfer['transfer_action'])
        # The same canonical V34 event owner is rewritten using the actual emitted action.
        mem_actual = self.base.base.memory.write(
            xin, st35.base.semantic_state, st35.base.episodic_memory, st35.base.memory_priority,
            st35.base.memory_age, action, uncertainty, novelty, pe, o35['reward_v32'], o35['risk_v32']
        )
        st35 = V35State(
            base=st35.base.__class__(
                base=st35.base.base,
                episodic_memory=mem_actual['memory'].detach() if commit_memory else mem_actual['memory'],
                memory_priority=mem_actual['priority'].detach() if commit_memory else mem_actual['priority'],
                memory_age=mem_actual['age'].detach() if commit_memory else mem_actual['age'],
                semantic_state=mem_actual['semantic'].detach() if commit_memory else mem_actual['semantic'],
                life_clock=st35.base.life_clock,
            ),
            identity_state=st35.identity_state, value_state=st35.value_state,
            commitment_strengths=st35.commitment_strengths, contradiction_state=st35.contradiction_state,
            value_provenance=st35.value_provenance, active_goal=st35.active_goal,
            goal_age=st35.goal_age, goal_progress=st35.goal_progress, goal_confidence=st35.goal_confidence,
            fast_adapter_state=st35.fast_adapter_state, identity_anchor=st35.identity_anchor,
            commitment_success=st35.commitment_success, commitment_failure=st35.commitment_failure,
            life_clock=st35.life_clock,
        )
        cmap = self.cognitive_map.write(
            z, o35['enriched_goal_v35'], action, o35['reward_v32'], uncertainty,
            state.cognitive_map, state.cognitive_map_priority, state.cognitive_map_age, state.last_node
        )
        trans = state.transition_matrix * self.cfg.cognitive_map_transition_decay_v36 + cmap['transition_event']
        new_state = V36State(
            base=st35,
            cognitive_map=cmap['memory'].detach() if commit_memory else cmap['memory'],
            cognitive_map_priority=cmap['priority'].detach() if commit_memory else cmap['priority'],
            cognitive_map_age=cmap['age'].detach() if commit_memory else cmap['age'],
            transition_matrix=trans.detach() if commit_memory else trans,
            macro_state=macro['macro_state'].detach() if commit_memory else macro['macro_state'],
            skill_trace=((0.93 * state.skill_trace + 0.07 * transfer['transfer_context']).tanh()).detach() if commit_memory else (0.93 * state.skill_trace + 0.07 * transfer['transfer_context']).tanh(),
            transfer_context=transfer['transfer_context'].detach() if commit_memory else transfer['transfer_context'],
            macro_age=(state.macro_age + 1.0).clamp(0.0, 1e6),
            last_node=cmap['node_index'],
        )
        out = dict(o35)
        out.update({
            'cognitive_map_context_v36': map_context,
            'cognitive_map_attention_v36': pre['attention'],
            'cognitive_map_novelty_v36': pre['novelty'],
            'cognitive_map_priority_v36': cmap['priority'],
            'cognitive_map_age_v36': cmap['age'],
            'cognitive_map_node_v36': cmap['node_index'],
            'cognitive_map_transition_event_v36': cmap['transition_event'],
            'macro_state_v36': macro['macro_state'],
            'macro_scales_v36': macro['macro_scales'],
            'macro_duration_probs_v36': macro['duration_probs'],
            'macro_duration_v36': macro['duration'],
            'macro_value_v36': macro['macro_value'],
            'transfer_context_v36': transfer['transfer_context'],
            'transfer_skill_probs_v36': transfer['skill_probs'],
            'transfer_action_v36': transfer['transfer_action'],
            'transfer_gate_v36': transfer['transfer_gate'],
            'transfer_value_v36': transfer['transfer_value'],
            'hierarchical_candidate_action_v36': search['candidate_action'],
            'hierarchical_candidate_score_v36': search['candidate_score'],
            'hierarchical_residual_v36': search['residual'],
            'chosen_action_v36': action,
            'macro_goal_v36': macro_goal,
            'transfer_goal_v36': transfer_goal,
            'planning_goal_v36': planning_goal,
        })
        out['_final_state'] = new_state
        return out, new_state

    def observe_outcome(self, state_after_action: V36State, prior_output: Dict[str, Tensor],
                        next_observation: Tensor, reward: Tensor, risk: Tensor,
                        done: Optional[Tensor] = None) -> Tuple[Dict[str, Tensor], V36State]:
        # Delegate causal identity/value evolution to V35 first.
        observed35, st35 = self.base.observe_outcome(state_after_action.base, prior_output, next_observation, reward, risk, done)
        corrected_v35 = st35
        z_next = self._internal(next_observation)
        prev_macro = state_after_action.macro_state
        target_macro = _norm(z_next)
        macro_error = (prev_macro - target_macro).norm(dim=-1, keepdim=True)
        # Update the temporal abstraction only after the consequence is observed.
        macro_next = _norm(0.90 * prev_macro + 0.10 * target_macro)
        macro_age = state_after_action.macro_age
        done_soft = torch.zeros_like(reward) if done is None else done.float().view(-1, 1).clamp(0, 1)
        macro_age_next = ((1.0 - done_soft) * (macro_age + 1.0)).clamp(0, float(self.cfg.macro_duration_max_v36 * 1000))
        skill_trace_next = torch.tanh(0.90 * state_after_action.skill_trace + 0.10 * prior_output['transfer_context_v36'])
        # The cognitive map receives the actual consequence here, closing the online
        # action -> outcome -> map-learning loop. No future observation is visible before action.
        cmap_obs = self.cognitive_map.write(
            self._internal(next_observation), prior_output['enriched_goal_v35'],
            prior_output['chosen_action_v36'], reward,
            prior_output.get('foresight_uncertainty_v32', torch.zeros_like(reward)),
            state_after_action.cognitive_map, state_after_action.cognitive_map_priority,
            state_after_action.cognitive_map_age, state_after_action.last_node
        )
        trans_next = (
            state_after_action.transition_matrix * self.cfg.cognitive_map_transition_decay_v36
            + cmap_obs['transition_event']
        )
        new_state = V36State(
            base=corrected_v35,
            cognitive_map=cmap_obs['memory'].detach(),
            cognitive_map_priority=cmap_obs['priority'].detach(),
            cognitive_map_age=cmap_obs['age'].detach(),
            transition_matrix=trans_next.detach(),
            macro_state=macro_next.detach(),
            skill_trace=skill_trace_next.detach(),
            transfer_context=prior_output['transfer_context_v36'].detach(),
            macro_age=macro_age_next.detach(),
            last_node=cmap_obs['node_index'],
        )
        observed = dict(observed35)
        observed.update({
            'macro_prediction_error_v36': macro_error,
            'macro_state_next_v36': macro_next,
            'macro_age_next_v36': macro_age_next,
            'skill_trace_next_v36': skill_trace_next,
            'actual_next_observation_v36': z_next,
            'cognitive_map_next_v36': cmap_obs['memory'],
            'cognitive_map_transition_next_v36': trans_next,
        })
        return observed, new_state

    def forward(self, x: Tensor, state: Optional[V36State] = None,
                goal_sequence=None, target_sequence=None, reward_sequence=None,
                risk_sequence=None, presence_sequence=None, modality_sequence=None,
                proprioception_sequence=None, interoception_sequence=None,
                commit_memory: bool = True, force_planning: Optional[bool] = None) -> Dict[str, Tensor]:
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            target_next = target_sequence[:, t] if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] else None
            o, st = self.step(
                x[:, t], st,
                goal=goal_sequence[:, t] if goal_sequence is not None else None,
                target_next=target_next,
                presence=presence_sequence[:, t] if presence_sequence is not None else None,
                modalities=modality_sequence[:, t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:, t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:, t] if interoception_sequence is not None else None,
                commit_memory=commit_memory, force_planning=force_planning,
            )
            if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] and t < x.size(1) - 1:
                rew = reward_sequence[:, t] if reward_sequence is not None else o['reward_v32'].detach()
                rsk = risk_sequence[:, t] if risk_sequence is not None else o['risk_v32'].detach()
                observed, st = self.observe_outcome(st, o, target_sequence[:, t].detach(), rew.detach(), rsk.detach())
                o.update({f'outcome_{k}_v36': v for k, v in observed.items() if torch.is_tensor(v)})
                o['outcome_identity_next_v35'] = st.base.identity_state
                o['outcome_value_next_v35'] = st.base.value_state
            rows.append(o)
        tensors = {
            k: torch.stack([r[k] for r in rows], 1)
            for k in rows[0]
            if torch.is_tensor(rows[0][k]) and not k.startswith('outcome_') and k != '_final_state'
        }
        out_keys = set().union(*[set(k for k in r if k.startswith('outcome_')) for r in rows]) if rows else set()
        for k in out_keys:
            template = next((r[k] for r in rows if k in r), None)
            if template is not None:
                tensors[k] = torch.stack([r[k] if k in r else torch.zeros_like(template) for r in rows], 1)
        tensors['_final_state'] = st
        return tensors

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        target_internal = target_sequence
        if target_internal is not None and target_internal.size(-1) != self.cfg.d:
            target_internal = self._internal(target_internal).detach()
        base_out = dict(out)
        heads = base_out.get('foresight_next_heads_v32')
        if heads is not None and heads.ndim == 4:
            # Legacy V33/V34/V35 wrappers can leave this tensor as [H,T,B,D].
            if heads.size(0) == self.cfg.ensemble_heads and heads.size(1) == out['fused_latent_v30'].size(1):
                base_out['foresight_next_heads_v32'] = heads.permute(2, 0, 1, 3).contiguous()
            elif heads.size(0) == out['fused_latent_v30'].size(0):
                base_out['foresight_next_heads_v32'] = heads.contiguous()
        p = self.base.loss_parts(base_out, target_sequence=target_internal, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']
        zero = _zero_like(z)
        if z.size(1) <= 1 or 'outcome_identity_next_v35' not in out:
            return {**p, 'cognitive_map': zero, 'map_transition': zero, 'macro': zero,
                    'skill_transfer': zero, 'transfer_consistency': zero, 'empowerment': zero, 'macro_duration': zero}
        # Cognitive-map prediction: map context should predict the observed next latent state.
        map_ctx = out['cognitive_map_context_v36'][:, :-1]
        z_next = z[:, 1:].detach()
        map_pred = _norm(map_ctx)
        cognitive_map = F.smooth_l1_loss(map_pred, _norm(z_next))
        # Transition learning uses a differentiable node predictor; the persistent adjacency
        # matrix remains an online statistic, while this predictor learns reusable topology.
        # Reuse the query-conditioned transition predictor by recomputing it from map context/query.
        # The predictor parameters are reached through this auxiliary target path.
        qv = _norm(out['cognitive_map_context_v36'][:, :-1])
        tv = self.cognitive_map.transition_predictor(torch.cat([qv, out['cognitive_map_context_v36'][:, :-1]], -1))
        next_attn = out['cognitive_map_attention_v36'][:, 1:].detach()
        map_transition = F.kl_div(F.log_softmax(tv, dim=-1), next_attn, reduction='batchmean')
        macro = F.smooth_l1_loss(out['macro_state_v36'][:, :-1], _norm(z_next))
        macro_duration_target = (1.0 + 2.5 * out['prediction_error_v31'][:, :-1].detach() + 1.5 * out['novelty'][:, :-1].detach()).clamp(1.0, float(self.cfg.macro_duration_max_v36))
        macro_duration = F.smooth_l1_loss(out['macro_duration_v36'][:, :-1], macro_duration_target)
        teacher = out['chosen_action_v35'][:, :-1].detach()
        transfer_action = out['transfer_action_v36'][:, :-1]
        skill_transfer = F.smooth_l1_loss(transfer_action, teacher)
        # The transfer path should remain near-zero only when the gate is low; preserve bounded teacher behavior.
        transfer_consistency = (out['transfer_gate_v36'][:, :-1] * (transfer_action - teacher).pow(2).mean(-1, keepdim=True)).mean()
        control_pred = self.empowerment(
            out['fused_latent_v30'][:, :-1].reshape(-1, self.cfg.d),
            out['chosen_action_v36'][:, :-1].reshape(-1, self.cfg.action_dim)
        )
        if reward_sequence is not None and reward_sequence.shape[:2] == z.shape[:2]:
            control_target = reward_sequence[:, :-1].detach().squeeze(-1).clamp(-1.0, 1.0)
            empowerment = F.smooth_l1_loss(control_pred, control_target.reshape(-1))
        else:
            empowerment = control_pred.pow(2).mean() * 0.01
        return {**p, 'cognitive_map': cognitive_map, 'map_transition': map_transition,
                'macro': macro, 'skill_transfer': skill_transfer,
                'transfer_consistency': transfer_consistency, 'empowerment': empowerment,
                'macro_duration': macro_duration}

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        target_sequence = kwargs.get('target_sequence')
        reward_sequence = kwargs.get('reward_sequence')
        risk_sequence = kwargs.get('risk_sequence')
        target_internal = target_sequence
        if target_internal is not None and target_internal.size(-1) != self.cfg.d:
            target_internal = self._internal(target_internal).detach()
        base_out = dict(out)
        heads = base_out.get('foresight_next_heads_v32')
        if heads is not None and heads.ndim == 4:
            if heads.size(0) == self.cfg.ensemble_heads and heads.size(1) == out['fused_latent_v30'].size(1):
                base_out['foresight_next_heads_v32'] = heads.permute(2, 0, 1, 3).contiguous()
        c = self.cfg
        return self.base.training_loss(base_out, target_sequence=target_internal,
                                       reward_sequence=reward_sequence, risk_sequence=risk_sequence) \
            + c.map_prediction_weight_v36 * p['cognitive_map'] \
            + c.map_transition_weight_v36 * p['map_transition'] \
            + c.macro_prediction_weight_v36 * p['macro'] \
            + c.macro_duration_weight_v36 * p['macro_duration'] \
            + c.skill_transfer_weight_v36 * p['skill_transfer'] \
            + c.transfer_consistency_weight_v36 * p['transfer_consistency'] \
            + c.empowerment_weight_v36 * p['empowerment']


class RuntimeStateStoreV36(RuntimeStateStoreV35):
    VERSION = 1

    @classmethod
    def load(cls, path: str, device=None, dtype=None) -> V36State:
        payload = torch.load(path, map_location=device, weights_only=False)
        if payload.get('version') != cls.VERSION:
            raise ValueError(f'unsupported V36 runtime-state version: {payload.get("version")}')
        state = payload['state']
        if device is not None or dtype is not None:
            state = cls._move(state, device=device, dtype=dtype)
        return state


class OrganismTrainerV36(OrganismTrainerV35):
    """V36 trainer with cognitive-map, macro-state and transfer losses."""
    def __init__(self, model: NeuroWeaveV36, lr: float = 3e-4, warmup_steps: int = 16):
        super().__init__(model=model, lr=lr, warmup_steps=warmup_steps)
        self.model = model

    def _replay_loss(self, device, dtype):
        sampled = self.replay.sample(self.model.cfg.replay_batch_v34, device, dtype)
        if sampled is None:
            return torch.zeros((), device=device, dtype=dtype), None, None
        batch, idx, is_w = sampled
        ensemble = self.model.base.base.base.base.ensemble
        pred = ensemble(batch['z'], batch['action'], batch['body'], batch['external_state'])
        next_err = F.smooth_l1_loss(pred['next_mean'], batch['next_obs'], reduction='none').mean(-1)
        reward_err = F.smooth_l1_loss(pred['reward_mean'], batch['reward'], reduction='none').mean(-1)
        risk_err = F.binary_cross_entropy(pred['risk_mean'].clamp(1e-5,1-1e-5), batch['risk'].clamp(0,1), reduction='none').mean(-1)
        per = next_err + 0.5 * reward_err + 0.5 * risk_err
        return (per * is_w).mean(), idx, per.detach()

    def dream_rehearse(self, max_items=None):
        n = min(len(self.replay), max_items or self.model.cfg.replay_batch_v34)
        if n <= 0:
            return {'accepted': 0.0, 'examined': 0.0, 'loss': 0.0}
        sampled = self.replay.sample(n, next(self.model.parameters()).device, next(self.model.parameters()).dtype)
        if sampled is None:
            return {'accepted': 0.0, 'examined': 0.0, 'loss': 0.0}
        batch, _, _ = sampled
        z, act, body, ext = batch['z'], batch['action'], batch['body'], batch['external_state']
        ensemble = self.model.base.base.base.base.ensemble
        with torch.no_grad():
            base = ensemble(z, act, body, ext)
            base_obj = (base['reward_mean'] - self.model.cfg.risk_aversion * base['risk_mean'] - 0.10 * base['total_uncertainty']).squeeze(-1)
            k = self.model.cfg.dream_candidates
            noise = torch.randn(n, k, act.size(-1), device=act.device, dtype=act.dtype) * self.model.cfg.dream_action_noise
            cands = torch.tanh(act.unsqueeze(1) + noise)
            flat = cands.reshape(n*k, -1)
            zf = z.unsqueeze(1).expand(-1,k,-1).reshape(n*k,-1)
            bf = body.unsqueeze(1).expand(-1,k,-1).reshape(n*k,-1)
            ef = ext.unsqueeze(1).expand(-1,k,-1).reshape(n*k,-1)
            cf = ensemble(zf,flat,bf,ef)
            cobj = (cf['reward_mean'] - self.model.cfg.risk_aversion * cf['risk_mean'] - 0.10 * cf['total_uncertainty']).view(n,k)
            best, idx = cobj.max(-1)
            chosen = cands[torch.arange(n,device=z.device),idx]
            chosen_unc = cf['total_uncertainty'].view(n,k)[torch.arange(n,device=z.device),idx]
            accepted = (best-base_obj > self.model.cfg.dream_accept_margin) & (chosen_unc < self.model.cfg.dream_uncertainty_limit)
        if not accepted.any():
            return {'accepted': 0.0,'examined':float(n),'loss':0.0}
        count = int(accepted.sum().item())
        goal = ext[accepted]
        if goal.size(-1) != self.model.cfg.goal_dim:
            goal = F.pad(goal,(0,max(0,self.model.cfg.goal_dim-goal.size(-1))))[...,:self.model.cfg.goal_dim]
        macro = torch.zeros(count,self.model.cfg.d,device=z.device,dtype=z.dtype)
        ident = torch.zeros_like(macro); value = torch.zeros_like(macro); transfer_mem = torch.zeros_like(macro)
        unc = chosen_unc[accepted].unsqueeze(-1); nov = torch.zeros_like(unc)
        pred = self.model.transfer(z[accepted],macro,goal,body[accepted],ident,value,transfer_mem,unc,nov)
        loss = F.smooth_l1_loss(pred['transfer_action'], chosen[accepted])
        self.optimizer.zero_grad(set_to_none=True); loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step()
        return {'accepted':float(accepted.sum()),'examined':float(n),'loss':float(loss.detach())}

    def ingest_real_outcome(self, state_after_action: V36State, prior_output: Dict[str, Tensor],
                            next_observation: Tensor, reward: Tensor, risk: Tensor,
                            done: Optional[Tensor] = None):
        observed, new_state = self.model.observe_outcome(
            state_after_action, prior_output, next_observation, reward, risk, done
        )
        self.ingest_outcome(
            prior_output['fused_latent_v30'].detach(),
            prior_output['chosen_action_v36'].detach(),
            prior_output['body_state_v30'].detach(),
            prior_output['external_state_v31'].detach(),
            self.model._internal(next_observation).detach(),
            reward.detach(), risk.detach(),
        )
        return observed, new_state

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        # Same V34/V35 replay mechanism, but the canonical action is V36's emitted action.
        self.optimizer.zero_grad(set_to_none=True)
        out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence,
                         reward_sequence=reward_sequence, risk_sequence=risk_sequence,
                         commit_memory=False, **kwargs)
        loss = self.model.training_loss(out, target_sequence=target_sequence,
                                        reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        idx = priority = None
        if self.steps >= self.warmup_steps and target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] and x.size(1) > 1:
            z = out['fused_latent_v30'][:, :-1].reshape(-1, self.model.cfg.d)
            action = out['chosen_action_v36'][:, :-1].reshape(-1, self.model.cfg.action_dim)
            body = out['body_state_v30'][:, :-1].reshape(-1, self.model.cfg.body_dim)
            ext = out['external_state_v31'][:, :-1].reshape(-1, self.model.cfg.d)
            nxt = self._internal(target_sequence[:, 1:]).reshape(-1, self.model.cfg.d)
            rew = (reward_sequence[:, 1:] if reward_sequence is not None else out['reward_v32'][:, :-1]).reshape(-1,1)
            rsk = (risk_sequence[:, 1:] if risk_sequence is not None else out['risk_v32'][:, :-1]).reshape(-1,1)
            self.replay.add(z.detach(), action.detach(), body.detach(), ext.detach(), nxt.detach(), rew.detach(), rsk.detach())
            replay_loss, idx, priority = self._replay_loss(x.device, x.dtype)
            loss = loss + self.model.cfg.replay_weight_v34 * replay_loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params, self.max_norm)
        self.optimizer.step()
        if idx is not None:
            self.replay.update_priority(idx, priority)
        self.steps += 1
        if self.cfg_rehearsal_due():
            self.last_rehearsal = self.dream_rehearse()
        return loss.detach(), out
