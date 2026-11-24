from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from neurocore.v78 import NeuroWeaveV78, OrganismTrainerV78, mobile_v78_config


@dataclass(frozen=True)
class ContinualTaskV78:
    task_id: int
    rotation: float
    sign: float


def _rotation_matrix(dim: int, angle: float, device=None, dtype=None) -> torch.Tensor:
    m = torch.eye(dim, device=device, dtype=dtype)
    c, s = torch.cos(torch.tensor(angle, device=device, dtype=dtype)), torch.sin(torch.tensor(angle, device=device, dtype=dtype))
    m[0, 0], m[0, 1], m[1, 0], m[1, 1] = c, -s, s, c
    return m


def make_task_batch(task: ContinualTaskV78, n: int, input_dim: int = 54, value_dim: int = 20, seed: int = 0, device=None) -> Tuple[torch.Tensor, torch.Tensor]:
    g = torch.Generator(device=device).manual_seed(seed)
    x = torch.randn(n, input_dim, generator=g, device=device)
    basis = x[:, :value_dim]
    rot = _rotation_matrix(value_dim, task.rotation, device=x.device, dtype=x.dtype)
    y = torch.tanh(task.sign * (basis @ rot.t()) + 0.15 * torch.sin(basis))
    return x, F.normalize(y, dim=-1)


def make_targets_for_task(task: ContinualTaskV78, x: torch.Tensor, value_dim: int = 20) -> torch.Tensor:
    basis = x[:, :value_dim]
    rot = _rotation_matrix(value_dim, task.rotation, device=x.device, dtype=x.dtype)
    y = torch.tanh(task.sign * (basis @ rot.t()) + 0.15 * torch.sin(basis))
    return F.normalize(y, dim=-1)


def eval_task(model: NeuroWeaveV78, ctx: torch.Tensor, target: torch.Tensor) -> float:
    model.eval()
    with torch.no_grad():
        out = model.neural_memory_v61(ctx)
        return float(F.smooth_l1_loss(out['read'], target).item())


def _write_task(model: NeuroWeaveV78, ctx: torch.Tensor, target: torch.Tensor) -> None:
    for i in range(ctx.size(0)):
        model.neural_memory_v61.write(ctx[i:i+1], target[i:i+1], strength=1.0, surprise=1.0)


def _snapshot_model_state(model: NeuroWeaveV78) -> dict:
    return {k: v.detach().clone() for k, v in model.state_dict().items()}


def _restore_model_state(model: NeuroWeaveV78, state: dict) -> None:
    model.load_state_dict(state, strict=True)


