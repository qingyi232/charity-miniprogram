#!/usr/bin/env python3
"""Crack BT Panel login by analyzing its frontend JS"""
import requests
import hashlib
import json
import re
import os
import time
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
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
s.headers['User-Agent'] = ua

print('=== Step 1: Get login page ===')
r = s.get(BT_ENTRY, timeout=15)
print(f'  Status: {r.status_code}, Size: {len(r.text)}')

if r.status_code != 200 or len(r.text) < 1000:
    print('  Panel not accessible, waiting 30s...')
    time.sleep(30)
    r = s.get(BT_ENTRY, timeout=15)
    print(f'  Retry: Status: {r.status_code}, Size: {len(r.text)}')

token_m = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_m.group(1) if token_m else ''
print(f'  login_token: {login_token}')

title_m = re.search(r"vite_public_title\s*=\s*'([^']*)'", r.text)
print(f'  title: {title_m.group(1) if title_m else "N/A"}')

js_files = re.findall(r'(?:src|href)="(/static/[^"]+\.(?:js|css))"', r.text)
print(f'  JS/CSS files: {len(js_files)}')

print('\n=== Step 2: Analyze login JS ===')
login_js_content = ''
for js_url in js_files:
    if not js_url.endswith('.js'):
        continue
    try:
        jr = s.get(f'{BT_BASE}{js_url}', timeout=10)
        if 'password' in jr.text and 'login' in jr.text:
            login_js_content = jr.text
            pwd_contexts = re.findall(r'.{0,80}password.{0,80}', jr.text)
            print(f'\n  File: {js_url} ({len(jr.text)} chars)')
            for ctx in pwd_contexts[:10]:
                print(f'    > {ctx.strip()[:120]}')

            md5_refs = re.findall(r'.{0,50}md5.{0,50}', jr.text, re.IGNORECASE)
            for m in md5_refs[:5]:
                print(f'    [MD5] {m.strip()[:120]}')

            encrypt_refs = re.findall(r'.{0,50}(?:encrypt|crypto|hash).{0,50}', jr.text, re.IGNORECASE)
            for e in encrypt_refs[:5]:
                print(f'    [ENCRYPT] {e.strip()[:120]}')

            login_refs = re.findall(r'.{0,30}/login.{0,100}', jr.text)
            for l in login_refs[:5]:
                print(f'    [LOGIN] {l.strip()[:120]}')
    except:
        pass

print('\n=== Step 3: Try login with all password formats ===')
md5_pwd = hashlib.md5(BT_PWD.encode('utf-8')).hexdigest()

s2 = requests.Session()
s2.verify = False
s2.headers['User-Agent'] = ua
r2 = s2.get(BT_ENTRY, timeout=15)
token_m2 = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r2.text)
fresh_token = token_m2.group(1) if token_m2 else ''
print(f'  Fresh token: {fresh_token}')

combos = [
    {'username': BT_USER, 'password': md5_pwd, 'token': fresh_token},
    {'username': BT_USER, 'password': md5_pwd, 'token': fresh_token, 'code': ''},
    {'username': BT_USER, 'password': hashlib.md5((md5_pwd + fresh_token).encode()).hexdigest(), 'token': fresh_token},
]

for i, data in enumerate(combos):
    s2.headers.update({
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': BT_BASE,
        'Referer': BT_ENTRY,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    })
    try:
        r3 = s2.post(f'{BT_BASE}/login', data=data, timeout=10)
        print(f'  #{i+1}: {r3.text[:200]}')
        try:
            j = json.loads(r3.text)
            if j.get('status'):
                print('  >>> SUCCESS <<<')
                
                for fname in ['index.html', 'api.py']:
                    fpath = os.path.join(local_dir, fname)
                    with open(fpath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    r4 = s2.post(f'{BT_BASE}/files?action=SaveFileBody',
                                data={'path': f'{remote_dir}/{fname}', 'data': content, 'encoding': 'utf-8'},
                                timeout=15)
                    print(f'  Upload {fname}: {r4.text[:200]}')
                
                cmd = 'pkill -f "python.*http.server" ; pkill -f "python.*api.py" ; sleep 1 ; cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
                r5 = s2.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
                print(f'  Shell: {r5.text[:200]}')
                print('\nDEPLOY COMPLETE!')
                exit(0)
        except:
            pass
    except Exception as e:
        print(f'  #{i+1}: {e}')

print('\n=== Login failed ===')
