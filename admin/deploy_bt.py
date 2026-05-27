#!/usr/bin/env python3
"""Deploy via BT Panel API"""
import urllib.request
import urllib.parse
import json
import os
import re
import hashlib
import time
import http.cookiejar

BT_URL = 'http://211.159.155.38:8888'
BT_USER = 'ecd087c0'
BT_PWD = 'b5a77f994909'

local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]


def bt_request(path, data=None, method='POST'):
    url = BT_URL + path
    if data:
        encoded = urllib.parse.urlencode(data).encode('utf-8')
    else:
        encoded = None
    req = urllib.request.Request(url, data=encoded, method=method)
    try:
        with opener.open(req, timeout=15) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            return resp.status, body
    except Exception as e:
        return 0, str(e)


def get_login_page():
    print('Step 1: Fetching login page...')
    status, body = bt_request('/login', method='GET')
    print(f'  Status: {status}, Length: {len(body)}')
    return body


def try_bt_login():
    login_page = get_login_page()

    print('Step 2: Attempting login...')
    md5_pwd = hashlib.md5(BT_PWD.encode()).hexdigest()

    for pwd_val in [BT_PWD, md5_pwd]:
        data = {
            'username': BT_USER,
            'password': pwd_val,
        }
        status, body = bt_request('/login', data)
        print(f'  Login attempt (pwd_type={"md5" if pwd_val == md5_pwd else "plain"}): status={status}')
        if status == 200:
            try:
                result = json.loads(body)
                print(f'  Result: {result}')
                if result.get('status') or result.get('msg', '').find('成功') >= 0:
                    return True
            except:
                if 'success' in body.lower() or '成功' in body:
                    return True
                print(f'  Body preview: {body[:200]}')

    token_match = re.search(r'request_token_head\s*=\s*["\']([^"\']+)', login_page)
    if token_match:
        token = token_match.group(1)
        print(f'  Found request_token: {token[:20]}...')
        data = {
            'username': BT_USER,
            'password': md5_pwd,
            'request_token': token,
        }
        status, body = bt_request('/login', data)
        print(f'  Login with token: status={status}')
        try:
            result = json.loads(body)
            print(f'  Result: {result}')
            if result.get('status'):
                return True
        except:
            print(f'  Body: {body[:200]}')

    return False


def upload_via_bt(filename, content):
    print(f'  Uploading {filename}...')
    boundary = '----WebKitFormBoundary' + str(int(time.time()))
    body_parts = []
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="f_path"\r\n\r\n{remote_dir}'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="f_name"\r\n\r\n{filename}'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="f_size"\r\n\r\n{len(content)}'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="blob"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content)
    body_parts.append(f'--{boundary}--\r\n'.encode())
    body_data = b'\r\n'.join(body_parts)

    url = BT_URL + '/files?action=upload_files'
    req = urllib.request.Request(url, data=body_data, method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    try:
        with opener.open(req, timeout=30) as resp:
            result = resp.read().decode()
            print(f'  Upload result: {result[:200]}')
            return True
    except Exception as e:
        print(f'  Upload failed: {e}')
        return False


def save_file_via_bt(filename, content_str):
    print(f'  Saving {filename} via SaveFileBody...')
    data = {
        'path': f'{remote_dir}/{filename}',
        'data': content_str,
        'encoding': 'utf-8',
    }
    status, body = bt_request('/files?action=SaveFileBody', data)
    print(f'  Save result: status={status}, body={body[:200]}')
    return status == 200


def run_command_via_bt(cmd):
    print(f'  Running: {cmd[:80]}...')
    data = {'cmd': cmd}
    status, body = bt_request('/ajax?action=ExecShell', data)
    if status == 200:
        print(f'  Output: {body[:300]}')
    else:
        data2 = {'command': cmd}
        status2, body2 = bt_request('/terminal?action=send_command', data2)
        print(f'  Alt output: status={status2}, body={body2[:300]}')


print('=== BT Panel Deploy ===\n')

logged_in = try_bt_login()

if logged_in:
    print('\nStep 3: Uploading files...')
    for fname in ['index.html', 'api.py']:
        fpath = os.path.join(local_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        save_file_via_bt(fname, content)

    print('\nStep 4: Restarting service...')
    run_command_via_bt(
        'pkill -f "python.*http.server" ; '
        'pkill -f "python.*api.py" ; '
        'sleep 1 ; '
        'cd /www/wwwroot/admin && nohup python3 api.py > /tmp/admin.log 2>&1 &'
    )
    print('\nDeploy complete!')
else:
    print('\n=== BT Panel login failed ===')
    print('The panel may use RSA encryption for login.')
    print('Please upload files manually through the BT Panel web UI.')
