from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v34 import (
    V34Config,
    V34State,
    NeuroWeaveV34,
    OrganismTrainerV34,
    RuntimeStateStoreV34,
)


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _zero_like(x: Tensor) -> Tensor:
    return x.new_zeros(())


@dataclass
class V35Config(V34Config):
    """V35 self/identity brain over the V34 memory-temporal organism.

    The design intentionally keeps one canonical episodic owner (V34 memory). V35
    adds only persistent self/identity state, commitment slots, value provenance
    aligned to the existing memory slots, and a contradiction reservoir.
    """

    identity_weight_v35: float = 0.14
    self_prediction_weight_v35: float = 0.12
    contradiction_weight_v35: float = 0.06
    commitment_weight_v35: float = 0.08
    value_provenance_weight_v35: float = 0.08
    self_consistency_weight_v35: float = 0.05
    development_weight_v35: float = 0.04
    identity_update_rate_v35: float = 0.16
    value_update_rate_v35: float = 0.10
    commitment_update_rate_v35: float = 0.12
    identity_slots_v35: int = 6
    identity_stability_floor_v35: float = 0.04
    contradiction_decay_v35: float = 0.90
    commitment_decay_v35: float = 0.985
    value_decay_v35: float = 0.97
    development_pressure_scale_v35: float = 0.20
    development_temperature_v35: float = 0.60
    identity_goal_scale_v35: float = 0.18
    value_goal_scale_v35: float = 0.10
    commitment_goal_scale_v35: float = 0.08
    provenance_goal_scale_v35: float = 0.06
    goal_persistence_v35: float = 0.84
    goal_update_rate_v35: float = 0.18
    goal_decay_v35: float = 0.98
    goal_management_weight_v35: float = 0.07
    goal_progress_weight_v35: float = 0.05
    fast_adapter_scale_v35: float = 0.12
    fast_adapter_decay_v35: float = 0.94
    fast_adapter_update_rate_v35: float = 0.16
    fast_adapter_weight_v35: float = 0.08
    identity_anchor_update_rate_v35: float = 0.03
    identity_anchor_weight_v35: float = 0.02
    goal_satisfaction_weight_v35: float = 0.05
    goal_satisfaction_threshold_v35: float = 0.82
    commitment_evidence_decay_v35: float = 0.985
    commitment_evidence_update_rate_v35: float = 0.12
    commitment_evidence_weight_v35: float = 0.08


@dataclass
class V35State:
    base: V34State
    identity_state: Tensor
    value_state: Tensor
    commitment_strengths: Tensor
    contradiction_state: Tensor
    value_provenance: Tensor
    active_goal: Tensor
    goal_age: Tensor
    goal_progress: Tensor
    goal_confidence: Tensor
    fast_adapter_state: Tensor
    identity_anchor: Tensor
    commitment_success: Tensor
    commitment_failure: Tensor
    life_clock: Tensor


