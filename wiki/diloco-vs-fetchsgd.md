# DiLoCo vs FetchSGD: Communication Efficiency Comparison

## Overview

This report compares two state-of-the-art communication-efficient distributed training algorithms:

- **DiLoCo** (Distributed Low-Communication Optimization): Uses inner AdamW optimizer steps locally, then communicates outer Nesterov momentum updates. Achieves ~500x communication reduction.
- **FetchSGD**: Uses Count Sketch compression with linear sketch accumulation for gradient communication. Achieves ~10-100x compression via sparse recovery.

Both target the communication bottleneck in distributed fine-tuning of large models, but take fundamentally different approaches: DiLoCo reduces communication *frequency*, while FetchSGD reduces communication *volume per round*.

## Architecture Comparison

### DiLoCo (Inner-Outer Optimizer Architecture)

**Core Mechanism:**
1. **Inner Loop**: Each worker runs local AdamW steps for K iterations (e.g., K=500)
2. **Outer Loop**: Workers synchronize via Nesterov momentum on the *model parameters* (not gradients)
3. Communication only happens at outer loop boundaries

**Mathematical Formulation:**
```
Inner (local):  θ_{t+1}^i = AdamW(θ_t^i, ∇L(θ_t^i))  // K steps
Outer (sync):   θ_{t+K} = (1-α)·θ_{t+K}^i + α·Σ_j(θ_{t+K}^j) / N  // Nesterov momentum
```

**Key Properties:**
- Inner optimizer: AdamW (adaptive learning rate, weight decay)
- Outer optimizer: Nesterov momentum across workers
- Communication: Full model parameters (dense) but infrequently
- Compression: None — relies on *temporal sparsity* (less frequent sync)
- Convergence: Provably matches standard distributed training under certain conditions

### FetchSGD (Count Sketch Compression)

**Core Mechanism:**
1. **Compress**: Apply Count Sketch to gradient vectors → sparse representation
2. **Accumulate**: Linear sketch accumulation across workers (sketches are additive)
3. **Recover**: Use sparse recovery algorithm to reconstruct
4. **Update**: Apply recovered gradient with local optimizer step

**Mathematical Formulation:**
```
Compress:   c_i = CS(g_i)           // Count Sketch of gradient
Aggregate:  C = Σ_i c_i             // Linear accumulation (no decompression needed)
Recover:    ĝ = Recover(C)         // Sparse recovery → approximate gradient
Update:     θ_{t+1} = Optimizer(θ_t, ĝ)
```

**Key Properties:**
- Compression: Count Sketch (randomized hash-based dimensionality reduction)
- Aggregation: Sketches are linearly aggregatable
- Communication: O(ε⁻² log d) per round (much smaller than O(d))
- Compression ratio: ~10-100x depending on sketch size

### Side-by-Side Architecture Table

| Property | DiLoCo | FetchSGD |
|----------|--------|----------|
| **Communication strategy** | Reduce frequency | Reduce volume per round |
| **What is communicated** | Model parameters (dense) | Compressed gradient sketches |
| **Compression type** | None (temporal sparsity) | Count Sketch (algorithmic) |
| **Per-round cost** | O(d) | O(s), s << d |
| **Rounds reduced** | K× (e.g., 500×) | Continuous (every step) |
| **Inner optimizer** | AdamW | Any (SGD, Adam, etc.) |
| **Outer optimizer** | Nesterov momentum | None (compression handles variance) |
| **Convergence guarantee** | Matches distributed AdamW | Approximate (sketch error bounded) |
| **Heterogeneity handling** | Good (local steps adapt) | Moderate (sketch error accumulates) |
| **Implementation complexity** | Medium (two-level optimizer) | High (sketch + recovery) |

## Performance Comparison

### Communication Efficiency

**DiLoCo:**
- 500× communication reduction (K=500 local steps)
- Each sync: full model size (e.g., 7B params × 2 bytes = 14 GB for bf16)
- Total volume for 1000 steps: 14 GB × 2 rounds = 28 GB
- vs. standard: 14 GB × 1000 = 14 TB → **500× reduction**

**FetchSGD:**
- ~100× compression via Count Sketch (typical sketch size = 1% of gradient)
- Each step: sketch size (e.g., 7B × 0.01 × 2 bytes = 140 MB)
- Total volume for 1000 steps: 140 MB × 1000 = 140 GB
- vs. standard: 14 GB × 1000 = 14 TB → **100× reduction**

**Winner for total reduction:** DiLoCo (500× vs 100×)
**Winner for per-step consistency:** FetchSGD (every step, not bursty)

### Convergence Quality

**DiLoCo:**
- Provably converges to same solution as distributed AdamW
- Nesterov momentum provides acceleration
- No approximation error in communication

**FetchSGD:**
- Convergence to approximate solution (sketch introduces bounded error)
- Error decreases as sketch size increases
- Variance from sketch recovery can slow convergence

