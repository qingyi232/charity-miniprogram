#!/usr/bin/env python3
"""Restart admin service and verify"""
import paramiko
import socket
import time

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

ssh = connect()
if not ssh:
    print('SSH failed')
    exit(1)

print('1. Check current service...')
run(ssh, 'systemctl status admin-web --no-pager 2>&1 | head -10')

print('\n2. Stop everything...')
run(ssh, 'systemctl stop admin-web 2>/dev/null; pkill -9 -f "python.*api.py" 2>/dev/null; sleep 2')

print('\n3. Verify port 80 is free...')
run(ssh, 'ss -tlnp | grep :80 || echo "Port 80 FREE"')

print('\n4. Check api.py is correct...')
run(ssh, 'head -15 /www/wwwroot/admin/api.py')

print('\n5. Start service...')
run(ssh, 'systemctl start admin-web')
time.sleep(3)

print('\n6. Status check...')
run(ssh, 'systemctl status admin-web --no-pager 2>&1 | head -10')

print('\n7. Local API test...')
run(ssh, 'curl -s http://127.0.0.1/api/cloud -X POST -H "Content-Type: application/json" -d \'{"name":"admin","data":{"action":"login","username":"admin","password":"admin123"}}\' 2>&1')

print('\n8. Local page test...')
run(ssh, 'curl -s http://127.0.0.1/ 2>&1 | head -3')

print('\n9. External connectivity test (from server)...')
run(ssh, 'curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s" http://127.0.0.1/ 2>&1')

ssh.close()
print('\nDone')
