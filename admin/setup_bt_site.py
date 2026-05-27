#!/usr/bin/env python3
"""Check BT panel nginx and try to set up a site"""
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

def run(ssh, cmd, timeout=15):
    chan = ssh._transport.open_session()
    chan.settimeout(timeout)
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

print('=== Find nginx in BT panel ===')
run(ssh, 'find /www/server -name "nginx" -type f 2>/dev/null | head -5')
run(ssh, 'ls /www/server/nginx/sbin/ 2>/dev/null || echo "no nginx sbin"')

print('\n=== Check BT panel Python project support ===')
run(ssh, 'ls /www/server/pyporject_evn/ 2>/dev/null; ls /www/server/python_project/ 2>/dev/null')

print('\n=== Check BT panel config ===')
run(ssh, 'cat /www/server/panel/config/config.json 2>/dev/null | head -20 || echo "no config.json"')

print('\n=== Check Tencent Cloud CLI ===')
run(ssh, 'pip3 list 2>/dev/null | grep -i tencent || echo "no tencent SDK"')

print('\n=== Check Tencent Cloud security group via API ===')
run(ssh, 'curl -s http://metadata.tencentyun.com/latest/meta-data/placement/zone 2>/dev/null')
run(ssh, 'curl -s http://metadata.tencentyun.com/latest/meta-data/instance-id 2>/dev/null')

print('\n=== Alternative: Try running on port 8080 ===')
# Port 8080 might be open in security group
print('Checking if port 8080 is already in use...')
run(ssh, 'ss -tlnp | grep :8080 || echo "Port 8080 FREE"')

print('\n=== BT panel port configuration ===')
run(ssh, 'cat /www/server/panel/data/port.pl 2>/dev/null')

print('\n=== BT panel firewall port list ===')
run(ssh, 'bt 14 2>/dev/null | head -10 || echo "bt command not found"')

ssh.close()
print('\nDone')
