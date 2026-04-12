"""
Product Recommendation Engine Training Pipeline
Processes Clickstream data to extract Frequent Itemsets (Association Rules)
and Category/Popularity-based collaborative filtering features.
"""

import os
import pandas as pd
import joblib
from collections import Counter
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

def dp(filename):
    return os.path.join(DATA_DIR, filename)

print("=" * 72)
print("  SMARTCOMMERCE AI — PRODUCT RECOMMENDATION ENGINE TRAINING")
print("=" * 72)
print(f"  Started at : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# ═══════════════════════════════════════════════════════════════
# 1. LOAD DATASETS
# ═══════════════════════════════════════════════════════════════
print("\n📦 Loading clickstream events (fast pass)...")
events_df = pd.read_csv(dp("clickstream_eventsput.csv"), usecols=["session_id", "sku_id", "event_type"])
print(f"  ✅ Loaded {len(events_df):,} events.")

# ═══════════════════════════════════════════════════════════════
# 2. TRAIN APRIORI ASSOCIATION RULES (Frequently Bought Together)
# ═══════════════════════════════════════════════════════════════
print("\n🔗 Training Apriori Association Rules...")

# We care about items interacting in the same session (strong intent signals)
intent_events = events_df[events_df["event_type"].isin(["purchase", "add_to_cart"])].copy()

# Group by session to build transaction baskets
transactions = intent_events.groupby("session_id")["sku_id"].apply(list).tolist()

# Filter products that appear rarely (< 5 times) to reduce noise
all_items = [item for bag in transactions for item in bag]
item_counts = Counter(all_items)
frequent_items = {p for p, c in item_counts.items() if c >= 5}

filtered_transactions = [
    list(set([p for p in t if p in frequent_items]))
    for t in transactions
]
filtered_transactions = [t for t in filtered_transactions if len(t) >= 2]

print(f"  Processed Transactions for Apriori: {len(filtered_transactions):,}")

if len(filtered_transactions) > 0:
    try:
        print(f"  Calculating co-occurrences using native memory-safe approach...")
        import itertools
        from collections import defaultdict
        
        pair_counts = Counter()
        item_support = Counter()
        
        # We process transactions natively.
        for t in filtered_transactions:
            t = sorted(list(t)) # Sort to prevent bidirectional duplicates (A,B and B,A)
            for item in t:
                item_support[item] += 1
            for pair in itertools.combinations(t, 2):
                pair_counts[pair] += 1

        total_transactions = len(filtered_transactions)
        apriori_output = []

        for pair, count in pair_counts.items():
            # Support = pair_count / total_transactions
            support_val = count / total_transactions
            
            if support_val < 0.0003: # Minimum support
                continue
                
            item_a, item_b = pair
            
            # For A -> B
            supp_a = item_support[item_a] / total_transactions
            supp_b = item_support[item_b] / total_transactions
            
            conf_ab = support_val / supp_a
            lift_ab = conf_ab / supp_b
            
            # For B -> A
            conf_ba = support_val / supp_b
            lift_ba = conf_ba / supp_a

            min_conf = 0.02
            
            if conf_ab >= min_conf:
                apriori_output.append({
                    "antecedents": str(item_a),
                    "consequents": str(item_b),
                    "confidence": round(conf_ab, 4),
                    "lift": round(lift_ab, 4),
                    "support": round(support_val, 6)
                })
                
            if conf_ba >= min_conf:
                apriori_output.append({
                    "antecedents": str(item_b),
                    "consequents": str(item_a),
                    "confidence": round(conf_ba, 4),
                    "lift": round(lift_ba, 4),
                    "support": round(support_val, 6)
                })
                
        apriori_df = pd.DataFrame(apriori_output)
        
        if apriori_df.empty:
            print("  ⚠️  No frequent itemsets found with given support limit.")
            apriori_df = pd.DataFrame(columns=["antecedents", "consequents", "confidence", "lift", "support"])

        apriori_df.to_csv(dp("apriori_rules.csv"), index=False)
        print(f"  ✅ apriori_rules.csv generated ({len(apriori_df):,} contextual rules found)")
    except Exception as e:
        print(f"  ⚠️  Error calculating rules: {e}")
else:
    print("  ⚠️  Not enough valid multi-item transactions found.")

print("\n" + "=" * 72)
print("  ✅ PRODUCT RECOMMENDATION ENGINE TRAINING COMPLETE!")
print("=" * 72)
