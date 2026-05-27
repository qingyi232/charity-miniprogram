#!/usr/bin/env python3
"""BT Panel login - minimal params"""
import requests
import hashlib
import json
import re
import os
import warnings
warnings.filterwarnings('ignore')

BT_BASE = 'http://211.159.155.38:8888'
BT_ENTRY = f'{BT_BASE}/tencentcloud'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'
local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

md5_pwd = hashlib.md5(BT_PWD.encode()).hexdigest()

s = requests.Session()
s.verify = False
s.headers['User-Agent'] = ua

print('Step 1: Visit entry...')
r = s.get(BT_ENTRY, timeout=15)
token_m = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_m.group(1) if token_m else ''
print(f'  Token: {login_token}')
print(f'  Cookies: {dict(s.cookies)}')

css_m = re.findall(r'href="(/static/css/[^"]+)"', r.text)
js_m = re.findall(r'src="(/static/js/[^"]+)"', r.text)
module_m = re.findall(r'src="(/static/[^"]+)"', r.text)
print(f'  CSS: {css_m}')
print(f'  JS: {js_m}')
print(f'  Module: {module_m}')

print('\nStep 2: Login with minimal params...')
combos = [
    ('only u+p md5', {'username': BT_USER, 'password': md5_pwd}),
    ('only u+p raw', {'username': BT_USER, 'password': BT_PWD}),
]

for desc, data in combos:
    s.headers.update({
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': BT_ENTRY,
        'Origin': BT_BASE,
    })
    r2 = s.post(f'{BT_BASE}/login', data=data, timeout=10)
    msg = r2.text
    try:
        j = json.loads(msg)
        msg = j.get('msg', msg)
        status = j.get('status', False)
    except:
        status = False
    print(f'  {desc}: status={status} msg={msg[:80]}')

    if status:
        print('\n>>> LOGIN SUCCESS! Deploying... <<<')
        for fname in ['index.html', 'api.py']:
            fpath = os.path.join(local_dir, fname)
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
            r3 = s.post(f'{BT_BASE}/files?action=SaveFileBody',
                        data={'path': f'{remote_dir}/{fname}', 'data': content, 'encoding': 'utf-8'}, timeout=15)
            print(f'  {fname}: {r3.text[:150]}')

        cmd = 'pkill -f "python.*http.server" ; pkill -f "python.*api.py" ; sleep 1 ; cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
        r4 = s.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
        print(f'  Shell: {r4.text[:150]}')
        print('\nDEPLOY COMPLETE!')
        exit(0)

print('\nStep 3: Try with x-http-token header...')
s2 = requests.Session()
s2.verify = False
s2.headers['User-Agent'] = ua
r_entry = s2.get(BT_ENTRY, timeout=15)
token_m2 = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r_entry.text)
tk2 = token_m2.group(1) if token_m2 else ''

s2.headers.update({
    'X-Requested-With': 'XMLHttpRequest',
    'x-http-token': tk2,
    'Referer': BT_ENTRY,
    'Origin': BT_BASE,
})

for desc, data in [
    ('header-token + u+p md5', {'username': BT_USER, 'password': md5_pwd}),
    ('header-token + u+p raw', {'username': BT_USER, 'password': BT_PWD}),
]:
    r5 = s2.post(f'{BT_BASE}/login', data=data, timeout=10)
    try:
        j = json.loads(r5.text)
        print(f'  {desc}: {j}')
        if j.get('status'):
            print('\n>>> SUCCESS! <<<')
            for fname in ['index.html', 'api.py']:
                fpath = os.path.join(local_dir, fname)
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                r6 = s2.post(f'{BT_BASE}/files?action=SaveFileBody',
                            data={'path': f'{remote_dir}/{fname}', 'data': content, 'encoding': 'utf-8'}, timeout=15)
                print(f'  {fname}: {r6.text[:150]}')
            cmd = 'pkill -f "python.*http.server" ; pkill -f "python.*api.py" ; sleep 1 ; cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
            r7 = s2.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
            print(f'  Shell: {r7.text[:150]}')
            print('\nDEPLOY COMPLETE!')
            exit(0)
    except:
        print(f'  {desc}: {r5.text[:100]}')
