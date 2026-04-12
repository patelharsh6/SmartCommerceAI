"""
Standalone training script for the Ridge price-prediction model.
Run directly:  python -m app.category_reco_model
Or use the version at app/models/category_reco_model.py which also
exposes a ProductEngine class for inference.
"""

from app.models.category_reco_model import train_model

if __name__ == "__main__":
    train_model()