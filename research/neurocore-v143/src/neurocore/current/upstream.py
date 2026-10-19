from __future__ import annotations

"""Source-backed neural backend registry.

External implementations are optional research backends. NeuroCore owns the canonical
state/memory contracts; upstream packages own their internal neural operator math.
No fallback is performed: an unavailable or incompatible backend remains unavailable.
"""

from dataclasses import asdict, dataclass
import importlib
import importlib.util
import inspect
from typing import Any, Iterable


@dataclass(frozen=True)
class UpstreamBackendSpec:
    key: str
    family: str
    purpose: str
    source_url: str
    license_name: str
    import_target: str | None = None
    package_name: str | None = None
    status: str = "candidate"  # candidate | integrated | rejected | research_only
    current_safe: bool = False
    notes: str = ""

    def availability(self) -> dict[str, Any]:
        if not self.import_target:
            return {
                "available": False,
                "reason": "source upload/vendor required",
                "module": None,
                "top_level": None,
            }
        module_name = self.import_target.split(":", 1)[0]
        top_level = module_name.split(".", 1)[0]
        try:
            # Prefer the complete module path. Some packages have import-time package
            # initialisation that raises ModuleNotFoundError; that still means unavailable.
            found = importlib.util.find_spec(module_name) is not None
        except (ImportError, ModuleNotFoundError, AttributeError):
            found = False
        result = {"available": bool(found), "module": module_name, "top_level": top_level}
        if found:
            result["resolution"] = self.resolve_symbol()
        return result

    def resolve_symbol(self) -> dict[str, Any]:
        """Resolve an explicitly catalogued symbol without providing a fallback implementation."""
        if not self.import_target:
            return {"resolved": False, "reason": "no import target; reference-only catalog entry"}
        module_name, _, symbol = self.import_target.partition(":")
        if not symbol:
            return {"resolved": False, "reason": f"invalid import target: {self.import_target}"}
        try:
            module = importlib.import_module(module_name)
            obj = getattr(module, symbol)
        except Exception as exc:
            return {
                "resolved": False,
                "reason": f"{type(exc).__name__}: {exc}",
                "module": module_name,
                "symbol": symbol,
            }
        return {
            "resolved": True,
            "module": module_name,
            "symbol": symbol,
            "qualified_name": getattr(obj, "__qualname__", symbol),
        }

    def source_record(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "family": self.family,
            "purpose": self.purpose,
            "source_url": self.source_url,
            "license": self.license_name,
            "package": self.package_name,
            "import_target": self.import_target,
            "status": self.status,
            "current_safe": self.current_safe,
            "notes": self.notes,
        }


_FLA = "https://github.com/fla-org/flash-linear-attention"
_FLA_LICENSE = "MIT"


def _fla(key: str, class_name: str, family: str, purpose: str, *, notes: str = "") -> UpstreamBackendSpec:
    return UpstreamBackendSpec(
        key=f"fla.{key}",
        family=family,
        purpose=purpose,
        source_url=_FLA,
        license_name=_FLA_LICENSE,
        import_target=f"fla.layers:{class_name}",
        package_name="flash-linear-attention",
        notes=notes,
    )


