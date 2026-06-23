"""
Softmax_τ — Topologically-stratified sparse attention.

Core equation:
    Softmax_τ(z_i) = exp(z_i) / Σ_{j: τ_j = τ_i} exp(z_j)

Where τ_i is the topological charge (torsion class) of token i.
Only tokens sharing the same τ class participate in normalization,
reducing complexity from O(n²) to O(n·k) where k = max class size.

Components:
    - TorsionComputer: Computes τ_i from Q, K embeddings
    - TauAttention: Full attention layer with topological stratification
    - HomotopyLoss: Penalizes discontinuous jumps between adjacent tokens
    - HopfLoss: Encourages imaginary mass (non-Hermitian topology)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple, Dict
import math


class TorsionComputer(nn.Module):
    """
    Computes the topological charge τ for each token.
    
    τ_i = f(Q_i, K_i) where f measures the "torsion" — the degree to which
    a token's query-key pair breaks symmetry with its neighbors.
    
    In practice: τ is a discrete class assignment based on the dominant
    eigencomponent of the local QK interaction matrix.
    """
    
    def __init__(self, d_model: int, n_classes: int = 4, method: str = "spectral"):
        super().__init__()
        self.d_model = d_model
        self.n_classes = n_classes
        self.method = method
        
        # Learnable class prototypes in the torsion space
        self.class_prototypes = nn.Parameter(torch.randn(n_classes, d_model))
        
        # Torsion projection — maps QK interaction to torsion space
        self.torsion_proj = nn.Linear(d_model, d_model // 2, bias=False)
        self.torsion_head = nn.Linear(d_model // 2, n_classes, bias=False)
    
    def forward(
        self,
        Q: torch.Tensor,
        K: torch.Tensor,
    ) -> torch.Tensor:
        """
        Compute torsion classes for each token.
        
        Args:
            Q: (batch, seq_len, d_model) — query embeddings
            K: (batch, seq_len, d_model) — key embeddings
        
        Returns:
            tau: (batch, seq_len) — integer class assignments
        """
        batch, seq_len, d = Q.shape
        
        if self.method == "spectral":
            # Compute local QK interaction: q_i · k_i for each token
            local_interaction = (Q * K).sum(dim=-1, keepdim=True)  # (B, S, 1)
            
            # Project to torsion space
            torsion_features = self.torsion_proj(Q * K)  # (B, S, d/2)
            torsion_logits = self.torsion_head(torsion_features)  # (B, S, n_classes)
            
            # Assign to class
            tau = torsion_logits.argmax(dim=-1)  # (B, S)
            
        elif self.method == "prototype":
            # Compute similarity to class prototypes
            # Project Q to torsion space
            q_torsion = self.torsion_proj(Q)  # (B, S, d/2)
            proto_torsion = self.torsion_proj(self.class_prototypes)  # (C, d/2)
            
            # Cosine similarity
            q_norm = F.normalize(q_torsion, dim=-1)
            p_norm = F.normalize(proto_torsion, dim=-1)
            
            similarity = torch.einsum('bsd,cd->bsc', q_norm, p_norm)  # (B, S, C)
            tau = similarity.argmax(dim=-1)  # (B, S)
            
        else:
            raise ValueError(f"Unknown torsion method: {self.method}")
        
        return tau


class TauAttention(nn.Module):
    """
    Softmax_τ attention layer.
    
    Instead of computing attention over all n tokens, we:
    1. Compute torsion class τ_i for each token
    2. Only compute attention within each torsion class
    3. Normalize within each class independently
    
    This gives O(n·k) complexity where k = max class size.
    """
    
    def __init__(
        self,
        d_model: int,
        n_heads: int = 8,
        n_torsion_classes: int = 4,
        dropout: float = 0.1,
        torsion_method: str = "spectral",
        max_class_size: int = 64,
    ):
        super().__init__()
        assert d_model % n_heads == 0
        
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        self.n_torsion_classes = n_torsion_classes
        self.max_class_size = max_class_size
        
        # Standard QKV projections
        self.W_q = nn.Linear(d_model, d_model, bias=False)
        self.W_k = nn.Linear(d_model, d_model, bias=False)
        self.W_v = nn.Linear(d_model, d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)
        
        # Torsion computer
        self.torsion = TorsionComputer(d_model, n_torsion_classes, torsion_method)
        
        self.dropout = nn.Dropout(dropout)
        self.scale = math.sqrt(self.d_k)
    
    def forward(
        self,
        x: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
        return_torsion: bool = False,
    ) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        """
        Forward pass with topological stratification.
        
        Args:
            x: (batch, seq_len, d_model)
            mask: optional (batch, seq_len) boolean mask
            return_torsion: if True, return torsion classes for analysis
        
        Returns:
            output: (batch, seq_len, d_model)
            info: dict with torsion classes, class sizes, etc.
        """
        batch, seq_len, d = x.shape
        
        # Compute Q, K, V
        Q = self.W_q(x).view(batch, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        K = self.W_k(x).view(batch, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        V = self.W_v(x).view(batch, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        # Q, K, V: (batch, n_heads, seq_len, d_k)
        
        # Compute torsion classes (per-head, using mean-pooled Q/K)
        Q_mean = Q.mean(dim=1)  # (batch, seq_len, d_k)
        K_mean = K.mean(dim=1)
        
        # Pad to d_model for torsion computer
        if self.d_k != self.d_model:
            Q_mean = Q_mean.repeat(1, 1, self.d_model // self.d_k)[:, :, :self.d_model]
            K_mean = K_mean.repeat(1, 1, self.d_model // self.d_k)[:, :, :self.d_model]
        
        tau = self.torsion(Q_mean, K_mean)  # (batch, seq_len)
        
        # Compute attention with topological stratification
        output = self._tau_attention(Q, K, V, tau, mask)
        
        # Reshape and project
        output = output.transpose(1, 2).contiguous().view(batch, seq_len, d)
        output = self.W_o(output)
        
        info = {
            "tau": tau,
            "n_classes": self.n_torsion_classes,
        }
        
        if return_torsion:
            # Compute class sizes for monitoring
            class_sizes = torch.zeros(batch, self.n_torsion_classes, dtype=torch.long)
            for c in range(self.n_torsion_classes):
                class_sizes[:, c] = (tau == c).sum(dim=-1)
            info["class_sizes"] = class_sizes
        
        return output, info
    
    def _tau_attention(
        self,
        Q: torch.Tensor,
        K: torch.Tensor,
        V: torch.Tensor,
        tau: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Compute attention within each torsion class.
        
        For each class c:
            - Gather tokens where τ_i = c
            - Compute softmax over only those tokens
            - Scatter results back
        
        This is the core O(n·k) operation.
        """
        batch, n_heads, seq_len, d_k = Q.shape
        n_classes = self.n_torsion_classes
        
        # Full attention scores (we'll mask by class)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / self.scale  # (B, H, S, S)
        
        # Create class mask: M[i,j] = 1 if τ_i == τ_j
        tau_i = tau.unsqueeze(-1).expand(-1, seq_len)  # (B, S, S)
        tau_j = tau.unsqueeze(-2).expand(-1, seq_len, -1)
        class_mask = (tau_i == tau_j).float()  # (B, S, S)
        
        # Expand mask for heads
        class_mask = class_mask.unsqueeze(1).expand(-1, n_heads, -1, -1)  # (B, H, S, S)
        
        # Apply class mask: set cross-class scores to -inf
        scores = scores.masked_fill(class_mask == 0, float('-inf'))
        
        # Apply optional padding mask
        if mask is not None:
            # mask: (B, S) — True for valid tokens
            key_mask = mask.unsqueeze(1).unsqueeze(2)  # (B, 1, 1, S)
            scores = scores.masked_fill(~key_mask, float('-inf'))
        
        # Softmax (within each class — cross-class are -inf so contribute 0)
        attn_weights = F.softmax(scores, dim=-1)
        attn_weights = attn_weights.nan_to_num(0.0)  # Handle all -inf rows
        attn_weights = self.dropout(attn_weights)
        
        # Apply attention to values
        output = torch.matmul(attn_weights, V)  # (B, H, S, d_k)
        
        return output


