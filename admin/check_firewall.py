#!/usr/bin/env python3
"""Check and fix firewall for port 80"""
import paramiko
import socket
import time

HOST = '211.159.155.38'
USER = 'root'
PWD = 'tb|38!6@CTL}f?'

def connect():
    for attempt in range(1, 4):
        try:
            print(f'SSH attempt {attempt}/3...')
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            sock = socket.create_connection((HOST, 22), timeout=30)
            transport = paramiko.Transport(sock)
            transport.banner_timeout = 60
            transport.connect(username=USER, password=PWD)
            ssh._transport = transport
            print('Connected!')
            return ssh
        except Exception as e:
            print(f'  Failed: {e}')
            if attempt < 3:
                print('  Retrying in 5s...')
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
    print('SSH failed after retries')
    exit(1)

print('\n--- firewalld status ---')
run(ssh, 'systemctl status firewalld --no-pager 2>&1 | head -5')

print('\n--- Open port 80 ---')
run(ssh, 'firewall-cmd --permanent --add-port=80/tcp 2>/dev/null && firewall-cmd --reload 2>/dev/null && echo "Port 80 opened via firewalld" || echo "firewalld not active, trying iptables"')
run(ssh, 'iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null && echo "Port 80 opened via iptables"')

print('\n--- Service status ---')
run(ssh, 'systemctl status admin-web --no-pager 2>&1 | head -8')

print('\n--- Test local curl ---')
run(ssh, 'curl -s http://127.0.0.1/ 2>&1 | head -3')

ssh.close()
print('\nDone')