class UpstreamBackendCatalog:
    """Explicit inventory of external neural implementations.

    Metadata is import-safe. Third-party modules are resolved only when a benchmark or
    caller explicitly requests a backend.
    """

    def __init__(self, specs: Iterable[UpstreamBackendSpec] = ()) -> None:
        self._specs = {spec.key: spec for spec in specs}

    @classmethod
    def default(cls) -> "UpstreamBackendCatalog":
        specs = [
            _fla("delta_net", "DeltaNet", "linear_recurrence", "Delta-rule fast-weight baseline"),
            _fla("gdn", "GatedDeltaNet", "linear_recurrence", "Gated DeltaNet recurrence"),
            _fla("gdn2", "GatedDeltaNet2", "linear_recurrence", "Gated DeltaNet-2 with decoupled erase/write", notes="Current FLA implementation; official NVIDIA reference is tracked separately."),
            _fla("gated_delta_product", "GatedDeltaProduct", "linear_recurrence", "Higher-order gated delta-product recurrence"),
            _fla("kda", "KimiDeltaAttention", "linear_recurrence", "Kimi Delta Attention / channel-wise decay"),
            _fla("pgdn", "PrecondGatedDeltaNet", "linear_recurrence", "Curvature-aware preconditioned Gated DeltaNet"),
            _fla("pkda", "PrecondKDA", "linear_recurrence", "Curvature-aware preconditioned KDA"),
            _fla("raven", "Raven", "linear_recurrence", "Sparse routed recurrent memory"),
            _fla("momentum_deltanet", "MomentumDeltaNet", "linear_recurrence", "Momentum-enhanced delta recurrence"),
            _fla("gla", "GatedLinearAttention", "linear_recurrence", "Gated linear attention recurrence"),
            _fla("gsa", "GatedSlotAttention", "memory", "Gated slot-based associative state"),
            _fla("hgrn", "HGRNAttention", "hierarchical_sequence", "Hierarchical gated recurrent sequence mixing"),
            _fla("hgrn2", "HGRN2Attention", "hierarchical_sequence", "Second-generation hierarchical recurrent sequence mixing"),
            _fla("linear", "LinearAttention", "attention", "Linear attention baseline"),
            _fla("based", "BasedLinearAttention", "attention", "Based linear attention"),
            _fla("rebased", "ReBasedLinearAttention", "attention", "ReBased linear attention"),
            _fla("forgetting", "ForgettingAttention", "attention", "Forgetting-gated attention"),
            _fla("multiscale_retention", "MultiScaleRetention", "memory", "Multi-scale retention state"),
            _fla("mamba", "Mamba", "state_space", "Mamba selective state space"),
            _fla("mamba2", "Mamba2", "state_space", "Mamba-2 structured state-space sequence model"),
            _fla("mamba3", "Mamba3", "state_space", "Mamba-3 state-space sequence model", notes="Evaluate separately from mobile CPU path; optimized kernels may be accelerator-specific."),
            _fla("log_linear_mamba2", "LogLinearMamba2", "state_space", "Log-linear Mamba-2 sequence model"),
            _fla("mesa", "MesaNet", "state_space", "Mesa-style learned state-space sequence model"),
            _fla("mom", "MomAttention", "memory", "Mixture-of-Memories routed memory", notes="May only become internal sub-banks under the canonical memory owner; never a second owner."),
            _fla("deltaformer", "DeltaFormerAttention", "linear_recurrence", "DeltaFormer associative-memory formulation"),
            _fla("wall", "WallAttention", "attention", "Diagonal-gate length-generalizing attention"),
            _fla("parallax", "Parallax", "attention", "Parameterized local linear attention"),
            UpstreamBackendSpec(
                "fla.cat", "meta_sequence", "Compress-and-Attend meta-sequence mixer", _FLA, "MIT", None,
                "flash-linear-attention", notes="CAT is tracked as an upstream paper/model; no public fla.layers class is assumed by the adapter."
            ),
            _fla("moba", "MoBA", "attention", "Mixture-of-Block Attention"),
            _fla("nsa", "NativeSparseAttention", "attention", "Native sparse attention"),
            _fla("path", "PaTHAttention", "attention", "Path-based attention"),
            _fla("rodimus", "RodimusAttention", "attention", "Rodimus sequence attention"),
            _fla("rwkv6", "RWKV6Attention", "state_space", "RWKV-6 recurrent attention"),
            _fla("rwkv7", "RWKV7Attention", "state_space", "RWKV-7 recurrent attention"),
            _fla("lightnet", "LightNetAttention", "attention", "LightNet efficient attention"),
            _fla("comba", "Comba", "linear_recurrence", "Comba recurrent operator"),
            _fla("abc", "ABCAttention", "memory", "ABC associative memory attention"),
            _fla("bit", "BitAttention", "attention", "Bit attention candidate"),
            _fla("attention", "Attention", "attention", "Standard attention baseline"),
            _fla("mla", "MultiheadLatentAttention", "attention", "Multihead latent attention"),
            _fla("sliding_window_shared_key", "SlidingWindowSharedKeyAttention", "attention", "Sliding-window shared-key attention"),
            _fla("yoco_cross", "YOCOCrossAttention", "attention", "YOCO cross-attention component"),
            _fla("yoco_retention", "YOCOGatedRetention", "linear_recurrence", "YOCO gated retention"),
            _fla("yoco_shared_kv", "YOCOSharedKVBuilder", "attention", "YOCO shared-KV builder"),
            UpstreamBackendSpec(
                "fla.flashqla", "linear_recurrence", "FlashQLA backend for Gated DeltaNet", _FLA, "MIT", None,
                "flash-linear-attention", notes="Tracked from current FLA news; not assumed to be a public layer class."
            ),
            UpstreamBackendSpec(
                "fla.gluon", "attention", "AttnRes/Gluon residual sequence mechanism", _FLA, "MIT", None,
                "flash-linear-attention", notes="Catalog only; not assumed to be a stable fla.layers export."
            ),
            UpstreamBackendSpec(
                "mamba3_ssm", "state_space", "Readable pure-PyTorch Mamba-3",
                "https://github.com/Aiyoniganmaaiya/mamba3-ssm", "MIT",
                "mamba3_ssm:Mamba3", "mamba3-ssm",
                notes="Portable research reference; verify source locally before promotion.",
            ),
            UpstreamBackendSpec(
                "mamba_official", "state_space", "Official state-spaces Mamba-3",
                "https://github.com/state-spaces/mamba", "Apache-2.0",
                "mamba_ssm:Mamba3", "mamba-ssm",
                status="research_only",
                notes="Full optimized path is accelerator-oriented; upstream currently has open Mamba-3 step/incremental issues worth qualifying before use.",
            ),
            UpstreamBackendSpec(
                "delta_product", "linear_recurrence", "DeltaProduct state transition",
                "https://github.com/automl/DeltaProduct", "MIT", None, "delta-product",
            ),
            UpstreamBackendSpec(
                "hnet", "hierarchical_sequence", "Dynamic hierarchical token/chunk processing",
                "https://github.com/goombalab/hnet", "MIT", None, "hnet",
                notes="Candidate for adaptive temporal abstraction, not a memory owner.",
            ),
            UpstreamBackendSpec(
                "atlas_torch", "memory", "ATLAS-style learned long-term memory",
                "https://github.com/danielquintas8/atlas-torch", "MIT", None, "atlas-torch",
                status="research_only", current_safe=False,
                notes="Needs isolated test-time learning qualification and memory ownership review.",
            ),
            UpstreamBackendSpec(
                "titans_pytorch", "memory", "Titans-style neural long-term memory",
                "https://github.com/lucidrains/titans-pytorch", "MIT", None, "titans-pytorch",
                status="research_only", current_safe=False,
                notes="Unofficial implementation; isolate and qualify before reuse.",
            ),
            UpstreamBackendSpec(
                "nvidia_gdn2", "linear_recurrence", "Official NVIDIA GDN-2 reference",
                "https://github.com/NVlabs/GatedDeltaNet-2", "NVIDIA Source Code License-NC", None, None,
                status="research_only", current_safe=False,
                notes="Reference only. Keep outside production/current tree and preserve upstream license terms.",
            ),
        ]
        return cls(specs)

    def specs(self) -> tuple[UpstreamBackendSpec, ...]:
        return tuple(self._specs.values())

    def get(self, key: str) -> UpstreamBackendSpec:
        return self._specs[key]

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return {
            key: {**asdict(spec), "availability": spec.availability()}
            for key, spec in self._specs.items()
        }

    def available(self) -> tuple[str, ...]:
        return tuple(key for key, spec in self._specs.items() if spec.availability()["available"])

    def candidates(self, *, family: str | None = None) -> tuple[UpstreamBackendSpec, ...]:
        return tuple(
            spec for spec in self._specs.values()
            if spec.status == "candidate" and (family is None or spec.family == family)
        )