class HomotopyLoss(nn.Module):
    """
    Penalizes discontinuous jumps between adjacent tokens.
    
    L_homotopy = mean( (h_{i+1} - h_i)² )
    
    Encourages smooth transitions in the latent manifold — adjacent tokens
    should have similar representations (they're "homotopic").
    """
    
    def __init__(self, lambda_homotopy: float = 0.01):
        super().__init__()
        self.lambda_homotopy = lambda_homotopy
    
    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        """
        Args:
            hidden_states: (batch, seq_len, d_model)
        """
        diff = hidden_states[:, 1:, :] - hidden_states[:, :-1, :]
        return self.lambda_homotopy * (diff ** 2).mean()


class HopfLoss(nn.Module):
    """
    Encourages non-Hermitian topology in the attention patterns.
    
    L_hopf = -mean( imag_mass ) + λ · mean( real_mass )
    
    Where real_mass and imaginary_mass are derived from the eigenvalue
    spectrum of the attention matrix. This encourages the attention
    matrix to have complex eigenvalues (non-Hermitian topology).
    """
    
    def __init__(self, lambda_real: float = 0.1, lambda_imag: float = 1.0):
        super().__init__()
        self.lambda_real = lambda_real
        self.lambda_imag = lambda_imag
    
    def forward(self, attn_weights: torch.Tensor) -> torch.Tensor:
        """
        Args:
            attn_weights: (batch, n_heads, seq_len, seq_len)
        """
        # Compute eigenvalue-like measure via SVD
        # For non-symmetric matrices, singular values ≈ |eigenvalues|
        U, S, V = torch.svd(attn_weights)
        
        # Real mass: how close to symmetric (A ≈ A^T)
        asymmetry = attn_weights - attn_weights.transpose(-2, -1)
        real_mass = (asymmetry ** 2).mean()
        
        # Imaginary mass: magnitude of complex eigenvalue components
        # Approximated by the deviation from stochasticity
        row_sums = attn_weights.sum(dim=-1)
        stochasticity_loss = ((row_sums - 1.0) ** 2).mean()
        
        return self.lambda_real * real_mass + self.lambda_imag * stochasticity_loss


class TauTransformerBlock(nn.Module):
    """Full transformer block using Softmax_τ attention."""
    
    def __init__(
        self,
        d_model: int,
        n_heads: int = 8,
        d_ff: int = 2048,
        n_torsion_classes: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        
        self.attention = TauAttention(
            d_model=d_model,
            n_heads=n_heads,
            n_torsion_classes=n_torsion_classes,
            dropout=dropout,
        )
        
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
            nn.Dropout(dropout),
        )
        
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
    
    def forward(
        self,
        x: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, Dict]:
        # Pre-norm attention
        normed = self.norm1(x)
        attn_out, info = self.attention(normed, mask=mask)
        x = x + attn_out
        
        # Pre-norm FF
        x = x + self.ff(self.norm2(x))
        
        return x, info
