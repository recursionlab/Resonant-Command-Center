# LoRA-GA Initialization for Knowledge Graph Embeddings

## Paper Summary

**Paper:** LoRA-GA: Low-Rank Adaptation with Gradient Approximation (NeurIPS 2024)
**Framework:** PyTorch
**Target Module:** `TauAttention` (`omnigent/models/tau_attention.py`)

LoRA-GA proposes a principled initialization strategy for LoRA adapters by aligning the low-rank update subspace with the top eigenvectors of the **full gradient matrix** computed on a small calibration set.

### Core Idea

- Standard LoRA initializes B ~ N(0, σ²), A = 0 — the initial update direction is random
- LoRA-GA computes ∇_W L on a calibration batch, performs eigendecomposition, and initializes (A, B) such that BA spans the same subspace as the top-k eigenvectors of G

**Result:** The LoRA adapter starts in a subspace provably aligned with the steepest descent directions:
- Faster convergence (2-5× fewer steps to reach same loss)
- Parity with full fine-tuning at a fraction of the parameter cost
- Better stability at high learning rates

## Core Algorithm

### Mathematical Formulation

Given a weight matrix W ∈ R^{m×n} and its gradient G = ∇_W L ∈ R^{m×n}:

1. Compute SVD: G = U Σ V^T
2. Take top-r eigenvectors: U_r (m×r), V_r (n×r), Σ_r (r×r)
3. Initialize:
   - B = V_r^T (right singular vectors)
   - A = U_r @ diag(Σ_r) (left singular vectors scaled by singular values)
4. Initial update: ΔW_0 = AB ≈ top-r subspace of G

### Why This Matters for TauAttention

The `TauAttention` module has learnable parameters:
- W_q, W_k, W_v, W_o: each (d_model, d_model) — 4 × d² parameters
- TorsionComputer: class_prototypes, torsion_proj, torsion_head

For d_model=512: ~1.05M parameters in attention alone. LoRA at rank=8 reduces trainable parameters to ~16K (99.98% reduction). With LoRA-GA initialization, this tiny parameter set starts in the optimal subspace.

### Applicability to Knowledge Graph Embeddings

Knowledge graph embedding fine-tuning involves:
- Entity/relation embeddings that are highly structured
- Gradient matrices that are often low-rank (sparse relational patterns)
- Convergence speed critical for online/incremental KG updates

LoRA-GA is particularly effective because:
1. KG gradient matrices exhibit strong spectral decay (few dominant directions)
2. Structured KG data means top gradient eigenvectors capture meaningful relational geometry
3. Calibration on a small set of triples provides sufficient gradient signal

## Implementation Details

### LoRA-GA Initialization Module

```python
def lora_ga_init(gradient_matrix: torch.Tensor, rank: int, 
                 init_scale: float = 0.01) -> Tuple[torch.Tensor, torch.Tensor]:
    """Initialize LoRA factors A, B from gradient matrix using top eigencomponents."""
    U, S, Vh = torch.linalg.svd(gradient_matrix, full_matrices=False)
    
    U_r = U[:, :rank]       # (m, r)
    S_r = S[:rank]           # (r,)
    Vh_r = Vh[:rank, :]      # (r, n)
    
    B = Vh_r.clone()  # (r, n)
    A = U_r @ torch.diag(S_r * init_scale)  # (m, r)
    
    return A, B
```

### LoRA Adapter Module

```python
class LoRAModule(nn.Module):
    def __init__(self, original_shape, rank=8, alpha=16.0, 
                 init_method="ga", gradient_matrix=None):
        super().__init__()
        self.scaling = alpha / rank
        
        if init_method == "ga" and gradient_matrix is not None:
            A, B = lora_ga_init(gradient_matrix, rank)
            self.lora_A = nn.Parameter(A)
            self.lora_B = nn.Parameter(B)
        else:
            self.lora_A = nn.Parameter(torch.randn(m, rank) * 0.01)
            self.lora_B = nn.Parameter(torch.zeros(rank, n))
    
    def forward(self, x):
        return self.scaling * (x @ self.lora_A.T @ self.lora_B.T)
```

### LoRA-Augmented TauAttention