def run_trial(seed: int, use_interference: bool, conflict: str = 'high', samples: int = 4, updates_per_task: int = 1) -> Dict:
    torch.manual_seed(seed)
    model = NeuroWeaveV78(mobile_v78_config(9))
    trainer = OrganismTrainerV78(model, lr=4e-4, warmup_steps=1)
    if conflict == 'none':
        tasks = [ContinualTaskV78(0, 0.00, 1.0), ContinualTaskV78(1, 0.25, 1.0), ContinualTaskV78(2, 0.50, 1.0), ContinualTaskV78(3, 0.75, 1.0)]
    elif conflict == 'medium':
        tasks = [ContinualTaskV78(0, 0.00, 1.0), ContinualTaskV78(1, 0.30, -1.0), ContinualTaskV78(2, 0.60, 1.0), ContinualTaskV78(3, 0.90, -1.0)]
    else:
        tasks = [ContinualTaskV78(0, 0.00, 1.0), ContinualTaskV78(1, 0.00, -1.0), ContinualTaskV78(2, 0.00, 1.0), ContinualTaskV78(3, 0.00, -1.0)]

    g = torch.Generator().manual_seed(seed * 101 + 17)
    shared_train_x = torch.randn(samples, 54, generator=g)
    shared_probe_x = torch.randn(8, 54, generator=g)
    train_batches = []
    probe_batches = []
    baseline_losses = []
    for task in tasks:
        tr = (shared_train_x.clone(), make_targets_for_task(task, shared_train_x))
        pr = (shared_probe_x.clone(), make_targets_for_task(task, shared_probe_x))
        train_batches.append(tr)
        probe_batches.append(pr)
        _write_task(model, tr[0], tr[1])
        baseline_losses.append(eval_task(model, pr[0], pr[1]))

    history: List[Dict] = []
    for task, (ctx, tgt) in zip(tasks, train_batches):
        # Each task receives identical optimizer-step budget. Replay is whatever is present in the
        # current canonical buffer; no hidden task-specific parameter bank is created.
        for _ in range(updates_per_task):
            if use_interference:
                replay = model.neural_memory_v61._replay_batch()
                if replay is None:
                    stats = trainer.continual_update_v78(ctx, tgt, task_id=task.task_id, replay_weight=0.0)
                else:
                    stats = trainer.continual_update_v78(ctx, tgt, replay[0], replay[1], task_id=task.task_id)
            else:
                parts = model.neural_memory_v61.memory_loss(ctx, tgt)
                trainer.neural_memory_optimizer.zero_grad(set_to_none=True)
                parts['loss'].backward()
                torch.nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0)
                trainer.neural_memory_optimizer.step()
                stats = {'current_loss': float(parts['loss'].detach().item()), 'replay_loss': 0.0, 'interference_cosine': 0.0, 'projection_ratio': 0.0, 'conflict': 0.0}
        model.neural_memory_v61.model_time_v72.add_(1.0)
        model.neural_memory_v61.replay_associative_state_v72(budget=2)
        losses = [eval_task(model, pctx, ptgt) for pctx, ptgt in probe_batches]
        history.append({'task_id': task.task_id, 'losses': losses, 'step_stats': stats})

    final_losses = [eval_task(model, pctx, ptgt) for pctx, ptgt in probe_batches]
    first_post_task_loss = history[0]['losses'][0]
    last_task_post_loss = history[-1]['losses'][-1]
    forgetting_task0 = final_losses[0] - first_post_task_loss
    adaptation_task_last = last_task_post_loss - baseline_losses[-1]
    return {
        'seed': seed,
        'mode': 'v78_interference' if use_interference else 'naive_current_only',
        'conflict': conflict,
        'samples': samples,
        'updates_per_task': updates_per_task,
        'baseline_losses': baseline_losses,
        'post_task0_loss': first_post_task_loss,
        'final_losses': final_losses,
        'task0_forgetting': forgetting_task0,
        'last_task_adaptation_delta': adaptation_task_last,
        'interference_cosine': float(model.neural_memory_v61.continual_interference_cos_v78.item()),
        'projection_ratio': float(model.neural_memory_v61.continual_projection_ratio_v78.item()),
        'conflict_events': int(model.neural_memory_v61.continual_conflict_events_v78.item()),
        'history': history,
    }


def _fixed_project(z: torch.Tensor, out_dim: int, seed: int) -> torch.Tensor:
    g = torch.Generator().manual_seed(seed)
    w = torch.randn(z.size(-1), out_dim, generator=g, dtype=z.dtype)
    w = F.normalize(w, dim=0)
    return z @ w


def collect_external_task(target_xy, seed: int, train_n: int = 6, probe_n: int = 8):
    from neurocore.v40 import ExternalTaskV40

    env = ExternalTaskV40(target=target_xy, seed=seed)
    rows = []
    while len(rows) < train_n + probe_n:
        obs = env.reset()
        for t in range(8):
            action = torch.randn(1, 3, generator=torch.Generator().manual_seed(seed * 17 + len(rows) * 31 + t)).clamp(-1, 1)
            nxt, reward, risk = env.step(action)
            rows.append((obs[0].detach().clone(), nxt[0].detach().clone(), reward[0].detach().clone(), risk[0].detach().clone()))
            obs = nxt
            if len(rows) >= train_n + probe_n:
                break
    obs = torch.stack([r[0] for r in rows])
    next_obs = torch.stack([r[1] for r in rows])
    reward = torch.stack([r[2] for r in rows])
    risk = torch.stack([r[3] for r in rows])
    context = _fixed_project(obs, 54, seed=seed + 4000)
    target_raw = torch.cat([next_obs, reward, risk], dim=-1)
    target = F.normalize(_fixed_project(target_raw, 20, seed=seed + 5000), dim=-1)
    return (context[:train_n], target[:train_n]), (context[train_n:], target[train_n:])


