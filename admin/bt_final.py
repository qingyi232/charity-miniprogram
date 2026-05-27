#!/usr/bin/env python3
"""Final BT Panel deploy - try all login methods"""
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

r = s.get(BT_ENTRY, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
token_m = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_m.group(1) if token_m else ''
print(f'Token: {login_token}')
print(f'Cookies: {dict(s.cookies)}')

md5_pwd = hashlib.md5(BT_PWD.encode('utf-8')).hexdigest()

headers_base = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': BT_ENTRY,
    'Origin': BT_BASE,
}

combos = [
    # header_extra, body_dict, content_type
    ({'X-Requested-With': 'XMLHttpRequest'}, {'username': BT_USER, 'password': md5_pwd, 'token': login_token}, 'form'),
    ({'X-Requested-With': 'XMLHttpRequest', 'x-http-token': login_token}, {'username': BT_USER, 'password': md5_pwd}, 'form'),
    ({'x-http-token': login_token}, {'username': BT_USER, 'password': md5_pwd}, 'form'),
    ({'X-Requested-With': 'XMLHttpRequest'}, {'username': BT_USER, 'password': md5_pwd, 'code': '', 'token': login_token}, 'form'),
    ({}, {'username': BT_USER, 'password': md5_pwd, 'token': login_token}, 'json'),
    ({'x-http-token': login_token, 'X-Requested-With': 'XMLHttpRequest'}, {'username': BT_USER, 'password': md5_pwd, 'token': login_token}, 'json'),
    ({'X-Requested-With': 'XMLHttpRequest'}, {'username': BT_USER, 'password': BT_PWD, 'token': login_token}, 'form'),
]

logged_in = False
for i, (extra_h, body, ct) in enumerate(combos):
    h = {**headers_base, **extra_h}
    try:
        if ct == 'json':
            r2 = s.post(f'{BT_BASE}/login', json=body, headers=h, timeout=10)
        else:
            r2 = s.post(f'{BT_BASE}/login', data=body, headers=h, timeout=10)
        try:
            j = json.loads(r2.text)
            status = j.get('status', False)
            msg = j.get('msg', '')
            print(f'  #{i+1} ({ct}): status={status} msg={msg[:50]}')
            if status:
                logged_in = True
                print('  >>> SUCCESS <<<')
                break
        except:
            print(f'  #{i+1}: not json: {r2.text[:100]}')
    except Exception as e:
        print(f'  #{i+1}: error={e}')

if logged_in:
    print('\n=== Deploying files ===')
    for fname in ['index.html', 'api.py']:
        fpath = os.path.join(local_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        data = {'path': f'{remote_dir}/{fname}', 'data': content, 'encoding': 'utf-8'}
        r3 = s.post(f'{BT_BASE}/files?action=SaveFileBody', data=data, timeout=15)
        try:
            j = json.loads(r3.text)
            print(f'  {fname}: {j}')
        except:
            print(f'  {fname}: {r3.text[:150]}')

    print('\nRestarting...')
    cmd = 'pkill -f "python.*http.server" ; pkill -f "python.*api.py" ; sleep 1 ; cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
    r4 = s.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
    try:
        print(f'  Shell: {json.loads(r4.text)}')
    except:
        print(f'  Shell: {r4.text[:150]}')

    print('\nDEPLOY COMPLETE!')
else:
    print('\nAll combos failed. Trying BT API key approach...')

    print('\nChecking if panel has API enabled...')
    api_key_url = f'{BT_BASE}/api'
    try:
        r5 = s.get(api_key_url, timeout=5)
        print(f'  /api: {r5.status_code} {r5.text[:200]}')
    except Exception as e:
        print(f'  /api: {e}')
