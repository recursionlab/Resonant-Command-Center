"""
lora_ga.py — LoRA-GA Initialization for Knowledge Graph Embeddings

Implements the LoRA-GA method from NeurIPS 2024:
1. Collect full gradients on calibration data
2. Eigendecompose gradient matrices
3. Initialize LoRA factors to align with top gradient eigenvectors

Target: TauAttention module fine-tuning in Omnigent pipeline.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple, Optional, List
import math


def compute_gradient_matrix(
    model: nn.Module,
    target_param_name: str,
    dataloader,
    device: str = "cpu",
    max_batches: int = 10,
) -> torch.Tensor:
    """
    Compute the average gradient matrix for a specific parameter over calibration data.
    
    Args:
        model: The model containing the target parameter
        target_param_name: Name of the parameter (e.g., 'attention.W_q.weight')
        dataloader: DataLoader yielding calibration data
        device: Device to run on
        max_batches: Maximum number of batches to accumulate gradients over
        
    Returns:
        G: Average gradient matrix of shape matching the target parameter
    """
    model.eval()
    model.zero_grad()
    
    param = dict(model.named_parameters())[target_param_name]
    accumulated_grad = torch.zeros_like(param)
    n_batches = 0
    
    for batch_idx, batch in enumerate(dataloader):
        if batch_idx >= max_batches:
            break
            
        # Move batch to device
        if isinstance(batch, (list, tuple)):
            batch = [b.to(device) if isinstance(b, torch.Tensor) else b for b in batch]
        elif isinstance(batch, dict):
            batch = {k: v.to(device) if isinstance(v, torch.Tensor) else v for k, v in batch.items()}
        
        # Forward pass
        if isinstance(batch, (list, tuple)):
            output = model(*batch)
        elif isinstance(batch, dict):
            output = model(**batch)
        else:
            output = model(batch)
        
        # Handle tuple outputs (like TauAttention which returns (output, info))
        if isinstance(output, tuple):
            main_output = output[0]
        else:
            main_output = output
            
        # Compute loss
        if isinstance(main_output, torch.Tensor) and main_output.dim() >= 2:
            loss = main_output.pow(2).mean()
        else:
            raise ValueError(f"Unexpected output shape: {main_output.shape}")
        
        loss.backward()
        
        if param.grad is not None:
            accumulated_grad += param.grad.detach().clone()
            model.zero_grad()
        
        n_batches += 1
    
    if n_batches == 0:
        raise ValueError("No batches processed")
    
    return accumulated_grad / n_batches


def lora_ga_init(
    gradient_matrix: torch.Tensor,
    rank: int,
    init_scale: float = 0.01,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Initialize LoRA factors A, B from the gradient matrix using top eigencomponents.
    
    Given gradient G (m×n), compute:
        G = U Σ V^T (SVD)
        B = V_r^T (rank × n)
        A = U_r @ diag(Σ_r) (m × rank)
    
    This ensures AB spans the same subspace as the top-r components of G.
    
    Args:
        gradient_matrix: G, shape (m, n) — the gradient of loss w.r.t. the weight
        rank: LoRA rank r
        init_scale: Scaling factor for A initialization
        
    Returns:
        A: Shape (m, rank) — the "down-projection" (initialized from gradient)
        B: Shape (rank, n) — the "up-projection" (initialized from right singular vectors)
    """
    m, n = gradient_matrix.shape
    assert rank <= min(m, n), f"Rank {rank} exceeds matrix dimensions ({m}, {n})"
    
    # SVD of gradient matrix
    U, S, Vh = torch.linalg.svd(gradient_matrix, full_matrices=False)
    
    # Extract top-r components
    U_r = U[:, :rank]       # (m, r)
    S_r = S[:rank]           # (r,)
    Vh_r = Vh[:rank, :]      # (r, n)
    
    # Initialize B as V_r^T (right singular vectors transposed)
    B = Vh_r.clone()  # (r, n)
    
    # Initialize A as U_r @ diag(S_r) scaled
    A = U_r @ torch.diag(S_r * init_scale)  # (m, r)
    
    return A, B


