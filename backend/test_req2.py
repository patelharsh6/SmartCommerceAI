import urllib.request
import urllib.error
import json

with open("test_out.txt", "w") as f:
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:8000/api/auth/login',
            data=b'{"email":"anshp@gmail.com","password":"password"}',
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        res = urllib.request.urlopen(req)
        f.write(f"SUCCESS {res.status}\n")
    except urllib.error.HTTPError as e:
        f.write(f"HTTPError {e.code} {e.read().decode()}\n")
    except Exception as e:
        f.write(f"Other Error {e}\n")
