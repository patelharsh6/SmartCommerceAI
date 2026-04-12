"""
Training Pipeline for Model 2 — Session-Aware Recommendations

Reads clickstream_eventsput.csv, builds session sequences, trains the
GRU4Rec + Transformer hybrid model, and serialises artifacts to data/model3/.

Usage:
    python -m app.train_session_rec
"""

import os
import sys
import json
import time
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from collections import defaultdict
from datetime import datetime

# Ensure UTF-8 output on Windows
os.environ.setdefault("PYTHONIOENCODING", "UTF-8")
sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(DATA_DIR, "model3")
os.makedirs(MODEL_DIR, exist_ok=True)

from app.models.session_rec_model import SessionRecModel


# ═══════════════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ═══════════════════════════════════════════════════════════════════════
print("=" * 65)
print("  SESSION-AWARE RECOMMENDATION MODEL — TRAINING PIPELINE")
print("=" * 65)

CLICKSTREAM_PATH = os.path.join(DATA_DIR, "clickstream_eventsput.csv")
CATALOG_PATH = os.path.join(DATA_DIR, "product_catalog.csv")

# We sample the clickstream to ensure instant CPU building
SAMPLE_SIZE = 250_000

print(f"\n[1/7] Loading clickstream data (sampling {SAMPLE_SIZE:,} rows)...")
t0 = time.time()

# Count total lines first for skiprows sampling
total_lines = sum(1 for _ in open(CLICKSTREAM_PATH, encoding="utf-8")) - 1
print(f"       Total events in file: {total_lines:,}")

if total_lines > SAMPLE_SIZE:
    events_df = pd.read_csv(CLICKSTREAM_PATH, nrows=SAMPLE_SIZE)
else:
    events_df = pd.read_csv(CLICKSTREAM_PATH)

print(f"       Loaded {len(events_df):,} events in {time.time()-t0:.1f}s")

# Load catalog for SKU mapping
catalog_df = pd.read_csv(CATALOG_PATH)
all_skus = sorted(catalog_df["sku_id"].unique().tolist())

# Build SKU → integer index mapping (0 = padding)
sku_to_idx = {sku: i + 1 for i, sku in enumerate(all_skus)}
idx_to_sku = {v: k for k, v in sku_to_idx.items()}
NUM_ITEMS = len(sku_to_idx) + 1  # +1 for padding index 0

print(f"       Unique SKUs: {len(all_skus):,}, Vocabulary size: {NUM_ITEMS:,}")


# ═══════════════════════════════════════════════════════════════════════
# 2. BUILD SESSION SEQUENCES
# ═══════════════════════════════════════════════════════════════════════
print("\n[2/7] Building session sequences...")
t0 = time.time()

# Sort by session and timestamp
events_df["timestamp"] = pd.to_datetime(events_df["timestamp"], errors="coerce")
events_df = events_df.dropna(subset=["timestamp", "session_id", "sku_id"])
events_df = events_df.sort_values(["session_id", "timestamp"])

# Only keep interaction events
INTERACTION_EVENTS = {"page_view", "product_view", "add_to_cart", "purchase", "search"}
events_df = events_df[events_df["event_type"].isin(INTERACTION_EVENTS)]

# Encode context features
DEVICE_MAP = {d: i for i, d in enumerate(events_df["device_type"].unique())}
REFERRAL_MAP = {r: i for i, r in enumerate(events_df["referral_source"].unique())}
N_DEVICES = len(DEVICE_MAP)
N_REFERRALS = len(REFERRAL_MAP)
N_CONTEXT = N_DEVICES + N_REFERRALS + 1  # +1 for hour_of_day (normalised)

# Build sequences per session
MAX_SEQ_LEN = 50
MIN_SEQ_LEN = 3   # sessions shorter than 3 aren't useful

sessions = defaultdict(list)
session_context = {}

for _, row in events_df.iterrows():
    sid = row["session_id"]
    sku = row["sku_id"]
    if sku in sku_to_idx:
        sessions[sid].append(sku_to_idx[sku])
        if sid not in session_context:
            # One-hot device
            device_vec = [0.0] * N_DEVICES
            dev = DEVICE_MAP.get(row.get("device_type"), 0)
            device_vec[dev] = 1.0
            # One-hot referral
            ref_vec = [0.0] * N_REFERRALS
            ref = REFERRAL_MAP.get(row.get("referral_source"), 0)
            ref_vec[ref] = 1.0
            # Normalised hour
            hour = float(row.get("hour_of_day", 12)) / 24.0
            session_context[sid] = device_vec + ref_vec + [hour]

# Filter by min length and truncate to max length
valid_sessions = {
    sid: seq[-MAX_SEQ_LEN:]
    for sid, seq in sessions.items()
    if len(seq) >= MIN_SEQ_LEN
}

