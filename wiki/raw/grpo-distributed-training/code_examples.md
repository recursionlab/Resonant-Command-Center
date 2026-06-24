# GRPO Research — Code Examples

## File: grpo_core.py
## Complete GRPO + FGRPO implementation for Omnigent integration

```python
"""
GRPO Core Implementation for Omnigent
======================================
Production-ready GRPO trainer with:
- Group baseline computation (U-statistics)
- Distributed group baseline aggregation
- FGRPO federated extension
- Integration with Omnient compression pipeline
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.distributed as dist
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum
import math


# ─── Configuration ───

@dataclass
class GRPOConfig:
    """Group Relative Policy Optimization configuration."""
    group_size: int = 16
    clip_epsilon: float = 0.2
    kl_penalty: float = 0.001
    learning_rate: float = 1e-6
    max_new_tokens: int = 1024
    temperature: float = 0.7
    advantage_normalization: bool = True
    max_grad_norm: float = 1.0
    group_baseline_type: str = "mean"  # "mean", "median", "trimmed_mean"
    adaptive_group_size: bool = False
    min_group_size: int = 4
    max_group_size: int = 128


@dataclass
class FGRPOConfig:
    """Federated GRPO configuration."""
    group_size: int = 16
    num_clients: int = 10
    local_epochs: int = 3
    clip_epsilon: float = 0.2
    adaptive_aggregation: bool = True
    global_baseline_smoothing: float = 0.9  # EMA for global baseline


# ─── Core Loss ───

class GRPOLoss(nn.Module):
    """
    GRPO Loss — replaces PPO's critic with group baseline.
    
    Mathematical formulation:
        L = -E[min(r(θ)·Â, clip(r(θ), 1-ε, 1+ε)·Â)]
        where Â_i = (R_i - mean(R_g)) / std(R_g)
    """
    
    def __init__(self, config: GRPOConfig):
        super().__init__()
        self.config = config
    
    def forward(
        self,
        log_probs: torch.Tensor,
        old_log_probs: torch.Tensor,
        rewards: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        
        # Compute group baseline (U-statistic)
        advantages = self._compute_advantages(rewards)
        
        # Importance ratio
        log_ratio = log_probs - old_log_probs
        ratio = torch.exp(log_ratio)
        
        # Clipped surrogate
        surr1 = ratio * advantages
        surr2 = torch.clamp(
            ratio,
            1 - self.config.clip_epsilon,
            1 + self.config.clip_epsilon
        ) * advantages
        policy_loss = -torch.min(surr1, surr2)
        
        if attention_mask is not None:
            policy_loss = (policy_loss * attention_mask).sum() / attention_mask.sum()
        else:
            policy_loss = policy_loss.mean()
        
        # KL penalty
        kl = (old_log_probs - log_probs).exp() * (old_log_probs - log_probs)
        if attention_mask is not None:
            kl = (kl * attention_mask).sum() / attention_mask.sum()
        else:
            kl = kl.mean()
        
        total_loss = policy_loss + self.config.kl_penalty * kl
        
        # Metrics
        metrics = {
            'loss': total_loss.item(),
            'policy_loss': policy_loss.item(),
            'kl_divergence': kl.item(),
            'mean_advantage': advantages.mean().item(),
            'std_advantage': advantages.std().item(),
            'mean_ratio': ratio.mean().item(),
        }
        
        return total_loss, metrics
    
    def _compute_advantages(self, rewards: torch.Tensor) -> torch.Tensor:
        """Compute group-relative advantages."""
        if self.config.advantage_normalization:
            mean = rewards.mean()
            std = rewards.std().clamp(min=1e-8)
            advantages = (rewards - mean) / std
        else:
            advantages = rewards - rewards.mean()
        
        # Expand to token level
        return advantages.unsqueeze(-1).expand_as(rewards.shape[0] if rewards.dim() == 1 else rewards)


# ─── Distributed Group Baseline ───

class DistributedGroupBaseline:
    """
    Computes group baseline across distributed workers.
    
    Communication: O(C) scalars per group (reward mean + std)
    vs O(d) for gradient synchronization.
    """
    
    @staticmethod
    def compute(
        local_rewards: torch.Tensor,
        local_group_ids: torch.Tensor,
        world_size: int = 1,
    ) -> torch.Tensor:
        """
        Compute globally-normalized advantages.
        
        Args:
            local_rewards: [num_local_rollouts] rewards
            local_group_ids: [num_local_rollouts] prompt IDs
            world_size: Number of distributed workers
        
        Returns:
            advantages: [num_local_rollouts] normalized advantages
        """
        if world_size == 1:
            mean = local_rewards.mean()
            std = local_rewards.std().clamp(min=1e-8)
            return (local_rewards - mean) / std
        
        # All-gather rewards and group IDs
        all_rewards = [torch.zeros_like(local_rewards) for _ in range(world_size)]
        all_groups = [torch.zeros_like(local_group_ids) for _ in range(world_size)]
        
        dist.all_gather(all_rewards, local_rewards)
        dist.all_gather(all_groups, local_group_ids)
        
        all_rewards = torch.cat(all_rewards)
        all_groups = torch.cat(all_groups)
        
        # Compute per-group statistics
        unique_groups = all_groups.unique()
        group_stats = {}
        for g in unique_groups:
            mask = all_groups == g
            group_rewards = all_rewards[mask]
            group_stats[g.item()] = {
                'mean': group_rewards.mean(),
                'std': group_rewards.std().clamp(min=1e-8),
                'count': mask.sum().item(),
            }
        
        # Assign advantages
        advantages = torch.zeros_like(local_rewards)
        for i, gid in enumerate(local_group_ids):
            stats = group_stats[gid.item()]
            if stats['count'] > 1:
                advantages[i] = (local_rewards[i] - stats['mean']) / stats['std']
            else:
                # Single sample: use global stats
                global_mean = all_rewards.mean()
                global_std = all_rewards.std().clamp(min=1e-8)
                advantages[i] = (local_rewards[i] - global_mean) / global_std
        
        return advantages


# ─── FGRPO Server ───

class FGRPOServer:
    """
    Federated GRPO Server.
    
    Communication per round:
    - Broadcast: O(d) policy parameters
    - Collect: O(C) client statistics (mean, std, n)
    - Broadcast: O(1) global baseline (mean, std)
    - Aggregate: O(d) policy gradients (FedAvg)
    """
    
    def __init__(self, model: nn.Module, config: FGRPOConfig):
        self.model = model
        self.config = config
        self.client_stats: Dict[int, Dict[str, float]] = {}
        self.global_mean_ema = 0.0
        self.global_std_ema = 1.0
    
    def receive_client_stats(
        self,
        client_id: int,
        local_mean: float,
        local_std: float,
        num_samples: int,
    ):
        self.client_stats[client_id] = {
            'mean': local_mean,
            'std': local_std,
            'n': num_samples,
        }
    
    def compute_global_baseline(self) -> Tuple[float, float]:
        """Compute global baseline with adaptive weighting."""
        if not self.client_stats:
            return 0.0, 1.0
        
        total_n = sum(s['n'] for s in self.client_stats.values())
        
        if self.config.adaptive_aggregation:
            # Inverse-variance weighting
            weights = {}
            for cid, stats in self.client_stats.items():
                weights[cid] = stats['n'] / (stats['std'] ** 2 + 1e-8)
        else:
            weights = {cid: stats['n'] for cid, stats in self.client_stats.items()}
        
        total_w = sum(weights.values())
        
        # Global mean
        global_mean = sum(
            weights[cid] * self.client_stats[cid]['mean']
            for cid in self.client_stats
        ) / total_w
        
        # Global std (within + between)
        within_var = sum(
            weights[cid] * self.client_stats[cid]['std'] ** 2
            for cid in self.client_stats
        ) / total_w
        
        between_var = sum(
            weights[cid] * (self.client_stats[cid]['mean'] - global_mean) ** 2
            for cid in self.client_stats
        ) / total_w
        
        global_std = math.sqrt(within_var + between_var + 1e-8)
        
        # EMA smoothing
        alpha = self.config.global_baseline_smoothing
        self.global_mean_ema = alpha * self.global_mean_ema + (1 - alpha) * global_mean
        self.global_std_ema = alpha * self.global_std_ema + (1 - alpha) * global_std
        
        return self.global_mean_ema, self.global_std_ema
    
    def aggregate_gradients(
        self,
        client_gradients: List[Dict[str, torch.Tensor]],
        client_weights: Optional[List[float]] = None,
    ) -> Dict[str, torch.Tensor]:
        """FedAvg gradient aggregation."""
        if client_weights is None:
            client_weights = [1.0 / len(client_gradients)] * len(client_gradients)
        
        aggregated = {}
        for key in client_gradients[0]:
            aggregated[key] = sum(
                w * grad[key] for w, grad in zip(client_weights, client_gradients)
            )
        
        return aggregated


# ─── Adaptive Group Size ───

class AdaptiveGroupSizer:
    """
    Dynamically adjusts group size G based on reward variance.
    
    High variance → larger G (need better baseline)
    Low variance → smaller G (save compute)
    """
    
    def __init__(
        self,
        min_g: int = 4,
        max_g: int = 128,
        target_std_error: float = 0.1,
    ):
        self.min_g = min_g
        self.max_g = max_g
        self.target_std_error = target_std_error
        self.variance_history: List[float] = []
    
    def compute_optimal_g(self, current_g: int) -> int:
        """Compute optimal G based on recent reward variance."""
        if len(self.variance_history) < 3:
            return current_g
        
        # Estimate current variance
        recent_var = sum(self.variance_history[-5:]) / min(5, len(self.variance_history))
        
        # G* = σ² / SE²
        optimal_g = int(recent_var / (self.target_std_error ** 2))
        
        # Clamp and round to power of 2
        optimal_g = max(self.min_g, min(self.max_g, optimal_g))
        optimal_g = 2 ** round(math.log2(optimal_g))
        
        return optimal_g
    
    def update(self, reward_variance: float):
        self.variance_history.append(reward_variance)


# ─── Integration with Omnigent Compression ───

class CompressedGRPOTrainer:
    """
    GRPO Trainer with Omnient Gradient Compression.
    
    Total communication per round:
        O(d · k_ratio) for gradients + O(C) for group baseline
    vs PPO: O(2d) for policy + critic gradients
    Reduction: ~1000x with k_ratio=0.001
    """
    
    def __init__(
        self,
        model: nn.Module,
        grpo_config: GRPOConfig,
        compression_config: Optional[Dict[str, Any]] = None,
    ):
        self.model = model
        self.grpo_config = grpo_config
        
        # Initialize compression if available
        self.compression_engine = None
        if compression_config is not None:
            try:
                from omnigent.distributed.compression import (
                    GradientCompressionEngine,
                    CompressionConfig,
                    CompressionType,
                )
                config = CompressionConfig(**compression_config)
                self.compression_engine = GradientCompressionEngine(
                    config=config, model=model
                )
            except ImportError:
                pass
    
    def train_step(
        self,
        rollouts: List[Tuple[torch.Tensor, torch.Tensor, float]],
        # (log_probs, old_log_probs, reward)
    ) -> Dict[str, float]:
        """
        Single GRPO training step with optional compression.
        """
        log_probs = torch.stack([r[0] for r in rollouts])
        old_log_probs = torch.stack([r[1] for r in rollouts])
        rewards = torch.tensor([r[2] for r in rollouts], device=log_probs.device)
        
        # Compute advantages
        advantages = DistributedGroupBaseline.compute(rewards, torch.arange(len(rewards)))
        
        # Loss
        loss_fn = GRPOLoss(self.grpo_config)
        loss, metrics = loss_fn(log_probs, old_log_probs, rewards)
        
        # Backward
        loss.backward()
        
        # Gradient compression + all-reduce
        if self.compression_engine is not None:
            for name, param in self.model.named_parameters():
                if param.grad is not None:
                    param.grad = self.compression_engine.compress_and_allreduce(
                        param.grad, name
                    )
        
        return metrics


# ─── Usage Example ───

def example_grpo_training():
    """Example: GRPO training loop."""
    
    # Configuration
    config = GRPOConfig(
        group_size=16,
        clip_epsilon=0.2,
        kl_penalty=0.001,
        learning_rate=1e-6,
    )
    
    # Initialize
    model = nn.Transformer(d_model=512, nhead=8, num_layers=6)  # Placeholder
    trainer = CompressedGRPOTrainer(
        model=model,
        grpo_config=config,
        compression_config={
            'compression_type': 'topk_quantization',
            'k_ratio': 0.001,
            'quantization_bits': 8,
            'error_feedback': True,
        }
    )
    
    # Training loop
    for step in range(1000):
        # 1. Generate rollouts (G per prompt)
        rollouts = []  # List of (log_probs, old_log_probs, reward)
        
        # 2. Compute group baseline and update
        metrics = trainer.train_step(rollouts)
        
        if step % 100 == 0:
            print(f"Step {step}: loss={metrics['loss']:.4f}, "
                  f"reward_mean={metrics['mean_advantage']:.4f}")
    
    return model


if __name__ == "__main__":
    example_grpo_training()
```

