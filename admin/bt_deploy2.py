#!/usr/bin/env python3
"""Deploy via BT Panel - correct login encryption"""
import requests
import hashlib
import json
import os
import re
import warnings
warnings.filterwarnings('ignore')

BT_BASE = 'http://211.159.155.38:8888'
BT_ENTRY = f'{BT_BASE}/tencentcloud'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'

local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'

s = requests.Session()
s.verify = False
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': BT_ENTRY,
})

print('Step 1: Get login page...')
r = s.get(BT_ENTRY, timeout=10)

token_match = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_match.group(1) if token_match else ''
print(f'  Token: {login_token}')

md5_pwd = hashlib.md5(BT_PWD.encode('utf-8')).hexdigest()

print('\nStep 2: Try login with encrypted password...')
password_variants = [
    ('md5(pwd+token)', hashlib.md5((md5_pwd + login_token).encode()).hexdigest()),
    ('md5(token+pwd)', hashlib.md5((login_token + md5_pwd).encode()).hexdigest()),
    ('md5(pwd)', md5_pwd),
    ('raw', BT_PWD),
    ('md5(raw+token)', hashlib.md5((BT_PWD + login_token).encode()).hexdigest()),
]

logged_in = False
for desc, pwd_val in password_variants:
    data = {
        'username': BT_USER,
        'password': pwd_val,
        'token': login_token,
    }
    try:
        r2 = s.post(f'{BT_BASE}/login', data=data, timeout=10)
        j = json.loads(r2.text)
        msg = j.get('msg', '')
        status = j.get('status', False)
        print(f'  {desc}: status={status}, msg={msg}')
        if status:
            logged_in = True
            print('  >>> LOGIN SUCCESS! <<<')
            break
    except Exception as e:
        print(f'  {desc}: error={e}')

if not logged_in:
    print('\n  Trying with request_token_head...')
    rt_match = re.search(r"request_token_head\s*=\s*[\"']([^\"']+)", r.text)
    rt = rt_match.group(1) if rt_match else ''
    print(f'  request_token_head: {rt}')

    if rt:
        s.headers['x-http-token'] = rt
        for desc, pwd_val in password_variants:
            data = {
                'username': BT_USER,
                'password': pwd_val,
            }
            try:
                r3 = s.post(f'{BT_BASE}/login', data=data, timeout=10)
                j = json.loads(r3.text)
                print(f'  w/header {desc}: {j}')
                if j.get('status'):
                    logged_in = True
                    break
            except Exception as e:
                print(f'  w/header {desc}: {e}')

if not logged_in:
    print('\n  Trying x-cookie-token...')
    cookie_val = ''
    for c in s.cookies:
        cookie_val = c.value
        break
    s.headers['x-cookie-token'] = cookie_val

    data = {
        'username': BT_USER,
        'password': md5_pwd,
        'token': login_token,
    }
    try:
        r4 = s.post(f'{BT_BASE}/login', data=data, timeout=10)
        j = json.loads(r4.text)
        print(f'  Result: {j}')
        if j.get('status'):
            logged_in = True
    except Exception as e:
        print(f'  Failed: {e}')

if logged_in:
    print('\n=== LOGGED IN! Deploying files... ===')
    for fname in ['index.html', 'api.py']:
        fpath = os.path.join(local_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        data = {
            'path': f'{remote_dir}/{fname}',
            'data': content,
            'encoding': 'utf-8',
        }
        r5 = s.post(f'{BT_BASE}/files?action=SaveFileBody', data=data, timeout=15)
        print(f'  {fname}: {r5.text[:200]}')

    print('\nRestarting service...')
    cmd = (
        'pkill -f "python.*http.server" ; '
        'pkill -f "python.*api.py" ; '
        'sleep 1 ; '
        'cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
    )
    r6 = s.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
    print(f'  Result: {r6.text[:200]}')
    print('\nDEPLOY COMPLETE!')
else:
    print('\n=== ALL LOGIN ATTEMPTS FAILED ===')
    print('BT Panel uses advanced encryption.')
