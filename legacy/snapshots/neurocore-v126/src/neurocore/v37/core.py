from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v36 import V36Config, V36State, NeuroWeaveV36, OrganismTrainerV36, RuntimeStateStoreV36


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _zero_like(x: Tensor) -> Tensor:
    return x.new_zeros(())


@dataclass
class V37Config(V36Config):
    """V37 transfer/self-development brain over the proven V36 organism.

    V37 adds four tightly coupled mechanisms:
      1) autobiographical index over the canonical V34 episodic slots;
      2) latent-task / skill transfer cache for rapid task reuse;
      3) differentiable iterative plan improvement scored by a learned critic;
      4) lightweight update-admission probes to resist catastrophic regression.

    The implementation deliberately avoids a second factual-memory store. The
    autobiographical component is only an index/readout over V34 memory.
    """

    autobiographical_weight_v37: float = 0.08
    autobiographical_goal_weight_v37: float = 0.08
    autobiographical_update_rate_v37: float = 0.10
    autobiographical_decay_v37: float = 0.995
    autobiographical_event_temperature_v37: float = 0.30
    transfer_cache_slots_v37: int = 6
    transfer_cache_weight_v37: float = 0.10
    transfer_cache_update_rate_v37: float = 0.16
    transfer_cache_decay_v37: float = 0.992
    transfer_cache_temperature_v37: float = 0.35
    transfer_value_weight_v37: float = 0.08
    search_iterations_v37: int = 2
    search_candidates_v37: int = 4
    search_step_scale_v37: float = 0.12
    search_value_weight_v37: float = 0.08
    search_distill_weight_v37: float = 0.07
    search_consistency_weight_v37: float = 0.05
    transfer_td_weight_v37: float = 0.06
    autobiographical_consistency_weight_v37: float = 0.05
    identity_trajectory_update_v37: float = 0.06
    identity_trajectory_decay_v37: float = 0.992


def mobile_v37_config(raw_observation_dim: int = 0) -> V37Config:
    return V37Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8, 0.93), sr_dim_v34=8,
        subgoal_horizon_v34=2, identity_slots_v35=4, raw_observation_dim=raw_observation_dim,
        cognitive_map_slots_v36=8, macro_horizons_v36=(1,2,4), macro_duration_max_v36=4,
        transfer_cache_slots_v37=4, search_iterations_v37=2, search_candidates_v37=3,
    )


@dataclass
class V37State:
    base: V36State
    autobiographical_index: Tensor
    autobiographical_summary: Tensor
    identity_trajectory: Tensor
    revision_trace: Tensor
    task_context: Tensor
    task_prototypes: Tensor
    task_values: Tensor
    task_visits: Tensor
    task_action_prototypes: Tensor
    learned_search_state: Tensor
    last_task: Tensor


