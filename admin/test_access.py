#!/usr/bin/env python3
"""Test external access to admin panel"""
import urllib.request
import json
import socket

HOST = '211.159.155.38'

print('=== Test 1: Socket connect to port 80 ===')
try:
    sock = socket.create_connection((HOST, 80), timeout=10)
    sock.sendall(b'GET / HTTP/1.1\r\nHost: 211.159.155.38\r\nConnection: close\r\n\r\n')
    data = b''
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        data += chunk
        if len(data) > 500:
            break
    sock.close()
    print(f'Response ({len(data)} bytes):')
    text = data.decode(errors='replace')
    print(text[:300])
    print('...')
except Exception as e:
    print(f'Failed: {e}')

print('\n=== Test 2: Login API ===')
try:
    body = json.dumps({
        'name': 'admin',
        'data': {'action': 'login', 'username': 'admin', 'password': 'admin123'}
    }).encode()
    req = urllib.request.Request(
        f'http://{HOST}/api/cloud',
        data=body,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = resp.read().decode()
        print(f'Login API: {result}')
except Exception as e:
    print(f'Login API failed: {e}')

print('\n=== Test 3: Dashboard API ===')
try:
    body = json.dumps({
        'name': 'admin',
        'data': {'action': 'dashboard'}
    }).encode()
    req = urllib.request.Request(
        f'http://{HOST}/api/cloud',
        data=body,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = resp.read().decode()
        print(f'Dashboard API: {result[:300]}')
except Exception as e:
    print(f'Dashboard API failed: {e}')
