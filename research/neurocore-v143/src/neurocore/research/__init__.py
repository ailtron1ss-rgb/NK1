"""Research-only reference implementations and opt-in candidates; never canonical runtime owners."""

from .replay_influence import ReplayInfluenceConfig, cosine_loss_output_gradient, replay_gradient_alignment
from .product_key_sparse_memory_reference import ProductKeyMemoryConfig, ProductKeySparseMemory, ProductKeySparseDeltaMemory
from .fwpkm_candidate import FwPKMConfig, FastWeightProductKeyMemoryCandidate
from .fwpkm_language_bridge import FwPKMLanguageBridgeConfig, FwPKMLanguageBridge

from .byte_patch_planner import BytePatchPlan, EntropyPatchPlanner
from .ttt_ntp_candidate import TTTNTPConfig, TTTNTPWrite

__all__ = [
    "ReplayInfluenceConfig", "cosine_loss_output_gradient", "replay_gradient_alignment",
    "ProductKeyMemoryConfig", "ProductKeySparseMemory", "ProductKeySparseDeltaMemory",
    "FwPKMConfig", "FastWeightProductKeyMemoryCandidate",
    "FwPKMLanguageBridgeConfig", "FwPKMLanguageBridge",
    "BytePatchPlan", "EntropyPatchPlanner", "TTTNTPConfig", "TTTNTPWrite",
]