def run_external_stream_trial(seed: int, use_interference: bool, updates_per_task: int = 2) -> Dict:
    torch.manual_seed(seed)
    model = NeuroWeaveV78(mobile_v78_config(9))
    trainer = OrganismTrainerV78(model, lr=4e-4, warmup_steps=1)
    task_targets = [(-0.75, -0.65), (0.75, 0.65), (-0.60, 0.72), (0.68, -0.70)]
    tasks = [collect_external_task(t, seed * 31 + i * 997, train_n=6, probe_n=8) for i, t in enumerate(task_targets)]
    baseline_losses = [eval_task(model, pr[0], pr[1]) for _, pr in tasks]
    post_task0 = None
    for task_id, ((ctx, tgt), _) in enumerate(tasks):
        _write_task(model, ctx, tgt)
        for _ in range(updates_per_task):
            if use_interference:
                replay = model.neural_memory_v61._replay_batch()
                stats = trainer.continual_update_v78(ctx, tgt, replay[0], replay[1], task_id=task_id) if replay else trainer.continual_update_v78(ctx, tgt, task_id=task_id, replay_weight=0.0)
            else:
                parts = model.neural_memory_v61.memory_loss(ctx, tgt)
                trainer.neural_memory_optimizer.zero_grad(set_to_none=True)
                parts['loss'].backward()
                torch.nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0)
                trainer.neural_memory_optimizer.step()
                stats = {'interference_cosine': 0.0, 'projection_ratio': 0.0, 'conflict': 0.0}
        if task_id == 0:
            post_task0 = eval_task(model, tasks[0][1][0], tasks[0][1][1])
        model.neural_memory_v61.model_time_v72.add_(1.0)
        model.neural_memory_v61.replay_associative_state_v72(budget=2)
    final_losses = [eval_task(model, pr[0], pr[1]) for _, pr in tasks]
    return {
        'seed': seed,
        'mode': 'v78_interference' if use_interference else 'naive_current_only',
        'baseline_losses': baseline_losses,
        'post_task0_loss': post_task0,
        'final_losses': final_losses,
        'task0_delta': float(final_losses[0] - post_task0),
        'last_task_delta': float(final_losses[-1] - baseline_losses[-1]),
        'interference_cosine': float(model.neural_memory_v61.continual_interference_cos_v78.item()),
        'projection_ratio': float(model.neural_memory_v61.continual_projection_ratio_v78.item()),
        'conflict_events': int(model.neural_memory_v61.continual_conflict_events_v78.item()),
    }


def run_replay_recovery_trial(seed: int, rounds: int = 4) -> Dict[str, float]:
    torch.manual_seed(seed)
    model = NeuroWeaveV78(mobile_v78_config(9))
    mem = model.neural_memory_v61
    with torch.no_grad():
        valid_slots = 8
        mem.semantic_slot_valid_v63[:valid_slots] = 1.0
        keys = F.normalize(torch.randn(valid_slots, mem.key_dim, generator=torch.Generator().manual_seed(seed + 800)), dim=-1)
        mem.semantic_key[:valid_slots] = keys
        for i in range(valid_slots - 2):
            mem._record_composition_path_v73([i, i + 1, i + 2], 1.0)
        source = F.normalize(keys[0] * 0.65 + keys[1] * 0.35, dim=-1)
        target = keys[2]
        mem._associative_write_v72(source, target, 0, 1.0)
        baseline = mem._associative_predict_v72(source.view(1, -1), 0)
        before = float(F.cosine_similarity(baseline, target.view(1, -1)).item())
        replay_count = int(mem.composition_replay_valid_v71.sum().item())
        mem.lesion_fast_associative_v78(1.0)
        after_lesion = mem._associative_predict_v72(source.view(1, -1), 0)
        lesion_cos = float(F.cosine_similarity(after_lesion, target.view(1, -1)).item())
        no_replay = mem._associative_predict_v72(source.view(1, -1), 0)
        no_replay_cos = float(F.cosine_similarity(no_replay, target.view(1, -1)).item())
        rec = mem.recover_associative_from_replay_v78(rounds=rounds, budget=2)
        recovered = mem._associative_predict_v72(source.view(1, -1), 0)
        after = float(F.cosine_similarity(recovered, target.view(1, -1)).item())
        recovery_fraction = (after - lesion_cos) / (before - lesion_cos + 1e-8)
    return {
        'seed': seed,
        'baseline_cosine': before,
        'lesion_cosine': lesion_cos,
        'no_replay_cosine': no_replay_cos,
        'recovered_cosine': after,
        'recovery_gain_over_lesion': after - lesion_cos,
        'recovery_fraction_of_lost_cosine': recovery_fraction,
        'replay_traces_before_lesion': replay_count,
        **rec,
    }