**Winner for convergence quality:** DiLoCo (exact communication)

### Computational Overhead

**DiLoCo:** ~1-2% overhead (standard AdamW + simple Nesterov)
**FetchSGD:** ~5-15% overhead (sketch + iterative recovery)

**Winner for low overhead:** DiLoCo

### Scalability

**DiLoCo:** Straggler problem — all workers must complete K steps before sync
**FetchSGD:** Straggler-resilient — can aggregate partial sketches, async-friendly

**Winner for scalability:** FetchSGD

## Tradeoffs

### DiLoCo Tradeoffs

**Pros:**
- Exact communication (no approximation error)
- Provable convergence matching distributed training
- Simple implementation (just two optimizer levels)
- No per-step computational overhead
- Works with any model architecture

**Cons:**
- Bursty communication (not smooth)
- Straggler vulnerability (sync barrier every K steps)
- Staleness: Workers use stale global info during local steps
- K selection is problem-dependent

### FetchSGD Tradeoffs

**Pros:**
- Smooth communication (every step, same volume)
- Linear aggregation (no decompression bottleneck)
- Straggler-friendly
- Asynchronous variants possible
- Better for federated settings

**Cons:**
- Approximate communication (sketch error)
- Higher per-step computational overhead
- More complex implementation
- Sketch size vs. accuracy tradeoff

### Decision Matrix

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Homogeneous cluster, full fine-tuning | **DiLoCo** | Simpler, exact, 500× reduction |
| Heterogeneous/federated setting | **FetchSGD** | Async-friendly, smooth communication |
| LoRA/QLoRA fine-tuning | **DiLoCo** | Nesterov on LoRA params is trivial |
| Very large models (>100B) | **FetchSGD** | Per-round volume matters more |
| Bandwidth-constrained network | **FetchSGD** | Small per-step messages |
| Latency-sensitive training | **DiLoCo** | No per-step overhead |
| High data heterogeneity | **FetchSGD** | Local steps + compression handles diversity |
| Need exact convergence | **DiLoCo** | No approximation error |

## When to Use Which

### Choose DiLoCo When:
1. Homogeneous cluster with reliable networking
2. Exact convergence guarantees needed
3. Minimal implementation complexity desired
4. Full fine-tuning with AdamW
5. Communication frequency (not volume) is the bottleneck

### Choose FetchSGD When:
1. Federated or heterogeneous setting
2. Smooth, non-bursty communication needed
3. Per-step latency matters
4. Very large models where per-round volume matters
5. Straggler workers or unreliable networking

## Omnigent Federated Knowledge Lattice Recommendation

### Analysis for Omnigent

The Omnigent federated knowledge lattice has:
1. **Distributed agents** with varying compute capabilities
2. **Knowledge graph embeddings** (tau_attention module)
3. **Periodic synchronization** (not continuous)
4. **Heterogeneous data** across agents
5. **QLoRA-based fine-tuning** (from existing codebase)
6. **Compression engine already exists** (TopK + Quantization + EF21)

### Recommendation: DiLoCo as primary, FetchSGD as fallback

**Rationale:**
1. Existing `compression.py` already implements TopK+Quantization+EF21. DiLoCo offers complementary temporal sparsity.
2. Knowledge lattice agents sync periodically, matching DiLoCo's bursty pattern.
3. QLoRA fine-tuning benefits from AdamW's adaptive learning rates (DiLoCo's inner loop).
4. Exact communication preserves knowledge graph consistency better than approximate sketches.
5. Simpler implementation — ~50 lines added to existing distributed training.

**When to switch to FetchSGD:**
- Highly heterogeneous compute across agents
- Extremely constrained network bandwidth (<10 Mbps)
- Need continuous async updates without sync barriers

### Hybrid Approach (Future Work)

A hybrid DiLoCo-FetchSGD could combine both:
- DiLoCo's inner-outer structure for temporal sparsity
- Count Sketch compression on the outer sync
- Potential: ~500× × 100× = ~50,000× total reduction

## Code Examples

See raw research outputs in `wiki/raw/diloco-vs-fetchsgd/compare.md` for full PyTorch implementations of:
- `DiLoCoOptimizer` (inner AdamW + outer Nesterov)
- `CountSketch` compressor
- `FetchSGDOptimizer` (sketch-based gradient compression)
- `FGRPOServer` / `FGRPOClient` (federated variants)

## References

1. DiLoCo: "Distributed Low-Communication Optimization" (arXiv:2311.08814)
2. FetchSGD: "Communication-Efficient Federated Learning with Sketching" (arXiv:2106.07209)
3. DeepSeekMath (2024) — uses GRPO with DiLoCo-style communication
4. FedAvg: "Communication-Efficient Learning of Deep Networks from Decentralized Data" (McMahan et al., 2017)
5. Count Sketch: "Finding Frequent Items in Data Streams" (Charikar et al., 2002)
