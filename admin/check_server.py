#!/usr/bin/env python3
"""Check server status and fix deployment issues"""
import paramiko
import socket
import time

HOST = '211.159.155.38'
USER = 'root'
PWD = 'tb|38!6@CTL}f?'

def connect():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    sock = socket.create_connection((HOST, 22), timeout=30)
    transport = paramiko.Transport(sock)
    transport.banner_timeout = 30
    transport.connect(username=USER, password=PWD)
    ssh._transport = transport
    return ssh

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
    if e and 'Warning' not in e:
        print(f'STDERR: {e}')
    return result

ssh = connect()
print('=== Connected ===\n')

print('--- Port 80 usage ---')
run(ssh, 'ss -tlnp | grep :80')

print('\n--- api.py log ---')
run(ssh, 'cat /tmp/admin.log 2>/dev/null; journalctl -u admin-web --no-pager -n 20 2>/dev/null')

print('\n--- Python3 check ---')
run(ssh, 'python3 --version')

print('\n--- Files in /www/wwwroot/admin ---')
run(ssh, 'ls -la /www/wwwroot/admin/')

print('\n--- Try starting api.py manually on port 8080 ---')
run(ssh, 'pkill -f "python.*api.py" 2>/dev/null; sleep 1')
run(ssh, 'cd /www/wwwroot/admin && PORT=8080 python3 -c "import api; print(\'import ok\')" 2>&1 || echo "import failed"')

print('\n--- Nginx status ---')
run(ssh, 'nginx -t 2>&1; systemctl status nginx --no-pager -l 2>/dev/null | head -5')

ssh.close()
print('\nDone')
