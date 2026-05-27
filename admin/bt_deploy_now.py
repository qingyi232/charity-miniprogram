#!/usr/bin/env python3
"""Deploy NOW - user just logged in, security reset"""
import requests, hashlib, json, re, os, base64, time, warnings
warnings.filterwarnings('ignore')
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5

BT_BASE = 'http://211.159.155.38:8888'
BT_ENTRY = f'{BT_BASE}/tencentcloud'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'
local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'

def md5(s): return hashlib.md5(s.encode('utf-8')).hexdigest()

def rsa_encrypt(plaintext, pem_key):
    pem = pem_key.strip()
    if '-----BEGIN' in pem:
        h, f = '-----BEGIN PUBLIC KEY-----', '-----END PUBLIC KEY-----'
        body = pem.replace(h,'').replace(f,'').strip()
        lines = [body[i:i+64] for i in range(0,len(body),64)]
        pem = h+'\n'+'\n'.join(lines)+'\n'+f
    key = RSA.import_key(pem)
    cipher = PKCS1_v1_5.new(key)
    return base64.b64encode(cipher.encrypt(plaintext.encode('utf-8'))).decode()

s = requests.Session()
s.verify = False
s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

print('Getting fresh page...')
r = s.get(BT_ENTRY, timeout=15)
token = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text).group(1)
rsa_key = re.search(r"vite_public_encryption\s*=\s*'([^']+)'", r.text).group(1)
print(f'Token: {token[:20]}...')

s.headers.update({
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': BT_ENTRY,
    'Origin': BT_BASE,
})

pwd_enc = rsa_encrypt(md5(md5(BT_PWD) + '_bt.cn'), rsa_key)

variants = [
    ('A: md5(user)', rsa_encrypt(md5(BT_USER), rsa_key)),
    ('B: md5(user+tk)', rsa_encrypt(md5(BT_USER + token), rsa_key)),
    ('C: md5(md5(user)+tk)', rsa_encrypt(md5(md5(BT_USER) + token), rsa_key)),
    ('D: rsa(user)', rsa_encrypt(BT_USER, rsa_key)),
    ('E: rsa(md5(user)+_bt.cn)', rsa_encrypt(md5(md5(BT_USER) + '_bt.cn'), rsa_key)),
]

for desc, user_enc in variants:
    data = {'username': user_enc, 'password': pwd_enc}
    try:
        r2 = s.post(f'{BT_BASE}/login', data=data, timeout=10)
        j = json.loads(r2.text)
        msg = j.get('msg', '')
        print(f'{desc}: status={j.get("status")} msg={msg[:60]}')
        if j.get('status'):
            print('\n=== LOGIN SUCCESS! Deploying... ===')
            for fname in ['index.html', 'api.py']:
                with open(os.path.join(local_dir, fname), 'r', encoding='utf-8') as f:
                    content = f.read()
                r3 = s.post(f'{BT_BASE}/files?action=SaveFileBody',
                            data={'path': f'{remote_dir}/{fname}', 'data': content, 'encoding': 'utf-8'}, timeout=30)
                try:
                    print(f'  {fname}: {json.loads(r3.text)}')
                except:
                    print(f'  {fname}: {r3.text[:100]}')

            cmd = 'pkill -f "python.*http.server" ; pkill -f "python.*api.py" ; sleep 1 ; cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
            r4 = s.post(f'{BT_BASE}/ajax?action=ExecShell', data={'cmd': cmd}, timeout=15)
            try:
                print(f'  Shell: {json.loads(r4.text)}')
            except:
                print(f'  Shell: {r4.text[:100]}')

            time.sleep(3)
            import urllib.request
            try:
                req = urllib.request.Request('http://211.159.155.38/api/cloud',
                    json.dumps({'name':'admin','data':{'action':'dashboard'}}).encode(),
                    {'Content-Type':'application/json'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    print(f'\n  API verify: {resp.read().decode()[:300]}')
            except Exception as e:
                print(f'\n  API verify: {e}')

            print('\nDEPLOY COMPLETE!')
            exit(0)
    except Exception as e:
        print(f'{desc}: error={e}')

    # Get fresh token for each attempt
    r = s.get(BT_ENTRY, timeout=15)
    tm = re.search(r"vite_public_login_token\s*=\s*'([^']+)'", r.text)
    if tm:
        token = tm.group(1)
        rsa_m = re.search(r"vite_public_encryption\s*=\s*'([^']+)'", r.text)
        if rsa_m:
            rsa_key = rsa_m.group(1)
        pwd_enc = rsa_encrypt(md5(md5(BT_PWD) + '_bt.cn'), rsa_key)

print('\nAll variants failed.')