print(f"       Total sessions: {len(sessions):,}")
print(f"       Valid sessions (>={MIN_SEQ_LEN} events): {len(valid_sessions):,}")
print(f"       Context features dim: {N_CONTEXT}")
print(f"       Time: {time.time()-t0:.1f}s")


# ═══════════════════════════════════════════════════════════════════════
# 3. DATASET & DATALOADER
# ═══════════════════════════════════════════════════════════════════════
print("\n[3/7] Building training dataset...")

class SessionDataset(Dataset):
    """
    For each session [i1, i2, ..., iN], create training pairs:
      input:  [i1, i2, ..., i_{N-1}]
      target: i_N  (predict the last item)
    """

    def __init__(self, sessions_dict, context_dict, max_len=50, n_context=10):
        self.inputs = []
        self.targets = []
        self.contexts = []
        self.max_len = max_len
        self.n_context = n_context

        for sid, seq in sessions_dict.items():
            # Multiple training samples per session via sliding window
            for end_idx in range(MIN_SEQ_LEN, len(seq) + 1):
                input_seq = seq[:end_idx - 1]
                target = seq[end_idx - 1]
                ctx = context_dict.get(sid, [0.0] * n_context)
                self.inputs.append(input_seq)
                self.targets.append(target)
                self.contexts.append(ctx)

        print(f"       Generated {len(self.inputs):,} training samples")

    def __len__(self):
        return len(self.inputs)

    def __getitem__(self, idx):
        seq = self.inputs[idx]
        # Pad sequence to max_len
        padded = [0] * (self.max_len - len(seq)) + seq
        mask = [True] * (self.max_len - len(seq)) + [False] * len(seq)
        return (
            torch.tensor(padded, dtype=torch.long),
            torch.tensor(mask, dtype=torch.bool),
            torch.tensor(self.contexts[idx], dtype=torch.float),
            torch.tensor(self.targets[idx], dtype=torch.long),
        )


dataset = SessionDataset(valid_sessions, session_context, MAX_SEQ_LEN, N_CONTEXT)

# Train / validation split (90/10)
train_size = int(0.9 * len(dataset))
val_size = len(dataset) - train_size
train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])

BATCH_SIZE = 256
train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, drop_last=True)
val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

print(f"       Train samples: {train_size:,}, Val samples: {val_size:,}")


# ═══════════════════════════════════════════════════════════════════════
# 4. MODEL INITIALISATION
# ═══════════════════════════════════════════════════════════════════════
print("\n[4/7] Initialising SessionRecModel...")

EMBED_DIM = 128
GRU_HIDDEN = 128
GRU_LAYERS = 2
TF_HEADS = 4
TF_LAYERS = 2
DROPOUT = 0.2
LR = 1e-3
EPOCHS = 10

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"       Device: {device}")

model = SessionRecModel(
    num_items=NUM_ITEMS,
    n_context_features=N_CONTEXT,
    embed_dim=EMBED_DIM,
    gru_hidden=GRU_HIDDEN,
    gru_layers=GRU_LAYERS,
    tf_heads=TF_HEADS,
    tf_layers=TF_LAYERS,
    tf_ff=EMBED_DIM * 2,
    dropout=DROPOUT,
    max_seq_len=MAX_SEQ_LEN,
).to(device)

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"       Total params: {total_params:,}")
print(f"       Trainable params: {trainable_params:,}")

optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-5)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=2, factor=0.5)
criterion = nn.CrossEntropyLoss()


# ═══════════════════════════════════════════════════════════════════════
# 5. TRAINING LOOP
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[5/7] Training for {EPOCHS} epochs...")
print("-" * 65)

best_val_loss = float("inf")
history = {"train_loss": [], "val_loss": [], "val_hr10": [], "val_mrr": []}

