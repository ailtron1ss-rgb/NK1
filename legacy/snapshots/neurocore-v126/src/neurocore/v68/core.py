from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v67 import (
    V67Config, mobile_v67_config, CanonicalNeuralMemoryOSV67,
    NeuroWeaveV67, OrganismRuntimeV67, OrganismTrainerV67,
)
from neurocore.v60.core import _batch


@dataclass
class V68Config(V67Config):
    """Predictive-contextual V68 extension over one canonical V67 memory owner."""
    neural_memory_replay_policy_rank_v68: int = 6
    neural_memory_replay_policy_gain_v68: float = 0.20
    neural_memory_replay_policy_lr_v68: float = 0.05
    neural_memory_context_route_rank_v68: int = 6
    neural_memory_context_route_gain_v68: float = 0.08
    neural_memory_context_temperature_v68: float = 0.32
    neural_memory_hypothesis_topk_v68: int = 3
    neural_memory_hypothesis_mix_v68: float = 0.20
    neural_memory_uncertainty_gate_v68: float = 0.55
    neural_memory_predictive_rank_v68: int = 6
    neural_memory_predictive_gain_v68: float = 0.16
    neural_memory_predictive_loss_v68: float = 0.07
    neural_memory_bridge_decay_v68: float = 0.995
    neural_memory_bridge_evidence_v68: float = 0.20
    neural_memory_structural_budget_v68: int = 6
    neural_memory_lesion_regrowth_v68: float = 0.18
    neural_memory_context_decay_v68: float = 0.985
    neural_memory_replay_policy_temperature_v68: float = 0.40
    neural_memory_replay_scheduler_blend_v68: float = 0.25
    neural_memory_context_min_maturity_v68: float = 0.30
    neural_memory_predictive_min_repeat_v68: float = 4.0


def mobile_v68_config(raw_observation_dim: int = 9) -> V68Config:
    base = dict(mobile_v67_config(raw_observation_dim).__dict__)
    base.update({
        "neural_memory_replay_policy_rank_v68": 6,
        "neural_memory_replay_policy_gain_v68": 0.20,
        "neural_memory_replay_policy_lr_v68": 0.05,
        "neural_memory_context_route_rank_v68": 6,
        "neural_memory_context_route_gain_v68": 0.08,
        "neural_memory_context_temperature_v68": 0.32,
        "neural_memory_hypothesis_topk_v68": 3,
        "neural_memory_hypothesis_mix_v68": 0.20,
        "neural_memory_uncertainty_gate_v68": 0.55,
        "neural_memory_predictive_rank_v68": 6,
        "neural_memory_predictive_gain_v68": 0.16,
        "neural_memory_predictive_loss_v68": 0.07,
        "neural_memory_bridge_decay_v68": 0.995,
        "neural_memory_bridge_evidence_v68": 0.20,
        "neural_memory_structural_budget_v68": 6,
        "neural_memory_lesion_regrowth_v68": 0.18,
        "neural_memory_context_decay_v68": 0.985,
        "neural_memory_replay_policy_temperature_v68": 0.40,
        "neural_memory_replay_scheduler_blend_v68": 0.25,
        "neural_memory_context_min_maturity_v68": 0.30,
        "neural_memory_predictive_min_repeat_v68": 4.0,
    })
    return V68Config(**base)


