import urllib.request
import urllib.error

try:
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/auth/login',
        data=b'{"email":"test@test.com","password":"pass"}',
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    res = urllib.request.urlopen(req)
    print("SUCCESS", res.status, res.read())
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read())
except Exception as e:
    print("Other Error:", e)
