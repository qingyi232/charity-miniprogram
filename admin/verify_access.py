#!/usr/bin/env python3
"""Verify external access and check Tencent Cloud security group"""
import paramiko
import socket
import time
import urllib.request
import json

HOST = '211.159.155.38'
USER = 'root'
PWD = 'tb|38!6@CTL}f?'

def connect():
    for attempt in range(1, 4):
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            sock = socket.create_connection((HOST, 22), timeout=30)
            transport = paramiko.Transport(sock)
            transport.banner_timeout = 60
            transport.connect(username=USER, password=PWD)
            ssh._transport = transport
            return ssh
        except:
            if attempt < 3:
                time.sleep(5)
    return None

def run(ssh, cmd):
    chan = ssh._transport.open_session()
    chan.settimeout(15)
    chan.exec_command(cmd)
    out = b''
    err = b''
    while True:
        if chan.recv_ready():
            out += chan.recv(4096)
        if chan.recv_stderr_ready():
            err += chan.recv_stderr(4096)
        if chan.exit_status_ready():
            while chan.recv_ready():
                out += chan.recv(4096)
            while chan.recv_stderr_ready():
                err += chan.recv_stderr(4096)
            break
    result = out.decode().strip()
    if result:
        print(result)
    e = err.decode().strip()
    if e:
        print(f'  STDERR: {e}')
    return result

# Test direct Python connection to port 80 (bypasses proxy)
print('=== Direct Python socket test to port 80 ===')
try:
    sock = socket.create_connection((HOST, 80), timeout=10)
    sock.sendall(b'GET / HTTP/1.0\r\nHost: 211.159.155.38\r\n\r\n')
    data = sock.recv(200)
    print(f'Response: {data[:200].decode(errors="replace")}')
    sock.close()
    print('Port 80 is ACCESSIBLE from outside!')
except Exception as e:
    print(f'Port 80 NOT accessible: {e}')

print('\n=== Direct Python socket test to port 8888 ===')
try:
    sock = socket.create_connection((HOST, 8888), timeout=10)
    print('Port 8888 is ACCESSIBLE')
    sock.close()
except Exception as e:
    print(f'Port 8888 NOT accessible: {e}')

# SSH check
ssh = connect()
if not ssh:
    print('SSH failed')
    exit(1)

print('\n=== Server local test ===')
run(ssh, 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null')

print('\n=== Service status ===')
run(ssh, 'systemctl status admin-web --no-pager 2>&1 | head -6')

print('\n=== Check Tencent Cloud security group via metadata ===')
run(ssh, 'curl -s --connect-timeout 3 http://metadata.tencentyun.com/latest/meta-data/security-group 2>/dev/null || echo "metadata not available"')

ssh.close()
print('\nDone')