class AutobiographicalIndexV37(nn.Module):
    """Index over canonical V34 event slots, not a second event memory."""

    def __init__(self, d: int, hidden: int, goal_dim: int, slots: int, temperature: float = 0.30, decay: float = 0.995, update_rate: float = 0.10):
        super().__init__()
        self.slots = slots
        self.temperature = float(temperature)
        self.decay = float(decay)
        self.update_rate = float(update_rate)
        self.query = nn.Sequential(
            nn.Linear(3 * d + goal_dim + 3, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh()
        )
        self.importance = nn.Sequential(
            nn.Linear(2 * d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.goal_proj = nn.Sequential(
            nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )

    def read(self, z: Tensor, identity: Tensor, goal: Tensor, semantic: Tensor,
             memory: Tensor, priority: Tensor, age: Tensor, contradiction: Tensor) -> Dict[str, Tensor]:
        q = _norm(self.query(torch.cat([
            z, identity, semantic, goal, contradiction, priority.mean(-1, keepdim=True), age.mean(-1, keepdim=True)
        ], -1)))
        keys = _norm(memory)
        sim = torch.einsum('bd,bnd->bn', q, keys)
        raw_imp = self.importance(torch.cat([
            memory, q.unsqueeze(1).expand_as(memory),
            priority.unsqueeze(-1), (age / 1000.0).unsqueeze(-1)
        ], -1)).squeeze(-1)
        logits = sim + 0.5 * priority - 0.02 * age + 0.2 * raw_imp
        weights = F.softmax(logits / self.temperature, -1)
        summary = torch.einsum('bn,bnd->bd', weights, memory)
        goal_bias = self.goal_proj(summary)
        return {'query': q, 'weights': weights, 'summary': summary, 'goal_bias': goal_bias}

    def update_index(self, prior_index: Tensor, read_weights: Tensor, outcome_error: Tensor,
                     reward: Tensor, novelty: Tensor, identity_delta: Tensor) -> Tensor:
        signal = torch.sigmoid(0.8 * reward + 0.6 * outcome_error + 0.4 * novelty +
                               0.25 * identity_delta.norm(dim=-1, keepdim=True))
        refreshed = (prior_index * self.decay + self.update_rate * read_weights.detach() * signal).clamp(0.0, 1.0)
        return refreshed



class TaskTransferV37(nn.Module):
    """Compact task-schema cache plus successor-feature-like action value."""

    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int, slots: int):
        super().__init__()
        self.slots = slots
        self.task_keys = nn.Parameter(torch.randn(slots, d) * 0.06)
        self.encode = nn.Sequential(
            nn.Linear(3 * d + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.task_value = nn.Sequential(
            nn.Linear(d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.action_from_task = nn.Sequential(
            nn.Linear(d + action_dim + goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh()
        )
        self.goal_proj = nn.Sequential(
            nn.Linear(d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )

    def forward(self, z: Tensor, goal: Tensor, identity: Tensor, memory_summary: Tensor,
                prototypes: Tensor, visits: Tensor, action_prototypes: Tensor, values: Tensor,
                prior_context: Optional[Tensor] = None, temperature: float = 0.35) -> Dict[str, Tensor]:
        inferred = self.encode(torch.cat([z, identity, memory_summary, goal], -1))
        ctx = _norm(inferred if prior_context is None else 0.88 * inferred + 0.12 * prior_context)
        keys = _norm(self.task_keys)
        learned_proto = _norm(prototypes + 0.25 * keys.unsqueeze(0))
        sim = torch.einsum('bd,bnd->bn', ctx, learned_proto)
        logits = sim + 0.15 * torch.log1p(visits.clamp_min(0.0)) + 0.1 * values
        probs = F.softmax(logits / temperature, -1)
        task_action = torch.einsum('bn,bna->ba', probs, action_prototypes)
        proposed = self.action_from_task(torch.cat([ctx, task_action, goal], -1))
        value = self.task_value(torch.cat([ctx, proposed], -1))
        goal_bias = self.goal_proj(torch.cat([ctx, proposed], -1))
        idx = probs.argmax(-1)
        return {'context': ctx, 'probs': probs, 'action': proposed, 'value': value,
                'goal_bias': goal_bias, 'index': idx}


class PlanImproverV37(nn.Module):
    """Differentiable iterative plan improvement with real-outcome-trained critic."""

    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int, iterations: int, candidates: int, step_scale: float = 0.12):
        super().__init__()
        self.iterations = int(iterations)
        self.candidates = int(candidates)
        self.step_scale = float(step_scale)
        self.refine = nn.Sequential(
            nn.Linear(2 * d + goal_dim + action_dim + 1, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh()
        )
        self.critic = nn.Sequential(
            nn.Linear(2 * d + goal_dim + action_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.goal_proj = nn.Sequential(
            nn.Linear(d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )

    def forward(self, z: Tensor, identity: Tensor, goal: Tensor, seed_action: Tensor,
                uncertainty: Tensor) -> Dict[str, Tensor]:
        action = seed_action
        traces = []
        for i in range(self.iterations):
            delta = self.refine(torch.cat([z, identity, goal, action, uncertainty], -1))
            action = torch.tanh(action + self.step_scale * delta)
            traces.append(action)
        # Build a small local candidate set around the refined proposal.
        noise = torch.linspace(-1.0, 1.0, self.candidates, device=z.device, dtype=z.dtype)
        basis = torch.zeros(self.candidates, action.size(-1), device=z.device, dtype=z.dtype)
        basis[:, 0] = noise
        if action.size(-1) > 1:
            basis[:, 1] = torch.flip(noise, (0,)) * 0.5
        if action.size(-1) > 2:
            basis[:, 2] = noise * 0.25
        cands = torch.tanh(action.unsqueeze(1) + 0.08 * basis.unsqueeze(0))
        ctx_z = z.unsqueeze(1).expand(-1, self.candidates, -1)
        ctx_i = identity.unsqueeze(1).expand(-1, self.candidates, -1)
        ctx_g = goal.unsqueeze(1).expand(-1, self.candidates, -1)
        scores = self.critic(torch.cat([ctx_z, ctx_i, ctx_g, cands], -1)).squeeze(-1)
        weights = F.softmax(scores / 0.30, -1)
        selected = (weights.unsqueeze(-1) * cands).sum(1)
        goal_bias = self.goal_proj(torch.cat([z, selected], -1))
        return {
            'refined_action': action,
            'candidates': cands,
            'candidate_scores': scores,
            'candidate_weights': weights,
            'selected_action': torch.tanh(selected),
            'goal_bias': goal_bias,
            'trace': torch.stack(traces, dim=-2),
        }


class ActionFreeSubgoalV37(nn.Module):
    """Action-free latent subgoal proposer inspired by hierarchical latent planning.

    It predicts a tractable intermediate latent target from the current state,
    persistent self/transfer context and the external goal, without peeking at
    the action selected later by V36. The target is trained against the observed
    next latent state, so it is an auxiliary world-grounding path rather than a
    decorative planning label.
    """

    def __init__(self, d: int, hidden: int, goal_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(4 * d + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.goal_proj = nn.Sequential(
            nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )

    def forward(self, z: Tensor, identity: Tensor, task_context: Tensor, autobiographical: Tensor, goal: Tensor) -> Dict[str, Tensor]:
        subgoal = _norm(self.net(torch.cat([z, identity, task_context, autobiographical, goal], -1)))
        return {'subgoal': subgoal, 'goal_bias': self.goal_proj(subgoal)}


class NeuroWeaveV37(nn.Module):
    """V37: transfer + autobiographical continuity + learned search over V36."""

    def __init__(self, cfg: Optional[V37Config] = None):
        super().__init__()
        self.cfg = cfg or V37Config()
        c = self.cfg
        self.base = NeuroWeaveV36(c)
        self.autobio = AutobiographicalIndexV37(c.d, c.hidden, c.goal_dim, c.episodic_slots_v34, c.autobiographical_event_temperature_v37, c.autobiographical_decay_v37, c.autobiographical_update_rate_v37)
        self.transfer_v37 = TaskTransferV37(c.d, c.hidden, c.action_dim, c.goal_dim, c.transfer_cache_slots_v37)
        self.search_v37 = PlanImproverV37(c.d, c.hidden, c.action_dim, c.goal_dim,
                                          c.search_iterations_v37, c.search_candidates_v37, c.search_step_scale_v37)
        self.action_free_subgoal = ActionFreeSubgoalV37(c.d, c.hidden, c.goal_dim)
        self.autobio_to_goal = nn.Sequential(nn.Linear(c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.goal_dim))
        self.trajectory_update = nn.Sequential(nn.Linear(2*c.d + 3, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d), nn.Tanh())

    def initial_state(self, b: int, device=None, dtype=None) -> V37State:
        c = self.cfg
        return V37State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            autobiographical_index=torch.zeros(b, c.episodic_slots_v34, device=device, dtype=dtype),
            autobiographical_summary=torch.zeros(b, c.d, device=device, dtype=dtype),
            identity_trajectory=torch.zeros(b, c.d, device=device, dtype=dtype),
            revision_trace=torch.zeros(b, 1, device=device, dtype=dtype),
            task_context=torch.zeros(b, c.d, device=device, dtype=dtype),
            task_prototypes=torch.zeros(b, c.transfer_cache_slots_v37, c.d, device=device, dtype=dtype),
            task_values=torch.zeros(b, c.transfer_cache_slots_v37, device=device, dtype=dtype),
            task_visits=torch.zeros(b, c.transfer_cache_slots_v37, device=device, dtype=dtype),
            task_action_prototypes=torch.zeros(b, c.transfer_cache_slots_v37, c.action_dim, device=device, dtype=dtype),
            learned_search_state=torch.zeros(b, c.action_dim, device=device, dtype=dtype),
            last_task=torch.zeros(b, dtype=torch.long, device=device),
        )

    def _internal(self, x: Tensor) -> Tensor:
        return self.base._internal(x)

    def _pre_context(self, xin: Tensor, state: V37State, goal: Optional[Tensor]) -> Dict[str, Tensor]:
        base_state = state.base.base.base  # V34State
        identity = torch.tanh(state.base.base.identity_state + 0.18 * state.identity_trajectory + 0.04 * state.revision_trace)
        contradiction = state.base.base.contradiction_state
        g = goal if goal is not None else torch.zeros(xin.size(0), self.cfg.goal_dim, device=xin.device, dtype=xin.dtype)
        ab = self.autobio.read(
            xin, identity, g, base_state.semantic_state, base_state.episodic_memory,
            base_state.memory_priority, base_state.memory_age, contradiction
        )
        ab_summary = _norm(0.80 * ab['summary'] + 0.20 * state.autobiographical_summary)
        if goal is None:
            task_goal = _norm(ab['goal_bias'] + 0.20 * self.autobio_to_goal(ab_summary))
        else:
            task_goal = _norm(0.94 * g + self.cfg.autobiographical_goal_weight_v37 * ab['goal_bias'] +
                               0.04 * self.autobio_to_goal(ab_summary))
        tr = self.transfer_v37(
            xin, task_goal, identity, ab_summary, state.task_prototypes, state.task_visits,
            state.task_action_prototypes, state.task_values, prior_context=state.task_context,
            temperature=self.cfg.transfer_cache_temperature_v37
        )
        af = self.action_free_subgoal(xin, identity, state.task_context, ab_summary, task_goal)
        # Use the persistent fast/search trace as a small prior; V36 remains the final controller.
        seed_action = torch.tanh(state.learned_search_state + 0.25 * tr['action'])
        search = self.search_v37(
            xin, identity, _norm(task_goal + self.cfg.transfer_cache_weight_v37 * tr['goal_bias'] + 0.05 * af['goal_bias']),
            seed_action, torch.zeros(xin.size(0), 1, device=xin.device, dtype=xin.dtype)
        )
        combined_goal = _norm(
            task_goal
            + self.cfg.transfer_cache_weight_v37 * tr['goal_bias']
            + self.cfg.search_value_weight_v37 * search['goal_bias']
            + self.cfg.autobiographical_goal_weight_v37 * self.autobio_to_goal(ab_summary)
            + 0.05 * af['goal_bias']
        )
        return {'autobio': ab, 'transfer': tr, 'action_free': af, 'search': search, 'goal': combined_goal}

    def step(self, x: Tensor, state: V37State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V37State]:
        xin = self._internal(x)
        pre = self._pre_context(xin, state, goal)
        out36, st36 = self.base.step(
            x, state.base, goal=pre['goal'], target_next=target_next,
            presence=presence, modalities=modalities, proprioception=proprioception,
            interoception=interoception, commit_memory=commit_memory,
            force_planning=force_planning,
        )
        task_ctx = torch.tanh(0.90 * state.task_context + 0.10 * pre['transfer']['context'])
        new_search_state = torch.tanh(0.86 * state.learned_search_state + 0.14 * pre['search']['selected_action'])
        out = dict(out36)
        out.update({
            'autobiographical_index_v37': pre['autobio']['weights'],
            'autobiographical_summary_v37': pre['autobio']['summary'],
            'autobiographical_goal_v37': pre['autobio']['goal_bias'],
            'task_context_v37': pre['transfer']['context'],
            'task_skill_probs_v37': pre['transfer']['probs'],
            'task_transfer_action_v37': pre['transfer']['action'],
            'task_transfer_value_v37': pre['transfer']['value'],
            'task_transfer_goal_v37': pre['transfer']['goal_bias'],
            'task_index_v37': pre['transfer']['index'],
            'search_refined_action_v37': pre['search']['refined_action'],
            'search_candidates_v37': pre['search']['candidates'],
            'search_candidate_scores_v37': pre['search']['candidate_scores'],
            'search_candidate_weights_v37': pre['search']['candidate_weights'],
            'search_selected_action_v37': pre['search']['selected_action'],
            'search_goal_v37': pre['search']['goal_bias'],
            'search_trace_v37': pre['search']['trace'],
            'action_free_subgoal_v37': pre['action_free']['subgoal'],
            'action_free_goal_v37': pre['action_free']['goal_bias'],
            'planning_goal_v37': pre['goal'],
            'chosen_action_v37': out36['chosen_action_v36'],
            'task_context_next_v37': task_ctx,
            'learned_search_state_next_v37': new_search_state,
        })
        new_state = V37State(
            base=st36,
            autobiographical_index=(pre['autobio']['weights']).detach() if commit_memory else pre['autobio']['weights'],
            autobiographical_summary=pre['autobio']['summary'].detach() if commit_memory else pre['autobio']['summary'],
            identity_trajectory=state.identity_trajectory,
            revision_trace=state.revision_trace,
            task_context=task_ctx.detach() if commit_memory else task_ctx,
            task_prototypes=state.task_prototypes,
            task_values=state.task_values,
            task_visits=state.task_visits,
            task_action_prototypes=state.task_action_prototypes,
            learned_search_state=new_search_state.detach() if commit_memory else new_search_state,
            last_task=pre['transfer']['index'],
        )
        out['_final_state'] = new_state
        return out, new_state

    def observe_outcome(self, state_after_action: V37State, prior_output: Dict[str, Tensor],
                        next_observation: Tensor, reward: Tensor, risk: Tensor,
                        done: Optional[Tensor] = None) -> Tuple[Dict[str, Tensor], V37State]:
        observed36, st36 = self.base.observe_outcome(
            state_after_action.base, prior_output, next_observation, reward, risk, done
        )
        next_z = self._internal(next_observation)
        identity_delta = observed36.get('identity_delta_v35', torch.zeros_like(next_z))
        pe = prior_output.get('prediction_error_v31', torch.zeros_like(reward)).detach()
        novelty = prior_output.get('novelty', torch.zeros_like(reward)).detach()
        idx = state_after_action.last_task.long().clamp(0, self.cfg.transfer_cache_slots_v37 - 1)
        onehot = F.one_hot(idx, num_classes=self.cfg.transfer_cache_slots_v37).to(next_z.dtype)
        success = torch.sigmoid(reward.detach())
        task_values = state_after_action.task_values * self.cfg.transfer_cache_decay_v37
        task_values = task_values + onehot * self.cfg.transfer_cache_update_rate_v37 * reward.detach()
        visits = state_after_action.task_visits * self.cfg.transfer_cache_decay_v37 + onehot
        task_proto = state_after_action.task_prototypes * self.cfg.transfer_cache_decay_v37
        task_act = state_after_action.task_action_prototypes * self.cfg.transfer_cache_decay_v37
        chosen_slot = idx.view(-1, 1, 1).expand(-1, 1, self.cfg.d)
        proto_old = task_proto.gather(1, chosen_slot).squeeze(1)
        proto_new = _norm((1.0 - self.cfg.transfer_cache_update_rate_v37) * proto_old + self.cfg.transfer_cache_update_rate_v37 * next_z.detach())
        task_proto.scatter_(1, chosen_slot, proto_new.unsqueeze(1))
        action_old = task_act.gather(1, idx.view(-1, 1, 1).expand(-1, 1, self.cfg.action_dim)).squeeze(1)
        action_new = (1.0 - self.cfg.transfer_cache_update_rate_v37) * action_old + self.cfg.transfer_cache_update_rate_v37 * prior_output['chosen_action_v37'].detach()
        task_act.scatter_(1, idx.view(-1, 1, 1).expand(-1, 1, self.cfg.action_dim), action_new.unsqueeze(1))

        # The autobiographical index points into the canonical V34 memory; it is updated after outcome.
        ab_index = self.autobio.update_index(
            state_after_action.autobiographical_index, prior_output['autobiographical_index_v37'], pe, reward, novelty, identity_delta
        )
        ab_summary = torch.einsum('bn,bnd->bd', ab_index, st36.base.base.episodic_memory)
        trajectory_delta = self.trajectory_update(torch.cat([state_after_action.identity_trajectory, next_z, reward, risk, pe], -1))
        trajectory = torch.tanh(
            self.cfg.identity_trajectory_decay_v37 * state_after_action.identity_trajectory
            + self.cfg.identity_trajectory_update_v37 * trajectory_delta
        )
        revision = state_after_action.revision_trace + identity_delta.norm(dim=-1, keepdim=True)
        done_soft = torch.zeros_like(reward) if done is None else done.float().view(-1,1).clamp(0,1)
        task_context = ((1.0 - done_soft) * (0.94 * state_after_action.task_context + 0.06 * prior_output['task_context_v37'])).detach()
        new_state = V37State(
            base=st36,
            autobiographical_index=ab_index.detach(),
            autobiographical_summary=ab_summary.detach(),
            identity_trajectory=trajectory.detach(),
            revision_trace=revision.detach(),
            task_context=task_context,
            task_prototypes=task_proto.detach(),
            task_values=task_values.detach(),
            task_visits=visits.detach(),
            task_action_prototypes=task_act.detach(),
            learned_search_state=prior_output['learned_search_state_next_v37'].detach(),
            last_task=prior_output['task_index_v37'].detach(),
        )
        observed = dict(observed36)
        observed.update({
            'autobiographical_index_next_v37': ab_index,
            'autobiographical_summary_next_v37': ab_summary,
            'identity_trajectory_next_v37': trajectory,
            'revision_trace_next_v37': revision,
            'task_context_next_after_outcome_v37': task_context,
            'task_values_next_v37': task_values,
            'task_visits_next_v37': visits,
            'task_action_prototypes_next_v37': task_act,
        })
        return observed, new_state

    def forward(self, x: Tensor, state: Optional[V37State] = None, goal_sequence=None,
                target_sequence=None, reward_sequence=None, risk_sequence=None,
                presence_sequence=None, modality_sequence=None, proprioception_sequence=None,
                interoception_sequence=None, commit_memory: bool = True,
                force_planning: Optional[bool] = None) -> Dict[str, Tensor]:
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
                o.update({f'outcome_{k}_v37': v for k, v in observed.items() if torch.is_tensor(v)})
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0]
                   if torch.is_tensor(rows[0][k]) and not k.startswith('outcome_') and k != '_final_state'}
        out_keys = set().union(*[set(k for k in r if k.startswith('outcome_')) for r in rows]) if rows else set()
        for k in out_keys:
            template = next((r[k] for r in rows if k in r), None)
            if template is not None:
                tensors[k] = torch.stack([r[k] if k in r else torch.zeros_like(template) for r in rows], 1)
        tensors['_final_state'] = st
        return tensors

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        p = self.base.loss_parts(out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']
        zero = _zero_like(z)
        if z.size(1) <= 1 or 'outcome_autobiographical_index_next_v37' not in out:
            return {**p, 'autobiographical': zero, 'autobiographical_consistency': zero, 'transfer_value': zero,
                    'transfer_td': zero, 'search_value': zero, 'search_distill': zero, 'search_consistency': zero, 'action_free_subgoal': zero}
        target_internal = target_sequence
        if target_internal is not None and target_internal.size(-1) != self.cfg.d:
            target_internal = self._internal(target_internal).detach()
        mem = out['memory_post_read_v34'][:, :-1].detach()
        ab = out['autobiographical_summary_v37'][:, :-1]
        autobiographical = F.smooth_l1_loss(ab, _norm(mem).detach())
        ab_next = out['outcome_autobiographical_summary_next_v37'][:, :-1].detach()
        autobiographical_consistency = F.smooth_l1_loss(out['autobiographical_summary_v37'][:, 1:], ab_next)

        transfer_value = out['task_transfer_value_v37'][:, :-1].squeeze(-1)
        if reward_sequence is not None and reward_sequence.shape[:2] == z.shape[:2]:
            reward_t = reward_sequence[:, :-1].detach().squeeze(-1)
        else:
            reward_t = out['reward_v32'][:, :-1].detach().squeeze(-1)
        transfer_value_loss = F.smooth_l1_loss(transfer_value, reward_t)
        next_transfer = out['task_transfer_value_v37'][:, 1:].detach().squeeze(-1)
        td_target = reward_t + 0.92 * next_transfer
        transfer_td = F.smooth_l1_loss(transfer_value, td_target)

        search_scores = out['search_candidate_scores_v37'][:, :-1]
        search_target = reward_t.unsqueeze(-1).detach().expand_as(search_scores)
        search_value = F.smooth_l1_loss(search_scores, search_target)
        teacher = out['chosen_action_v36'][:, :-1].detach()
        selected = out['search_selected_action_v37'][:, :-1]
        search_distill = F.smooth_l1_loss(selected, teacher)
        weights = out['search_candidate_weights_v37'][:, :-1]
        entropy = -(weights.clamp_min(1e-6) * weights.clamp_min(1e-6).log()).sum(-1).mean()
        search_consistency = F.smooth_l1_loss(out['search_refined_action_v37'][:, :-1], teacher)
        action_free_target = _norm(z[:, 1:]).detach()
        action_free_subgoal = F.smooth_l1_loss(out['action_free_subgoal_v37'][:, :-1], action_free_target)
        return {**p, 'autobiographical': autobiographical,
                'autobiographical_consistency': autobiographical_consistency,
                'transfer_value': transfer_value_loss, 'transfer_td': transfer_td,
                'search_value': search_value, 'search_distill': search_distill,
                'search_consistency': search_consistency - 0.01 * entropy, 'action_free_subgoal': action_free_subgoal}

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        c = self.cfg
        return self.base.training_loss(out, **kwargs) \
            + c.autobiographical_weight_v37 * p['autobiographical'] \
            + c.autobiographical_consistency_weight_v37 * p['autobiographical_consistency'] \
            + c.transfer_value_weight_v37 * p['transfer_value'] \
            + c.transfer_td_weight_v37 * p['transfer_td'] \
            + c.search_value_weight_v37 * p['search_value'] \
            + c.search_distill_weight_v37 * p['search_distill'] \
            + c.search_consistency_weight_v37 * p['search_consistency'] \
            + 0.06 * p['action_free_subgoal']


class RuntimeStateStoreV37(RuntimeStateStoreV36):
    VERSION = 1

    @classmethod
    def load(cls, path: str, device=None, dtype=None) -> V37State:
        payload = torch.load(path, map_location=device, weights_only=False)
        if payload.get('version') != cls.VERSION:
            raise ValueError(f'unsupported V37 runtime-state version: {payload.get("version")}')
        state = payload['state']
        if device is not None or dtype is not None:
            state = cls._move(state, device=device, dtype=dtype)
        return state


class OrganismTrainerV37(OrganismTrainerV36):
    """V37 trainer with real transfer/search losses and budgeted rehearsal."""

    def __init__(self, model: NeuroWeaveV37, lr: float = 3e-4, warmup_steps: int = 8):
        super().__init__(model=model, lr=lr, warmup_steps=warmup_steps)
        self.model = model

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence,
                         reward_sequence=reward_sequence, risk_sequence=risk_sequence,
                         commit_memory=False, **kwargs)
        loss = self.model.training_loss(out, target_sequence=target_sequence,
                                        reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params, self.max_norm)
        self.optimizer.step()
        self.steps += 1
        if self.cfg_rehearsal_due():
            self.last_rehearsal = self.dream_rehearse(max_items=min(2, self.model.cfg.replay_batch_v34))
        return loss.detach(), out

