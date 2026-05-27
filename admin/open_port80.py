#!/usr/bin/env python3
"""Open port 80 through BT panel firewall"""
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

print('--- Check YJ-FIREWALL-INPUT chain ---')
run(ssh, 'iptables -L YJ-FIREWALL-INPUT -n --line-numbers 2>/dev/null')

print('\n--- Check YJ-FIREWALL-FILTER chain ---')
run(ssh, 'iptables -L YJ-FIREWALL-FILTER -n --line-numbers 2>/dev/null || echo "no YJ-FIREWALL-FILTER"')

print('\n--- Add port 80 to YJ-FIREWALL-INPUT ---')
run(ssh, 'iptables -I YJ-FIREWALL-INPUT 1 -p tcp --dport 80 -j ACCEPT 2>/dev/null && echo "Added to YJ chain" || echo "Failed to add to YJ chain"')

print('\n--- Add port 443 too ---')
run(ssh, 'iptables -I YJ-FIREWALL-INPUT 1 -p tcp --dport 443 -j ACCEPT 2>/dev/null || true')

print('\n--- Updated YJ-FIREWALL-INPUT ---')
run(ssh, 'iptables -L YJ-FIREWALL-INPUT -n --line-numbers 2>/dev/null | head -20')

print('\n--- Verify full INPUT chain ---')
run(ssh, 'iptables -L INPUT -n --line-numbers 2>/dev/null')

print('\n--- Test from server ---')
run(ssh, 'curl -s http://127.0.0.1/ 2>&1 | head -2')

ssh.close()
print('\nDone - try accessing http://211.159.155.38 from browser now')