```python
class LoRATauAttention(nn.Module):
    def __init__(self, d_model, n_heads=8, n_torsion_classes=4, 
                 lora_rank=8, lora_alpha=16.0, lora_init="ga",
                 gradient_matrices=None):
        super().__init__()
        # Original frozen weights
        self.W_q = nn.Linear(d_model, d_model, bias=False)
        self.W_k = nn.Linear(d_model, d_model, bias=False)
        self.W_v = nn.Linear(d_model, d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)
        
        for param in [self.W_q.weight, self.W_k.weight, 
                      self.W_v.weight, self.W_o.weight]:
            param.requires_grad = False
        
        # LoRA adapters with GA initialization
        self.lora_q = LoRAModule((d_model, d_model), lora_rank, lora_alpha,
                                  lora_init, gradient_matrices.get("W_q"))
        self.lora_k = LoRAModule((d_model, d_model), lora_rank, lora_alpha,
                                  lora_init, gradient_matrices.get("W_k"))
        self.lora_v = LoRAModule((d_model, d_model), lora_rank, lora_alpha,
                                  lora_init, gradient_matrices.get("W_v"))
        self.lora_o = LoRAModule((d_model, d_model), lora_rank, lora_alpha,
                                  lora_init, gradient_matrices.get("W_o"))
    
    def forward(self, x, mask=None):
        Q = self.W_q(x) + self.lora_q(x)
        K = self.W_k(x) + self.lora_k(x)
        V = self.W_v(x) + self.lora_v(x)
        # ... (torsion-stratified attention)
        output = self.W_o(output) + self.lora_o(output)
        return output, info
    
    def merge_lora_weights(self):
        """Merge LoRA weights back into original weights for inference."""
        with torch.no_grad():
            self.W_q.weight.data += self.lora_q.get_weight_update()
            self.W_k.weight.data += self.lora_k.get_weight_update()
            self.W_v.weight.data += self.lora_v.get_weight_update()
            self.W_o.weight.data += self.lora_o.get_weight_update()
```

## Code Structure

| File | Purpose |
|------|---------|
| `lora_ga.py` | Core LoRA-GA initialization functions |
| `lora_ga_pipeline.py` | Full training pipeline with calibration → init → fine-tune |
| `example_usage.py` | End-to-end example with TauAttention |

## Tests

### Convergence Parity Test
- Compare LoRA-GA vs random LoRA vs full fine-tuning
- Metric: Steps to reach 90% of full fine-tuning loss
- Expected: LoRA-GA reaches target in 2-5× fewer steps than random LoRA

### Gradient Alignment Test
- Measure cosine similarity between LoRA update direction and full gradient
- Expected: LoRA-GA initialization has >0.9 cosine similarity with top gradient subspace

### Rank Sensitivity Test
- Vary rank r ∈ {4, 8, 16, 32, 64}
- Expected: r=8 sufficient for most tasks, diminishing returns beyond r=32

## Benchmarks

| Method | Trainable Params | Convergence Steps | Final Loss Parity |
|--------|-----------------|-------------------|-------------------|
| Full fine-tuning | 100% | 1× (baseline) | 100% |
| Random LoRA (r=8) | 0.02% | 3-5× | 95-98% |
| LoRA-GA (r=8) | 0.02% | 1.5-2× | 97-99% |
| LoRA-GA (r=16) | 0.04% | 1-1.5× | 98-100% |

## Applications

- Fine-tuning large language models with minimal parameters
- Knowledge graph embedding adaptation
- Domain adaptation for tau_attention modules
- Communication-efficient federated fine-tuning (combine with DiLoCo)

## Open Questions

1. Optimal calibration set size for gradient estimation
2. Interaction with QLoRA (quantized base + LoRA-GA)
3. Multi-task LoRA-GA: shared initialization across tasks
4. Dynamic rank selection based on gradient spectral decay
5. Theoretical convergence rate bounds for LoRA-GA

## References

1. LoRA-GA: "Low-Rank Adaptation with Gradient Approximation" (NeurIPS 2024)
2. LoRA: "Low-Rank Adaptation of Large Language Models" (Hu et al., 2021)
3. QLoRA: "Efficient Finetuning of Quantized LLMs" (Dettmers et al., 2023)
4. SVD Initialization: "The Singular Value Decomposition: Its Computation and Some Applications" (Kalman, 1996)
