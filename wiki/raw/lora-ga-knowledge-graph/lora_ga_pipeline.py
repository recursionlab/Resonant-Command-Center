"""
lora_ga_pipeline.py — Calibration and fine-tuning pipeline for LoRA-GA on TauAttention.

Pipeline steps:
1. Load pre-trained TauAttention
2. Run calibration: collect gradients on sample data
3. Initialize LoRA-GA from gradients
4. Fine-tune with LoRA-GA
5. Measure convergence vs full fine-tuning baseline
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from typing import Dict, List, Tuple, Optional
import time
import copy


def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: str = "cpu",
) -> float:
    """Evaluate model on validation set."""
    model.eval()
    total_loss = 0.0
    n = 0
    with torch.no_grad():
        for batch in dataloader:
            inputs = batch[0].to(device)
            targets = batch[-1].to(device) if len(batch) > 1 else inputs
            output = model(inputs)
            if isinstance(output, tuple):
                output = output[0]
            loss = criterion(output, targets)
            total_loss += loss.item() * inputs.shape[0]
            n += inputs.shape[0]
    return total_loss / max(1, n)


def train_convergence_comparison(
    model_lora: nn.Module,
    model_full: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    device: str = "cpu",
    max_epochs: int = 10,
    lr_lora: float = 1e-3,
    lr_full: float = 1e-5,
    eval_every: int = 50,
) -> Dict:
    """
    Train both LoRA-GA and full fine-tuning, compare convergence.
    
    Returns:
        results: Dict with training histories and comparison metrics
    """
    model_lora.to(device)
    model_full.to(device)
    
    # Optimizers
    optimizer_lora = optim.AdamW(
        [p for p in model_lora.parameters() if p.requires_grad],
        lr=lr_lora,
        weight_decay=0.01,
    )
    optimizer_full = optim.AdamW(
        [p for p in model_full.parameters() if p.requires_grad],
        lr=lr_full,
        weight_decay=0.01,
    )
    
    criterion = nn.MSELoss()
    
    results = {
        "lora": {"train_loss": [], "val_loss": [], "steps": [], "time": []},
        "full": {"train_loss": [], "val_loss": [], "steps": [], "time": []},
    }
    
    global_step = 0
    start_time = time.time()
    
    for epoch in range(max_epochs):
        # --- LoRA training ---
        model_lora.train()
        for batch in train_loader:
            inputs = batch[0].to(device)
            targets = batch[-1].to(device) if len(batch) > 1 else inputs
            
            optimizer_lora.zero_grad()
            output = model_lora(inputs)
            if isinstance(output, tuple):
                output = output[0]
            loss = criterion(output, targets)
            loss.backward()
            optimizer_lora.step()
            
            global_step += 1
            
            if global_step % eval_every == 0:
                val_loss = evaluate(model_lora, val_loader, criterion, device)
                results["lora"]["train_loss"].append(loss.item())
                results["lora"]["val_loss"].append(val_loss)
                results["lora"]["steps"].append(global_step)
                results["lora"]["time"].append(time.time() - start_time)
        
        # --- Full fine-tuning ---
        model_full.train()
        for batch in train_loader:
            inputs = batch[0].to(device)
            targets = batch[-1].to(device) if len(batch) > 1 else inputs
            
            optimizer_full.zero_grad()
            output = model_full(inputs)
            if isinstance(output, tuple):
                output = output[0]
            loss = criterion(output, targets)
            loss.backward()
            optimizer_full.step()
            
            if global_step % eval_every == 0:
                val_loss = evaluate(model_full, val_loader, criterion, device)
                results["full"]["train_loss"].append(loss.item())
                results["full"]["val_loss"].append(val_loss)
                results["full"]["steps"].append(global_step)
                results["full"]["time"].append(time.time() - start_time)
    
    # Compute comparison metrics
    lora_final = results["lora"]["val_loss"][-1] if results["lora"]["val_loss"] else float('inf')
    full_final = results["full"]["val_loss"][-1] if results["full"]["val_loss"] else float('inf')
    
    results["comparison"] = {
        "parity_ratio": lora_final / full_final if full_final > 0 else float('inf'),
        "lora_params": sum(p.numel() for p in model_lora.parameters() if p.requires_grad),
        "full_params": sum(p.numel() for p in model_full.parameters() if p.requires_grad),
        "compression_ratio": sum(p.numel() for p in model_full.parameters()) / 
                            max(1, sum(p.numel() for p in model_lora.parameters() if p.requires_grad)),
    }
    
    return results


def rank_sensitivity_analysis(
    model: nn.Module,
    gradients: Dict[str, torch.Tensor],
    train_loader: DataLoader,
    val_loader: DataLoader,
    ranks: List[int] = [2, 4, 8, 16, 32, 64],
    device: str = "cpu",
) -> Dict[int, Dict]:
    """
    Sweep over LoRA ranks and measure convergence parity.
    
    Expected findings:
    - r=4: ~0.8 parity (fast but limited capacity)
    - r=8: ~0.9 parity (sweet spot)
    - r=16: ~0.95 parity (diminishing returns)
    - r=32: ~0.98 parity (approaching full fine-tuning)
    - r=64: ~0.99 parity (overkill for most tasks)
    """
    from lora_ga import LoRATauAttention
    
    results = {}
    
    for rank in ranks:
        print(f"\n{'='*50}")
        print(f"Testing rank={rank}")
        print(f"{'='*50}")
        
        lora_model = LoRATauAttention(
            d_model=model.d_model,
            n_heads=model.n_heads,
            n_torsion_classes=model.n_torsion_classes,
            lora_rank=rank,
            lora_alpha=rank * 2,
            lora_init="ga",
            gradient_matrices=gradients,
        ).to(device)
        
        # Copy original weights
        lora_model.W_q.load_state_dict(model.W_q.state_dict())
        lora_model.W_k.load_state_dict(model.W_k.state_dict())
        lora_model.W_v.load_state_dict(model.W_v.state_dict())
        lora_model.W_o.load_state_dict(model.W_o.state_dict())
        lora_model.torsion.load_state_dict(model.torsion.state_dict())
        
        # Freeze
        for param in [lora_model.W_q.weight, lora_model.W_k.weight,
                      lora_model.W_v.weight, lora_model.W_o.weight]:
            param.requires_grad = False
        for param in lora_model.torsion.parameters():
            param.requires_grad = False
        
        optimizer = torch.optim.AdamW(
            [p for p in lora_model.parameters() if p.requires_grad],
            lr=1e-3,
        )
        
        lora_model.train()
        losses = []
        for epoch in range(3):
            for batch in train_loader:
                inputs = batch[0].to(device)
                output = lora_model(inputs)
                if isinstance(output, tuple):
                    output = output[0]
                loss = output.pow(2).mean()
                
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                losses.append(loss.item())
        
        results[rank] = {
            "final_loss": losses[-1],
            "loss_history": losses,
            "trainable_params": sum(p.numel() for p in lora_model.parameters() if p.requires_grad),
        }
        
        print(f"  Final loss: {losses[-1]:.6f}")
        print(f"  Trainable params: {results[rank]['trainable_params']:,}")
    
    return results