def run_parameter_interference_trial(seed: int, updates_a: int = 8, updates_b: int = 8) -> Dict:
    torch.manual_seed(seed)
    shared_g = torch.Generator().manual_seed(seed + 12000)
    ctx = torch.randn(8, 54, generator=shared_g)
    task_a = ContinualTaskV78(0, 0.0, 1.0)
    task_b = ContinualTaskV78(1, 0.0, -1.0)
    tgt_a = make_targets_for_task(task_a, ctx)
    tgt_b = make_targets_for_task(task_b, ctx)
    template = NeuroWeaveV78(mobile_v78_config(9))
    initial_state = _snapshot_model_state(template)
    results = {}
    for use_interference in (False, True):
        model = NeuroWeaveV78(mobile_v78_config(9))
        _restore_model_state(model, initial_state)
        trainer = OrganismTrainerV78(model, lr=5e-4, warmup_steps=1)
        before_a = eval_task(model, ctx, tgt_a)
        for _ in range(updates_a):
            if use_interference:
                trainer.continual_update_v78(ctx, tgt_a, task_id=0, replay_weight=0.0)
            else:
                parts = model.neural_memory_v61.memory_loss(ctx, tgt_a)
                trainer.neural_memory_optimizer.zero_grad(set_to_none=True); parts['loss'].backward(); nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0); trainer.neural_memory_optimizer.step()
        after_a = eval_task(model, ctx, tgt_a)
        for _ in range(updates_b):
            if use_interference:
                trainer.continual_update_v78(ctx, tgt_b, ctx, tgt_a, task_id=1, replay_weight=0.75)
            else:
                parts = model.neural_memory_v61.memory_loss(ctx, tgt_b)
                trainer.neural_memory_optimizer.zero_grad(set_to_none=True); parts['loss'].backward(); nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0); trainer.neural_memory_optimizer.step()
        final_a = eval_task(model, ctx, tgt_a)
        final_b = eval_task(model, ctx, tgt_b)
        results['v78' if use_interference else 'naive'] = {
            'initial_a_loss': before_a,
            'post_a_loss': after_a,
            'final_a_loss': final_a,
            'final_b_loss': final_b,
            'a_change_after_b': final_a - after_a,
            'b_improvement': after_a - final_b,
            'interference_cosine': float(model.neural_memory_v61.continual_interference_cos_v78.item()),
            'projection_ratio': float(model.neural_memory_v61.continual_projection_ratio_v78.item()),
            'conflict_events': int(model.neural_memory_v61.continual_conflict_events_v78.item()),
        }
    return {'seed': seed, **results, 'retention_benefit': results['naive']['a_change_after_b'] - results['v78']['a_change_after_b'], 'adaptation_benefit': results['v78']['b_improvement'] - results['naive']['b_improvement']}



def _gradient_cosine_for_tasks(model: NeuroWeaveV78, ctx: torch.Tensor, ta: ContinualTaskV78, tb: ContinualTaskV78) -> float:
    ya = make_targets_for_task(ta, ctx)
    yb = make_targets_for_task(tb, ctx)
    params = [p for p in model.neural_memory_v61.parameters() if p.requires_grad]
    pa = model.neural_memory_v61.memory_loss(ctx, ya)
    pb = model.neural_memory_v61.memory_loss(ctx, yb)
    la = OrganismTrainerV78._task_objective_v78(pa)
    lb = OrganismTrainerV78._task_objective_v78(pb)
    ga = torch.autograd.grad(la, params, allow_unused=True, retain_graph=True)
    gb = torch.autograd.grad(lb, params, allow_unused=True)
    dot = sum(float((a*b).sum().item()) for a,b in zip(ga,gb) if a is not None and b is not None)
    na = sum(float(a.pow(2).sum().item()) for a in ga if a is not None) ** 0.5
    nb = sum(float(b.pow(2).sum().item()) for b in gb if b is not None) ** 0.5
    return dot / (na*nb + 1e-12)