class CanonicalNeuralMemoryOSV68(CanonicalNeuralMemoryOSV67):
    """V68: predictive context, learned replay scheduling, multi-hypothesis read, lesion/regrowth."""

    def __init__(self, input_dim: int, *args, **kwargs):
        rp_rank = int(kwargs.pop("replay_policy_rank", 6)); rp_gain = float(kwargs.pop("replay_policy_gain", .20))
        rp_lr = float(kwargs.pop("replay_policy_lr", .05)); cr_rank = int(kwargs.pop("context_route_rank", 6))
        cr_gain = float(kwargs.pop("context_route_gain", .08)); cr_temp = float(kwargs.pop("context_temperature", .32))
        hyp_k = int(kwargs.pop("hypothesis_topk", 3)); hyp_mix = float(kwargs.pop("hypothesis_mix", .20))
        unc_gate = float(kwargs.pop("uncertainty_gate", .55)); pred_rank = int(kwargs.pop("predictive_rank", 6))
        pred_gain = float(kwargs.pop("predictive_gain", .16)); pred_w = float(kwargs.pop("predictive_loss_weight", .07))
        bridge_decay = float(kwargs.pop("bridge_decay", .995)); bridge_evidence = float(kwargs.pop("bridge_evidence", .20))
        struct_budget = int(kwargs.pop("structural_budget", 6)); lesion_regrowth = float(kwargs.pop("lesion_regrowth", .18))
        ctx_decay = float(kwargs.pop("context_decay", .985)); rp_temp = float(kwargs.pop("replay_policy_temperature", .40))
        sched_blend = float(kwargs.pop("replay_scheduler_blend", .25))
        min_maturity = float(kwargs.pop("context_min_maturity", .30))
        min_repeat = float(kwargs.pop("predictive_min_repeat", 4.0))
        super().__init__(input_dim, *args, **kwargs)

        self.replay_policy_rank_v68 = max(2, rp_rank)
        self.replay_policy_gain_v68 = max(0.0, min(1.0, rp_gain))
        self.replay_policy_lr_v68 = max(.005, min(.50, rp_lr))
        self.context_route_rank_v68 = max(2, cr_rank)
        self.context_route_gain_base_v68 = max(0.0, min(1.0, cr_gain))
        self.context_temperature_v68 = max(.05, min(1.5, cr_temp))
        self.hypothesis_topk_v68 = max(2, min(self.semantic_slots, hyp_k))
        self.hypothesis_mix_v68 = max(0.0, min(1.0, hyp_mix))
        self.uncertainty_gate_v68 = max(0.0, min(2.0, unc_gate))
        self.predictive_rank_v68 = max(2, pred_rank)
        self.predictive_gain_v68 = max(0.0, min(1.0, pred_gain))
        self.predictive_loss_weight_v68 = max(0.0, pred_w)
        self.bridge_decay_v68 = max(.90, min(.99999, bridge_decay))
        self.bridge_evidence_v68 = max(.01, min(1.0, bridge_evidence))
        self.structural_budget_v68 = max(1, struct_budget)
        self.lesion_regrowth_v68 = max(0.0, min(1.0, lesion_regrowth))
        self.context_decay_v68 = max(.90, min(.99999, ctx_decay))
        self.replay_policy_temperature_v68 = max(.05, min(2.0, rp_temp))
        self.replay_scheduler_blend_v68 = max(0.0, min(1.0, sched_blend))
        self.context_min_maturity_v68 = max(0.0, min(1.0, min_maturity))
        self.predictive_min_repeat_v68 = max(1.0, min_repeat)

        self.replay_policy_left_v68 = nn.Parameter(torch.randn(8, self.replay_policy_rank_v68) * .02)
        self.replay_policy_right_v68 = nn.Parameter(torch.randn(self.replay_policy_rank_v68, 1) * .02)
        self.replay_policy_bias_v68 = nn.Parameter(torch.zeros(1))
        self.context_route_left_v68 = nn.Parameter(torch.randn(self.key_dim + 4, self.context_route_rank_v68) * .02)
        self.context_route_right_v68 = nn.Parameter(torch.randn(self.context_route_rank_v68, 1) * .02)
        self.context_route_bias_v68 = nn.Parameter(torch.zeros(1))
        self.context_route_gain_logit_v68 = nn.Parameter(torch.tensor(math.log(self.context_route_gain_base_v68 / max(1e-6, 1.0-self.context_route_gain_base_v68))))
        self.predictive_left_v68 = nn.Parameter(torch.randn(self.key_dim, self.predictive_rank_v68) * .018)
        self.predictive_right_v68 = nn.Parameter(torch.randn(self.predictive_rank_v68, self.key_dim) * .018)
        self.predictive_bias_v68 = nn.Parameter(torch.zeros(self.key_dim))

        self.register_buffer("replay_policy_seen_v68", torch.zeros((), dtype=torch.long))
        self.register_buffer("replay_policy_effect_v68", torch.zeros(()))
        self.register_buffer("context_route_effect_v68", torch.zeros(()))
        self.register_buffer("context_uncertainty_v68", torch.zeros(()))
        self.register_buffer("predictive_bridge_matrix_v68", torch.zeros(self.semantic_slots, self.semantic_slots))
        self.register_buffer("predictive_bridge_repeat_v68", torch.zeros(self.semantic_slots, self.semantic_slots))
        self.register_buffer("predictive_bridge_loss_v68", torch.zeros(()))
        self.register_buffer("predictive_bridge_hits_v68", torch.zeros((), dtype=torch.long))
        self.register_buffer("structural_lesion_count_v68", torch.zeros((), dtype=torch.long))
        self.register_buffer("structural_regrowth_count_v68", torch.zeros((), dtype=torch.long))
        self.register_buffer("structural_last_update_v68", torch.zeros((), dtype=torch.long))
        self.register_buffer("context_signature_v68", torch.zeros(self.key_dim))
        self.register_buffer("context_signature_valid_v68", torch.zeros(()))
        self.register_buffer("hypothesis_entropy_v68", torch.zeros(()))
        self.register_buffer("replay_scheduler_calls_v68", torch.zeros((), dtype=torch.long))

    @property
    def context_route_gain_v68(self) -> Tensor:
        return torch.sigmoid(self.context_route_gain_logit_v68).clamp(0.0, 1.0)

    def _replay_policy_score_v68(self, valid: Tensor) -> Tensor:
        if valid.numel() == 0: return self.replay_contexts.new_zeros((0,))
        age = (self.model_time_v65 - self.replay_last_replayed_v65[valid]).clamp_min(0.0)
        hazard = 1.0 - torch.exp(-age / self.forgetting_tau_v65)
        novel = self.replay_novelty_v65[valid].clamp(0.0, 1.0)
        conflict = self.replay_conflict_v65[valid].clamp(0.0, 1.0)
        priority = self.replay_priorities[valid].clamp(0.0, 1.0)
        count = self.replay_replay_count_v65[valid]
        mass = self.replay_model_update_mass_v65[valid].clamp_min(0.0)
        feat = torch.stack([hazard, novel, conflict, priority, torch.sigmoid(count/4.0), torch.tanh(mass), torch.ones_like(hazard), torch.sigmoid(-count)], dim=-1)
        learned = torch.sigmoid(self.replay_policy_gain_v68 * ((torch.tanh(feat @ self.replay_policy_left_v68) @ self.replay_policy_right_v68).squeeze(-1) / self.replay_policy_temperature_v68 + self.replay_policy_bias_v68.squeeze(0)))
        heuristic = .42*hazard + .22*novel + .16*conflict + .12*priority + .08*torch.sigmoid(-count)
        return (1.0-self.replay_scheduler_blend_v68)*heuristic + self.replay_scheduler_blend_v68*learned

    @torch.no_grad()
    def _replay_batch(self) -> Optional[Tuple[Tensor, Tensor]]:
        valid = torch.nonzero(self.replay_valid > .5, as_tuple=False).flatten()
        if valid.numel() == 0: return None
        old = self._replay_scores_v65(valid); learned = self._replay_policy_score_v68(valid)
        score = (1.0-self.replay_scheduler_blend_v68)*old + self.replay_scheduler_blend_v68*learned
        k = min(max(2, int(round(valid.numel()*.12))), int(valid.numel()))
        idx = valid[torch.topk(score, k=k).indices]
        self.replay_last_replayed_v65[idx] = self.model_time_v65; self.replay_replay_count_v65[idx].add_(1.0)
        self.replay_policy_seen_v68.add_(int(idx.numel())); self.replay_scheduler_calls_v68.add_(1)
        self.replay_policy_effect_v68.mul_(.95).add_(.05*float((learned[torch.topk(score, k=k).indices] - old[torch.topk(score, k=k).indices]).abs().mean().item()))
        return self.replay_contexts[idx], self.replay_targets[idx]

    @torch.no_grad()
    def _retention_replay_batch_v65(self) -> Optional[Tuple[Tensor, Tensor]]:
        valid = torch.nonzero(self.replay_valid > .5, as_tuple=False).flatten()
        if valid.numel() == 0: return None
        age = (self.model_time_v65 - self.replay_last_replayed_v65[valid]).clamp_min(0.0)
        hazard = 1.0 - torch.exp(-age / self.forgetting_tau_v65)
        learned = self._replay_policy_score_v68(valid)
        risk = .62*hazard + .18*self.replay_novelty_v65[valid].clamp(0,1) + .20*learned
        k = max(1, min(6, int(round(valid.numel()*self.retention_replay_fraction_v65)), int(valid.numel())))
        idx = valid[torch.topk(risk, k=k).indices]
        self.replay_last_replayed_v65[idx] = self.model_time_v65; self.replay_replay_count_v65[idx].add_(1.0)
        return self.replay_contexts[idx], self.replay_targets[idx]

    @torch.no_grad()
    def _record_predictive_bridge_v68(self, src: int, dst: int, strength: float) -> None:
        if src < 0 or dst < 0 or src >= self.semantic_slots or dst >= self.semantic_slots or src == dst: return
        s = float(max(.05, min(2.0, strength)))
        self.predictive_bridge_matrix_v68.mul_(self.bridge_decay_v68)
        self.predictive_bridge_repeat_v68.mul_(self.bridge_decay_v68)
        self.predictive_bridge_matrix_v68[src,dst] = .90*self.predictive_bridge_matrix_v68[src,dst] + .10*s
        self.predictive_bridge_repeat_v68[src,dst].add_(1.0)

    @torch.no_grad()
    def _update_context_signature_v68(self, keys: Tensor) -> None:
        if keys.numel() == 0: return
        sig = F.normalize(keys.detach().mean(dim=0), dim=-1)
        if float(self.context_signature_valid_v68.item()) < .5:
            self.context_signature_v68.copy_(sig); self.context_signature_valid_v68.fill_(1)
        else:
            self.context_signature_v68.mul_(self.context_decay_v68).add_((1.0-self.context_decay_v68)*sig)
            self.context_signature_v68.copy_(F.normalize(self.context_signature_v68, dim=-1))

    @torch.no_grad()
    def write(self, context: Tensor, target: Tensor, strength: float=1.0, surprise: float=0.0, memory_type: Optional[int]=None) -> Dict[str, Tensor]:
        x = _batch(context)
        keys, _ = self.encode(x) if x.size(-1)==self.input_dim else (F.normalize(x, dim=-1), None)
        out = super().write(x, target, strength=strength, surprise=surprise, memory_type=memory_type)
        self._update_context_signature_v68(keys)
        slots = self._resolve_slots_v67(keys)
        prev = int(self.semantic_structural_last_slot_v67.item())
        for slot in slots.tolist():
            if prev >= 0 and slot >= 0 and prev != slot: self._record_predictive_bridge_v68(prev, slot, strength*(1.0+surprise))
            prev = slot if slot >= 0 else prev
        if prev >= 0: self.semantic_structural_last_slot_v67.fill_(prev)
        return out

    def _predictive_next_key_v68(self, q: Tensor) -> Tensor:
        qn = F.normalize(q, dim=-1); return F.normalize(torch.tanh(qn @ self.predictive_left_v68) @ self.predictive_right_v68 + self.predictive_bias_v68, dim=-1)

    def _contextual_structure_scale_v68(self, q: Tensor, uncertainty: Tensor) -> Tensor:
        sig = self.context_signature_v68.to(q).view(1,-1).expand(q.size(0),-1)
        feats = torch.cat([q, uncertainty, sig[:,:1], torch.sigmoid(-q.norm(dim=-1,keepdim=True))], dim=-1)
        if feats.size(-1) != self.key_dim+4: feats = F.pad(feats, (0, max(0, self.key_dim+4-feats.size(-1))) )[:,:self.key_dim+4]
        h = torch.tanh(feats @ self.context_route_left_v68)
        return torch.sigmoid((h @ self.context_route_right_v68).squeeze(-1) + self.context_route_bias_v68.squeeze(0)).view(-1,1)

    @torch.no_grad()
    def _global_semantic_read(self, q: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        read, weights, conf = super()._global_semantic_read(q)
        if weights.numel()==0: return read, weights, conf
        entropy = -(weights.clamp_min(1e-8)*weights.clamp_min(1e-8).log()).sum(dim=-1,keepdim=True)/math.log(max(2,weights.size(-1)))
        uncertainty = (0.65*entropy + 0.35*(1.0-conf.clamp(0,1))).clamp(0,1)
        maturity = self.semantic_structural_maturity_v67.to(q).clamp(0.0,1.0)
        evidence_gate = torch.sigmoid((maturity - self.context_min_maturity_v68) * 10.0)
        route = (self._contextual_structure_scale_v68(F.normalize(q,dim=-1), uncertainty) * self.context_route_gain_v68.to(q) * evidence_gate * (self.uncertainty_gate_v68*uncertainty + (1.0-0.5*self.uncertainty_gate_v68))).clamp(0,.35)
        structural = self._structural_candidate_graph_v67(F.normalize(q,dim=-1))
        if float(self.semantic_structural_mask_v67.sum().item())>0 and bool((structural.sum()>0).item()):
            prop = weights @ structural; prop = prop/prop.sum(dim=-1,keepdim=True).clamp_min(1e-6)
            weights = ((1-route)*weights + route*prop); weights = weights/weights.sum(dim=-1,keepdim=True).clamp_min(1e-6)
            direct = weights @ self.semantic_value.to(q)
            read_before = read; read = (1-self.hypothesis_mix_v68)*read + self.hypothesis_mix_v68*direct
            delta=float((direct-read_before).pow(2).mean().sqrt().item()); self.context_route_effect_v68.mul_(.95).add_(.05*delta)
        self.context_uncertainty_v68.mul_(.95).add_(.05*float(uncertainty.mean().item()))
        self.hypothesis_entropy_v68.mul_(.95).add_(.05*float(entropy.mean().item()))
        qn = F.normalize(q,dim=-1)
        pred = self._predictive_next_key_v68(qn)
        key_bank = F.normalize(self.semantic_key.to(q),dim=-1)
        sims = pred @ key_bank.t()
        learned_bonus = torch.softmax(sims/max(.05,self.context_temperature_v68),dim=-1)
        source_idx = torch.argmax(qn @ key_bank.t(), dim=-1)
        observed_rows = self.predictive_bridge_repeat_v68.to(q)[source_idx]
        observed_prior = observed_rows / observed_rows.sum(dim=-1,keepdim=True).clamp_min(1e-6)
        has_bridge = (observed_rows.max(dim=-1,keepdim=True).values >= self.predictive_min_repeat_v68).to(q)
        bonus_dist = 0.65*observed_prior + 0.35*learned_bonus
        bonus = bonus_dist * (self.predictive_gain_v68*uncertainty*has_bridge)
        weights = (weights+bonus).clamp_min(0); weights = weights/weights.sum(dim=-1,keepdim=True).clamp_min(1e-6)
        with torch.no_grad():
            self.predictive_bridge_hits_v68.add_(int((bonus.max(dim=-1).values > 0.02).sum().item()))
        read = .82*read + .18*(weights @ self.semantic_value.to(q))
        return read, weights, conf

    def _predictive_bridge_loss_v68(self) -> Tensor:
        valid = self.semantic_slot_valid_v63 > .5
        if int(valid.sum().item())<2: return self.semantic_key.new_zeros(())
        src,dst = torch.nonzero((self.predictive_bridge_repeat_v68*self.semantic_slot_valid_v63.view(-1,1)*self.semantic_slot_valid_v63.view(1,-1))>.5, as_tuple=True)
        if src.numel()==0: return self.semantic_key.new_zeros(())
        keys=F.normalize(self.semantic_key,dim=-1); pred=self._predictive_next_key_v68(keys[src]); target=keys[dst]
        w=self.predictive_bridge_repeat_v68[src,dst].to(pred).clamp_min(1.0)
        loss=(1-F.cosine_similarity(pred,target,dim=-1))*w
        return loss.sum()/w.sum().clamp_min(1.0)

    def memory_loss(self, context: Tensor, target: Tensor) -> Dict[str, Tensor]:
        base=super().memory_loss(context,target); pred=self._predictive_bridge_loss_v68()
        ctx = _batch(context)
        qctx = self.encode(ctx)[0] if ctx.size(-1)==self.input_dim else F.normalize(ctx,dim=-1)
        # The context router is trained to open only when uncertainty and mature structural evidence agree.
        ent_target = torch.full((qctx.size(0),1), float(self.semantic_structural_maturity_v67.clamp(0,1).item()), device=qctx.device, dtype=qctx.dtype)
        ent_target = ent_target * torch.sigmoid(qctx.norm(dim=-1,keepdim=True))
        router_unc = self.context_route_gain_v68.to(qctx) * self._contextual_structure_scale_v68(qctx, ent_target)
        context_route_loss = F.smooth_l1_loss(router_unc, ent_target.detach().clamp(0,1))
        valid=torch.nonzero(self.replay_valid>.5,as_tuple=False).flatten()
        sched=self._replay_policy_score_v68(valid) if valid.numel() else base["loss"].new_zeros(())
        if valid.numel():
            tgt=.45*self.replay_novelty_v65[valid]+.35*self.replay_conflict_v65[valid]+.20*self.replay_priorities[valid].clamp(0,1)
            sched_loss=F.smooth_l1_loss(sched,tgt.detach())
        else: sched_loss=base["loss"].new_zeros(())
        total=base["loss"]+self.predictive_loss_weight_v68*pred+.02*sched_loss+.01*context_route_loss
        self.predictive_bridge_loss_v68.copy_(pred.detach()); return {**base,"predictive_bridge_v68":pred,"replay_policy_calibration_v68":sched_loss,"context_route_calibration_v68":context_route_loss,"loss":total}

    def consolidate(self, optimizer: torch.optim.Optimizer, steps:int=1) -> Dict[str,float]:
        out=super().consolidate(optimizer,steps=steps)
        if out.get("steps",0)<=0: return out
        with torch.no_grad():
            self._update_structural_topology_v67(); self.structural_last_update_v68.copy_(self.semantic_structural_step_v67)
            active=int(self.semantic_structural_mask_v67.sum().item())
            if active>self.structural_budget_v68:
                flat=(self.semantic_structural_utility_v67*self.semantic_structural_mask_v67).view(-1)
                keep=min(self.structural_budget_v68,int((flat>0).sum().item()))
                if keep>0:
                    idx=torch.topk(flat,k=keep).indices; hard=torch.zeros_like(flat); hard[idx]=1
                    self.semantic_structural_mask_v67.copy_(hard.view_as(self.semantic_structural_mask_v67))
        out.update({"predictive_bridge_loss_v68":float(self.predictive_bridge_loss_v68.item()),"context_route_effect_v68":float(self.context_route_effect_v68.item())})
        return out

    @torch.no_grad()
    def lesion_structural_edges(self,fraction:float=.35)->Dict[str,float]:
        active=torch.nonzero(self.semantic_structural_mask_v67>.5,as_tuple=False)
        if active.numel()==0:return {"lesioned":0.,"remaining":0.,"regrowth_ready":0.}
        n=max(1,min(active.size(0),int(round(active.size(0)*max(.05,min(1.,fraction))))))
        util=self.semantic_structural_utility_v67[active[:,0],active[:,1]]; chosen=active[torch.argsort(util)[:n]]
        self.semantic_structural_mask_v67[chosen[:,0],chosen[:,1]]=0; self.structural_lesion_count_v68.add_(n); self.semantic_structural_maturity_v67.mul_(.75)
        ready=(self.semantic_structural_repeat_v67[chosen[:,0],chosen[:,1]]>=self.structural_repeat_threshold_v67).float().mean()
        return {"lesioned":float(n),"remaining":float(self.semantic_structural_mask_v67.sum()),"regrowth_ready":float(ready.item())}

    @torch.no_grad()
    def regrow_structural_edges(self)->Dict[str,float]:
        old=self.semantic_structural_mask_v67.clone(); self._update_structural_topology_v67()
        added=((self.semantic_structural_mask_v67>.5)&(old<=.5)).sum(); self.structural_regrowth_count_v68.add_(int(added.item()))
        return {"regrown":float(added.item()),"active":float(self.semantic_structural_mask_v67.sum())}

    def diagnostics(self)->Dict[str,Tensor]:
        d=super().diagnostics(); d.update({
            "v68_replay_policy_effect":self.replay_policy_effect_v68.reshape(1,1),
            "v68_replay_policy_seen":self.replay_policy_seen_v68.float().reshape(1,1),
            "v68_context_route_effect":self.context_route_effect_v68.reshape(1,1),
            "v68_context_uncertainty":self.context_uncertainty_v68.reshape(1,1),
            "v68_predictive_bridge_loss":self.predictive_bridge_loss_v68.reshape(1,1),
            "v68_predictive_bridge_hits":self.predictive_bridge_hits_v68.float().reshape(1,1),
            "v68_structural_lesions":self.structural_lesion_count_v68.float().reshape(1,1),
            "v68_structural_regrowth":self.structural_regrowth_count_v68.float().reshape(1,1),
            "v68_hypothesis_entropy":self.hypothesis_entropy_v68.reshape(1,1),
            "v68_replay_scheduler_calls":self.replay_scheduler_calls_v68.float().reshape(1,1),
        }); return d


class NeuroWeaveV68(NeuroWeaveV67):
    def __init__(self,cfg:Optional[V68Config]=None):
        cfg=cfg or V68Config(); NeuroWeaveV67.__init__(self,cfg); old=self.neural_memory_v61; c=cfg
        args=dict(
            input_dim=c.latent_dim_v46+c.d+c.memory_value_dim_v55+c.drive_dim_v57,key_dim=c.neural_memory_key_dim_v61,value_dim=c.neural_memory_value_dim_v61,
            fast_slots=c.neural_memory_fast_slots_v61,fast_rank=c.neural_memory_fast_rank_v61,semantic_slots=c.neural_memory_semantic_slots_v65,semantic_rank=c.neural_memory_semantic_rank_v61,hidden=c.neural_memory_hidden_v61,
            temperature=c.neural_memory_temperature_v61,fast_decay=c.neural_memory_fast_decay_v61,semantic_decay=c.neural_memory_semantic_decay_v61,replay_size=c.neural_memory_replay_size_v65,
            autobiographical_decay=c.neural_memory_autobio_decay_v61,procedural_decay=c.neural_memory_procedural_decay_v61,topk=c.neural_memory_topk_v61,long_term_hidden=c.neural_memory_long_term_hidden_v61,long_term_layers=c.neural_memory_long_term_layers_v61,
            long_term_mix=c.neural_memory_long_term_mix_v61,router_hidden=c.neural_memory_router_hidden_v61,router_temperature=c.neural_memory_router_temperature_v61,conflict_threshold=c.neural_memory_conflict_threshold_v61,
            types=c.neural_memory_types_v62,type_dim=c.neural_memory_type_dim_v62,typed_semantic_slots=c.neural_memory_typed_semantic_slots_v62,hopfield_steps=c.neural_memory_hopfield_steps_v62,hopfield_beta=c.neural_memory_hopfield_beta_v62,hopfield_residual=c.neural_memory_hopfield_residual_v62,
            energy_replay_weight=c.neural_memory_energy_replay_weight_v62,consolidation_gate=c.neural_memory_consolidation_gate_v62,protection=c.neural_memory_protection_v62,conflict_replay_weight=c.neural_memory_conflict_replay_weight_v62,replay_priority_floor=c.neural_memory_replay_priority_floor_v62,
            semantic_merge_threshold=c.neural_semantic_merge_threshold_v63,semantic_update_floor=c.neural_semantic_update_floor_v63,semantic_max_update=c.neural_semantic_max_update_v63,semantic_similarity_weight=c.neural_semantic_similarity_weight_v63,semantic_reconstruction_weight=c.neural_semantic_reconstruction_weight_v63,semantic_contrastive_weight=c.neural_semantic_contrastive_weight_v63,semantic_conflict_weight=c.neural_semantic_conflict_weight_v63,
            consolidation_budget_min=c.neural_semantic_consolidation_budget_min_v63,consolidation_budget_max=c.neural_semantic_consolidation_budget_max_v63,relation_rank=c.neural_semantic_relation_rank_v64,relation_gain=c.neural_semantic_relation_gain_v64,relation_lr=c.neural_semantic_relation_lr_v64,relation_temperature=c.neural_semantic_relation_temperature_v64,conflict_split_threshold=c.neural_semantic_conflict_split_threshold_v64,importance_decay=c.neural_semantic_importance_decay_v64,importance_protection=c.neural_semantic_importance_protection_v64,reconsolidation_rate=c.neural_semantic_reconsolidation_rate_v64,reconsolidation_floor=c.neural_semantic_reconsolidation_floor_v64,replay_diversity=c.neural_semantic_replay_diversity_v64,
            model_time_scale=c.neural_memory_model_time_scale_v65,forgetting_tau=c.neural_memory_forgetting_tau_v65,novelty_weight=c.neural_memory_novelty_weight_v65,age_weight=c.neural_memory_age_weight_v65,conflict_weight_v65=c.neural_memory_conflict_weight_v65,priority_weight_v65=c.neural_memory_priority_weight_v65,anchor_lr=c.neural_memory_anchor_lr_v65,anchor_penalty=c.neural_memory_anchor_penalty_v65,anchor_floor=c.neural_memory_anchor_floor_v65,anchor_ceiling=c.neural_memory_anchor_ceiling_v65,plasticity_floor=c.neural_memory_plasticity_floor_v65,plasticity_ceiling=c.neural_memory_plasticity_ceiling_v65,rare_event_boost=c.neural_memory_rare_event_boost_v65,semantic_retrieval_topk=c.neural_memory_semantic_retrieval_topk_v65,retention_replay_mix=c.neural_memory_retention_replay_mix_v65,retention_replay_fraction=c.neural_memory_retention_replay_fraction_v65,gradient_projection=c.neural_memory_gradient_projection_v65,
            graph_rank=c.neural_memory_graph_rank_v66,graph_gain=c.neural_memory_graph_gain_v66,graph_temperature=c.neural_memory_graph_temperature_v66,graph_observed_mix=c.neural_memory_graph_observed_mix_v66,graph_hop2_mix=c.neural_memory_graph_hop2_mix_v66,graph_loss_weight=c.neural_memory_graph_loss_v66,graph_entropy_weight=c.neural_memory_graph_entropy_v66,graph_transition_decay=c.neural_memory_graph_transition_decay_v66,graph_maturity_tau=c.neural_memory_graph_maturity_tau_v66,graph_topk=c.neural_memory_graph_topk_v66,transfer_weight=c.neural_memory_transfer_weight_v66,transfer_floor=c.neural_memory_transfer_floor_v66,
            structural_rank=c.neural_memory_structural_rank_v67,structural_gain=c.neural_memory_structural_gain_v67,structural_topk=c.neural_memory_structural_topk_v67,structural_repeat_threshold=c.neural_memory_structural_repeat_threshold_v67,structural_utility_threshold=c.neural_memory_structural_utility_threshold_v67,structural_edge_decay=c.neural_memory_structural_edge_decay_v67,structural_utility_decay=c.neural_memory_structural_utility_decay_v67,structural_growth_rate=c.neural_memory_structural_growth_rate_v67,structural_prune_rate=c.neural_memory_structural_prune_rate_v67,structural_rewire_margin=c.neural_memory_structural_rewire_margin_v67,structural_hop_mix=c.neural_memory_structural_hop_mix_v67,structural_loss_weight=c.neural_memory_structural_loss_weight_v67,pattern_sep_weight=c.neural_memory_pattern_sep_weight_v67,pattern_sep_margin=c.neural_memory_pattern_sep_margin_v67,bidirectional_weight=c.neural_memory_bidirectional_weight_v67,structural_safety=c.neural_memory_structural_safety_v67,structural_update_interval=c.neural_memory_structural_update_interval_v67,
            replay_policy_rank=c.neural_memory_replay_policy_rank_v68,replay_policy_gain=c.neural_memory_replay_policy_gain_v68,replay_policy_lr=c.neural_memory_replay_policy_lr_v68,context_route_rank=c.neural_memory_context_route_rank_v68,context_route_gain=c.neural_memory_context_route_gain_v68,context_temperature=c.neural_memory_context_temperature_v68,hypothesis_topk=c.neural_memory_hypothesis_topk_v68,hypothesis_mix=c.neural_memory_hypothesis_mix_v68,uncertainty_gate=c.neural_memory_uncertainty_gate_v68,predictive_rank=c.neural_memory_predictive_rank_v68,predictive_gain=c.neural_memory_predictive_gain_v68,predictive_loss_weight=c.neural_memory_predictive_loss_v68,bridge_decay=c.neural_memory_bridge_decay_v68,bridge_evidence=c.neural_memory_bridge_evidence_v68,structural_budget=c.neural_memory_structural_budget_v68,lesion_regrowth=c.neural_memory_lesion_regrowth_v68,context_decay=c.neural_memory_context_decay_v68,replay_policy_temperature=c.neural_memory_replay_policy_temperature_v68,replay_scheduler_blend=c.neural_memory_replay_scheduler_blend_v68,
        )
        args.pop("input_dim")
        self.neural_memory_v61=CanonicalNeuralMemoryOSV68(c.latent_dim_v46+c.d+c.memory_value_dim_v55+c.drive_dim_v57,**args)
        cur=self.neural_memory_v61.state_dict(); self.neural_memory_v61.load_state_dict({k:v for k,v in old.state_dict().items() if k in cur and tuple(v.shape)==tuple(cur[k].shape)},strict=False)
        self._modules.pop("neural_memory_v60",None); self._modules.pop("neural_memory_v63",None)
    @property
    def neural_memory_v60(self): return self.neural_memory_v61
    @property
    def neural_memory_v63(self): return self.neural_memory_v61
    @property
    def neural_memory_v64(self): return self.neural_memory_v61
    @property
    def neural_memory_v65(self): return self.neural_memory_v61
    @property
    def neural_memory_v66(self): return self.neural_memory_v61
    @property
    def neural_memory_v67(self): return self.neural_memory_v61


class OrganismRuntimeV68(OrganismRuntimeV67):
    @torch.no_grad()
    def step(self,observation:Tensor,goal:Optional[Tensor]=None)->Dict[str,Tensor]:
        out=super().step(observation,goal=goal); ref=_batch(observation); d=self.model.neural_memory_v61.diagnostics()
        for k in ("v68_replay_policy_effect","v68_context_route_effect","v68_context_uncertainty","v68_predictive_bridge_loss","v68_hypothesis_entropy"): out[k]=d[k].to(ref)
        return out


class OrganismTrainerV68(OrganismTrainerV67):
    def __init__(self,model:NeuroWeaveV68,lr:float=3e-4,warmup_steps:int=4,external_verifier=None):
        super().__init__(model,lr=lr,warmup_steps=warmup_steps,external_verifier=external_verifier)
        self.neural_memory_optimizer=torch.optim.AdamW(self.model.neural_memory_v61.parameters(),lr=model.cfg.neural_memory_consolidation_lr_v61,weight_decay=1e-4)


class RuntimeStateStoreV68:
    VERSION=8
    @classmethod
    def save(cls,path:Path,model:NeuroWeaveV68,trainer:Optional[OrganismTrainerV68]=None,runtime:Optional[OrganismRuntimeV68]=None):
        mem=model.neural_memory_v61; torch.save({"version_v68":cls.VERSION,"base_version":67,"model":model.state_dict(),"v68":{"structural_lesions":int(mem.structural_lesion_count_v68.item()),"structural_regrowth":int(mem.structural_regrowth_count_v68.item()),"replay_policy_seen":int(mem.replay_policy_seen_v68.item())},"neural_memory_optimizer":trainer.neural_memory_optimizer.state_dict() if trainer else None,"neural_memory_updates_v61":int(getattr(trainer,"neural_memory_updates_v61",0)) if trainer else 0,"runtime":runtime.state_dict() if runtime else None},path)
    @classmethod
    def load(cls,path:Path,model:NeuroWeaveV68,trainer:Optional[OrganismTrainerV68]=None,runtime:Optional[OrganismRuntimeV68]=None):
        p=torch.load(path,map_location="cpu",weights_only=False); state=p.get("model",p); tgt=model.state_dict(); model.load_state_dict({k:v for k,v in state.items() if k in tgt and tuple(v.shape)==tuple(tgt[k].shape)},strict=False); sec=p.get("v68") or {}; mem=model.neural_memory_v61
        mem.structural_lesion_count_v68.fill_(int(sec.get("structural_lesions",0))); mem.structural_regrowth_count_v68.fill_(int(sec.get("structural_regrowth",0))); mem.replay_policy_seen_v68.fill_(int(sec.get("replay_policy_seen",0)))
        if trainer:
            if p.get("neural_memory_optimizer"):
                try: trainer.neural_memory_optimizer.load_state_dict(p["neural_memory_optimizer"])
                except (ValueError,RuntimeError): pass
            trainer.neural_memory_updates_v61=int(p.get("neural_memory_updates_v61",0))
        if runtime and p.get("runtime") is not None: runtime.load_state_dict(p["runtime"])
        return p


class PredictiveContextualMemoryGateV68:
    """Mechanistic V68 battery; not a consciousness metric."""
    def __init__(self,memory:CanonicalNeuralMemoryOSV68,optimizer:torch.optim.Optimizer): self.memory,self.optimizer=memory,optimizer
    @staticmethod
    @torch.no_grad()
    def _score(read:Tensor,target:Tensor)->float: return float((F.cosine_similarity(read.view(1,-1),target.view(1,-1),dim=-1).item()+1)/2)
    def run(self,seed:int=17,episodes:int=256,distractors:int=384)->Dict[str,float]:
        torch.manual_seed(seed); anchors=[F.normalize(torch.randn(self.memory.key_dim),dim=0) for _ in range(8)]; targets=[F.normalize(torch.randn(self.memory.value_dim),dim=0) for _ in range(8)]
        for i in range(episodes):
            j=i%8; self.memory.write(F.normalize(anchors[j]+.03*torch.randn(self.memory.key_dim),dim=0),targets[j]+.03*torch.randn(self.memory.value_dim),strength=1.,surprise=.8 if i%17==0 else .15)
            if i%48==47:self.memory.consolidate(self.optimizer,steps=1)
        before=sum(self._score(self.memory.retrieve(a.view(1,-1))["semantic_read"][0],targets[i]) for i,a in enumerate(anchors))/8
        for i in range(distractors):
            self.memory.write(F.normalize(torch.randn(self.memory.key_dim),dim=0),F.normalize(torch.randn(self.memory.value_dim),dim=0),strength=1.,surprise=.5)
            if i%96==95:self.memory.consolidate(self.optimizer,steps=1)
        mid=sum(self._score(self.memory.retrieve(a.view(1,-1))["semantic_read"][0],targets[i]) for i,a in enumerate(anchors))/8
        lesion=self.memory.lesion_structural_edges(.4); regrow=self.memory.regrow_structural_edges()
        for _ in range(2):self.memory.consolidate(self.optimizer,steps=1)
        after=sum(self._score(self.memory.retrieve(a.view(1,-1))["semantic_read"][0],targets[i]) for i,a in enumerate(anchors))/8
        return {"recent":float(before),"retention":float(mid),"post_recovery":float(after),"lesioned":lesion["lesioned"],"regrown":regrow["regrown"],"context_uncertainty":float(self.memory.context_uncertainty_v68.item()),"predictive_bridge_loss":float(self.memory.predictive_bridge_loss_v68.item())}