def lora_ga_init_from_square(
    gradient_square: torch.Tensor,
    rank: int,
    m: int,
    n: int,
    init_scale: float = 0.01,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Alternative: Initialize from G^T @ G (square n×n) when m > n.
    Useful for memory efficiency.
    
    Args:
        gradient_square: G^T @ G, shape (n, n)
        rank: LoRA rank
        m: Original parameter rows
        n: Original parameter columns
        init_scale: Scaling factor
        
    Returns:
        A: (m, rank), B: (rank, n)
    """
    eigenvalues, eigenvectors = torch.linalg.eigh(gradient_square)
    idx = torch.argsort(eigenvalues, descending=True)
    eigenvalues = eigenvalues[idx]
    eigenvectors = eigenvectors[:, idx]
    
    V_r = eigenvectors[:, :rank]  # (n, r)
    S_r = eigenvalues[:rank].clamp(min=0).sqrt()
    
    B = (V_r.T * S_r)  # (r, n)
    A = torch.randn(m, rank) * init_scale  # (m, r)
    
    return A, B


class LoRAModule(nn.Module):
    """
    LoRA adapter module with optional GA initialization.
    
    Replaces a weight matrix W with: W' = W + (alpha/r) * B @ A
    where A ∈ R^{m×r}, B ∈ R^{r×n} are the low-rank adapters.
    """
    
    def __init__(
        self,
        original_shape: Tuple[int, int],
        rank: int = 8,
        alpha: float = 16.0,
        init_method: str = "ga",
        gradient_matrix: Optional[torch.Tensor] = None,
    ):
        super().__init__()
        self.m, self.n = original_shape
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank
        
        if init_method == "ga" and gradient_matrix is not None:
            A, B = lora_ga_init(gradient_matrix, rank)
            self.lora_A = nn.Parameter(A)
            self.lora_B = nn.Parameter(B)
        else:
            # Standard LoRA init: A ~ N(0, σ²), B = 0
            self.lora_A = nn.Parameter(torch.randn(self.m, rank) * 0.01)
            self.lora_B = nn.Parameter(torch.zeros(rank, self.n))
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Compute the LoRA update: ΔW @ x = scaling * B @ A @ x
        
        Args:
            x: Input tensor of shape (..., n)
            
        Returns:
            Update of shape (..., m)
        """
        return self.scaling * (x @ self.lora_A.T @ self.lora_B.T)
    
    def get_weight_update(self) -> torch.Tensor:
        """Return the full low-rank update matrix ΔW = scaling * B @ A."""
        return self.scaling * (self.lora_B.T @ self.lora_A.T)


class TorsionComputer(nn.Module):
    """TorsionComputer from omnigent/models/tau_attention.py (re-defined for standalone use)."""
    
    def __init__(self, d_model: int, n_classes: int = 4, method: str = "spectral"):
        super().__init__()
        self.d_model = d_model
        self.n_classes = n_classes
        self.method = method
        self.class_prototypes = nn.Parameter(torch.randn(n_classes, d_model))
        self.torsion_proj = nn.Linear(d_model, d_model // 2, bias=False)
        self.torsion_head = nn.Linear(d_model // 2, n_classes, bias=False)
    
    def forward(self, Q, K):
        if self.method == "spectral":
            torsion_features = self.torsion_proj(Q * K)
            torsion_logits = self.torsion_head(torsion_features)
            tau = torsion_logits.argmax(dim=-1)
        else:
            raise ValueError(f"Unknown method: {self.method}")
        return tau


class LoRATauAttention(nn.Module):
    """
    TauAttention with LoRA-GA adapters applied to Q, K, V, O projections.
    
    Replaces the standard linear projections in TauAttention with LoRA-augmented
    versions, using GA initialization for fast convergence.
    """
    
    def __init__(
        self,
        d_model: int,
        n_heads: int = 8,
        n_torsion_classes: int = 4,
        dropout: float = 0.1,
        torsion_method: str = "spectral",
        max_class_size: int = 64,
        lora_rank: int = 8,
        lora_alpha: float = 16.0,
        lora_init: str = "ga",
        gradient_matrices: Optional[Dict[str, torch.Tensor]] = None,
    ):
        super().__init__()
        assert d_model % n_heads == 0
        
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        self.n_torsion_classes = n_torsion_classes
        self.max_class_size = max_class_size
        
        # Original frozen weights
        self.W_q = nn.Linear(d_model, d_model, bias=False)
        self.W_k = nn.Linear(d_model, d_model, bias=False)
        self.W_v = nn.Linear(d_model, d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)
        
        # Freeze original weights
        for param in [self.W_q.weight, self.W_k.weight, self.W_v.weight, self.W_o.weight]:
            param.requires_grad = False
        
        # LoRA adapters
        lora_kwargs = {
            "rank": lora_rank,
            "alpha": lora_alpha,
            "init_method": lora_init,
        }
        
        self.lora_q = LoRAModule(
            (d_model, d_model), **lora_kwargs,
            gradient_matrix=gradient_matrices.get("W_q") if gradient_matrices else None,
        )
        self.lora_k = LoRAModule(
            (d_model, d_model), **lora_kwargs,
            gradient_matrix=gradient_matrices.get("W_k") if gradient_matrices else None,
        )
        self.lora_v = LoRAModule(
            (d_model, d_model), **lora_kwargs,
            gradient_matrix=gradient_matrices.get("W_v") if gradient_matrices else None,
        )
        self.lora_o = LoRAModule(
            (d_model, d_model), **lora_kwargs,
            gradient_matrix=gradient_matrices.get("W_o") if gradient_matrices else None,
        )
        
        # Torsion computer (also gets LoRA)
        self.torsion = TorsionComputer(d_model, n_torsion_classes, torsion_method)
        for param in self.torsion.parameters():
            param.requires_grad = False
        
        self.lora_torsion_proj = LoRAModule(
            (d_model, d_model // 2), **lora_kwargs,
            gradient_matrix=gradient_matrices.get("torsion_proj") if gradient_matrices else None,
        )
        
        self.dropout = nn.Dropout(dropout)
        self.scale = math.sqrt(self.d_k)
    
    def forward(
        self,
        x: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
        return_torsion: bool = False,
    ) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        """Forward pass with LoRA-augmented projections."""
        batch, seq_len, d = x.shape
        
        # Q, K, V with LoRA updates
        Q = self.W_q(x) + self.lora_q(x)
        K = self.W_k(x) + self.lora_k(x)
        V = self.W_v(x) + self.lora_v(x)
        
        # Reshape for multi-head
        Q = Q.view(batch, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        K = K.view(batch, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        V = V.view(batch, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        
        # Torsion classes
        Q_mean = Q.mean(dim=1)
        K_mean = K.mean(dim=1)
        if self.d_k != self.d_model:
            Q_mean = Q_mean.repeat(1, 1, self.d_model // self.d_k)[:, :, :self.d_model]
            K_mean = K_mean.repeat(1, 1, self.d_model // self.d_k)[:, :, :self.d_model]
        
        # Torsion with LoRA
        torsion_features = self.torsion.torsion_proj(Q_mean * K_mean)
        torsion_features = torsion_features + self.lora_torsion_proj(Q_mean * K_mean)
        torsion_logits = self.torsion.torsion_head(torsion_features)
        tau = torsion_logits.argmax(dim=-1)
        
        # Attention with topological stratification
        output = self._tau_attention(Q, K, V, tau, mask)
        
        # Output projection with LoRA
        output = output.transpose(1, 2).contiguous().view(batch, seq_len, d)
        output = self.W_o(output) + self.lora_o(output)
        
        info = {"tau": tau, "n_classes": self.n_torsion_classes}
        
        if return_torsion:
            class_sizes = torch.zeros(batch, self.n_torsion_classes, dtype=torch.long)
            for c in range(self.n_torsion_classes):
                class_sizes[:, c] = (tau == c).sum(dim=-1)
            info["class_sizes"] = class_sizes
        
        return output, info
    
    def _tau_attention(self, Q, K, V, tau, mask=None):
        """Topological stratified attention (from TauAttention)."""
        batch, n_heads, seq_len, d_k = Q.shape
        n_classes = self.n_torsion_classes
        
        scores = torch.matmul(Q, K.transpose(-2, -1)) / self.scale
        
        tau_i = tau.unsqueeze(-1).expand(-1, seq_len)
        tau_j = tau.unsqueeze(-2).expand(-1, seq_len, -1)
        class_mask = (tau_i == tau_j).float().unsqueeze(1).expand(-1, n_heads, -1, -1)
        
        scores = scores.masked_fill(class_mask == 0, float('-inf'))
        
        if mask is not None:
            key_mask = mask.unsqueeze(1).unsqueeze(2)
            scores = scores.masked_fill(~key_mask, float('-inf'))
        
        attn_weights = F.softmax(scores, dim=-1)
        attn_weights = attn_weights.nan_to_num(0.0)
        attn_weights = self.dropout(attn_weights)
        
        return torch.matmul(attn_weights, V)
    
    def merge_lora_weights(self):
        """
        Merge LoRA weights back into original weights for inference.
        W_merged = W + (alpha/r) * B @ A
        """
        with torch.no_grad():
            self.W_q.weight.data += self.lora_q.get_weight_update()
            self.W_k.weight.data += self.lora_k.get_weight_update()
            self.W_v.weight.data += self.lora_v.get_weight_update()
            self.W_o.weight.data += self.lora_o.get_weight_update()
            self.torsion.torsion_proj.weight.data += self.lora_torsion_proj.get_weight_update()
        
        # Remove LoRA modules
        del self.lora_q, self.lora_k, self.lora_v, self.lora_o, self.lora_torsion_proj


class LoRATauTransformerBlock(nn.Module):
    """Full transformer block with LoRA-GA attention."""
    
    def __init__(
        self,
        d_model: int,
        n_heads: int = 8,
        d_ff: int = 2048,
        n_torsion_classes: int = 4,
        dropout: float = 0.1,
        lora_rank: int = 8,
        lora_alpha: float = 16.0,
        lora_init: str = "ga",
        gradient_matrices: Optional[Dict[str, torch.Tensor]] = None,
    ):
        super().__init__()
        
        self.attention = LoRATauAttention(
            d_model=d_model,
            n_heads=n_heads,
            n_torsion_classes=n_torsion_classes,
            dropout=dropout,
            lora_rank=lora_rank,
            lora_alpha=lora_alpha,
            lora_init=lora_init,
            gradient_matrices=gradient_matrices,
        )
        
        # FFN (frozen)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
            nn.Dropout(dropout),
        )
        for param in self.ff.parameters():
            param.requires_grad = False
        
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
    
    def forward(self, x, mask=None):
        normed = self.norm1(x)
        attn_out, info = self.attention(normed, mask=mask)
        x = x + attn_out
        x = x + self.ff(self.norm2(x))
        return x, info


def calibrate_gradients(
    model: nn.Module,
    dataloader,
    target_names: List[str],
    device: str = "cpu",
    max_batches: int = 50,
) -> Dict[str, torch.Tensor]:
    """
    Collect gradient matrices for target parameters.
    
    Args:
        model: Pre-trained model
        dataloader: Calibration data loader
        target_names: List of parameter names to collect gradients for
        device: Device
        max_batches: Number of calibration batches
        
    Returns:
        gradients: Dict mapping parameter name -> average gradient matrix
    """
    model.eval()
    model.to(device)
    
    gradients = {name: None for name in target_names}
    param_map = dict(model.named_parameters())
    n_batches = 0
    
    for batch_idx, batch in enumerate(dataloader):
        if batch_idx >= max_batches:
            break
        
        if isinstance(batch, (list, tuple)):
            inputs = batch[0].to(device)
        elif isinstance(batch, dict):
            inputs = batch["input"].to(device)
        else:
            inputs = batch.to(device)
        
        model.zero_grad()
        
        output = model(inputs)
        if isinstance(output, tuple):
            main_output = output[0]
        else:
            main_output = output
        
        if main_output.dim() == 3:
            loss = main_output.pow(2).mean()
        else:
            loss = main_output.pow(2).mean()
        
        loss.backward()
        
        for name in target_names:
            if name in param_map and param_map[name].grad is not None:
                grad = param_map[name].grad.detach().clone()
                if gradients[name] is None:
                    gradients[name] = grad
                else:
                    gradients[name] += grad
        
        model.zero_grad()
        n_batches += 1
    
    for name in target_names:
        if gradients[name] is not None:
            gradients[name] /= n_batches
    
    print(f"Calibrated on {n_batches} batches")
    for name, grad in gradients.items():
        if grad is not None:
            print(f"  {name}: shape={grad.shape}, norm={grad.norm():.4f}")
    
    return gradients


def measure_gradient_alignment(
    lora_module: LoRATauAttention,
    gradient_matrices: Dict[str, torch.Tensor],
) -> Dict[str, float]:
    """
    Measure cosine similarity between LoRA update and full gradient.
    
    High alignment (>0.9) confirms correct GA initialization.
    """
    alignments = {}
    
    for key, grad in gradient_matrices.items():
        if grad is None:
            continue
        
        if key == "W_q":
            lora_update = lora_module.lora_q.get_weight_update()
        elif key == "W_k":
            lora_update = lora_module.lora_k.get_weight_update()
        elif key == "W_v":
            lora_update = lora_module.lora_v.get_weight_update()
        elif key == "W_o":
            lora_update = lora_module.lora_o.get_weight_update()
        else:
            continue
        
        grad_flat = grad.flatten()
        update_flat = lora_update.flatten()
        
        cos_sim = F.cosine_similarity(
            grad_flat.unsqueeze(0),
            update_flat.unsqueeze(0),
        ).item()
        
        alignments[key] = cos_sim
    
    return alignments
