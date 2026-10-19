from __future__ import annotations

from pathlib import Path
import json
import random
import tempfile
from typing import Sequence

import torch
import torch.nn as nn
import torch.nn.functional as F

from .neural_self_optimization_controller_v2 import NeuralSelfOptimizationControllerV2
from .online_adaptation_transaction_v1 import OnlineAdaptationTransactionV1

VERSION = '1.27.0-dev'
FAMILY_ORDER = ('sum3', 'xor3', 'mul2', 'sub_offset')


class _TinyContinualNet(nn.Module):
    def __init__(self, hidden: int = 24):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(3, hidden), nn.Tanh(), nn.Linear(hidden, 1))

    def forward(self, x):
        return self.net(x)


def _seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)


def _task_fn(family: str, x: torch.Tensor) -> torch.Tensor:
    if family == 'sum3':
        return x[:, 0:1] + x[:, 1:2] + x[:, 2:3]
    if family == 'xor3':
        bits = (x > 0).to(torch.int64)
        return ((bits[:, 0] + 2 * bits[:, 1] + 4 * bits[:, 2]).remainder(2)).float().unsqueeze(1)
    if family == 'mul2':
        return x[:, 0:1] * x[:, 1:2]
    if family == 'sub_offset':
        return x[:, 0:1] - x[:, 1:2] + 0.25
    raise ValueError(family)


def _data(family: str, seed: int, n: int = 24):
    g = torch.Generator().manual_seed(int(seed))
    x = torch.randn(n, 3, generator=g)
    return x, _task_fn(family, x)


def _score(model: nn.Module, family: str, seed: int, n: int = 24) -> float:
    model.eval()
    x, y = _data(family, seed, n)
    with torch.no_grad():
        loss = float(F.mse_loss(model(x), y))
    return 1.0 / (1.0 + loss)


def _copy_model(model: nn.Module) -> _TinyContinualNet:
    out = _TinyContinualNet()
    out.load_state_dict(model.state_dict())
    return out


def _train_fixed_budget(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    x: torch.Tensor,
    y: torch.Tensor,
    replay_x: torch.Tensor | None,
    replay_y: torch.Tensor | None,
    config: dict,
    *,
    teacher: nn.Module | None,
    seed: int,
) -> float:
    model.train()
    steps = int(config['steps'])
    batch_size = int(config['batch_size'])
    replay_ratio = float(config['replay_ratio']) if replay_x is not None and len(replay_x) else 0.0
    anchor_weight = float(config['anchor_weight'])
    generator = torch.Generator().manual_seed(int(seed))
    last_loss = 0.0
    for _ in range(steps):
        replay_n = min(len(replay_x), int(round(batch_size * replay_ratio))) if replay_x is not None else 0
        current_n = max(1, batch_size - replay_n)
        ci = torch.randint(len(x), (current_n,), generator=generator)
        bx, by = x[ci], y[ci]
        if replay_n:
            ri = torch.randint(len(replay_x), (replay_n,), generator=generator)
            bx = torch.cat([bx, replay_x[ri]], dim=0)
            by = torch.cat([by, replay_y[ri]], dim=0)
        pred = model(bx)
        loss = F.mse_loss(pred, by)
        if teacher is not None and anchor_weight > 0.0:
            with torch.no_grad():
                frozen = teacher(bx)
            loss = loss + anchor_weight * F.mse_loss(pred, frozen)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        last_loss = float(loss.detach())
    return last_loss


