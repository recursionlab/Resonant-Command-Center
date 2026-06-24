# GRPO Research — Key Findings Summary

## Finding 1: GRPO Eliminates the Critic
- PPO requires syncing both policy AND critic parameters (2x communication)
- GRPO uses group scores as baseline — no critic network needed
- Communication savings: 50% of PPO baseline (critic eliminated)

## Finding 2: U-Statistics Baseline Theory
- Group mean is a U-statistic: unbiased, consistent, minimum-variance estimator
- Baseline variance scales as σ²/G — diminishing returns with larger groups
- Optimal G = O(σ²/ε²) where ε is target advantage estimation error

## Finding 3: Group Size Scaling Law
- G=4-16: Sufficient for most RLHF tasks
- G=64-256: Needed for high-variance rewards (math reasoning)
- Beyond G=256: <1% improvement per doubling
- DeepSeek uses G=64 for mathematical reasoning

## Finding 4: Federated GRPO (FGRPO)
- Extends GRPO to non-IID federated settings
- Adaptive aggregation: inverse-variance weighting of client baselines
- Communication: O(C) extra scalars per round (negligible vs gradients)
- Robust to heterogeneous client reward distributions

## Finding 5: Integration with Omnigent Pipeline
- GRPO complements (does not replace) existing gradient compression
- Combined: GRPO (eliminates critic) + Top-K (compresses policy gradients) = ~1000x reduction
- Fits DiLoCo island architecture: GRPO as intra-island RL optimizer
- Stateless critic → simpler tiered checkpointing

## Finding 6: Open Challenges
- Non-IID federated settings: optimal G differs from centralized
- Interaction with LoRA fine-tuning unexplored
- Multi-objective rewards not natively supported
- Dynamic group size adaptation is untested
- Connection to Softmax_τ torsion partitioning unexplored
