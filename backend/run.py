from app.main import app

if __name__ == "__main__":
    print("[*] Starting SmartCommerceAI on http://127.0.0.1:8000")
    # Using the native Flask runner to avoid ASGI/WSGI signature errors
    app.run(host="127.0.0.1", port=8000, debug=True)