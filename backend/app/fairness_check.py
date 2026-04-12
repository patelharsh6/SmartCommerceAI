import pandas as pd
import numpy as np

print("Running Fairness Audit...")

users = pd.read_csv('./data/user_segment_profiles.csv')

def classify_user_recreated(user_events):
    if user_events.empty:
        return "new_user"
    purchases = user_events[user_events['event_type'] == 'purchase']
    if purchases.empty:
        return "browser"
    
    aov = purchases['price_seen_usd'].sum() / len(purchases)
    if aov >= 200:
        return "premium"
    elif aov >= 50:
        return "regular"
    else:
        return "low_spender"

try:
    events = pd.read_csv('./data/clickstream_eventsput.csv')
    
    # Calculate segment for each dataset user
    user_segments = []
    
    grouped = events.groupby('user_id')
    
    for uid, data in grouped:
        seg = classify_user_recreated(data)
        user_segments.append({'user_id': uid, 'calculated_segment': seg})
    
    seg_df = pd.DataFrame(user_segments)
    users = users.merge(seg_df, on='user_id', how='left')
    users['calculated_segment'] = users['calculated_segment'].fillna('new_user')

    print("\n--- Demographic Bias Check ---")
    print("\nSegment distribution by Gender:")
    print(pd.crosstab(users['gender'], users['calculated_segment'], normalize='index') * 100)

    print("\nSegment distribution by Age Group:")
    print(pd.crosstab(users['age_group'], users['calculated_segment'], normalize='index') * 100)
    
except Exception as e:
    print(f"Error: {e}")
