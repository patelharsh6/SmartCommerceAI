with open("test_out.txt", "w") as f:
    try:
        from app.main import app
        f.write("SUCCESS\n")
    except Exception as e:
        import traceback
        f.write("FAIL\n")
        f.write(traceback.format_exc())
