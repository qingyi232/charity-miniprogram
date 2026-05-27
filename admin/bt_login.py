#!/usr/bin/env python3
"""Try BT Panel login with requests"""
import requests
import hashlib
import json
import os
import time
import warnings
warnings.filterwarnings('ignore')

BT_BASE = 'http://211.159.155.38:8888'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'

s = requests.Session()
s.verify = False
s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

print('=== Step 1: Access BT Panel Entry ===')
entry_url = f'{BT_BASE}/tencentcloud'
try:
    r = s.get(entry_url, timeout=10, allow_redirects=True)
    print(f'  Status: {r.status_code}')
    print(f'  Final URL: {r.url}')
    print(f'  Cookies: {dict(s.cookies)}')
    print(f'  Body ({len(r.text)} chars): {r.text[:500]}')
except Exception as e:
    print(f'  Failed: {e}')

print('\n=== Step 2: Try Login ===')
md5_pwd = hashlib.md5(BT_PWD.encode()).hexdigest()

for login_url in [f'{BT_BASE}/login', r.url if 'r' in dir() else f'{BT_BASE}/login']:
    for pwd in [BT_PWD, md5_pwd]:
        try:
            data = {'username': BT_USER, 'password': pwd}
            r2 = s.post(login_url, data=data, timeout=10)
            print(f'  POST {login_url} (pwd={"md5" if pwd == md5_pwd else "plain"})')
            print(f'  Status: {r2.status_code}')
            print(f'  Response: {r2.text[:300]}')
            try:
                j = json.loads(r2.text)
                if j.get('status'):
                    print('  LOGIN SUCCESS!')
                    break
            except:
                pass
        except Exception as e:
            print(f'  Failed: {e}')

print(f'\n  All cookies: {dict(s.cookies)}')

print('\n=== Step 3: Try file operations ===')
for action_url in [
    f'{BT_BASE}/files?action=GetFileBody',
    f'{BT_BASE}/file?action=GetFileBody',
]:
    try:
        r3 = s.post(action_url, data={'path': '/www/wwwroot/admin/index.html'}, timeout=10)
        print(f'  {action_url}: status={r3.status_code}, body={r3.text[:200]}')
    except Exception as e:
        print(f'  {action_url}: {e}')

print('\n=== Step 4: Try SaveFileBody ===')
local_dir = os.path.dirname(os.path.abspath(__file__))

for action_url in [
    f'{BT_BASE}/files?action=SaveFileBody',
    f'{BT_BASE}/file?action=SaveFileBody',
]:
    try:
        with open(os.path.join(local_dir, 'api.py'), 'r', encoding='utf-8') as f:
            content = f.read()
        data = {
            'path': '/www/wwwroot/admin/api.py',
            'data': content,
            'encoding': 'utf-8',
        }
        r4 = s.post(action_url, data=data, timeout=10)
        print(f'  {action_url}: status={r4.status_code}, body={r4.text[:200]}')
    except Exception as e:
        print(f'  {action_url}: {e}')
