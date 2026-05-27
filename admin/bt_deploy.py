#!/usr/bin/env python3
"""Deploy via BT Panel - with login_token support"""
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
s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

print('Step 1: Get login page and token...')
r = s.get(BT_ENTRY, timeout=10)
print(f'  Status: {r.status_code}')

token_match = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_match.group(1) if token_match else ''
print(f'  Login token: {login_token}')

print('\nStep 2: Login...')
md5_pwd = hashlib.md5(BT_PWD.encode()).hexdigest()

login_variants = [
    {'username': BT_USER, 'password': md5_pwd, 'token': login_token},
    {'username': BT_USER, 'password': BT_PWD, 'token': login_token},
    {'username': BT_USER, 'password': md5_pwd, 'login_token': login_token},
    {'username': BT_USER, 'password': BT_PWD, 'login_token': login_token},
    {'username': BT_USER, 'password': md5_pwd, 'token': login_token, 'code': ''},
    {'username': BT_USER, 'password': md5_pwd, 'request_token': login_token},
]

logged_in = False
for i, data in enumerate(login_variants):
    try:
        r2 = s.post(f'{BT_BASE}/login', data=data, timeout=10)
        j = json.loads(r2.text)
        print(f'  Variant {i+1}: {j}')
        if j.get('status'):
            logged_in = True
            print('  LOGIN SUCCESS!')
            break
    except Exception as e:
        print(f'  Variant {i+1}: {e} | body={r2.text[:100]}')

if not logged_in:
    print('\nTrying JSON login...')
    for pwd in [md5_pwd, BT_PWD]:
        try:
            data = {'username': BT_USER, 'password': pwd, 'token': login_token}
            r3 = s.post(f'{BT_BASE}/login', json=data, timeout=10,
                        headers={'Content-Type': 'application/json'})
            j = json.loads(r3.text)
            print(f'  JSON login: {j}')
            if j.get('status'):
                logged_in = True
                print('  LOGIN SUCCESS!')
                break
        except Exception as e:
            print(f'  JSON login failed: {e}')

if not logged_in:
    print('\n=== Login failed, but trying file ops anyway (cookie-based) ===')

print('\nStep 3: Upload files...')
for fname in ['index.html', 'api.py']:
    fpath = os.path.join(local_dir, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    data = {
        'path': f'{remote_dir}/{fname}',
        'data': content,
        'encoding': 'utf-8',
    }
    try:
        r4 = s.post(f'{BT_BASE}/files?action=SaveFileBody', data=data, timeout=15)
        result = r4.text[:200]
        print(f'  {fname}: {result}')
        try:
            j = json.loads(r4.text)
            if j.get('status'):
                print(f'  {fname} SAVED!')
        except:
            pass
    except Exception as e:
        print(f'  {fname} failed: {e}')

print('\nStep 4: Restart service...')
cmds = [
    'pkill -f "python.*http.server" ; pkill -f "python.*api.py" ; sleep 1',
    'cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &',
]
for cmd in cmds:
    try:
        r5 = s.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
        print(f'  CMD result: {r5.text[:200]}')
    except Exception as e:
        print(f'  CMD failed: {e}')

print('\nDone!')