for epoch in range(1, EPOCHS + 1):
    # --- Train ---
    model.train()
    train_loss = 0.0
    n_batches = 0

    for batch in train_loader:
        item_seq, padding_mask, context, target = [b.to(device) for b in batch]

        scores = model(item_seq, context, padding_mask)
        loss = criterion(scores, target)

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        optimizer.step()

        train_loss += loss.item()
        n_batches += 1

    avg_train_loss = train_loss / max(n_batches, 1)

    # --- Validate ---
    model.eval()
    val_loss = 0.0
    val_batches = 0
    hits_at_10 = 0
    mrr_sum = 0.0
    total_samples = 0

    with torch.no_grad():
        for batch in val_loader:
            item_seq, padding_mask, context, target = [b.to(device) for b in batch]

            scores = model(item_seq, context, padding_mask)
            loss = criterion(scores, target)
            val_loss += loss.item()
            val_batches += 1

            # Compute Hit Rate@10 and MRR
            _, topk = torch.topk(scores, 10, dim=-1)
            for i in range(target.size(0)):
                t = target[i].item()
                ranked = topk[i].tolist()
                if t in ranked:
                    hits_at_10 += 1
                    rank = ranked.index(t) + 1
                    mrr_sum += 1.0 / rank
                total_samples += 1

    avg_val_loss = val_loss / max(val_batches, 1)
    hr10 = hits_at_10 / max(total_samples, 1)
    mrr = mrr_sum / max(total_samples, 1)

    scheduler.step(avg_val_loss)

    history["train_loss"].append(avg_train_loss)
    history["val_loss"].append(avg_val_loss)
    history["val_hr10"].append(hr10)
    history["val_mrr"].append(mrr)

    marker = " *" if avg_val_loss < best_val_loss else ""
    if avg_val_loss < best_val_loss:
        best_val_loss = avg_val_loss
        torch.save(model.state_dict(), os.path.join(MODEL_DIR, "session_rec_model.pt"))

    print(
        f"  Epoch {epoch:2d}/{EPOCHS} | "
        f"Train Loss: {avg_train_loss:.4f} | "
        f"Val Loss: {avg_val_loss:.4f} | "
        f"HR@10: {hr10:.4f} | "
        f"MRR: {mrr:.4f}{marker}"
    )

print("-" * 65)


# ═══════════════════════════════════════════════════════════════════════
# 6. SAVE ARTIFACTS
# ═══════════════════════════════════════════════════════════════════════
print("\n[6/7] Saving artifacts...")

# Save vocabulary mappings
vocab = {
    "sku_to_idx": sku_to_idx,
    "idx_to_sku": {str(k): v for k, v in idx_to_sku.items()},
    "device_map": DEVICE_MAP,
    "referral_map": REFERRAL_MAP,
    "num_items": NUM_ITEMS,
    "n_context": N_CONTEXT,
    "n_devices": N_DEVICES,
    "n_referrals": N_REFERRALS,
    "max_seq_len": MAX_SEQ_LEN,
    "embed_dim": EMBED_DIM,
    "gru_hidden": GRU_HIDDEN,
    "gru_layers": GRU_LAYERS,
    "tf_heads": TF_HEADS,
    "tf_layers": TF_LAYERS,
}
with open(os.path.join(MODEL_DIR, "vocab.json"), "w") as f:
    json.dump(vocab, f, indent=2)

# Save training report
report = {
    "timestamp": datetime.now().isoformat(),
    "data": {
        "total_events": int(total_lines),
        "sampled_events": len(events_df),
        "total_sessions": len(sessions),
        "valid_sessions": len(valid_sessions),
        "training_samples": train_size,
        "validation_samples": val_size,
        "unique_skus": len(all_skus),
    },
    "model": {
        "architecture": "GRU4Rec + Transformer (Dual Encoder) + Cold-Start Gate",
        "num_items": NUM_ITEMS,
        "embed_dim": EMBED_DIM,
        "gru_hidden": GRU_HIDDEN,
        "gru_layers": GRU_LAYERS,
        "transformer_heads": TF_HEADS,
        "transformer_layers": TF_LAYERS,
        "total_params": total_params,
        "trainable_params": trainable_params,
        "context_features": N_CONTEXT,
    },
    "training": {
        "epochs": EPOCHS,
        "batch_size": BATCH_SIZE,
        "learning_rate": LR,
        "best_val_loss": best_val_loss,
        "final_hr10": history["val_hr10"][-1],
        "final_mrr": history["val_mrr"][-1],
    },
    "history": history,
    "artifacts": [
        "session_rec_model.pt",
        "vocab.json",
        "training_report.json",
    ],
}
with open(os.path.join(MODEL_DIR, "training_report.json"), "w") as f:
    json.dump(report, f, indent=2)

print(f"       Saved: session_rec_model.pt ({os.path.getsize(os.path.join(MODEL_DIR, 'session_rec_model.pt')) / 1024:.0f} KB)")
print(f"       Saved: vocab.json")
print(f"       Saved: training_report.json")


# ═══════════════════════════════════════════════════════════════════════
# 7. SUMMARY
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[7/7] Training complete!")
print("=" * 65)
print(f"  Best Val Loss : {best_val_loss:.4f}")
print(f"  Hit Rate@10   : {history['val_hr10'][-1]:.4f}")
print(f"  MRR           : {history['val_mrr'][-1]:.4f}")
print(f"  Model params  : {total_params:,}")
print(f"  Artifacts dir : {MODEL_DIR}")
print("=" * 65)
