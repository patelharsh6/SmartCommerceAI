# =========================================
# PRODUCT RECOMMENDATION MODEL TRAINING
# =========================================

import pandas as pd
import pickle
import os
from collections import Counter
from mlxtend.preprocessing import TransactionEncoder
from mlxtend.frequent_patterns import apriori, association_rules

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# =========================================
# 1. LOAD DATA
# =========================================
print("Reading dataset...")
df = pd.read_csv("./data/Dataset.csv")

# Optional: Sample data to manage memory if the dataset is massive
if len(df) > 500000:
    print("Sampling dataset to 500k rows for performance...")
    df = df.sample(500000, random_state=42)

# Force string type for IDs to ensure matching works in the API
df['product_id'] = df['product_id'].astype(str)

# =========================================
# 2. SAVE PRODUCT META (CRUCIAL 🔥)
# =========================================
print("Saving metadata...")
# We take the first occurrence of each product to map ID -> Category/Brand
product_meta = df[['product_id', 'category_code', 'brand']].drop_duplicates('product_id')
product_meta.to_csv("data/product_meta.csv", index=False)

# =========================================
# 3. CREATE & FILTER TRANSACTIONS
# =========================================
print("Processing transactions...")
# Group by user to see which products were interacted with together
transactions = df.groupby('user_id')['product_id'].apply(list).tolist()

# Filter out products that appear very rarely (less than 5 times) to improve rule quality
all_products = [item for sublist in transactions for item in sublist]
product_counts = Counter(all_products)
frequent_products = {p for p, c in product_counts.items() if c >= 5}

# Rebuild transactions with only frequent products and remove single-item baskets
filtered_transactions = [
    list(set([p for p in t if p in frequent_products]))
    for t in transactions
]
filtered_transactions = [t for t in filtered_transactions if len(t) >= 2]

# =========================================
# 4. ENCODING & APRIORI
# =========================================
print("Running Apriori algorithm...")
te = TransactionEncoder()
te_array = te.fit(filtered_transactions).transform(filtered_transactions)
df_encoded = pd.DataFrame(te_array, columns=te.columns_)

# Find frequent itemsets (max_len=2 because we want 1-to-1 recommendations)
frequent_itemsets = apriori(
    df_encoded, 
    min_support=0.001, 
    use_colnames=True, 
    max_len=2
)

# =========================================
# 5. ASSOCIATION RULES
# =========================================
print("Generating association rules...")
rules = association_rules(
    frequent_itemsets, 
    metric="confidence", 
    min_threshold=0.05
)

# Clean rules: Ensure only one product in the antecedent (input)
rules = rules[rules['antecedents'].apply(lambda x: len(x) == 1)]

# =========================================
# 6. CREATE RECOMMENDATION DICTIONARY
# =========================================
print("Building recommendation dictionary...")
recommendation_dict = {}

for _, row in rules.iterrows():
    # Extract strings from frozensets
    ant = list(row['antecedents'])[0]
    con = list(row['consequents'])[0]
    conf = row['confidence']

    if ant not in recommendation_dict:
        recommendation_dict[ant] = []
    
    recommendation_dict[ant].append((con, conf))

# Sort recommendations for each product by confidence (highest first)
for key in recommendation_dict:
    recommendation_dict[key] = sorted(
        recommendation_dict[key],
        key=lambda x: x[1],
        reverse=True
    )

# =========================================
# 7. SAVE MODEL
# =========================================
with open("data/recommendation_model.pkl", "wb") as f:
    pickle.dump(recommendation_dict, f)

print(f"✅ Success! Generated rules for {len(recommendation_dict)} products.")
print("✅ Files saved in /data: recommendation_model.pkl, product_meta.csv")