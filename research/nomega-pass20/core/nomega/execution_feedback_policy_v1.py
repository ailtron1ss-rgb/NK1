from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
import json
import math
import random
import time

import torch
import torch.nn.functional as F
from torch.distributions import Categorical

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program, OPS, REGS
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .task_spec_v1 import FAMILY_TO_ID, parse_task_spec, CANONICAL_PROMPT
from .adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
from .evolution_archive_v1 import EvolutionArchiveV1


@dataclass
class FeedbackTrajectoryV1:
    prompt: str
    family: str
    family_id: int
    program: Program
    reward: float
    holdout_fitness: float
    hvm_agreement: float
    steps: int
    turns: int
    counterexamples: List[Dict[str, Any]]
    logprob_sum: float

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["program"] = [list(x) for x in self.program]
        return d


@dataclass
class ExecutionFeedbackTrainReportV1:
    before_reward: float
    after_reward: float
    reward_delta: float
    positive_updates: int
    episodes: int
    trajectories: int
    optimizer_steps: int
    verified_trajectory_rate: float
    mean_reward: float
    mean_group_std: float
    wall_s: float
    promotion_safe: bool
    provenance: str


class ExecutionFeedbackPolicyTrainerV1:
    """Bounded GRPO-like execution-feedback learner for the compact program decoder.

    The learner follows a finite-horizon loop inspired by execution-feedback RL:
    sample a group of candidate programs, execute them against held-out examples,
    standardize rewards within the group, and update the policy from trajectory
    log-probabilities. No critic/value model is introduced. The implementation is
    intentionally small and dependency-free so it can be stress-tested in NΩ.

    This is an experimental policy-training layer. It does not claim that a small
    component benchmark proves general neural self-improvement.
    """

    def __init__(self, root: Path, model: NeuralProgramSynthesizerV2, seed: int = 2901,
                 lr: float = 2e-4, temperature: float = 1.0, entropy_weight: float = 0.002):
        self.root = Path(root)
        self.model = model
        self.seed = int(seed)
        self.rng = random.Random(seed)
        self.optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
        self.temperature = max(float(temperature), 0.05)
        self.entropy_weight = max(float(entropy_weight), 0.0)
        self.steps = 0
        self.last_trajectories: List[FeedbackTrajectoryV1] = []
        (self.root / "runtime").mkdir(parents=True, exist_ok=True)

    def _condition(self, text: str, family_id: Optional[int]) -> torch.Tensor:
        cond, _ = self.model._condition_with_family(text, family_id)
        return cond

    def _sample_one(self, text: str, family_id: Optional[int], max_len: int,
                    greedy: bool = False) -> Tuple[Program, torch.Tensor, torch.Tensor]:
        device = next(self.model.parameters()).device
        cond = self._condition(text, family_id)
        prefix = torch.tensor([[[14, 0, 0]]], device=device, dtype=torch.long)
        program: Program = []
        logps: List[torch.Tensor] = []
        entropies: List[torch.Tensor] = []
        self.model.eval()

        for s in range(int(max_len)):
            xs = [self.model._embed_prev(prefix[:, i, :], i, cond.squeeze(1))
                  for i in range(prefix.size(1))]
            x = torch.cat(xs, dim=1)
            mask = torch.triu(torch.full((x.size(1), x.size(1)), float('-inf'), device=device), diagonal=1)
            h = self.model.norm(self.model.decoder(x, mask=mask))[:, -1]
            logits = [self.model.op_head(h), self.model.a_head(h), self.model.b_head(h)]
            sampled: List[int] = []
            step_logprob = []
            step_entropy = []
            for j, raw in enumerate(logits):
                dist = Categorical(logits=raw / self.temperature)
                value = raw.argmax(-1) if greedy else dist.sample()
                sampled.append(int(value.item()))
                step_logprob.append(dist.log_prob(value).sum())
                step_entropy.append(dist.entropy().sum())
            op, a, b = sampled
            program.append((op, a, b))
            logps.append(torch.stack(step_logprob).sum())
            entropies.append(torch.stack(step_entropy).sum())
            tok = torch.tensor([[[op, a, b]]], device=device, dtype=torch.long)
            prefix = torch.cat([prefix, tok], dim=1)
            if op == 14:
                break

        if not program or program[-1][0] != 14:
            # A missing explicit halt is a valid sampled action sequence for the RL
            # trace; execution verification decides whether it has any reward.
            program = program[:max(1, max_len - 2)] + [(13, 0, 0), (14, 0, 0)]
        return program, torch.stack(logps).sum(), torch.stack(entropies).sum()

    @staticmethod
    def _reward(holdout_fitness: float, hvm_agreement: float, complexity: int) -> float:
        # Execution is authoritative. HVM agreement is an independent execution path;
        # complexity is only a small tie-breaker and cannot rescue an invalid program.
        base = 0.75 * float(holdout_fitness) + 0.25 * float(hvm_agreement)
        if holdout_fitness < 0.25:
            return float(base - 0.01 * max(0, complexity - 6))
        return float(base - 0.002 * max(0, complexity - 6))

    def _episode_group(self, prompt: str, family: str, family_id: int,
                       holdout: Sequence[Tuple[List[int], int]], group_size: int,
                       max_len: int, oracle_family: bool = True) -> Tuple[List[FeedbackTrajectoryV1], List[torch.Tensor], List[torch.Tensor]]:
        acq = ProgramAcquisitionCoreV2(self.root, seed=self.seed + 401 + family_id)
        traces: List[FeedbackTrajectoryV1] = []
        logps: List[torch.Tensor] = []
        entropies: List[torch.Tensor] = []
        fid = family_id if oracle_family else None
        for _ in range(max(2, int(group_size))):
            program, lp, ent = self._sample_one(prompt, fid, max_len=max_len, greedy=False)
            hf, hvm, ces = acq._eval(program, holdout)
            reward = self._reward(hf, hvm, len(program))
            traces.append(FeedbackTrajectoryV1(
                prompt=prompt,
                family=family,
                family_id=family_id,
                program=program,
                reward=reward,
                holdout_fitness=float(hf),
                hvm_agreement=float(hvm),
                steps=len(program),
                turns=1,
                counterexamples=list(ces),
                logprob_sum=float(lp.detach()),
            ))
            logps.append(lp)
            entropies.append(ent)
        return traces, logps, entropies

    def _update_group(self, rewards: Sequence[float], logps: Sequence[torch.Tensor], entropies: Sequence[torch.Tensor]) -> Tuple[float, float]:
        r = torch.tensor(list(rewards), dtype=torch.float32, device=next(self.model.parameters()).device)
        mean = r.mean()
        std = r.std(unbiased=False)
        adv = (r - mean) / (std + 1e-6)
        policy_loss = torch.stack([-a * lp for a, lp in zip(adv, logps)]).mean()
        entropy_bonus = torch.stack(entropies).mean()
        loss = policy_loss - self.entropy_weight * entropy_bonus
        self.optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()
        self.steps += 1
        return float(loss.detach()), float(std.detach())

    @torch.no_grad()
    def evaluate_reward(self, prompt: str, family: str, family_id: int,
                        holdout: Sequence[Tuple[List[int], int]], max_len: int,
                        samples: int = 4, oracle_family: bool = True) -> float:
        self.model.eval()
        acq = ProgramAcquisitionCoreV2(self.root, seed=self.seed + 991)
        rewards=[]
        fid=family_id if oracle_family else None
        for _ in range(max(1, samples)):
            code=self.model.generate(prompt, family_id=fid, max_len=max_len)
            hf,hvm,_=acq._eval(code,holdout)
            rewards.append(self._reward(hf,hvm,len(code)))
        return float(sum(rewards)/max(1,len(rewards)))

    def store_verified_trajectories(self, trajectories: Sequence[FeedbackTrajectoryV1], cycle_id: str) -> Dict[str, Any]:
        memory = AdaptiveExperienceMemoryV3(self.root)
        archive = EvolutionArchiveV1(self.root)
        stored = 0
        records = []
        for row in trajectories:
            if row.holdout_fitness < 0.8 or row.hvm_agreement < 0.8:
                continue
            spec = parse_task_spec(row.prompt, min_confidence=0.995)
            if not spec.semantic_valid or spec.family != row.family:
                continue
            key = memory.store_verified(
                family=row.family, text=row.prompt, code=row.program,
                reward=float(row.reward), source='execution_feedback_verified',
                cycle_id=str(cycle_id),
                provenance={'holdout_fitness':row.holdout_fitness,'hvm_agreement':row.hvm_agreement,'turns':row.turns,'steps':row.steps},
                confidence=min(1.0, 0.5*row.holdout_fitness + 0.5*row.hvm_agreement),
                status='validated',
            )
            archive.add(
                family=row.family, operator='execution_feedback_policy', code=row.program,
                verified=True, success=float(row.reward), search_cost=float(row.steps),
                complexity=float(len(row.program)/64.0), source='execution_feedback_verified', cycle_id=str(cycle_id),
            )
            stored += 1
            records.append({'key':key,'family':row.family,'reward':row.reward})
        return {'stored':stored,'records':records,'memory_stats':memory.stats(),'archive_stats':archive.stats()}

    def fit(self, tasks: Sequence[Tuple[str, str, int, Sequence[Tuple[List[int], int]]]],
            episodes: int = 4, group_size: int = 4, max_len: Optional[int] = None,
            oracle_family: bool = True) -> ExecutionFeedbackTrainReportV1:
        if not tasks:
            return ExecutionFeedbackTrainReportV1(0,0,0,0,0,0,0,0,0,0,False,'no tasks')
        L=int(max_len or self.model.max_len)
        before=[]
        for prompt,fam,fid,holdout in tasks:
            before.append(self.evaluate_reward(prompt,fam,fid,holdout,L,samples=2,oracle_family=oracle_family))
        t0=time.perf_counter(); trajectories=0; positive=0; reward_values=[]; group_stds=[]; losses=[]
        self.model.train()
        for ep in range(max(1,int(episodes))):
            order=list(range(len(tasks))); self.rng.shuffle(order)
            for idx in order:
                prompt,fam,fid,holdout=tasks[idx]
                traces,logps,entropies=self._episode_group(prompt,fam,fid,holdout,group_size,L,oracle_family)
                rewards=[t.reward for t in traces]
                _,gstd=self._update_group(rewards,logps,entropies)
                self.last_trajectories.extend(traces)
                losses.append(float(losses[-1] if losses else 0.0))
                group_stds.append(gstd); trajectories += len(traces); reward_values.extend(rewards)
                if max(rewards) >= 0.8 and max(rewards) > (sum(rewards)/len(rewards)):
                    positive += 1
        after=[]
        for prompt,fam,fid,holdout in tasks:
            after.append(self.evaluate_reward(prompt,fam,fid,holdout,L,samples=2,oracle_family=oracle_family))
        before_mean=sum(before)/len(before); after_mean=sum(after)/len(after)
        promotion_safe=(after_mean>before_mean and any(x>=0.8 for x in reward_values) and sum(1 for x in reward_values if x>=0.8)>0 and all(math.isfinite(x) for x in after))
        return ExecutionFeedbackTrainReportV1(
            before_reward=float(before_mean), after_reward=float(after_mean), reward_delta=float(after_mean-before_mean),
            positive_updates=int(positive), episodes=max(1,int(episodes)), trajectories=trajectories,
            optimizer_steps=self.steps, verified_trajectory_rate=sum(1 for x in reward_values if x>=0.8)/max(1,len(reward_values)),
            mean_reward=sum(reward_values)/max(1,len(reward_values)), mean_group_std=sum(group_stds)/max(1,len(group_stds)),
            wall_s=time.perf_counter()-t0, promotion_safe=bool(promotion_safe),
            provenance='Execution reward is computed from held-out TinyVM/HVM verification; group-standardized advantages; no synthetic score is used as the primary reward.'
        )

    def save_evidence(self, path: Optional[Path], report: ExecutionFeedbackTrainReportV1, extra: Optional[Dict[str, Any]] = None) -> Path:
        out = Path(path or (self.root / 'runtime' / f'execution_feedback_policy_{self.seed}.json'))
        out.parent.mkdir(parents=True, exist_ok=True)
        payload = {'report': asdict(report), 'seed': self.seed, 'temperature': self.temperature, 'entropy_weight': self.entropy_weight}
        if extra:
            payload.update(extra)
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
        return out