def _resolve_target(target: str):
    module_name, attr_name = target.split(":", 1)
    module = importlib.import_module(module_name)
    return getattr(module, attr_name)


def inspect_constructor(catalog: UpstreamBackendCatalog, key: str) -> dict[str, Any]:
    """Inspect an upstream constructor without instantiating it."""
    spec = catalog.get(key)
    if not spec.import_target:
        return {"available": False, "reason": "no import target"}
    try:
        cls = _resolve_target(spec.import_target)
        try:
            sig = inspect.signature(cls)
            params = list(sig.parameters.values())
        except (TypeError, ValueError):
            sig = None
            params = []
        return {
            "available": True,
            "class": getattr(cls, "__name__", str(cls)),
            "signature": str(sig) if sig is not None else None,
            "parameters": [p.name for p in params],
        }
    except Exception as exc:  # inspection only; benchmark reports exact error
        return {"available": False, "reason": f"{type(exc).__name__}: {exc}"}


def make_upstream_backend(catalog: UpstreamBackendCatalog, key: str, **kwargs: Any) -> Any:
    """Instantiate exactly the requested upstream implementation; never silently fallback."""
    spec = catalog.get(key)
    if spec.status == "research_only":
        raise PermissionError(f"upstream backend is research-only: {key}")
    if not spec.import_target:
        raise ImportError(
            f"upstream source for {key} is catalogued but not installed/importable; "
            f"vendor the source or install the documented package from {spec.source_url}"
        )
    try:
        cls = _resolve_target(spec.import_target)
    except (ImportError, AttributeError) as exc:
        raise ImportError(
            f"cannot import requested upstream backend {key} from {spec.import_target}: {exc}"
        ) from exc
    return cls(**kwargs)
