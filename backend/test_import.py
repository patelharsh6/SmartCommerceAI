import sys
import traceback

try:
    from app.main import app
    print("SUCCESS")
except Exception as e:
    print("FAILED")
    traceback.print_exc(file=sys.stdout)
