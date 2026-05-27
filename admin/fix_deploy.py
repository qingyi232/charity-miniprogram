#!/usr/bin/env python3
"""Fix deployment - kill old process, restart service"""
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
    if e:
        print(f'  STDERR: {e}')
    return result

ssh = connect()
print('=== Connected ===\n')

print('1. Stop systemd service...')
run(ssh, 'systemctl stop admin-web 2>/dev/null')

print('\n2. Kill ALL python processes on port 80...')
run(ssh, 'kill -9 1845709 2>/dev/null; pkill -9 -f "python.*api.py" 2>/dev/null; sleep 2')

print('\n3. Verify port 80 is free...')
result = run(ssh, 'ss -tlnp | grep :80 || echo "Port 80 is FREE"')

print('\n4. Start systemd service...')
run(ssh, 'systemctl daemon-reload')
run(ssh, 'systemctl start admin-web')
time.sleep(3)

print('\n5. Check service status...')
run(ssh, 'systemctl status admin-web --no-pager -l')

print('\n6. Test API...')
run(ssh, 'curl -s http://127.0.0.1/api/cloud -X POST -H "Content-Type: application/json" -d \'{"name":"admin","data":{"action":"login","username":"admin","password":"admin123"}}\' | head -c 500')

print('\n7. Check port 80...')
run(ssh, 'ss -tlnp | grep :80')

ssh.close()
print('\n\nDone!')
