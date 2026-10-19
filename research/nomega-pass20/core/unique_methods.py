"""Unique invent methods — not standard GA/ES clones.

1. ScarSearch       — structure-scar memory: penalize failed fingerprints
2. EchoFitness      — robustness under tape echo/permutation transforms
3. TaskForge        — adversarial task invention from solved programs
4. ContrastiveGate  — accept only if program fails on wrong-kind tasks
5. MacroAlchemy     — distill cross-kind instruction macros
6. CrossChannel     — neural proposals + scar-guided genesis hybrid
7. ResidualBlank    — residual search after neural prior (true invent remainder)

All methods are executable and measured — no decorative stubs.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple, Set
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
import json, random, hashlib

ROOT = Path(__file__).resolve().parents[1]
SCAR_PATH = ROOT / "runtime" / "structure_scars.json"
MACRO_PATH = ROOT / "runtime" / "alchemy_macros.json"

Expr = Any
Code = List[Tuple[int, int, int]]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fp(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()[:16]


# ─── 1. ScarSearch ───────────────────────────────────────────

class ScarMemory:
    """Remember failing program structure hashes; penalize repeats."""

    def __init__(self):
        self.scars: Dict[str, int] = {}  # fp -> fail_count
        self.wins: Dict[str, int] = {}
        self._load()

    def _load(self):
        if SCAR_PATH.exists():
            try:
                data = json.loads(SCAR_PATH.read_text(encoding="utf-8"))
                self.scars = {k: int(v) for k, v in (data.get("scars") or {}).items()}
                self.wins = {k: int(v) for k, v in (data.get("wins") or {}).items()}
            except Exception:
                pass

    def save(self):
        try:
            SCAR_PATH.parent.mkdir(parents=True, exist_ok=True)
            SCAR_PATH.write_text(
                json.dumps({"scars": self.scars, "wins": self.wins, "updated": _now()}, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    def code_fp(self, code: Code) -> str:
        # structure only: ops sequence, ignore exact regs somewhat
        ops = [c[0] for c in code]
        return _fp(ops)

    def penalty(self, code: Code) -> float:
        fp = self.code_fp(code)
        fails = self.scars.get(fp, 0)
        wins = self.wins.get(fp, 0)
        if fails == 0:
            return 0.0
        # more fails -> higher penalty, mitigated by wins
        return min(0.5, 0.08 * fails / (1 + wins))

    def record(self, code: Code, success: bool):
        fp = self.code_fp(code)
        if success:
            self.wins[fp] = self.wins.get(fp, 0) + 1
            if fp in self.scars and self.wins[fp] >= 3:
                self.scars[fp] = max(0, self.scars[fp] - 1)
        else:
            self.scars[fp] = self.scars.get(fp, 0) + 1
        self.save()

    def adjusted_fitness(self, raw: float, code: Code) -> float:
        return max(0.0, raw - self.penalty(code))


# ─── 2. EchoFitness ──────────────────────────────────────────

def echo_transform(tape: List[int], mode: str, rng: random.Random) -> List[int]:
    t = list(tape)
    if mode == "shift":
        k = rng.randint(1, 3)
        return t[k:] + t[:k]
    if mode == "mirror":
        return t[::-1]
    if mode == "noise":
        out = t[:]
        i = rng.randrange(len(out))
        out[i] = (out[i] + rng.choice([-1, 1, 2, -2])) & 255
        return out
    if mode == "swap01":
        out = t[:]
        out[0], out[1] = out[1], out[0]
        return out
    return t


def echo_fitness(code: Code, tasks: List[Tuple[List[int], int]], modes: Optional[List[str]] = None) -> Dict[str, float]:
    """Primary fitness + echo robustness (unique vs plain hold)."""
    from core.genesis_kernel import fitness, TinyVM

    modes = modes or ["shift", "mirror", "noise"]
    primary = fitness(code, tasks)
    vm = TinyVM()
    rng = random.Random(hash(tuple(code[0])) if code else 0)
    echo_scores = []
    for mode in modes:
        ok = 0
        for tape, y in tasks:
            # only meaningful for tasks invariant to transform — use noise always
            # for shift/mirror: recompute y only if we know kind; here use noise + swap on inputs
            # with same y (tests brittle memorization of absolute tape slots for slot-dependent ops)
            if mode in ("noise",):
                tt = echo_transform(tape, mode, rng)
                try:
                    if vm.run(code, tt) == (y & 255):
                        ok += 1
                except Exception:
                    pass
            elif mode == "swap01":
                # for sum/xor etc y may change — recompute if op is commutative check via both
                tt = echo_transform(tape, mode, rng)
                try:
                    pred = vm.run(code, tt)
                    # accept if pred matches either original y or swapped-input semantics unknown
                    # stricter: only count if program still outputs original y (slot-sensitive fail)
                    if pred == (y & 255):
                        ok += 1
                except Exception:
                    pass
            else:
                tt = echo_transform(tape, mode, rng)
                try:
                    if vm.run(code, tt) == (y & 255):
                        ok += 1
                except Exception:
                    pass
        echo_scores.append(ok / max(1, len(tasks)))
    echo_mean = sum(echo_scores) / max(1, len(echo_scores))
    # combined: prefer primary, boost echo
    combined = 0.65 * primary + 0.35 * echo_mean
    return {"primary": round(primary, 3), "echo": round(echo_mean, 3), "combined": round(combined, 3)}


# ─── 3. TaskForge ────────────────────────────────────────────

def task_forge(
    code: Code,
    base_tasks: List[Tuple[List[int], int]],
    n_new: int = 10,
    seed: int = 0,
) -> List[Tuple[List[int], int]]:
    """Invent harder tasks near the decision boundary of a solved program."""
    from core.genesis_kernel import TinyVM

    vm = TinyVM()
    rng = random.Random(seed ^ 0xF0E6)
    hard: List[Tuple[List[int], int]] = []
    # boundary: flip bits until output changes, keep last stable
    for tape, y in base_tasks:
        for _ in range(max(1, n_new // max(1, len(base_tasks)))):
            t = list(tape)
            for trial in range(12):
                i = rng.randrange(8)
                old = t[i]
                t[i] = rng.randrange(256)
                pred = vm.run(code, t)
                if pred != y:
                    # one step back toward boundary
                    t[i] = old
                    t[i] = (old + rng.choice([1, -1, 8, -8, 16])) & 255
                    y2 = vm.run(code, t)
                    hard.append((t[:], y2))
                    break
            else:
                hard.append((t[:], vm.run(code, t)))
    rng.shuffle(hard)
    return hard[:n_new]


# ─── 4. ContrastiveGate ──────────────────────────────────────

def contrastive_gate(
    code: Code,
    own_tasks: List[Tuple[List[int], int]],
    foreign_tasks: List[Tuple[List[int], int]],
    own_min: float = 0.85,
    foreign_max: float = 0.55,
) -> Dict[str, Any]:
    """Accept only if strong on own tasks and weak on foreign (anti-generic constant)."""
    from core.genesis_kernel import fitness

    own = fitness(code, own_tasks)
    foreign = fitness(code, foreign_tasks)
    accepted = own >= own_min and foreign <= foreign_max
    return {
        "own": round(own, 3),
        "foreign": round(foreign, 3),
        "accepted": accepted,
        "margin": round(own - foreign, 3),
    }


# ─── 5. MacroAlchemy ─────────────────────────────────────────

class MacroAlchemy:
    """Distill shared instruction fragments across successful multi-kind programs."""

    def __init__(self):
        self.macros: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self):
        if MACRO_PATH.exists():
            try:
                self.macros = json.loads(MACRO_PATH.read_text(encoding="utf-8")).get("macros") or {}
            except Exception:
                pass

    def save(self):
        try:
            MACRO_PATH.parent.mkdir(parents=True, exist_ok=True)
            MACRO_PATH.write_text(
                json.dumps({"macros": self.macros, "updated": _now()}, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    def distill(self, programs: List[Tuple[str, Code]], min_support: int = 2) -> List[Dict[str, Any]]:
        frag_count: Dict[str, int] = defaultdict(int)
        frag_body: Dict[str, Code] = {}
        for kind, code in programs:
            for i in range(len(code)):
                for L in (2, 3):
                    if i + L <= len(code):
                        frag = code[i : i + L]
                        key = _fp([(c[0], c[1]) for c in frag])  # op+a
                        frag_count[key] += 1
                        frag_body[key] = frag
        invented = []
        for key, cnt in frag_count.items():
            if cnt >= min_support:
                name = f"alch_{key[:8]}"
                self.macros[name] = {
                    "code": [list(x) for x in frag_body[key]],
                    "support": cnt,
                    "ts": _now(),
                }
                invented.append({"name": name, "support": cnt, "len": len(frag_body[key])})
        self.save()
        invented.sort(key=lambda x: -x["support"])
        return invented

    def inject(self, code: Code, rng: random.Random) -> Code:
        if not self.macros:
            return code
        name = rng.choice(list(self.macros.keys()))
        frag = [tuple(x) for x in self.macros[name]["code"]]
        if not code:
            return frag
        pos = rng.randrange(len(code))
        return (code[:pos] + frag + code[pos:])[:32]


# ─── 6. CrossChannel hybrid ──────────────────────────────────

def cross_channel_invent(
    kind: str,
    seed: int = 41,
    pop: int = 20,
    gens: int = 15,
) -> Dict[str, Any]:
    """Neural proposals + scar-adjusted GA on Genesis VM."""
    from core.genesis_kernel import fitness, TinyVM, Genome
    from core.neural_invent import NeuralInventTrainer, _y_for

    rng = random.Random(seed ^ hash(kind) & 0xFFFF)
    scars = ScarMemory()
    alchemy = MacroAlchemy()

    def gen_tasks(n, s):
        r = random.Random(s)
        out = []
        for _ in range(n):
            tape = [r.randrange(256) for _ in range(8)]
            out.append((tape, _y_for(kind, tape)))
        return out

    train, hold = gen_tasks(12, seed), gen_tasks(12, seed ^ 0xBEEF)
    foreign = gen_tasks(12, seed ^ 0xDEAD)
    # foreign kind shift
    foreign = [(t, _y_for("xor" if kind != "xor" else "sum", t)) for t, _ in foreign]

    population: List[Code] = []
    try:
        nt = NeuralInventTrainer(seed)
        for c in nt.propose_topk(train, k=6, temperature=0.8):
            population.append(c)
        population.append(nt.propose_program(train))
    except Exception:
        pass
    while len(population) < pop:
        # random short load-op-out
        i, j = rng.randrange(8), rng.randrange(8)
        bop = rng.choice([3, 4, 5, 6, 7, 15, 17, 18])
        code = [(1, 0, i), (1, 1, j), (bop, 0, 1), (13, 0, 0), (14, 0, 0)]
        code = alchemy.inject(code, rng)
        population.append(code)

    best = {"hold": -1.0, "code": population[0], "train": 0.0, "echo": {}, "contrast": {}}
    for g in range(gens):
        scored = []
        for code in population:
            raw = fitness(code, train)
            adj = scars.adjusted_fitness(raw, code)
            scored.append((adj, raw, code))
        scored.sort(key=lambda x: -x[0])
        elite = [c for _, _, c in scored[:6]]
        # evaluate best on hold + echo + contrast
        cand = scored[0][2]
        ho = fitness(cand, hold)
        echo = echo_fitness(cand, hold)
        contrast = contrastive_gate(cand, hold, foreign)
        scars.record(cand, success=ho >= 0.85 and contrast["accepted"])
        if ho > best["hold"]:
            best = {
                "hold": ho,
                "train": scored[0][1],
                "code": cand,
                "echo": echo,
                "contrast": contrast,
            }
        if best["hold"] >= 0.99 and contrast["accepted"]:
            break
        # next gen
        new_pop = elite[:]
        while len(new_pop) < pop:
            parent = rng.choice(elite)
            child = list(parent)
            if rng.random() < 0.5 and len(child) > 2:
                idx = rng.randrange(len(child) - 1)
                op, a, b = child[idx]
                child[idx] = (rng.randrange(20), a, b) if rng.random() < 0.5 else (op, rng.randrange(4), b)
            child = alchemy.inject(child, rng)
            new_pop.append(child)
        population = new_pop

    ok = best["hold"] >= 0.85
    if ok:
        alchemy.distill([(kind, best["code"])], min_support=1)
    return {
        "method": "cross_channel",
        "kind": kind,
        "hold": round(best["hold"], 3),
        "train": round(best["train"], 3),
        "echo": best["echo"],
        "contrast": best["contrast"],
        "ok": ok,
        "scars": len(scars.scars),
        "macros": len(alchemy.macros),
    }


# ─── 7. ResidualBlank ────────────────────────────────────────

def residual_after_neural(seed: int = 41) -> Dict[str, Any]:
    """Run neural cycle; residual kinds go to scar-cross search."""
    from core.neural_invent import NeuralInventTrainer, KINDS

    tr = NeuralInventTrainer(seed)
    cycle = tr.neural_invent_cycle(len(KINDS))
    residual = [r["kind"] for r in cycle["results"] if not r["ok"]]
    extras = []
    for kind in residual or ["mul"]:  # always stress-test one channel
        extras.append(cross_channel_invent(kind, seed=seed, pop=16, gens=12))
    return {
        "method": "residual_blank",
        "neural_rate": cycle["rate"],
        "neural_solved": cycle["solved"],
        "residual_kinds": residual,
        "residual_results": extras,
        "residual_ok": sum(1 for e in extras if e.get("ok")),
    }


def run_all_unique(seed: int = 41) -> Dict[str, Any]:
    """Execute full unique-method suite with real metrics."""
    from core.neural_invent import NeuralInventTrainer, _y_for, KINDS
    from core.genesis_kernel import fitness

    rng = random.Random(seed)
    report: Dict[str, Any] = {"seed": seed, "ts": _now(), "methods": {}}

    # Scar + echo demo on neural program
    tr = NeuralInventTrainer(seed)
    kind = "sum"
    train = [([rng.randrange(256) for _ in range(8)], 0) for _ in range(8)]
    train = []
    r = random.Random(seed)
    for _ in range(10):
        tape = [r.randrange(256) for _ in range(8)]
        train.append((tape, _y_for(kind, tape)))
    code = tr.propose_program(train)
    scars = ScarMemory()
    raw = fitness(code, train)
    adj = scars.adjusted_fitness(raw, code)
    echo = echo_fitness(code, train)
    report["methods"]["scar_echo"] = {
        "raw": round(raw, 3),
        "adj": round(adj, 3),
        "echo": echo,
        "scar_penalty": round(raw - adj, 3),
    }

    # TaskForge
    forged = task_forge(code, train, n_new=8, seed=seed)
    report["methods"]["task_forge"] = {
        "n": len(forged),
        "sample_y": [y for _, y in forged[:3]],
        "fit_on_forged": round(fitness(code, forged), 3),
    }

    # Contrastive
    foreign = []
    for _ in range(10):
        tape = [r.randrange(256) for _ in range(8)]
        foreign.append((tape, _y_for("xor", tape)))
    report["methods"]["contrastive"] = contrastive_gate(code, train, foreign)

    # MacroAlchemy distill from cycle successes
    cyc = tr.neural_invent_cycle(8)
    progs = []
    for row in cyc["results"]:
        if row["ok"]:
            # re-propose for body
            kt = row["kind"]
            trn = []
            rr = random.Random(hash(kt) & 0xFFFF)
            for _ in range(6):
                tape = [rr.randrange(256) for _ in range(8)]
                trn.append((tape, _y_for(kt, tape)))
            progs.append((kt, tr.propose_program(trn)))
    alch = MacroAlchemy()
    invented = alch.distill(progs, min_support=2)
    report["methods"]["macro_alchemy"] = {"invented": invented[:8], "n_macros": len(alch.macros)}

    # CrossChannel on one kind
    report["methods"]["cross_channel"] = cross_channel_invent("or", seed=seed, pop=14, gens=10)

    # Residual suite
    report["methods"]["residual"] = residual_after_neural(seed)

    report["summary"] = {
        "neural_cycle": cyc["rate"],
        "contrast_accepted": report["methods"]["contrastive"]["accepted"],
        "cross_ok": report["methods"]["cross_channel"]["ok"],
        "macros": report["methods"]["macro_alchemy"]["n_macros"],
        "echo_combined": echo["combined"],
    }
    return report