def discover_conflicting_pair_v78(seed: int = 0, warmup_steps: int = 12):
    torch.manual_seed(seed)
    ctx = torch.randn(8, 54, generator=torch.Generator().manual_seed(seed + 16000))
    candidates = [ContinualTaskV78(i, angle, sign) for i,(angle,sign) in enumerate((
        (0.0, 1.0), (0.0,-1.0), (0.7,1.0), (0.7,-1.0), (1.4,1.0), (1.4,-1.0),
    ))]
    model = NeuroWeaveV78(mobile_v78_config(9))
    trainer = OrganismTrainerV78(model, lr=5e-4, warmup_steps=1)
    anchor = candidates[0]
    ya = make_targets_for_task(anchor, ctx)
    for _ in range(max(1, int(warmup_steps))):
        parts = model.neural_memory_v61.memory_loss(ctx, ya)
        trainer.neural_memory_optimizer.zero_grad(set_to_none=True)
        parts['loss'].backward()
        torch.nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0)
        trainer.neural_memory_optimizer.step()
    best = None
    for candidate in candidates[1:]:
        c = _gradient_cosine_for_tasks(model, ctx, anchor, candidate)
        if best is None or c < best['cosine']:
            best = {'a': anchor, 'b': candidate, 'cosine': c, 'warmup_steps': int(warmup_steps)}
    return best


def run_discovered_interference_trial(seed: int = 0, updates_a: int = 8, updates_b: int = 8):
    pair = discover_conflicting_pair_v78(seed)
    torch.manual_seed(seed + 17000)
    ctx = torch.randn(8, 54, generator=torch.Generator().manual_seed(seed + 12000))
    ta, tb = pair['a'], pair['b']
    ya, yb = make_targets_for_task(ta, ctx), make_targets_for_task(tb, ctx)
    template = NeuroWeaveV78(mobile_v78_config(9))
    initial_state = _snapshot_model_state(template)
    results = {}
    for use_interference in (False, True):
        model = NeuroWeaveV78(mobile_v78_config(9))
        _restore_model_state(model, initial_state)
        trainer = OrganismTrainerV78(model, lr=5e-4, warmup_steps=1)
        before_a = eval_task(model, ctx, ya)
        for _ in range(updates_a):
            parts = model.neural_memory_v61.memory_loss(ctx, ya)
            trainer.neural_memory_optimizer.zero_grad(set_to_none=True); parts['loss'].backward(); nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0); trainer.neural_memory_optimizer.step()
        after_a = eval_task(model, ctx, ya)
        for _ in range(updates_b):
            if use_interference:
                stats = trainer.continual_update_v78(ctx, yb, ctx, ya, task_id=1)
            else:
                parts = model.neural_memory_v61.memory_loss(ctx, yb)
                trainer.neural_memory_optimizer.zero_grad(set_to_none=True); parts['loss'].backward(); nn.utils.clip_grad_norm_(model.neural_memory_v61.parameters(), 1.0); trainer.neural_memory_optimizer.step()
        final_a = eval_task(model, ctx, ya)
        final_b = eval_task(model, ctx, yb)
        results['v78' if use_interference else 'naive'] = {'initial_a_loss':before_a,'post_a_loss':after_a,'final_a_loss':final_a,'final_b_loss':final_b,'a_change_after_b':final_a-after_a,'b_improvement':after_a-final_b,'interference_cosine':float(model.neural_memory_v61.continual_interference_cos_v78.item()),'projection_ratio':float(model.neural_memory_v61.continual_projection_ratio_v78.item()),'conflict_events':int(model.neural_memory_v61.continual_conflict_events_v78.item())}
    return {'seed':seed,'discovered_pair':{'a_task':pair['a'].task_id,'a_rotation':pair['a'].rotation,'a_sign':pair['a'].sign,'b_task':pair['b'].task_id,'b_rotation':pair['b'].rotation,'b_sign':pair['b'].sign,'pretrain_gradient_cosine':pair['cosine']},**results,'retention_benefit':results['naive']['a_change_after_b']-results['v78']['a_change_after_b']}
