"""
Omnigent Models Package
Softmax_τ attention + supporting components.
"""

from .tau_attention import (
    TauAttention,
    TauTransformerBlock,
    TorsionComputer,
    HomotopyLoss,
    HopfLoss,
)

__all__ = [
    "TauAttention",
    "TauTransformerBlock",
    "TorsionComputer",
    "HomotopyLoss",
    "HopfLoss",
]
