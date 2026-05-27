#!/usr/bin/env python3
"""BT Panel deploy - with RSA encryption like the real frontend"""
import requests
import hashlib
import json
import re
import os
import warnings
warnings.filterwarnings('ignore')

try:
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5
    import base64
    HAS_CRYPTO = True
except ImportError:
    try:
        from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
        from cryptography.hazmat.primitives import serialization
        HAS_CRYPTO = 'cryptography'
    except ImportError:
        HAS_CRYPTO = False

BT_BASE = 'http://211.159.155.38:8888'
BT_ENTRY = f'{BT_BASE}/tencentcloud'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'
local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

s = requests.Session()
s.verify = False
s.headers['User-Agent'] = ua

print('Step 1: Get login page + token...')
r = s.get(BT_ENTRY, timeout=15)
token_m = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
login_token = token_m.group(1) if token_m else ''
print(f'  Token: {login_token}')

print('\nStep 2: Fetch login.js to find RSA key and login logic...')
login_js_url = f'{BT_BASE}/static/js/login.js?v=1765533662'
jr = s.get(login_js_url, timeout=10)
js_text = jr.text
print(f'  login.js size: {len(js_text)}')

rsa_key_match = re.search(r'(?:setPublicKey|public_key|rsa_key|publicKey|BEGIN PUBLIC KEY)[^"\']*["\']([A-Za-z0-9+/=\n\r]+)', js_text)
if rsa_key_match:
    print(f'  Found RSA key in login.js: {rsa_key_match.group(1)[:60]}...')
else:
    print('  No RSA key in login.js, checking for API to get key...')

key_api_match = re.findall(r'["\']([/a-zA-Z]*(?:key|rsa|public|encrypt)[/a-zA-Z]*)["\']', js_text, re.IGNORECASE)
print(f'  Key-related strings: {key_api_match[:10]}')

login_logic = re.findall(r'(?:login|submit|sign_in).{0,300}', js_text, re.IGNORECASE)
for ll in login_logic[:5]:
    print(f'  Login logic: {ll[:200]}')

encrypt_logic = re.findall(r'(?:encrypt|JSEncrypt|setPublicKey|md5).{0,200}', js_text)
for el in encrypt_logic[:10]:
    print(f'  Encrypt: {el[:200]}')

print('\nStep 3: Check for RSA public key API...')
key_endpoints = ['/login?action=get_key', '/get_key', '/login/get_key']
for ep in key_endpoints:
    try:
        kr = s.get(f'{BT_BASE}{ep}', timeout=5)
        if kr.status_code == 200 and len(kr.text) > 10:
            print(f'  {ep}: {kr.text[:300]}')
            try:
                kj = json.loads(kr.text)
                if 'key' in str(kj).lower():
                    print(f'  FOUND KEY DATA!')
            except:
                pass
    except:
        pass

for ep in key_endpoints:
    try:
        kr = s.post(f'{BT_BASE}{ep}', timeout=5)
        if kr.status_code == 200 and len(kr.text) > 10:
            print(f'  POST {ep}: {kr.text[:300]}')
    except:
        pass

print('\nStep 4: Check login-legacy.js...')
legacy_url = f'{BT_BASE}/static/js/login-legacy.js?v=1765533662'
lr = s.get(legacy_url, timeout=10)
legacy_text = lr.text
print(f'  login-legacy.js size: {len(legacy_text)}')

pwd_contexts = re.findall(r'.{0,100}password.{0,100}', legacy_text)
for ctx in pwd_contexts[:10]:
    ctx_clean = ctx.strip()
    if 'encrypt' in ctx_clean.lower() or 'md5' in ctx_clean.lower() or 'rsa' in ctx_clean.lower() or 'key' in ctx_clean.lower():
        print(f'  PWD: {ctx_clean[:200]}')

login_post = re.findall(r'.{0,50}(?:post|fetch|ajax|axios).{0,200}login.{0,200}', legacy_text, re.IGNORECASE)
for lp in login_post[:5]:
    print(f'  POST: {lp[:200]}')

rsa_key_legacy = re.search(r'(?:setPublicKey|public_key|BEGIN PUBLIC KEY)[^"\']*["\']([^"\']+)', legacy_text)
if rsa_key_legacy:
    print(f'\n  RSA Key found: {rsa_key_legacy.group(1)[:100]}')