## File: grpo_config.yaml
## Configuration for GRPO training in Omnigent

```yaml
# GRPO Training Configuration
# For Omnigent distributed training pipeline

grpo:
  group_size: 16
  clip_epsilon: 0.2
  kl_penalty: 0.001
  learning_rate: 1.0e-6
  max_new_tokens: 1024
  temperature: 0.7
  advantage_normalization: true
  max_grad_norm: 1.0
  group_baseline_type: "mean"
  adaptive_group_size: false
  min_group_size: 4
  max_group_size: 128

fgrpo:
  num_clients: 10
  local_epochs: 3
  adaptive_aggregation: true
  global_baseline_smoothing: 0.9

compression:
  compression_type: "topk_quantization"
  k_ratio: 0.001
  quantization_bits: 8
  error_feedback: true
  ef_momentum: 0.9

integration:
  diloco_island_size: 4  # GPUs per island
  checkpoint_interval: 100
  stats_log_interval: 10
```

## File: test_grpo.py
## Unit tests for GRPO implementation

```python
import torch
import pytest
from grpo_core import (
    GRPOLoss, GRPOConfig, DistributedGroupBaseline,
    FGRPOServer, FGRPOConfig, AdaptiveGroupSizer,
    CompressedGRPOTrainer
)


class TestGRPOLoss:
    """Test GRPO loss computation."""
    
    def test_basic_loss(self):
        config = GRPOConfig(group_size=4)
        loss_fn = GRPOLoss(config)
        
        log_probs = torch.randn(4, 10)
        old_log_probs = torch.randn(4, 10)
        rewards = torch.tensor([1.0, 2.0, 3.0, 4.0])
        
        loss, metrics = loss_fn(log_probs, old_log_probs, rewards)
        
        assert loss.dim() == 0  # Scalar
        assert 'kl_divergence' in metrics
        assert metrics['mean_advantage'] == pytest.approx(0.0, abs=0.1)
    
    def test_advantage_normalization(self):
        config = GRPOConfig(advantage_normalization=True)
        loss_fn = GRPOLoss(config)
        
        rewards = torch.tensor([0.0, 0.0, 10.0, 10.0])
        advantages = loss_fn._compute_advantages(rewards)
        
        # Advantages should be normalized
        assert advantages.mean().abs() < 1e-6
        assert (advantages.std() - 1.0).abs() < 1e-5
    
    def test_clipping(self):
        config = GRPOConfig(clip_epsilon=0.2)
        loss_fn = GRPOLoss(config)
        
        # Large ratio should be clipped
        log_probs = torch.ones(4, 10) * 0.5  # High ratio
        old_log_probs = torch.zeros(4, 10)
        rewards = torch.tensor([1.0, 2.0, 3.0, 4.0])
        
        loss, metrics = loss_fn(log_probs, old_log_probs, rewards)
        assert metrics['mean_ratio'] <= 1.2 + 1e-5  # Should be clipped


class TestDistributedGroupBaseline:
    """Test distributed group baseline computation."""
    
    def test_single_node(self):
        rewards = torch.tensor([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
        group_ids = torch.tensor([0, 0, 0, 1, 1, 1])
        
        advantages = DistributedGroupBaseline.compute(rewards, group_ids, world_size=1)
        
        # Group 0: [1,2,3] -> mean=2, std=0.816
        # Group 1: [4,5,6] -> mean=5, std=0.816
        assert advantages.shape == rewards.shape
    
    def test_advantage_properties(self):
        rewards = torch.randn(100)
        group_ids = torch.arange(25).repeat(4)
        
        advantages = DistributedGroupBaseline.compute(rewards, group_ids, world_size=1)
        
        # Each group should have mean ≈ 0
        for g in range(25):
            group_advantages = advantages[group_ids == g]
            assert group_advantages.mean().abs() < 1e-5


class TestAdaptiveGroupSizer:
    """Test adaptive group size computation."""
    
    def test_increases_with_variance(self):
        sizer = AdaptiveGroupSizer(min_g=4, max_g=128, target_std_error=0.1)
        
        # High variance → larger G
        for _ in range(5):
            sizer.update(10.0)
        g_high = sizer.compute_optimal_g(16)
        
        # Low variance → smaller G
        sizer2 = AdaptiveGroupSizer(min_g=4, max_g=128, target_std_error=0.1)
        for _ in range(5):
            sizer2.update(0.1)
        g_low = sizer2.compute_optimal_g(16)
        
        assert g_high >= g_low
    
    def test_clamping(self):
        sizer = AdaptiveGroupSizer(min_g=4, max_g=128)
        
        for _ in range(5):
            sizer.update(10000.0)  # Very high variance
        g = sizer.compute_optimal_g(16)
        
        assert g <= 128
