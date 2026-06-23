"""
Mixture of Experts (MoE) Layer with Expert Parallelism.

Implements:
- Top-k routing with noisy top-k, expert choice, differentiable routing
- Expert parallelism (EP) with all-to-all communication
- Capacity factor tuning with dynamic load balancing
- Integration with compression engine for expert gradient sync
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.distributed as dist
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, List, Literal
import math

from omnigent.configs.moe_config import MoEConfig
from omnigent.distributed.compression import GradientCompressionEngine, CompressionConfig, CompressionType