def _evaluate_candidate(
    base_model: nn.Module,
    family: str,
    families: Sequence[str],
    idx: int,
    data_seed: int,
    train_seed: int,
    pre_scores: dict[str, float],
    replay_x: torch.Tensor | None,
    replay_y: torch.Tensor | None,
    config: dict,
):
    candidate = _copy_model(base_model)
    optimizer = torch.optim.AdamW(candidate.parameters(), lr=float(config['lr']))
    teacher = _copy_model(base_model) if float(config['anchor_weight']) > 0.0 else None
    x, y = _data(family, data_seed + idx * 101)
    _train_fixed_budget(candidate, optimizer, x, y, replay_x, replay_y, config, teacher=teacher, seed=train_seed + idx * 1001)
    seen = families[: idx + 1]
    post_scores = {fam: _score(candidate, fam, data_seed + families.index(fam) * 101) for fam in seen}
    new_gain = post_scores[family] - pre_scores[family]
    if idx:
        old_before = sum(pre_scores[f] for f in families[:idx]) / idx
        old_after = sum(post_scores[f] for f in families[:idx]) / idx
        retention_delta = old_after - old_before
        retention = old_after
    else:
        retention_delta = 0.0
        retention = post_scores[family]
    ood_score = _score(candidate, family, data_seed + 5000 + idx * 101)
    utility = new_gain + 0.50 * retention_delta + 0.25 * (ood_score - pre_scores[family])
    return candidate, {
        'utility': float(utility),
        'new_gain': float(new_gain),
        'retention': float(retention),
        'retention_delta': float(retention_delta),
        'ood': float(ood_score),
        'post_scores': post_scores,
        'budget': int(config['steps']) * int(config['batch_size']),
        'config': dict(config),
    }


