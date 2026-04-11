import app.extensions as ext
from datetime import datetime
import bcrypt

# HASH PASSWORD
def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())

# CREATE USER
def create_user(data, otp):
    return ext.db.users.insert_one({
        "name": data["name"],
        "email": data["email"].lower(),
        "password": hash_password(data["password"]),
        "phone": data.get("phone"),
        "address": data.get("address"),
        "otp": otp,
        "is_verified": False,
        "created_at": datetime.utcnow()
    })

# FIND USER
def find_user(email):
    return ext.db.users.find_one({"email": email.lower()})

# VERIFY USER
def verify_user(email):
    return ext.db.users.update_one(
        {"email": email.lower()},
        {"$set": {"is_verified": True, "otp": None}}
    )