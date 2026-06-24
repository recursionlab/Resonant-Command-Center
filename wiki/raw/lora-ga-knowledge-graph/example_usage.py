"""
example_usage.py — Complete example of applying LoRA-GA to TauAttention

Usage:
    python example_usage.py

This demonstrates the full pipeline:
1. Create/load pre-trained TauAttention
2. Calibrate gradients on sample data
3. Apply LoRA-GA initialization
4. Fine-tune and compare with full fine-tuning baseline
"""

import torch
from torch.utils.data import DataLoader, TensorDataset
import copy
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lora_ga import (
    LoRATauAttention,
    calibrate_gradients,
    measure_gradient_alignment,
)
from lora_ga_pipeline import train_convergence_comparison


def main():
    # Configuration
    D_MODEL = 256
    N_HEADS = 8
    SEQ_LEN = 64
    BATCH_SIZE = 16
    LORA_RANK = 8
    LORA_ALPHA = 16.0
    CALIBRATION_BATCHES = 20
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    
    print(f"Using device: {DEVICE}")
    print(f"Configuration: d_model={D_MODEL}, n_heads={N_HEADS}, seq_len={SEQ_LEN}")
    print(f"LoRA: rank={LORA_RANK}, alpha={LORA_ALPHA}")
    print()
    
    # Create synthetic data (replace with actual KG embedding data)
    # Simulating knowledge graph attention inputs
    calib_data = torch.randn(256, SEQ_LEN, D_MODEL)
    calib_loader = DataLoader(
        TensorDataset(calib_data),
        batch_size=BATCH_SIZE,
        shuffle=False,
    )
    
    train_data = torch.randn(1024, SEQ_LEN, D_MODEL)
    train_targets = torch.randn(1024, SEQ_LEN, D_MODEL)
    train_loader = DataLoader(
        TensorDataset(train_data, train_targets),
        batch_size=BATCH_SIZE,
        shuffle=True,
    )
    
    # Step 1: Create pre-trained TauAttention
    # In production: load from checkpoint
    from lora_ga import TorsionComputer
    
    # Build a minimal TauAttention-like model for demonstration
    class SimpleTauAttention(torch.nn.Module):
        def __init__(self, d_model, n_heads, n_torsion_classes=4):
            super().__init__()
            self.d_model = d_model
            self.n_heads = n_heads
            self.n_torsion_classes = n_torsion_classes
            self.W_q = torch.nn.Linear(d_model, d_model, bias=False)
            self.W_k = torch.nn.Linear(d_model, d_model, bias=False)
            self.W_v = torch.nn.Linear(d_model, d_model, bias=False)
            self.W_o = torch.nn.Linear(d_model, d_model, bias=False)
            self.torsion = TorsionComputer(d_model, n_torsion_classes)
        
        def forward(self, x, mask=None):
            batch, seq_len, d = x.shape
            Q = self.W_q(x)
            K = self.W_k(x)
            V = self.W_v(x)
            torsion_logits = self.torsion.torsion_head(
                self.torsion.torsion_proj(Q.mean(dim=1, keepdim=True).expand(-1, seq_len, -1) * 
                                            K.mean(dim=1, keepdim=True).expand(-1, seq_len, -1))
            )
            tau = torsion_logits.argmax(dim=-1)
            # Simplified attention for calibration demo
            scores = torch.bmm(Q, K.transpose(1, 2)) / (d ** 0.5)
            attn = torch.softmax(scores, dim=-1)
            output = torch.bmm(attn, V)
            output = self.W_o(output)
            return output, {"tau": tau}
    
    original_attn = SimpleTauAttention(D_MODEL, N_HEADS).to(DEVICE)
    
    print(f"Original parameters: {sum(p.numel() for p in original_attn.parameters()):,}")
    
    # Step 2: Calibrate gradients
    target_params = [
        "W_q.weight", "W_k.weight", "W_v.weight", "W_o.weight",
    ]
    
    gradients = calibrate_gradients(
        model=original_attn,
        dataloader=calib_loader,
        target_names=target_params,
        device=DEVICE,
        max_batches=CALIBRATION_BATCHES,
    )
    
    # Step 3: Apply LoRA-GA
    gradient_map = {
        "W_q": gradients.get("W_q.weight"),
        "W_k": gradients.get("W_k.weight"),
        "W_v": gradients.get("W_v.weight"),
        "W_o": gradients.get("W_o.weight"),
    }
    
    lora_attn = LoRATauAttention(
        d_model=D_MODEL,
        n_heads=N_HEADS,
        n_torsion_classes=4,
        lora_rank=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        lora_init="ga",
        gradient_matrices=gradient_map,
    ).to(DEVICE)
    
    # Copy original weights
    lora_attn.W_q.load_state_dict(original_attn.W_q.state_dict())
    lora_attn.W_k.load_state_dict(original_attn.W_k.state_dict())
    lora_attn.W_v.load_state_dict(original_attn.W_v.state_dict())
    lora_attn.W_o.load_state_dict(original_attn.W_o.state_dict())
    lora_attn.torsion.load_state_dict(original_attn.torsion.state_dict())
    
    # Freeze original weights
    for param in [lora_attn.W_q.weight, lora_attn.W_k.weight,
                  lora_attn.W_v.weight, lora_attn.W_o.weight]:
        param.requires_grad = False
    for param in lora_attn.torsion.parameters():
        param.requires_grad = False
    
    lora_params = sum(p.numel() for p in lora_attn.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in original_attn.parameters())
    print(f"\nLoRA trainable parameters: {lora_params:,}")
    print(f"Compression ratio: {total_params / lora_params:.1f}x")
    
    # Step 4: Measure gradient alignment
    alignment = measure_gradient_alignment(lora_attn, gradient_map)
    print(f"\nGradient alignment scores:")
    for key, score in alignment.items():
        print(f"  {key}: {score:.4f}")
    
    # Step 5: Train and compare
    full_attn = copy.deepcopy(original_attn)
    
    print("\n--- Starting convergence comparison ---")
    results = train_convergence_comparison(
        model_lora=lora_attn,
        model_full=full_attn,
        train_loader=train_loader,
        val_loader=train_loader,  # Use separate val set in practice
        device=DEVICE,
        max_epochs=3,
        lr_lora=1e-3,
        lr_full=1e-5,
        eval_every=20,
    )
    
    print("\n=== Results ===")
    print(f"LoRA-GA final val loss: {results['lora']['val_loss'][-1]:.6f}")
    print(f"Full fine-tune final val loss: {results['full']['val_loss'][-1]:.6f}")
    print(f"Parity ratio: {results['comparison']['parity_ratio']:.4f}")
    print(f"Compression: {results['comparison']['compression_ratio']:.1f}x")
    
    # Step 6: Merge weights for deployment
    lora_attn.merge_lora_weights()
    print("\nLoRA weights merged into original model for inference.")
    print("Done.")


if __name__ == "__main__":
    main()