def build_report(seed: int = 41, families: Sequence[str] | None = None) -> dict:
    _seed(seed)
    families = tuple(families or FAMILY_ORDER)
    root = Path(tempfile.mkdtemp(prefix='nomega127-selfopt-'))
    controller = NeuralSelfOptimizationControllerV2(root, seed=seed + 77, ensemble=2)
    model = _TinyContinualNet()
    incumbent_config = {
        'lr': 0.025, 'steps': 12, 'replay_ratio': 0.25,
        'anchor_weight': 0.10, 'interference_threshold': 0.75,
        'batch_size': 8, 'inference_batch': 8,
    }
    history: list[dict] = []
    memory_x: list[torch.Tensor] = []
    memory_y: list[torch.Tensor] = []
    phase_reports = []
    controller_fits = 0
    candidate_template = (
        (0.012, 0.25, 0.10),
        (0.020, 0.40, 0.15),
        (0.028, 0.50, 0.20),
        (0.036, 0.60, 0.08),
    )

    for idx, family in enumerate(families):
        pre_scores = {fam: _score(model, fam, seed + families.index(fam) * 101) for fam in families[: idx + 1]}
        replay_x = torch.cat(memory_x, dim=0) if memory_x else None
        replay_y = torch.cat(memory_y, dim=0) if memory_y else None
        candidates = []
        for j, (lr, replay_ratio, anchor) in enumerate(candidate_template):
            candidates.append({
                'name': f'cfg_{j}',
                'budget': 12 * 8,
                'config': {
                    'lr': lr, 'steps': 12, 'replay_ratio': replay_ratio,
                    'anchor_weight': anchor, 'interference_threshold': 0.75,
                    'batch_size': 8, 'inference_batch': 8,
                },
            })

        # Measure the incumbent first. This reference run is mandatory and does not
        # depend on which candidate the neural controller will later choose.
        baseline_model, baseline_metrics = _evaluate_candidate(
            model, family, families, idx, seed, seed + 901,
            pre_scores, replay_x, replay_y, incumbent_config,
        )

        # State is measured BEFORE the current candidate decision.
        state = {
            'new_gain': float(baseline_metrics['new_gain']),
            'retention': float(sum(pre_scores.values()) / max(1, len(pre_scores))),
            'ood': float(pre_scores[family]),
            'uncertainty': float(0.20 if not phase_reports else phase_reports[-1]['prediction_uncertainty']),
            'interference': float(0.20 if not phase_reports else phase_reports[-1].get('interference', 0.20)),
            'plasticity': float(0.80 if not phase_reports else phase_reports[-1].get('plasticity', 0.80)),
            'restart_ok': 1.0,
            'rollback_rate': sum(1 for p in phase_reports if p['commit_or_rollback'] == 'rollback') / max(1, len(phase_reports)),
            'budget': 96.0,
            'baseline_utility': float(baseline_metrics['utility']),
            'incumbent_lr': float(incumbent_config['lr']),
            'incumbent_replay_ratio': float(incumbent_config['replay_ratio']),
            'incumbent_anchor_weight': float(incumbent_config['anchor_weight']),
        }
        if len(history) >= 6:
            fit = controller.fit(history, epochs=12)
            if fit is not None:
                controller_fits += 1
        proposal = controller.propose(candidates, state=state, baseline_budget=96.0, max_budget_ratio=1.0)
        predicted_advantage = float(proposal.get('predicted_advantage', proposal.get('predicted_utility', 0.0) - state['baseline_utility']))
        prediction_uncertainty = float(proposal.get('prediction_uncertainty', state['uncertainty']))
        defer = controller.should_defer(
            predicted_advantage=predicted_advantage,
            uncertainty=prediction_uncertainty,
            min_advantage=0.0, max_uncertainty=0.75,
        )
        chosen_idx = next(i for i, c in enumerate(candidates) if c['name'] == proposal.get('name', candidates[0]['name']))
        chosen_cfg = dict(incumbent_config) if defer else dict(candidates[chosen_idx]['config'])

        # Production decision: incumbent is measured first; a neural proposal is
        # executed only when its evidence is strong enough, otherwise we defer.
        if defer:
            chosen_model, chosen_metrics = None, dict(baseline_metrics)
        else:
            chosen_model, chosen_metrics = _evaluate_candidate(
                model, family, families, idx, seed, seed + 900,
                pre_scores, replay_x, replay_y, chosen_cfg,
            )
        baseline = {
            'utility': baseline_metrics['utility'], 'budget': baseline_metrics['budget'],
            'retention': baseline_metrics['retention'], 'ood': baseline_metrics['ood'],
            'restart_ok': 1.0, 'uncertainty': state['uncertainty'],
        }

        if defer:
            candidate = {
                'utility': baseline_metrics['utility'], 'budget': baseline_metrics['budget'],
                'retention': baseline_metrics['retention'], 'ood': baseline_metrics['ood'],
                'restart_ok': True, 'uncertainty': prediction_uncertainty,
            }
            gate = {
                'accepted': False, 'reasons': ('defer_no_change',),
                'utility_gain': 0.0, 'budget_ratio': 1.0,
                'retention_delta': 0.0, 'ood_delta': 0.0, 'restart_ok': True,
            }
            status = 'defer'
            chosen_metrics['restart_ok'] = True
            committed_scores = dict(pre_scores)
        else:
            ckpt = root / f'phase_{idx}_candidate.pt'
            torch.save({'model': chosen_model.state_dict()}, ckpt)
            reloaded = _TinyContinualNet()
            reloaded.load_state_dict(torch.load(ckpt, map_location='cpu', weights_only=False)['model'])
            restart_score = _score(reloaded, family, seed + families.index(family) * 101)
            chosen_metrics['restart_ok'] = abs(restart_score - chosen_metrics['post_scores'][family]) < 1e-8
            candidate = {
                'utility': chosen_metrics['utility'], 'budget': chosen_metrics['budget'],
                'retention': chosen_metrics['retention'], 'ood': chosen_metrics['ood'],
                'restart_ok': chosen_metrics['restart_ok'], 'uncertainty': prediction_uncertainty,
            }
            gate_obj = controller.gate(
                baseline=baseline, candidate=candidate,
                min_gain=0.0, max_budget_ratio=1.0,
                max_retention_drop=0.05, max_ood_drop=0.05,
            )
            gate = gate_obj.to_dict()
            optimizer = torch.optim.AdamW(model.parameters(), lr=float(chosen_cfg['lr']))
            tx = OnlineAdaptationTransactionV1(root, model, optimizer, budget=chosen_metrics['budget'])
            tx.begin({'phase': family, 'seed': seed, 'config': chosen_cfg, 'controller': 'v2'})
            model.load_state_dict(chosen_model.state_dict())
            status = tx.evaluate({
                'new_gain': chosen_metrics['new_gain'],
                'retention_drop': max(0.0, -chosen_metrics['retention_delta']),
                'ood_drop': max(0.0, baseline['ood'] - chosen_metrics['ood']),
                'interference_veto': False,
                'restart_ok': chosen_metrics['restart_ok'],
                'steps': chosen_cfg['steps'],
            }, thresholds={'min_new_gain': -1.0, 'max_retention_drop': 0.20, 'max_ood_drop': 0.20})
            if not gate_obj.accepted and status == 'commit':
                tx.rollback()
                status = 'rollback'
            if status == 'commit':
                committed_scores = chosen_metrics['post_scores']
                incumbent_config = dict(chosen_cfg)
            else:
                model.load_state_dict(baseline_model.state_dict())
                committed_scores = baseline_metrics['post_scores']

        # Research-only oracle sweep: executed after the production decision and
        # excluded from production equal-budget accounting. Its only purpose is to
        # quantify selection regret and provide training evidence for future phases.
        oracle_rows = []
        for j, cand in enumerate(candidates):
            _, oracle_metrics = _evaluate_candidate(
                model,
                family, families, idx, seed, seed + 1200 + j,
                pre_scores, replay_x, replay_y, cand['config'],
            )
            oracle_rows.append((cand, oracle_metrics))
            history.append({
                'state': dict(state),
                'config': cand['config'],
                'utility': float(oracle_metrics['utility']),
                'baseline_utility': float(baseline_metrics['utility']),
                'budget': float(oracle_metrics['budget']),
            })
        measured_best_utility = max(float(m['utility']) for _, m in oracle_rows)
        selection_regret = max(0.0, measured_best_utility - float(chosen_metrics['utility']))

        cx, cy = _data(family, seed + idx * 101, n=4)
        memory_x.append(cx.detach().clone())
        memory_y.append(cy.detach().clone())

        phase_reports.append({
            'family': family,
            'proposal': proposal,
            'predicted_utility': float(proposal.get('predicted_utility', state['baseline_utility'] + predicted_advantage)),
            'predicted_advantage': float(predicted_advantage),
            'prediction_uncertainty': float(prediction_uncertainty),
            'deferred': bool(defer),
            'baseline_reference_utility': float(baseline_metrics['utility']),
            'chosen_config': dict(chosen_cfg),
            'baseline_budget': int(baseline['budget']),
            'budget': int(chosen_metrics['budget']),
            'equal_budget': int(chosen_metrics['budget']) == int(baseline['budget']),
            'candidate_utility': float(chosen_metrics['utility']),
            'baseline_utility': float(baseline['utility']),
            'measured_best_utility': float(measured_best_utility),
            'selection_regret': float(selection_regret),
            'gate': gate if isinstance(gate, dict) else gate.to_dict(),
            'commit_or_rollback': status,
            'restart_ok': bool(chosen_metrics['restart_ok']),
            'new_gain': float(chosen_metrics['new_gain']),
            'retention': float(chosen_metrics['retention']),
            'ood': float(chosen_metrics['ood']),
            'interference': float(state['interference']),
            'plasticity': float(state['plasticity']),
            'committed_scores': committed_scores,
            'oracle_evidence_excluded_from_budget': True,
        })

    return {
        'version': VERSION,
        'seed': int(seed),
        'phases': len(families),
        'equal_budget': all(p['equal_budget'] for p in phase_reports),
        'restart_equivalence': all(p['restart_ok'] for p in phase_reports),
        'controller_fits': controller_fits,
        'phase_reports': phase_reports,
        'runtime_root': str(root),
    }
