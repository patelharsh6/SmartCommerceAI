import pandas as pd
import numpy as np
import sys
import os

# Add parent directory to path so we can import recommendation_service directly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.services.recommendation_service import get_dynamic_price

def run_audit():
    print("Starting Fairness Audit on Live Pricing Engine...\n")
    users = pd.read_csv("./data/user_segment_profiles.csv")
    catalog = pd.read_csv("./data/product_catalog.csv")
    
    # We take 20 synthetic product_ids (1-20)
    sample_prods = list(range(1, 21))
    
    # Take 500 users
    users_sample = users.head(500)
    
    results = []
    
    print("Simulating Get Price... this takes a moment.")
    for idx, user in users_sample.iterrows():
        uid = str(user['user_id'])
        gender = user.get('gender', 'Unknown')
        age = user.get('age_group', 'Unknown')
        country = user.get('country', 'Unknown')
        
        for pid in sample_prods:
            price_data = get_dynamic_price(int(pid), uid)
            if price_data:
                results.append({
                    'user_id': uid,
                    'gender': gender,
                    'age_group': age,
                    'country': country,
                    'product_id': pid,
                    'base_price': price_data.get('base_price', 0),
                    'final_price': price_data.get('final_price', 0),
                    'savings_pct': price_data.get('savings_percent', 0),
                    'segment_assigned': price_data.get('user_segment', 'unknown')
                })
                
    if not results:
        print("Audit failed: No prices returned!")
        return
        
    df_results = pd.DataFrame(results)
    df_results['markup_pct'] = ((df_results['final_price'] - df_results['base_price']) / df_results['base_price']) * 100
    
    print("Audit Complete. Compiling Report...\n")
    print("="*50)
    print("           DEMOGRAPHIC PARITY REPORT")
    print("="*50)
    
    print("\n--- By Gender ---")
    gender_group = df_results.groupby('gender').agg({'markup_pct': 'mean', 'savings_pct': 'mean'}).round(2)
    print(gender_group)
    
    print("\n--- By Age Group ---")
    age_group = df_results.groupby('age_group').agg({'markup_pct': 'mean', 'savings_pct': 'mean'}).round(2)
    print(age_group)
    
    print("\n--- By Assigned Segment ---")
    seg_group = df_results.groupby('segment_assigned').agg({'markup_pct': 'mean', 'savings_pct': 'mean'}).round(2)
    print(seg_group)

    print("\n" + "="*50)

if __name__ == "__main__":
    run_audit()
