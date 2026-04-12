"""
Auth Routes — Register, Login, OTP Verification, Profile Update
Uses MongoDB for persistent user storage.
"""

from flask import Blueprint, request, jsonify
import app.extensions as ext
import traceback
import jwt
import os
import functools

from app.models.user_model import (
    create_user,
    find_user,
    verify_user,
    verify_password
)

from app.utils.otp import generate_otp
from app.services.email_service import send_email

auth_bp = Blueprint("auth", __name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "smartcommerce-secret-key-2026")


# ─── Helper: Extract current user from JWT ───
def _get_current_user():
    """Extract user from JWT token in Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        email = payload.get("email")
        if email:
            user = find_user(email)
            if user:
                user["_id"] = str(user["_id"])
                return user
        return None
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_auth(f):
    """Decorator to require authentication."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({"message": "Authentication required"}), 401
        return f(user, *args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════
# 📝 REGISTER
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json(silent=True)

        if not data or "email" not in data or "password" not in data:
            return jsonify({"message": "Email & password required"}), 400

        if find_user(data["email"]):
            return jsonify({"message": "User already exists"}), 400

        otp = generate_otp()
        create_user(data, otp)

        try:
            send_email(data["email"], "Your OTP Code", otp)
            return jsonify({"message": "OTP sent to your email"}), 200
        except Exception as email_err:
            print(f"[EMAIL ERROR] {email_err}")
            # User is created but email failed — still let them try verify
            return jsonify({
                "message": "Account created. OTP email may be delayed.",
                "otp_debug": otp  # Remove in production
            }), 200

    except Exception as e:
        print(f"[REGISTER ERROR]\n{traceback.format_exc()}")
        return jsonify({"message": f"Registration failed: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════
# ✅ VERIFY OTP
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    try:
        data = request.get_json(silent=True)

        if not data or "email" not in data or "otp" not in data:
            return jsonify({"message": "Email and OTP required"}), 400

        user = find_user(data["email"])

        if not user:
            return jsonify({"message": "User not found"}), 404

        if str(user["otp"]) != str(data["otp"]):
            return jsonify({"message": "Invalid OTP. Please try again."}), 400

        verify_user(data["email"])
        return jsonify({"message": "Email verified successfully"}), 200

    except Exception as e:
        print(f"[VERIFY OTP ERROR]\n{traceback.format_exc()}")
        return jsonify({"message": f"Verification failed: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════
# 🔐 LOGIN
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True)

        if not data or "email" not in data or "password" not in data:
            return jsonify({"message": "Email & password required"}), 400

        user = find_user(data["email"])

        if not user:
            return jsonify({"message": "User not found"}), 404

        if not verify_password(data["password"], user["password"]):
            return jsonify({"message": "Wrong password"}), 401

        if not user.get("is_verified", False):
            return jsonify({"message": "Please verify your email first"}), 403

        # Generate JWT token
        user_id = str(user.get("_id", ""))
        token = jwt.encode(
            {"email": user["email"], "user_id": user_id},
            JWT_SECRET,
            algorithm="HS256"
        )

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {
                "id": user_id,
                "name": user.get("name", ""),
                "email": user["email"],
                "phone": user.get("phone", ""),
                "address": user.get("address", ""),
                "avatar": user.get("avatar", "👤"),
                "created_at": str(user.get("created_at", "")),
            }
        }), 200

    except Exception as e:
        print(f"[LOGIN ERROR]\n{traceback.format_exc()}")
        return jsonify({"message": f"Login failed: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════
# 🔄 RESEND OTP
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    try:
        data = request.get_json(silent=True)

        if not data or "email" not in data:
            return jsonify({"message": "Email required"}), 400

        user = find_user(data["email"])

        if not user:
            return jsonify({"message": "User not found"}), 404

        otp = generate_otp()

        ext.db.users.update_one(
            {"email": data["email"].lower()},
            {"$set": {"otp": otp}}
        )

        try:
            send_email(data["email"], "Your New OTP Code", otp)
        except Exception as email_err:
            print(f"[EMAIL ERROR] {email_err}")

        return jsonify({"message": "OTP resent successfully"}), 200

    except Exception as e:
        print(f"[RESEND OTP ERROR]\n{traceback.format_exc()}")
        return jsonify({"message": f"Failed to resend OTP: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════
# 👤 PROFILE UPDATE
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/update-profile", methods=["PUT"])
@require_auth
def update_profile(user):
    try:
        data = request.get_json(silent=True) or {}

        update_fields = {}
        if "name" in data:
            update_fields["name"] = data["name"]
        if "phone" in data:
            update_fields["phone"] = data["phone"]
        if "address" in data:
            update_fields["address"] = data["address"]
        if "avatar" in data:
            update_fields["avatar"] = data["avatar"]

        if update_fields:
            ext.db.users.update_one(
                {"email": user["email"]},
                {"$set": update_fields}
            )

        return jsonify({"message": "Profile updated successfully"}), 200

    except Exception as e:
        print(f"[UPDATE PROFILE ERROR]\n{traceback.format_exc()}")
        return jsonify({"message": f"Update failed: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════
# 👤 GET PROFILE
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/profile", methods=["GET"])
@require_auth
def get_profile(user):
    return jsonify({
        "user": {
            "id": str(user.get("_id", "")),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "address": user.get("address", ""),
            "avatar": user.get("avatar", "👤"),
            "created_at": str(user.get("created_at", "")),
        }
    })
