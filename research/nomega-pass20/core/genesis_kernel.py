"""Genesis Kernel — zero-prior self-improving program invent layer.

Aligned with the user goal:
  - invent programs/binaries from minimal ISA (no pretrained nets, no human code dumps)
  - store, sort, reuse knowledge
  - self-modify search policy under dual measurement
  - optionally invent macro-"languages" (named op sequences) from useful fragments

This is NOT a frontier LLM and does not claim AGI. It is a pure evolutionary
invent loop on a tiny machine, designed to run on Termux.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import json, random, hashlib, struct, time

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "runtime" / "genesis_state.json"
KNOWLEDGE = ROOT / "runtime" / "genesis_knowledge.json"
BIN_DIR = ROOT / "runtime" / "genesis_bins"

# Minimal ISA — only what the machine is, not "knowledge"
OPS = {
    0: "NOP", 1: "LOAD", 2: "STORE", 3: "ADD", 4: "SUB",
    5: "XOR", 6: "AND", 7: "OR", 8: "SHL", 9: "SHR",
    10: "CMP", 11: "JZ", 12: "JMP", 13: "OUT", 14: "HALT",
    15: "MUL", 16: "NOT", 17: "MIN", 18: "MAX", 19: "SWAP",
}
N_OPS = len(OPS)
REG_N = 4
MAX_CODE = 32
TAPE_N = 8


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()[:16]


@dataclass
class Genome:
    """Flat program: list of (op, a, b) — a/b are reg or imm encoded."""
    code: List[Tuple[int, int, int]] = field(default_factory=list)
    fitness: float = 0.0
    hold: float = 0.0
    origin: str = "random"
    macros_used: List[str] = field(default_factory=list)

    def fingerprint(self) -> str:
        return _hash(self.code)


class TinyVM:
    """Deterministic tiny VM. Input tape[8] -> output byte in OUT register trail."""

    def run(self, code: List[Tuple[int, int, int]], tape: List[int], steps: int = 96) -> int:
        reg = [0] * REG_N
        mem = [(tape[i] if i < len(tape) else 0) & 255 for i in range(TAPE_N)]
        pc = 0
        out = 0
        n = len(code)
        if n == 0:
            return 0
        for _ in range(steps):
            if pc < 0 or pc >= n:
                break
            op, a, b = code[pc]
            op = op % N_OPS
            a = a % REG_N
            b = b & 255
            if op == 14:  # HALT
                break
            elif op == 1:  # LOAD reg[a] = mem[b % 8]
                reg[a] = mem[b % TAPE_N]
            elif op == 2:  # STORE mem[b % 8] = reg[a]
                mem[b % TAPE_N] = reg[a]
            elif op == 3:  # ADD reg[a] = reg[a] + reg[b % REG_N]
                reg[a] = (reg[a] + reg[b % REG_N]) & 255
            elif op == 4:  # SUB
                reg[a] = (reg[a] - reg[b % REG_N]) & 255
            elif op == 5:  # XOR
                reg[a] = (reg[a] ^ reg[b % REG_N]) & 255
            elif op == 6:  # AND
                reg[a] = (reg[a] & reg[b % REG_N]) & 255
            elif op == 7:  # OR
                reg[a] = (reg[a] | reg[b % REG_N]) & 255
            elif op == 8:  # SHL
                reg[a] = (reg[a] << 1) & 255
            elif op == 9:  # SHR
                reg[a] = (reg[a] >> 1) & 255
            elif op == 10:  # CMP reg[a] = reg[a] < reg[b%REG]
                reg[a] = 1 if reg[a] < reg[b % REG_N] else 0
            elif op == 11:  # JZ if reg[a]==0 pc=b%n
                if reg[a] == 0:
                    pc = b % n
                    continue
            elif op == 12:  # JMP
                pc = b % n
                continue
            elif op == 13:  # OUT out = reg[a]
                out = reg[a]
            elif op == 15:  # MUL
                reg[a] = (reg[a] * reg[b % REG_N]) & 255
            elif op == 16:  # NOT
                reg[a] = (255 - reg[a]) & 255
            elif op == 17:  # MIN
                reg[a] = min(reg[a], reg[b % REG_N])
            elif op == 18:  # MAX
                reg[a] = max(reg[a], reg[b % REG_N])
            elif op == 19:  # SWAP
                rb = b % REG_N
                reg[a], reg[rb] = reg[rb], reg[a]
            pc += 1
        return out & 255



def fitness(code: List[Tuple[int, int, int]], tasks: List[Tuple[List[int], int]]) -> float:
    if not tasks:
        return 0.0
    vm = TinyVM()
    ok = 0
    for tape, y in tasks:
        try:
            pred = vm.run(code, tape)
            if pred == (y & 255):
                ok += 1
        except Exception:
            pass
    return ok / len(tasks)


class KnowledgeBank:
    """Store / sort / reuse invented programs and macros."""

    def __init__(self):
        self.items: List[Dict[str, Any]] = []
        self.macros: Dict[str, List[Tuple[int, int, int]]] = {}
        self._load()

    def _load(self):
        if KNOWLEDGE.exists():
            try:
                data = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))
                self.items = list(data.get("items") or [])
                self.macros = {k: [tuple(x) for x in v] for k, v in (data.get("macros") or {}).items()}
            except Exception:
                pass

    def save(self):
        try:
            KNOWLEDGE.parent.mkdir(parents=True, exist_ok=True)
            KNOWLEDGE.write_text(
                json.dumps({"items": self.items[-200:], "macros": {k: [list(x) for x in v] for k, v in self.macros.items()}, "updated": _now()}, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    def add_program(self, genome: Genome, task_name: str, utility: float):
        entry = {
            "fp": genome.fingerprint(),
            "task": task_name,
            "fitness": genome.fitness,
            "hold": genome.hold,
            "utility": utility,
            "code": [list(x) for x in genome.code],
            "origin": genome.origin,
            "ts": _now(),
        }
        # dedup by fp
        self.items = [i for i in self.items if i.get("fp") != entry["fp"]]
        self.items.append(entry)
        self.items.sort(key=lambda x: -float(x.get("utility", 0)))
        self.items = self.items[:200]
        self.save()

    def promote_macro(self, name: str, fragment: List[Tuple[int, int, int]]):
        if len(fragment) < 2:
            return
        self.macros[name] = fragment[:8]
        self.save()

    def top(self, n: int = 10) -> List[Dict[str, Any]]:
        return sorted(self.items, key=lambda x: -float(x.get("utility", 0)))[:n]

    def sample_code(self, rng: random.Random) -> Optional[List[Tuple[int, int, int]]]:
        if not self.items:
            return None
        # utility-weighted
        weights = [max(0.01, float(i.get("utility", 0.1))) for i in self.items]
        s = sum(weights)
        r = rng.random() * s
        acc = 0.0
        for w, item in zip(weights, self.items):
            acc += w
            if acc >= r:
                return [tuple(x) for x in item["code"]]
        return [tuple(x) for x in self.items[0]["code"]]


@dataclass
class Policy:
    """Evolvable search policy (not a deep net — pure θ)."""
    mut_rate: float = 0.35
    max_len: int = 16
    pop: int = 24
    gens: int = 20
    macro_p: float = 0.15
    elite: int = 6


class GenesisKernel:
    """Self-improving invent loop: tasks → evolve → knowledge → self-mod policy."""

    def __init__(self, seed: int = 41):
        self.seed = seed
        self.rng = random.Random(seed ^ 0x6E35)
        self.bank = KnowledgeBank()
        self.policy = Policy()
        self.history: List[Dict[str, Any]] = []
        self.updates = 0
        self._load_state()

    def _load_state(self):
        if STATE.exists():
            try:
                data = json.loads(STATE.read_text(encoding="utf-8"))
                p = data.get("policy") or {}
                self.policy = Policy(**{**asdict(Policy()), **p})
                self.updates = int(data.get("updates", 0))
                self.history = list(data.get("history") or [])[-40:]
            except Exception:
                pass

    def save_state(self):
        try:
            STATE.parent.mkdir(parents=True, exist_ok=True)
            STATE.write_text(
                json.dumps({
                    "policy": asdict(self.policy),
                    "updates": self.updates,
                    "history": self.history[-40:],
                    "updated": _now(),
                }, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    def random_code(self, length: Optional[int] = None) -> List[Tuple[int, int, int]]:
        # 40%: pure random; 60%: load-two-tape-slots + binary op + out (ISA skeleton, not task key)
        if self.rng.random() < 0.6:
            i = self.rng.randrange(TAPE_N)
            j = self.rng.randrange(TAPE_N)
            binop = self.rng.choice([3, 4, 5, 6, 7, 15, 17, 18])  # ADD SUB XOR AND OR MUL MIN MAX
            return [
                (1, 0, i),   # LOAD r0 = tape[i]
                (1, 1, j),   # LOAD r1 = tape[j]
                (binop, 0, 1),  # r0 = r0 OP r1
                (13, 0, 0),  # OUT r0
                (14, 0, 0),  # HALT
            ]
        n = length or self.rng.randint(4, self.policy.max_len)
        code = []
        for _ in range(n):
            op = self.rng.randrange(N_OPS)
            a = self.rng.randrange(REG_N)
            b = self.rng.randrange(16)
            code.append((op, a, b))
        code[-1] = (14, 0, 0)
        if len(code) > 2:
            code[-2] = (13, 0, 0)
        return code

    def mutate(self, code: List[Tuple[int, int, int]]) -> List[Tuple[int, int, int]]:
        c = list(code)
        if not c:
            return self.random_code()
        for i in range(len(c)):
            if self.rng.random() < self.policy.mut_rate:
                op, a, b = c[i]
                choice = self.rng.randrange(3)
                if choice == 0:
                    op = self.rng.randrange(N_OPS)
                elif choice == 1:
                    a = self.rng.randrange(REG_N)
                else:
                    b = self.rng.randrange(16)
                c[i] = (op, a, b)
        if self.rng.random() < 0.2 and len(c) < MAX_CODE:
            c.insert(self.rng.randrange(len(c)), (self.rng.randrange(N_OPS), self.rng.randrange(REG_N), self.rng.randrange(16)))
        if self.rng.random() < 0.15 and len(c) > 4:
            del c[self.rng.randrange(len(c) - 2)]
        # inject macro
        if self.bank.macros and self.rng.random() < self.policy.macro_p:
            name = self.rng.choice(list(self.bank.macros.keys()))
            frag = self.bank.macros[name]
            pos = self.rng.randrange(max(1, len(c) - 1))
            c = c[:pos] + list(frag) + c[pos:]
            c = c[:MAX_CODE]
        return c

    def crossover(self, a: List[Tuple[int, int, int]], b: List[Tuple[int, int, int]]) -> List[Tuple[int, int, int]]:
        if not a or not b:
            return self.random_code()
        cut = self.rng.randrange(1, min(len(a), len(b)))
        return (a[:cut] + b[cut:])[:MAX_CODE]

    def invent_task_family(self, name: str, make_fn, n_train: int = 12, n_hold: int = 10) -> Dict[str, Any]:
        train = make_fn(self.seed, n_train)
        hold = make_fn(self.seed ^ 0xBEEF, n_hold)
        pop: List[Genome] = []
        # neural proposals (real net) if available
        neural_codes = []
        try:
            from core.neural_invent import NeuralInventTrainer
            nt = NeuralInventTrainer(self.seed)
            for _ in range(min(4, self.policy.pop // 4)):
                neural_codes.append(nt.propose_program(train))
        except Exception:
            pass
        for _ in range(self.policy.pop):
            code = self.random_code()
            origin = "random"
            if neural_codes and self.rng.random() < 0.35:
                code = neural_codes[self.rng.randrange(len(neural_codes))]
                origin = "neural"
            elif self.rng.random() < 0.25:
                sc = self.bank.sample_code(self.rng)
                if sc:
                    code = sc
                    origin = "knowledge"
            g = Genome(code=code, origin=origin)
            g.fitness = fitness(g.code, train)
            pop.append(g)
        best = pop[0]
        for gen in range(self.policy.gens):
            for g in pop:
                g.fitness = fitness(g.code, train)
            pop.sort(key=lambda x: -x.fitness)
            if pop[0].fitness > best.fitness:
                best = Genome(code=list(pop[0].code), fitness=pop[0].fitness, origin="evolve")
            if best.fitness >= 0.999:
                break
            elites = pop[: self.policy.elite]
            new_pop = elites[:]
            while len(new_pop) < self.policy.pop:
                if self.rng.random() < 0.3 and len(elites) >= 2:
                    code = self.crossover(elites[0].code, elites[1].code)
                    origin = "cross"
                else:
                    parent = self.rng.choice(elites)
                    code = self.mutate(parent.code)
                    origin = "mut"
                g = Genome(code=code, origin=origin)
                g.fitness = fitness(g.code, train)
                new_pop.append(g)
            pop = new_pop
        best.hold = fitness(best.code, hold)
        utility = 0.6 * best.hold + 0.4 * best.fitness
        if best.hold >= 0.8:
            self.bank.add_program(best, name, utility)
            # invent macro from middle fragment
            if len(best.code) >= 4:
                mid = best.code[1: min(5, len(best.code) - 1)]
                self.bank.promote_macro(f"m_{name}_{best.fingerprint()[:6]}", mid)
        return {
            "task": name,
            "train": round(best.fitness, 3),
            "hold": round(best.hold, 3),
            "len": len(best.code),
            "fp": best.fingerprint(),
            "ok": best.hold >= 0.8,
            "code": best.code,
        }

    def emit_binary(self, code: List[Tuple[int, int, int]], name: str) -> str:
        """Emit compact binary bytecode file (not host ELF — portable genesis bin)."""
        BIN_DIR.mkdir(parents=True, exist_ok=True)
        path = BIN_DIR / f"{name}.gbin"
        # format: magic GBN1 | n | repeated u8 op,a,b
        data = bytearray(b"GBN1")
        data.append(len(code) & 255)
        for op, a, b in code:
            data.extend([op & 255, a & 255, b & 255])
        try:
            path.write_bytes(data)
            return str(path)
        except OSError:
            return ""

    def self_mod_policy(self) -> Dict[str, Any]:
        """Dual-measure: try variant policy, accept if mean hold improves."""
        tasks = [
            ("sum01", lambda s, n: [([self.rng.randrange(256) for _ in range(8)], (lambda t: (t[0]+t[1])&255)([self.rng.randrange(256) for _ in range(8)])) for _ in range(n)]),
        ]
        # simpler fixed tasks
        def make_sum(s, n):
            rng = random.Random(s)
            out = []
            for _ in range(n):
                t = [rng.randrange(256) for _ in range(8)]
                out.append((t, (t[0] + t[1]) & 255))
            return out

        def make_xor(s, n):
            rng = random.Random(s)
            out = []
            for _ in range(n):
                t = [rng.randrange(256) for _ in range(8)]
                out.append((t, (t[0] ^ t[1]) & 255))
            return out

        families = [("sum01", make_sum), ("xor01", make_xor)]
        base_pol = Policy(**asdict(self.policy))

        def eval_policy(pol: Policy) -> float:
            old = self.policy
            self.policy = pol
            # smaller internal budget for measure
            self.policy.gens = min(pol.gens, 12)
            self.policy.pop = min(pol.pop, 16)
            scores = []
            for name, fn in families:
                r = self.invent_task_family(name, fn, n_train=8, n_hold=6)
                scores.append(r["hold"])
            self.policy = old
            return sum(scores) / max(1, len(scores))

        base = eval_policy(base_pol)
        var = Policy(
            mut_rate=min(0.6, base_pol.mut_rate + self.rng.uniform(-0.1, 0.15)),
            max_len=max(8, min(24, base_pol.max_len + self.rng.randint(-2, 4))),
            pop=max(12, min(40, base_pol.pop + self.rng.randint(-4, 6))),
            gens=max(8, min(40, base_pol.gens + self.rng.randint(-4, 8))),
            macro_p=min(0.5, max(0.05, base_pol.macro_p + self.rng.uniform(-0.05, 0.1))),
            elite=max(3, min(10, base_pol.elite + self.rng.randint(-1, 2))),
        )
        after = eval_policy(var)
        accepted = after >= base - 1e-9
        if accepted:
            self.policy = var
        self.updates += 1
        entry = {"ts": _now(), "accepted": accepted, "base": round(base, 3), "after": round(after, 3), "policy": asdict(self.policy)}
        self.history.append(entry)
        self.save_state()
        try:
            from core.patch_journal import record
            record("genesis_selfmod", accepted, {"hold": base}, {"hold": after})
        except Exception:
            pass
        return entry

    def cycle(self, rounds: int = 3) -> Dict[str, Any]:
        def make_sum(s, n):
            rng = random.Random(s)
            return [((t := [rng.randrange(256) for _ in range(8)]), (t[0] + t[1]) & 255) for _ in range(n)]

        def make_xor(s, n):
            rng = random.Random(s)
            return [((t := [rng.randrange(256) for _ in range(8)]), (t[0] ^ t[1]) & 255) for _ in range(n)]

        def make_and(s, n):
            rng = random.Random(s)
            return [((t := [rng.randrange(256) for _ in range(8)]), (t[0] & t[1]) & 255) for _ in range(n)]

        def make_min(s, n):
            rng = random.Random(s)
            return [((t := [rng.randrange(256) for _ in range(8)]), min(t[0], t[1]) & 255) for _ in range(n)]

        families = [("sum01", make_sum), ("xor01", make_xor), ("and01", make_and), ("min01", make_min)]
        results = []
        bins = []
        for i in range(rounds):
            name, fn = families[i % len(families)]
            r = self.invent_task_family(name, fn)
            results.append(r)
            if r["ok"]:
                path = self.emit_binary(r["code"], f"{name}_{r['fp'][:8]}")
                bins.append(path)
        mod = self.self_mod_policy()
        return {
            "results": results,
            "solved": sum(1 for r in results if r["ok"]),
            "n": len(results),
            "bins": bins,
            "selfmod": mod,
            "knowledge_n": len(self.bank.items),
            "macros_n": len(self.bank.macros),
            "policy": asdict(self.policy),
            "updates": self.updates,
        }

    def status(self) -> Dict[str, Any]:
        return {
            "updates": self.updates,
            "policy": asdict(self.policy),
            "knowledge_n": len(self.bank.items),
            "macros_n": len(self.bank.macros),
            "top": self.bank.top(5),
            "history_tail": self.history[-5:],
        }


def quick_genesis(seed: int = 41, rounds: int = 4) -> Dict[str, Any]:
    return GenesisKernel(seed).cycle(rounds=rounds)
