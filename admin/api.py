#!/usr/bin/env python3
"""Admin backend - proxies requests to WeChat Cloud Functions via WeChat API"""
import http.server
import socketserver
import json
import urllib.request
import time
import threading
import os
import uuid
import cgi

APPID = 'wxaaa365fef83ceeab'
SECRET = '32d1444f8d00f63c3af8ce726bd6c846'
CLOUD_ENV = 'cloud1-d7gvq0lhy78aa1507'
PORT = int(os.environ.get('PORT', '80'))
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

_token_cache = {'token': None, 'expires': 0}
_token_lock = threading.Lock()


def get_access_token():
    with _token_lock:
        now = time.time()
        if _token_cache['token'] and now < _token_cache['expires']:
            return _token_cache['token']

        url = (
            'https://api.weixin.qq.com/cgi-bin/token'
            f'?grant_type=client_credential&appid={APPID}&secret={SECRET}'
        )
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                if 'access_token' in data:
                    _token_cache['token'] = data['access_token']
                    _token_cache['expires'] = now + data.get('expires_in', 7200) - 300
                    return _token_cache['token']
                print(f'[ERROR] get access_token failed: {data}')
                return None
        except Exception as e:
            print(f'[ERROR] get access_token exception: {e}')
            return None


def call_cloud_function(func_name, func_data):
    token = get_access_token()
    if not token:
        return {'code': 500, 'message': '获取微信 access_token 失败，请检查 AppID/Secret'}

    url = (
        'https://api.weixin.qq.com/tcb/invokecloudfunction'
        f'?access_token={token}&env={CLOUD_ENV}&name={func_name}'
    )
    body = json.dumps(func_data).encode('utf-8')

    try:
        req = urllib.request.Request(
            url, data=body,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            if result.get('errcode') == 0:
                resp_data = result.get('resp_data', '{}')
                return json.loads(resp_data)
            return {
                'code': 500,
                'message': f"云函数调用失败: {result.get('errmsg', '未知错误')} (errcode={result.get('errcode')})"
            }
    except Exception as e:
        return {'code': 500, 'message': f'请求异常: {e}'}


LOCAL_ADMINS = {
    'admin': {'password': 'admin123', 'role': 'superadmin', 'nickname': '管理员'}
}


class AdminHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == '/api/cloud':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                req_data = json.loads(body.decode('utf-8'))
                func_name = req_data.get('name', 'admin')
                func_data = req_data.get('data', {})

                if func_data.get('action') == 'login':
                    result = self._local_login(func_data)
                    if result:
                        self._json_response(200, result)
                        return

                result = call_cloud_function(func_name, func_data)
                self._json_response(200, result)
            except Exception as e:
                print(f'[ERROR] do_POST exception: {e}')
                self._json_response(200, {'code': 500, 'message': str(e)})
        elif self.path == '/api/upload':
            self._handle_upload()
        else:
            self.send_error(404)

    def _handle_upload(self):
        try:
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self._json_response(200, {'code': 400, 'message': '需要 multipart/form-data'})
                return

            form = cgi.FieldStorage(
                fp=self.rfile, headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
            )
            file_item = form['file']
            if not file_item.file:
                self._json_response(200, {'code': 400, 'message': '未收到文件'})
                return

            upload_dir = os.path.join(STATIC_DIR, 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            ext = os.path.splitext(file_item.filename)[1] or '.jpg'
            filename = f'{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}'
            filepath = os.path.join(upload_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(file_item.file.read())

            url = f'/uploads/{filename}'
            self._json_response(200, {'code': 200, 'url': url})
        except Exception as e:
            print(f'[ERROR] upload exception: {e}')
            self._json_response(200, {'code': 500, 'message': str(e)})

    @staticmethod
    def _local_login(data):
        username = data.get('username', '')
        password = data.get('password', '')
        admin = LOCAL_ADMINS.get(username)
        if admin and admin['password'] == password:
            return {
                'code': 200,
                'data': {'username': username, 'role': admin['role'], 'nickname': admin['nickname']}
            }
        return None

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _json_response(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        ts = time.strftime('%H:%M:%S')
        print(f'[{ts}] {fmt % args}')


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), AdminHandler)
    print(f'[Admin API] listening on http://0.0.0.0:{PORT}')
    print(f'[Admin API] static dir: {STATIC_DIR}')
    print(f'[Admin API] cloud env: {CLOUD_ENV}')
    server.serve_forever()
