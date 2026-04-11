from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field

class CouponModel(BaseModel):
    voucher_name: str = Field(..., description="Internal name for the campaign")
    code: str = Field(..., min_length=4, description="The actual discount code (e.g., SAVE20)")
    offer_price: float = Field(..., gt=0, description="The discount value or fixed price")
    
    # Target User Info (Optional: if the coupon is unique to a user)
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    
    # Validity Logic
    is_active: bool = True
    usage_limit: int = Field(default=1, description="How many times this can be used")
    used_count: int = 0
    
    # Timestamps
    expiry_date: datetime = Field(
        default_factory=lambda: datetime.utcnow() + timedelta(days=30)
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "voucher_name": "Welcome Bonus",
                "code": "SMART2026",
                "offer_price": 500.0,
                "user_email": "customer@example.com",
                "is_active": True,
                "usage_limit": 1
            }
        }

def create_coupon_entry(name, email, voucher, price, code):
    """
    Standardized dictionary for MongoDB insertion
    """
    return {
        "user_name": name,
        "user_email": email.lower().strip(),
        "voucher_name": voucher,
        "offer_price": float(price),
        "code": code.upper().strip(),
        "is_active": True,
        "used_count": 0,
        "created_at": datetime.utcnow()
    }