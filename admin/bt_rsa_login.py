#!/usr/bin/env python3
"""BT Panel deploy with RSA encrypted login"""
import requests
import hashlib
import json
import re
import os
import base64
import warnings
warnings.filterwarnings('ignore')

from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5

BT_BASE = 'http://211.159.155.38:8888'
BT_ENTRY = f'{BT_BASE}/tencentcloud'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'
local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'


def md5(s):
    return hashlib.md5(s.encode('utf-8')).hexdigest()


def rsa_encrypt(plaintext, public_key_str):
    pem = public_key_str.strip()
    if '-----BEGIN' in pem:
        header = '-----BEGIN PUBLIC KEY-----'
        footer = '-----END PUBLIC KEY-----'
        body = pem.replace(header, '').replace(footer, '').strip()
        lines = [body[i:i+64] for i in range(0, len(body), 64)]
        pem = f'{header}\n' + '\n'.join(lines) + f'\n{footer}'
    else:
        lines = [pem[i:i+64] for i in range(0, len(pem), 64)]
        pem = '-----BEGIN PUBLIC KEY-----\n' + '\n'.join(lines) + '\n-----END PUBLIC KEY-----'
    key = RSA.import_key(pem)
    cipher = PKCS1_v1_5.new(key)
    encrypted = cipher.encrypt(plaintext.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')


s = requests.Session()
s.verify = False
s.headers['User-Agent'] = ua

print('Step 1: Get login page...')
r = s.get(BT_ENTRY, timeout=15)
print(f'  Status: {r.status_code}, Size: {len(r.text)}')

token_m = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_m.group(1) if token_m else ''
print(f'  login_token: {login_token}')

enc_m = re.search(r"vite_public_encryption\s*=\s*'([^']+)'", r.text)
rsa_public_key = enc_m.group(1) if enc_m else ''
print(f'  RSA public key ({len(rsa_public_key)} chars): {rsa_public_key[:80]}...' if rsa_public_key else '  RSA key NOT found in page!')

if not rsa_public_key:
    print('  Searching in all window variables...')
    all_vars = re.findall(r"window\.(\w+)\s*=\s*'([^']*)'", r.text)
    for name, val in all_vars:
        print(f'    window.{name} = {val[:80]}...' if len(val) > 80 else f'    window.{name} = {val}')
    exit(1)

print('\nStep 2: Encrypt and login...')
s.headers.update({
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': BT_ENTRY,
    'Origin': BT_BASE,
})

print(f'  Raw: user={BT_USER}, pwd={BT_PWD}')
print(f'  md5(user): {md5(BT_USER)}')
print(f'  md5(pwd): {md5(BT_PWD)}')
print(f'  md5(md5(pwd)+_bt.cn): {md5(md5(BT_PWD) + "_bt.cn")}')
print(f'  md5(user+token): {md5(BT_USER + login_token)}')

enc_user = rsa_encrypt(md5(md5(BT_USER) + login_token), rsa_public_key)
enc_pwd = rsa_encrypt(md5(md5(BT_PWD) + '_bt.cn'), rsa_public_key)

login_data = {'username': enc_user, 'password': enc_pwd, 'code': ''}
r2 = s.post(f'{BT_BASE}/login', data=login_data, timeout=10)
try:
    j = json.loads(r2.text)
    msg = j.get('msg', '')
    print(f'  Result: status={j.get("status")}, msg={msg}')
    if not j.get('status'):
        print(f'  Login failed. Trying without code field...')
        login_data2 = {'username': enc_user, 'password': enc_pwd}
        r2b = s.post(f'{BT_BASE}/login', data=login_data2, timeout=10)
        j = json.loads(r2b.text)
        print(f'  Result: status={j.get("status")}, msg={j.get("msg","")}')
except:
    print(f'  Response: {r2.text[:200]}')

logged_in = j.get('status', False) if 'j' in dir() else False
if not logged_in:
    print('\n  Login failed.')
    exit(1)
print('\n>>> LOGIN SUCCESS! <<<')

print('\nStep 4: Upload files...')
for fname in ['index.html', 'api.py']:
    fpath = os.path.join(local_dir, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    r3 = s.post(f'{BT_BASE}/files?action=SaveFileBody',
                data={'path': f'{remote_dir}/{fname}', 'data': content, 'encoding': 'utf-8'},
                timeout=15)
    try:
        j = json.loads(r3.text)
        print(f'  {fname}: {j}')
    except:
        print(f'  {fname}: {r3.text[:150]}')

print('\nStep 5: Restart service...')
cmd = (
    'pkill -f "python.*http.server" ; '
    'pkill -f "python.*api.py" ; '
    'sleep 1 ; '
    'cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
)
r4 = s.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
try:
    print(f'  Shell: {json.loads(r4.text)}')
except:
    print(f'  Shell: {r4.text[:150]}')

print('\nStep 6: Verify...')
import time
time.sleep(3)

import urllib.request
try:
    req = urllib.request.Request(
        'http://211.159.155.38/api/cloud',
        json.dumps({'name': 'admin', 'data': {'action': 'dashboard'}}).encode(),
        {'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = resp.read().decode()
        print(f'  API test: {result[:300]}')
except Exception as e:
    print(f'  API test failed: {e}')

print('\nDEPLOY COMPLETE!')