class IdentityLedgerV35(nn.Module):
    """Causal self/identity dynamics with commitments and outcome provenance.

    It does not create a second episodic memory. Provenance uses the V34 memory
    slots as its address space, keeping one canonical event store.
    """

    def __init__(self, d: int, hidden: int, action_dim: int, body_dim: int,
                 goal_dim: int, slots: int, commitment_decay: float = 0.985, value_decay: float = 0.97, value_update_rate: float = 0.10, contradiction_decay: float = 0.90, commitment_evidence_decay: float = 0.985, commitment_evidence_update_rate: float = 0.12, commitment_evidence_weight: float = 0.08, commitment_update_rate: float = 0.12):
        super().__init__()
        self.d = d
        self.goal_dim = goal_dim
        self.slots = slots
        self.commitment_decay_v35 = float(commitment_decay)
        self.value_decay_v35 = float(value_decay)
        self.value_update_rate_v35 = float(value_update_rate)
        self.contradiction_decay_v35 = float(contradiction_decay)
        self.commitment_evidence_decay_v35 = float(commitment_evidence_decay)
        self.commitment_evidence_update_rate_v35 = float(commitment_evidence_update_rate)
        self.commitment_evidence_weight_v35 = float(commitment_evidence_weight)
        self.commitment_update_rate_v35 = float(commitment_update_rate)

        self.self_predict = nn.Sequential(
            nn.Linear(3 * d + goal_dim + action_dim + body_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.self_observe = nn.Sequential(
            nn.Linear(d + action_dim + body_dim + 3, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.revise = nn.Sequential(
            nn.Linear(3 * d + 3, hidden), nn.SiLU(), nn.Linear(hidden, hidden),
            nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.revision_gate = nn.Sequential(
            nn.Linear(3 * d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.contradiction = nn.Sequential(
            nn.Linear(2 * d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.value_update = nn.Sequential(
            nn.Linear(d + 5, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.identity_goal = nn.Sequential(
            nn.Linear(2 * d, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.value_goal = nn.Sequential(
            nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.provenance = nn.Sequential(
            nn.Linear(2 * d + 3, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )
        self.provenance_goal = nn.Sequential(
            nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.commitment_key = nn.Parameter(torch.randn(slots, goal_dim) * 0.05)
        self.commitment_score = nn.Sequential(
            nn.Linear(goal_dim + d + 2, hidden), nn.SiLU(), nn.Linear(hidden, self.slots)
        )
        self.commitment_context = nn.Sequential(
            nn.Linear(goal_dim, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )
        self.identity_summary = nn.Sequential(
            nn.Linear(d + slots + 1, hidden), nn.SiLU(), nn.Linear(hidden, d)
        )
        self.development = nn.Sequential(
            nn.Linear(4, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim)
        )

    def goal_context(self, identity: Tensor, value: Tensor, commitment_strengths: Tensor,
                     contradiction_state: Optional[Tensor] = None, provenance_summary: Optional[Tensor] = None,
                     commitment_success: Optional[Tensor] = None, commitment_failure: Optional[Tensor] = None) -> Dict[str, Tensor]:
        keys = _norm(self.commitment_key)
        if commitment_success is None:
            commitment_success = torch.zeros_like(commitment_strengths)
        if commitment_failure is None:
            commitment_failure = torch.zeros_like(commitment_strengths)
        evidence = commitment_success / (commitment_success + commitment_failure + 1e-4)
        weights = F.softmax(commitment_strengths + self.commitment_evidence_weight_v35 * (evidence - 0.5), dim=-1)
        commitment_raw = torch.matmul(weights, keys)
        commitment_ctx = _norm(self.commitment_context(commitment_raw))
        contradiction_state = torch.zeros(identity.size(0), 1, device=identity.device, dtype=identity.dtype) if contradiction_state is None else contradiction_state
        identity_repr = torch.tanh(self.identity_summary(torch.cat([identity, commitment_strengths, contradiction_state], -1)))
        identity_goal = self.identity_goal(torch.cat([identity_repr, value], -1))
        value_goal = self.value_goal(value)
        provenance_summary = torch.zeros_like(identity) if provenance_summary is None else provenance_summary
        provenance_goal = self.provenance_goal(provenance_summary)
        return {
            'identity_goal': identity_goal,
            'value_goal': value_goal,
            'provenance_goal': provenance_goal,
            'identity_repr': identity_repr,
            'commitment_goal': commitment_ctx,
            'commitment_weights': weights,
        }

    def predict_self(self, identity: Tensor, z: Tensor, goal: Tensor,
                     action: Tensor, body: Tensor, semantic: Tensor) -> Tensor:
        return self.self_predict(torch.cat([identity, z, semantic, goal, action, body], -1))

    def observe_outcome(
        self,
        prior_identity: Tensor,
        prior_value: Tensor,
        prior_commitments: Tensor,
        prior_contradiction: Tensor,
        prior_provenance: Tensor,
        self_prediction: Tensor,
        z_next: Tensor,
        action: Tensor,
        body: Tensor,
        reward: Tensor,
        risk: Tensor,
        prediction_error: Tensor,
        novelty: Tensor,
        write_weights: Tensor,
        goal: Tensor,
        life_clock: Tensor,
    ) -> Dict[str, Tensor]:
        # Self observation is intentionally action/body/outcome grounded and does not receive identity as input.
        self_observation = self.self_observe(torch.cat([z_next, action, body, reward, risk, prediction_error], -1))
        raw_dist = (self_prediction - self_observation).norm(dim=-1, keepdim=True)
        contradiction = torch.sigmoid(self.contradiction(torch.cat([
            self_prediction, self_observation, reward, risk
        ], -1)))
        contradiction_signal = (0.65 * contradiction + 0.35 * raw_dist.clamp(0.0, 2.0)).clamp(0.0, 1.0)
        gate = torch.sigmoid(self.revision_gate(torch.cat([
            prior_identity, self_prediction, self_observation,
            contradiction_signal, reward, risk
        ], -1)))
        revision_delta = self.revise(torch.cat([
            prior_identity, self_prediction, self_observation, contradiction_signal, reward, risk
        ], -1))
        # Revision is evidence-gated: small contradictions do not continuously rewrite identity.
        effective_gate = (gate * contradiction_signal).clamp(0.0, 1.0)
        candidate_identity = torch.tanh(prior_identity + revision_delta * effective_gate)
        identity = torch.tanh((1.0 - 0.35 * effective_gate) * prior_identity + 0.35 * effective_gate * candidate_identity)

        outcome_score = torch.sigmoid(1.6 * reward - 1.4 * risk - 0.8 * contradiction_signal)
        score_bias = self.commitment_score(torch.cat([goal, identity, reward, risk], -1))
        key_sim = F.cosine_similarity(goal.unsqueeze(1), _norm(self.commitment_key).unsqueeze(0), dim=-1)
        key_assignment = F.softmax(key_sim / 0.35, -1)
        commitment_logits = (key_sim + 0.5 * score_bias) / 0.35
        commitment_probs = F.softmax(commitment_logits, -1)
        # The runtime assignment follows the learned score, while the learning target is an
        # outcome-modulated detached anchor. This avoids the previous self-distillation loop
        # where target==prediction and commitment_score could receive zero gradient.
        outcome_factor = (0.5 + 0.5 * outcome_score).expand_as(key_assignment)
        commitment_learning_target = (key_assignment * outcome_factor).clamp_min(1e-6)
        commitment_learning_target = commitment_learning_target / commitment_learning_target.sum(-1, keepdim=True).clamp_min(1e-6)
        commitment_target = commitment_probs.clamp(0.0, 1.0)
        assignment = commitment_probs
        # Evidence is updated in the V35State outside this stateless ledger; return the
        # per-outcome positive/negative evidence contributions here.
        commitment_success_increment = assignment * outcome_score
        commitment_failure_increment = assignment * (1.0 - outcome_score)
        commitment_strengths = (
            prior_commitments * self.commitment_decay_v35
            + self.commitment_update_rate_v35 * assignment * (1.0 - prior_commitments)
            + (0.5 * self.commitment_update_rate_v35) * assignment * (outcome_score - prior_commitments)
        ).clamp(0.0, 1.0)
        # Give explicit goal continuity a small persistence boost; success/failure still modifies it.
        commitment_strengths = (commitment_strengths + 0.04 * commitment_target).clamp(0.0, 1.0)

        value_delta = self.value_update(torch.cat([
            z_next, reward, risk, contradiction_signal, novelty, prediction_error
        ], -1))
        value_state = torch.tanh(
            self.value_decay_v35 * prior_value
            + self.value_update_rate_v35 * value_delta
        )

        prov_delta = self.provenance(torch.cat([
            prior_identity, self_observation, reward, risk, contradiction_signal
        ], -1))
        provenance = (
            prior_provenance * 0.965
            + write_weights.unsqueeze(-1) * prov_delta.unsqueeze(1)
        ).tanh()

        reservoir = (
            self.contradiction_decay_v35 * prior_contradiction
            + (1.0 - self.contradiction_decay_v35) * contradiction_signal
        ).clamp(0.0, 1.0)

        return {
            'identity_state': identity,
            'value_state': value_state,
            'commitment_strengths': commitment_strengths,
            'contradiction_state': reservoir,
            'value_provenance': provenance,
            'self_observation': self_observation,
            'self_prediction_error': raw_dist,
            'contradiction': contradiction_signal,
            'revision_gate': effective_gate,
            'commitment_target': commitment_target,
            'commitment_probs': commitment_probs,
            'commitment_assignment': assignment,
            'commitment_learning_target': commitment_learning_target,
            'outcome_score': outcome_score,
            'commitment_success_increment': commitment_success_increment,
            'commitment_failure_increment': commitment_failure_increment,
        }


class FastAdaptationV35(nn.Module):
    """Lightweight within-episode plasticity layer.

    It keeps a compact persistent state rather than updating the whole model on every
    environment transition. The state changes only after an observed outcome, so the
    action path cannot see its own consequence before acting.
    """

    def __init__(self, d: int, hidden: int, goal_dim: int, action_dim: int, scale: float, decay: float, update_rate: float):
        super().__init__()
        self.d = d
        self.scale = float(scale)
        self.decay = float(decay)
        self.update_rate = float(update_rate)
        self.action_delta = nn.Sequential(
            nn.Linear(4*d + goal_dim + action_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh()
        )
        self.write_gate = nn.Sequential(
            nn.Linear(4*d + goal_dim + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.state_update = nn.Sequential(
            nn.Linear(d + action_dim + 3, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, d), nn.Tanh()
        )

    def act(self, fast_state: Tensor, z: Tensor, goal: Tensor, identity: Tensor, value: Tensor, action: Tensor) -> Dict[str, Tensor]:
        ctx = torch.cat([z, identity, value, fast_state, goal, action], -1)
        residual = self.action_delta(ctx)
        gate = torch.sigmoid(self.write_gate(ctx))
        adapted = torch.tanh(action + self.scale * gate * residual)
        return {'action': adapted, 'residual': residual, 'gate': gate}

    def observe(self, fast_state: Tensor, z_next: Tensor, action: Tensor, reward: Tensor, risk: Tensor, prediction_error: Tensor) -> Tensor:
        upd = self.state_update(torch.cat([z_next, action, reward, risk, prediction_error], -1))
        return (self.decay * fast_state + self.update_rate * upd).tanh()


class DevelopmentControllerV35(nn.Module):
    """Converts observed competence gaps into bounded developmental pressure."""

    def __init__(self, goal_dim: int, hidden: int, temperature: float = 0.60):
        super().__init__()
        self.temperature = float(temperature)
        self.net = nn.Sequential(
            nn.Linear(4, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU(),
            nn.Linear(hidden, goal_dim)
        )

    def forward(self, uncertainty: Tensor, prediction_error: Tensor, novelty: Tensor,
                skill_entropy: Tensor) -> Tuple[Tensor, Tensor]:
        signal = torch.cat([uncertainty, prediction_error, novelty, skill_entropy], -1)
        raw = self.net(signal)
        pressure = torch.sigmoid(signal.mean(-1, keepdim=True) / max(self.temperature, 1e-3))
        return torch.tanh(raw), pressure


class NeuroWeaveV35(nn.Module):
    """V35: self/identity brain with real outcome-driven revision and continuity."""

    def __init__(self, cfg: Optional[V35Config] = None):
        super().__init__()
        self.cfg = cfg or V35Config()
        c = self.cfg
        self.base = NeuroWeaveV34(c)
        self.identity = IdentityLedgerV35(
            c.d, c.hidden, c.action_dim, c.body_dim, c.goal_dim,
            c.identity_slots_v35, c.commitment_decay_v35, c.value_decay_v35, c.value_update_rate_v35, c.contradiction_decay_v35, c.commitment_evidence_decay_v35, c.commitment_evidence_update_rate_v35, c.commitment_evidence_weight_v35, c.commitment_update_rate_v35
        )
        self.development = DevelopmentControllerV35(c.goal_dim, c.hidden, c.development_temperature_v35)
        self.goal_manager = nn.Sequential(
            nn.Linear(2 * c.goal_dim + 4, c.hidden), nn.SiLU(),
            nn.Linear(c.hidden, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 1)
        )
        self.goal_progress_head = nn.Sequential(
            nn.Linear(c.goal_dim + 4, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 1)
        )
        self.goal_satisfaction_head = nn.Sequential(
            nn.Linear(c.d + c.goal_dim + 3, c.hidden), nn.SiLU(),
            nn.Linear(c.hidden, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 1)
        )
        self.fast_adapter = FastAdaptationV35(c.d, c.hidden, c.goal_dim, c.action_dim,
                                               c.fast_adapter_scale_v35, c.fast_adapter_decay_v35,
                                               c.fast_adapter_update_rate_v35)

    def initial_state(self, b: int, device=None, dtype=None) -> V35State:
        return V35State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            identity_state=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            value_state=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            commitment_strengths=torch.zeros(b, self.cfg.identity_slots_v35, device=device, dtype=dtype),
            contradiction_state=torch.zeros(b, 1, device=device, dtype=dtype),
            value_provenance=torch.zeros(
                b, self.cfg.episodic_slots_v34, self.cfg.d, device=device, dtype=dtype
            ),
            active_goal=torch.zeros(b, self.cfg.goal_dim, device=device, dtype=dtype),
            goal_age=torch.zeros(b, 1, device=device, dtype=dtype),
            goal_progress=torch.zeros(b, 1, device=device, dtype=dtype),
            goal_confidence=torch.zeros(b, 1, device=device, dtype=dtype),
            fast_adapter_state=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            identity_anchor=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            commitment_success=torch.zeros(b, self.cfg.identity_slots_v35, device=device, dtype=dtype),
            commitment_failure=torch.zeros(b, self.cfg.identity_slots_v35, device=device, dtype=dtype),
            life_clock=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def _internal(self, x: Tensor) -> Tensor:
        return self.base._internal(x)

    def _enrich_goal(self, goal: Optional[Tensor], state: V35State, xin: Tensor,
                     uncertainty: Tensor, prediction_error: Tensor, novelty: Tensor,
                     skill_entropy: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        mem_logits = state.base.memory_priority
        age = state.base.memory_age
        mem_weights = F.softmax(mem_logits - self.cfg.memory_age_penalty_v34 * age, dim=-1)
        provenance_summary = (mem_weights.unsqueeze(-1) * state.value_provenance).sum(1)
        ctx = self.identity.goal_context(
            0.78 * state.identity_state + 0.22 * state.identity_anchor,
            state.value_state, state.commitment_strengths,
            state.contradiction_state, provenance_summary,
            state.commitment_success, state.commitment_failure
        )
        dev_goal, dev_pressure = self.development(uncertainty, prediction_error, novelty, skill_entropy)
        candidate = (
            self.cfg.identity_goal_scale_v35 * _norm(ctx['identity_goal'])
            + self.cfg.value_goal_scale_v35 * _norm(ctx['value_goal'])
            + self.cfg.commitment_goal_scale_v35 * _norm(ctx['commitment_goal'])
            + self.cfg.provenance_goal_scale_v35 * _norm(ctx['provenance_goal'])
            + self.cfg.development_pressure_scale_v35 * dev_pressure * dev_goal
        )
        candidate = _norm(candidate)
        if goal is not None:
            candidate = _norm(
                0.82 * goal
                + self.cfg.identity_goal_scale_v35 * _norm(ctx['identity_goal'])
                + self.cfg.value_goal_scale_v35 * _norm(ctx['value_goal'])
                + self.cfg.commitment_goal_scale_v35 * _norm(ctx['commitment_goal'])
                + self.cfg.provenance_goal_scale_v35 * _norm(ctx['provenance_goal'])
                + self.cfg.development_pressure_scale_v35 * dev_pressure * dev_goal
            )
        prior = state.active_goal
        goal_similarity = F.cosine_similarity(prior, candidate, dim=-1).unsqueeze(-1)
        gate_in = torch.cat([
            prior, candidate,
            goal_similarity, state.goal_confidence, prediction_error.clamp(0, 1), novelty.clamp(0, 1)
        ], -1)
        gate = torch.sigmoid(self.goal_manager(gate_in))
        persistence = self.cfg.goal_persistence_v35 * state.goal_confidence.clamp(0, 1)
        gate = gate * (0.25 + 0.75 * persistence)
        combined = _norm((1.0 - gate) * candidate + gate * prior)
        return combined, {
            **ctx, 'development_goal': dev_goal, 'development_pressure': dev_pressure,
            'goal_candidate': candidate, 'goal_persistence_gate': gate,
            'goal_similarity': goal_similarity, 'provenance_summary': provenance_summary,
        }

    def step(self, x: Tensor, state: V35State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V35State]:
        xin = self._internal(x)
        # Read V34 state first; self/identity is updated only from outcomes.
        # Reuse already-persistent state to allocate development pressure before the expensive V34/V33 pass.
        # No second world-model call is made here: mobile execution stays bounded.
        priority_mean = state.base.memory_priority.mean(-1, keepdim=True)
        cheap_unc = (state.base.base.drive_state.norm(dim=-1, keepdim=True) / (self.cfg.drive_dim ** 0.5)).clamp(0.0, 1.0)
        novelty_proxy = (1.0 - priority_mean).clamp(0.0, 1.0)
        commitment_probs = F.softmax(state.commitment_strengths, dim=-1)
        skill_entropy = (-(commitment_probs.clamp_min(1e-6) * commitment_probs.clamp_min(1e-6).log()).sum(-1, keepdim=True)
                         / max(1.0, torch.log(torch.tensor(float(self.cfg.identity_slots_v35), device=x.device))).clamp_min(1e-6)).clamp(0.0, 1.0)
        enriched_goal, goal_ctx = self._enrich_goal(
            goal, state, xin, cheap_unc, state.contradiction_state, novelty_proxy, skill_entropy
        )
        o34, st34 = self.base.step(
            x, state.base, goal=enriched_goal, target_next=target_next,
            presence=presence, modalities=modalities, proprioception=proprioception,
            interoception=interoception, commit_memory=commit_memory,
            force_planning=force_planning,
        )
        z = o34['fused_latent_v30']
        body = o34['body_state_v30']
        base_action = o34['chosen_action_v34']
        semantic = o34['semantic_state_v34']
        fast = self.fast_adapter.act(
            state.fast_adapter_state, z, enriched_goal, state.identity_state, state.value_state, base_action
        )
        action = fast['action']
        self_prediction = self.identity.predict_self(
            state.identity_state, z, enriched_goal, action, body, semantic
        )
        # V34 wrote the pre-adaptation action. Rewrite the same canonical memory address
        # using the actual emitted action so replay/provenance remains causally correct.
        mem_actual = self.base.memory.write(
            xin, state.base.semantic_state, state.base.episodic_memory, state.base.memory_priority,
            state.base.memory_age, action, o34['foresight_uncertainty_v32'], o34['novelty'],
            o34['prediction_error_v31'], o34['reward_v32'], o34['risk_v32']
        )
        st34_actual = V34State(
            base=st34.base, episodic_memory=mem_actual['memory'].detach() if commit_memory else mem_actual['memory'],
            memory_priority=mem_actual['priority'].detach() if commit_memory else mem_actual['priority'],
            memory_age=mem_actual['age'].detach() if commit_memory else mem_actual['age'],
            semantic_state=mem_actual['semantic'].detach() if commit_memory else mem_actual['semantic'],
            life_clock=st34.life_clock,
        )
        st34 = st34_actual
        out = dict(o34)
        out.update({
            # Replace V34's pre-adaptation action bookkeeping with the actual emitted-action
            # memory write, preserving one canonical event store and causal provenance.
            'memory_read_v34': mem_actual['read_before'],
            'memory_post_read_v34': mem_actual['read_after'],
            'memory_attention_v34': mem_actual['read_attention'],
            'memory_write_weights_v34': mem_actual['write_weights'],
            'memory_write_gate_v34': mem_actual['write_gate'],
            'memory_write_content_v34': mem_actual['write_content'],
            'memory_evidence_v34': mem_actual['evidence'],
            'memory_priority_v34': mem_actual['priority'],
            'memory_age_v34': mem_actual['age'],
            'semantic_state_v34': mem_actual['semantic'],
            'semantic_next_prediction_v34': mem_actual['semantic_next_prediction'],
            'identity_state_v35': state.identity_state,
            'value_state_v35': state.value_state,
            'commitment_strengths_v35': state.commitment_strengths,
            'contradiction_state_v35': state.contradiction_state,
            'value_provenance_v35': state.value_provenance,
            'self_prediction_v35': self_prediction,
            'identity_goal_v35': goal_ctx['identity_goal'],
            'value_goal_v35': goal_ctx['value_goal'],
            'commitment_goal_v35': goal_ctx['commitment_goal'],
            'development_goal_v35': goal_ctx['development_goal'],
            'development_pressure_v35': goal_ctx['development_pressure'],
            'enriched_goal_v35': enriched_goal,
            'active_goal_v35': state.active_goal,
            'goal_age_v35': state.goal_age,
            'goal_progress_v35': state.goal_progress,
            'goal_confidence_v35': state.goal_confidence,
            'goal_candidate_v35': goal_ctx['goal_candidate'],
            'goal_persistence_gate_v35': goal_ctx['goal_persistence_gate'],
            'fast_adapter_state_v35': state.fast_adapter_state,
            'fast_adapter_gate_v35': fast['gate'],
            'fast_adapter_residual_v35': fast['residual'],
            'base_action_v35': base_action,
            'chosen_action_v35': action,
        })
        # Identity state intentionally does not update here: action is not yet causally observed.
        new_state = V35State(
            base=st34,
            identity_state=state.identity_state,
            value_state=state.value_state,
            commitment_strengths=state.commitment_strengths,
            contradiction_state=state.contradiction_state,
            value_provenance=state.value_provenance,
            active_goal=state.active_goal,
            goal_age=state.goal_age,
            goal_progress=state.goal_progress,
            goal_confidence=state.goal_confidence,
            fast_adapter_state=state.fast_adapter_state,
            identity_anchor=state.identity_anchor,
            commitment_success=state.commitment_success,
            commitment_failure=state.commitment_failure,
            life_clock=state.life_clock + 1,
        )
        out['_final_state'] = new_state
        return out, new_state

    def observe_outcome(self, state_after_action: V35State, prior_output: Dict[str, Tensor],
                        next_observation: Tensor, reward: Tensor, risk: Tensor,
                        done: Optional[Tensor] = None) -> Tuple[Dict[str, Tensor], V35State]:
        z_next = self._internal(next_observation)
        reward = reward if reward.ndim == 2 else reward.reshape(-1, 1)
        risk = risk if risk.ndim == 2 else risk.reshape(-1, 1)
        pe = prior_output.get('prediction_error_v31', torch.zeros_like(reward))
        nov = prior_output.get('novelty', torch.zeros_like(reward))
        updated = self.identity.observe_outcome(
            prior_output['identity_state_v35'],
            prior_output['value_state_v35'],
            prior_output['commitment_strengths_v35'],
            prior_output['contradiction_state_v35'],
            prior_output['value_provenance_v35'],
            prior_output['self_prediction_v35'],
            z_next,
            prior_output['chosen_action_v34'],
            prior_output['body_state_v30'],
            reward,
            risk,
            pe,
            nov,
            prior_output['memory_write_weights_v34'],
            prior_output['enriched_goal_v35'],
            state_after_action.life_clock,
        )
        # Correct/refresh the same canonical V34 memory address space using actual outcome signals.
        mem = self.base.memory.write(
            prior_output['fused_latent_v30'].detach(),
            state_after_action.base.semantic_state,
            state_after_action.base.episodic_memory,
            state_after_action.base.memory_priority,
            state_after_action.base.memory_age,
            prior_output['chosen_action_v34'].detach(),
            prior_output['foresight_uncertainty_v32'].detach(),
            prior_output['novelty'].detach(),
            pe.detach(), reward.detach(), risk.detach(),
        )
        corrected_base = V34State(
            base=state_after_action.base.base,
            episodic_memory=mem['memory'].detach(),
            memory_priority=mem['priority'].detach(),
            memory_age=mem['age'].detach(),
            semantic_state=mem['semantic'].detach(),
            life_clock=state_after_action.base.life_clock,
        )
        mem_logits = state_after_action.base.memory_priority
        mem_weights = F.softmax(mem_logits - self.cfg.memory_age_penalty_v34 * state_after_action.base.memory_age, dim=-1)
        provenance_summary = (mem_weights.unsqueeze(-1) * updated['value_provenance']).sum(1)
        ctx_next = self.identity.goal_context(
            0.78 * updated['identity_state'] + 0.22 * state_after_action.identity_anchor,
            updated['value_state'], updated['commitment_strengths'],
            updated['contradiction_state'], provenance_summary,
            state_after_action.commitment_success, state_after_action.commitment_failure
        )
        dev_goal, dev_pressure = self.development(
            prior_output.get('foresight_uncertainty_v32', torch.zeros_like(reward)),
            pe.clamp(0, 1), nov.clamp(0, 1),
            F.softmax(updated['commitment_strengths'], dim=-1).mean(-1, keepdim=True)
        )
        goal_candidate = _norm(
            self.cfg.identity_goal_scale_v35 * _norm(ctx_next['identity_goal'])
            + self.cfg.value_goal_scale_v35 * _norm(ctx_next['value_goal'])
            + self.cfg.commitment_goal_scale_v35 * _norm(ctx_next['commitment_goal'])
            + self.cfg.provenance_goal_scale_v35 * _norm(ctx_next['provenance_goal'])
            + self.cfg.development_pressure_scale_v35 * dev_pressure * dev_goal
        )
        prior_goal = state_after_action.active_goal
        goal_similarity = F.cosine_similarity(prior_goal, goal_candidate, dim=-1).unsqueeze(-1)
        progress_target = torch.sigmoid(
            1.4 * reward - 1.2 * risk - 0.8 * pe - 0.7 * updated['contradiction']
        ).clamp(0, 1)
        gate_in = torch.cat([
            prior_goal, goal_candidate, goal_similarity, state_after_action.goal_confidence,
            pe.clamp(0, 1), nov.clamp(0, 1)
        ], -1)
        goal_gate = torch.sigmoid(self.goal_manager(gate_in))
        new_goal = _norm((1.0 - goal_gate) * goal_candidate + goal_gate * prior_goal)
        fast_state_next = self.fast_adapter.observe(
            state_after_action.fast_adapter_state, z_next, prior_output['chosen_action_v35'], reward, risk, pe
        )
        anchor_stability = (1.0 - updated['contradiction']).clamp(self.cfg.identity_stability_floor_v35, 1.0)
        anchor_rate = (self.cfg.identity_anchor_update_rate_v35 * anchor_stability).clamp(0.005, 0.1)
        identity_anchor_next = ((1.0 - anchor_rate) * state_after_action.identity_anchor + anchor_rate * updated['identity_state']).clamp(-1.0, 1.0)
        commitment_success_next = (
            self.cfg.commitment_evidence_decay_v35 * state_after_action.commitment_success
            + self.cfg.commitment_evidence_update_rate_v35 * updated['commitment_success_increment']
        ).clamp(0.0, 1e6)
        commitment_failure_next = (
            self.cfg.commitment_evidence_decay_v35 * state_after_action.commitment_failure
            + self.cfg.commitment_evidence_update_rate_v35 * updated['commitment_failure_increment']
        ).clamp(0.0, 1e6)
        goal_progress = (self.cfg.goal_decay_v35 * state_after_action.goal_progress
                         + self.cfg.goal_update_rate_v35 * progress_target).clamp(0, 1)
        goal_confidence = (self.cfg.goal_decay_v35 * state_after_action.goal_confidence
                           + self.cfg.goal_update_rate_v35 * (progress_target * 0.8 + goal_similarity.abs() * 0.2)).clamp(0, 1)
        continue_goal = torch.sigmoid((progress_target - 0.5) * 8.0)
        goal_age = (continue_goal * (state_after_action.goal_age + 1.0)).clamp(0, 1e6)
        # Directly ground the goal manager in outcome progress; the target is detached, the gate is learned.
        goal_progress_pred = torch.sigmoid(self.goal_progress_head(torch.cat([
            new_goal, reward, risk, pe.clamp(0,1), updated['contradiction']
        ], -1)))
        goal_satisfaction = torch.sigmoid(self.goal_satisfaction_head(torch.cat([
            z_next, new_goal, reward, risk, updated['contradiction']
        ], -1)))
        # A completed goal releases persistence and allows a new self-generated goal to enter.
        completion_prob = torch.sigmoid((goal_satisfaction - self.cfg.goal_satisfaction_threshold_v35) * 12.0)
        complete_soft = (completion_prob * (0.5 + 0.5 * goal_confidence)).clamp(0.0, 1.0)
        fresh_goal = _norm(0.65 * goal_candidate + 0.35 * ctx_next['commitment_goal'])
        active_after_completion = _norm((1.0 - complete_soft) * new_goal + complete_soft * fresh_goal)
        goal_age = ((1.0 - complete_soft) * goal_age).clamp(0.0, 1e6)
        new_state = V35State(
            base=corrected_base,
            identity_state=updated['identity_state'].detach(),
            value_state=updated['value_state'].detach(),
            commitment_strengths=updated['commitment_strengths'].detach(),
            contradiction_state=updated['contradiction_state'].detach(),
            value_provenance=updated['value_provenance'].detach(),
            active_goal=active_after_completion.detach(),
            goal_age=goal_age.detach(),
            goal_progress=goal_progress.detach(),
            goal_confidence=goal_confidence.detach(),
            fast_adapter_state=fast_state_next.detach(),
            identity_anchor=identity_anchor_next.detach(),
            commitment_success=commitment_success_next.detach(),
            commitment_failure=commitment_failure_next.detach(),
            life_clock=state_after_action.life_clock,
        )
        observed = dict(updated)
        observed.update({
            'actual_next_observation_v35': z_next,
            'identity_delta_v35': updated['identity_state'] - prior_output['identity_state_v35'],
            'value_delta_v35': updated['value_state'] - prior_output['value_state_v35'],
            'active_goal': new_goal,
            'goal_gate': goal_gate,
            'goal_candidate': goal_candidate,
            'goal_progress': goal_progress,
            'goal_confidence': goal_confidence,
            'goal_progress_target': progress_target,
            'goal_progress_pred': goal_progress_pred,
            'goal_satisfaction': goal_satisfaction,
            'active_goal_next': active_after_completion,
            'fast_adapter_state_next': fast_state_next,
            'fast_teacher_action': prior_output.get('teacher_action_v33', prior_output['base_action_v35']).detach(),
            'identity_anchor': identity_anchor_next,
            'commitment_success': commitment_success_next,
            'commitment_failure': commitment_failure_next,
        })
        return observed, new_state

    def act_from_observation(self, observation: Tensor, state: V35State,
                             goal: Optional[Tensor] = None,
                             commit_memory: bool = True,
                             force_planning: Optional[bool] = None):
        return self.step(observation, state, goal=goal, commit_memory=commit_memory,
                         force_planning=force_planning)

    def forward(self, x: Tensor, state: Optional[V35State] = None,
                goal_sequence=None, target_sequence=None, reward_sequence=None,
                risk_sequence=None, presence_sequence=None, modality_sequence=None,
                proprioception_sequence=None, interoception_sequence=None,
                commit_memory: bool = True, force_planning: Optional[bool] = None) -> Dict[str, Tensor]:
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        outcome_rows = []
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
            # Outcome at t is used only to create state at t+1. This preserves causal ordering.
            if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] and t < x.size(1) - 1:
                rew = reward_sequence[:, t] if reward_sequence is not None else o['reward_v32'].detach()
                rsk = risk_sequence[:, t] if risk_sequence is not None else o['risk_v32'].detach()
                observed, st = self.observe_outcome(st, o, target_sequence[:, t].detach(), rew.detach(), rsk.detach())
                o.update({f'outcome_{k}_v35': v for k, v in observed.items() if torch.is_tensor(v)})
                o['outcome_identity_next_v35'] = st.identity_state
                o['outcome_value_next_v35'] = st.value_state
                o['outcome_contradiction_next_v35'] = st.contradiction_state
            rows.append(o)
        tensors = {
            k: torch.stack([r[k] for r in rows], 1)
            for k in rows[0]
            if torch.is_tensor(rows[0][k]) and not k.startswith('outcome_') and k != '_final_state'
        }
        # Outcome keys exist only for non-terminal steps. Keep a length-T aligned tensor; terminal values are zeros
        # and are excluded by the losses via [:, :-1].
        outcome_keys = set().union(*[set(k for k in r if k.startswith('outcome_')) for r in rows]) if rows else set()
        for k in outcome_keys:
            template = next((r[k] for r in rows if k in r), None)
            if template is None:
                continue
            vals = [r[k] if k in r else torch.zeros_like(template) for r in rows]
            tensors[k] = torch.stack(vals, 1)
        if 'foresight_next_heads_v32' in tensors:
            tensors['foresight_next_heads_v32'] = tensors['foresight_next_heads_v32'].permute(0, 2, 1, 3).contiguous()
        tensors['_final_state'] = st
        return tensors

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        p = self.base.loss_parts(out, target_sequence=target_sequence,
                                 reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']
        zero = _zero_like(z)
        if z.size(1) <= 1 or 'outcome_identity_state_v35' not in out:
            return {**p, 'identity': zero, 'self_prediction': zero, 'contradiction': zero,
                    'commitment': zero, 'value_provenance': zero, 'self_consistency': zero,
                    'development': zero, 'goal_management': zero, 'goal_progress': zero, 'goal_satisfaction': zero, 'fast_adaptation': zero, 'identity_anchor': zero}
        # The observed identity next-state is the actual corrected state produced from target_next/reward/risk.
        id_next = out['outcome_identity_next_v35']
        self_pred = out['self_prediction_v35'][:, :-1]
        identity_loss = F.smooth_l1_loss(id_next[:, :-1], _norm(self_pred.detach()))
        self_prediction_loss = F.smooth_l1_loss(self_pred, id_next[:, :-1].detach())
        contradiction = out['outcome_contradiction_v35'][:, :-1]
        contradiction_target = (out['outcome_self_prediction_error_v35'][:, :-1].detach() / 2.0).clamp(0.0, 1.0)
        contradiction_loss = F.smooth_l1_loss(contradiction, contradiction_target)
        commitment_probs = out['outcome_commitment_probs_v35'][:, :-1]
        commitment_target = out['outcome_commitment_learning_target_v35'][:, :-1].detach()
        commitment_loss = F.kl_div(commitment_probs.clamp_min(1e-6).log(), commitment_target, reduction='batchmean')
        prov = out['value_provenance_v35'][:, :-1]
        prov_target = out['outcome_identity_delta_v35_v35'][:, :-1].detach().unsqueeze(2)
        prov_target = prov_target.expand(-1, -1, prov.size(-2), -1)
        # Scale the target by memory-slot relevance, preserving a single canonical event store.
        prov_loss = F.smooth_l1_loss(prov, prov_target)
        stability = (out['outcome_identity_delta_v35_v35'][:, :-1].norm(dim=-1, keepdim=True) -
                     contradiction_target).abs().mean()
        development_signal = out['development_pressure_v35'][:, :-1]
        development_target = torch.sigmoid(
            out['foresight_uncertainty_v32'][:, :-1].detach()
            + out['prediction_error_v31'][:, :-1].detach()
            + out['novelty'][:, :-1].detach()
        )
        development = F.smooth_l1_loss(development_signal, development_target)
        goal_gate = out['outcome_goal_gate_v35'][:, :-1]
        goal_target = out['outcome_goal_progress_target_v35'][:, :-1].detach()
        goal_management = F.binary_cross_entropy(goal_gate.clamp(1e-5,1-1e-5), goal_target)
        goal_pred = out['outcome_goal_progress_pred_v35'][:, :-1]
        goal_progress = F.smooth_l1_loss(goal_pred, goal_target)
        goal_sat = out['outcome_goal_satisfaction_v35'][:, :-1]
        sat_target = torch.sigmoid((goal_target - self.cfg.goal_satisfaction_threshold_v35) * 12.0)
        goal_satisfaction = F.binary_cross_entropy(goal_sat.clamp(1e-5,1-1e-5), sat_target)
        fast_action = out['chosen_action_v35'][:, :-1]
        fast_teacher = out['teacher_action_v33'][:, :-1].detach()
        fast_adaptation = F.smooth_l1_loss(fast_action, fast_teacher)
        anchor = out['outcome_identity_anchor_v35'][:, :-1]
        identity_current = out['outcome_identity_state_v35'][:, :-1]
        identity_anchor_loss = (1.0 - F.cosine_similarity(identity_current, anchor, dim=-1)).clamp_min(0.0).mean()
        return {**p, 'identity': identity_loss, 'self_prediction': self_prediction_loss,
                'contradiction': contradiction_loss, 'commitment': commitment_loss,
                'value_provenance': prov_loss, 'self_consistency': stability,
                'development': development, 'goal_management': goal_management,
                'goal_progress': goal_progress, 'goal_satisfaction': goal_satisfaction,
                'fast_adaptation': fast_adaptation,
                'identity_anchor': identity_anchor_loss}

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        c = self.cfg
        return self.base.training_loss(out, **kwargs) \
            + c.identity_weight_v35 * p['identity'] \
            + c.self_prediction_weight_v35 * p['self_prediction'] \
            + c.contradiction_weight_v35 * p['contradiction'] \
            + c.commitment_weight_v35 * p['commitment'] \
            + c.value_provenance_weight_v35 * p['value_provenance'] \
            + c.self_consistency_weight_v35 * p['self_consistency'] \
            + c.development_weight_v35 * p['development'] \
            + c.goal_management_weight_v35 * p['goal_management'] \
            + c.goal_progress_weight_v35 * p['goal_progress'] \
            + c.fast_adapter_weight_v35 * p['fast_adaptation'] \
            + c.identity_anchor_weight_v35 * p['identity_anchor'] \
            + c.goal_satisfaction_weight_v35 * p['goal_satisfaction']


class RuntimeStateStoreV35(RuntimeStateStoreV34):
    """Atomic persistence for the V35 live self + identity + goal-adaptation state."""
    VERSION = 2

    @classmethod
    def load(cls, path: str, device=None, dtype=None, goal_dim: Optional[int] = None) -> V35State:
        payload = torch.load(path, map_location=device, weights_only=False)
        version = payload.get('version')
        if version == cls.VERSION:
            state = payload['state']
        elif version == 1:
            # V35 v1 predates persistent goal/fast-adaptation fields. We can migrate it
            # without inventing history when the caller supplies the configured goal dimension.
            if goal_dim is None:
                raise ValueError('V35 v1 checkpoint migration requires goal_dim=...')
            state = payload['state']
            b = state.identity_state.size(0)
            dev, dt = state.identity_state.device, state.identity_state.dtype
            state.active_goal = torch.zeros(b, goal_dim, device=dev, dtype=dt)
            state.goal_age = torch.zeros(b, 1, device=dev, dtype=dt)
            state.goal_progress = torch.zeros(b, 1, device=dev, dtype=dt)
            state.goal_confidence = torch.zeros(b, 1, device=dev, dtype=dt)
            state.fast_adapter_state = torch.zeros_like(state.identity_state)
        else:
            raise ValueError(f'unsupported V35 runtime-state version: {version}')
        if device is not None or dtype is not None:
            state = cls._move(state, device=device, dtype=dtype)
        return state


class OrganismTrainerV35(OrganismTrainerV34):
    """V35 trainer: V34 replay plus identity/continuity losses and explicit online outcome application."""

    def ingest_real_outcome(self, state_after_action: V35State, prior_output: Dict[str, Tensor],
                            next_observation: Tensor, reward: Tensor, risk: Tensor,
                            done: Optional[Tensor] = None) -> Tuple[Dict[str, Tensor], V35State]:
        observed, new_state = self.model.observe_outcome(
            state_after_action, prior_output, next_observation, reward, risk, done
        )
        self.ingest_outcome(
            prior_output['fused_latent_v30'].detach(),
            prior_output['chosen_action_v34'].detach(),
            prior_output['body_state_v30'].detach(),
            prior_output['external_state_v31'].detach(),
            self.model._internal(next_observation).detach(),
            reward.detach(), risk.detach(),
        )
        return observed, new_state
