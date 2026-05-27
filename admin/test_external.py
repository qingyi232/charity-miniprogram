#!/usr/bin/env python3
"""Test external access from server and debug connection issues"""
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
    chan.settimeout(20)
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

print('=== Test from server using public IP ===')
run(ssh, 'curl -v http://211.159.155.38/ 2>&1 | head -20')

print('\n=== Test API via public IP ===')
run(ssh, 'curl -s http://211.159.155.38/api/cloud -X POST -H "Content-Type: application/json" -d \'{"name":"admin","data":{"action":"login","username":"admin","password":"admin123"}}\' 2>&1')

print('\n=== Check if there is a cloud firewall / WAF ===')
run(ssh, 'iptables -L -n -v | head -20')

print('\n=== Check conntrack ===')
run(ssh, 'conntrack -L 2>/dev/null | grep "dport=80" | head -5 || echo "conntrack not available"')

print('\n=== Check tcpdump for incoming port 80 (5s sample) ===')
run(ssh, 'timeout 1 tcpdump -i any port 80 -c 5 2>&1 || echo "no packets captured"')

ssh.close()
print('\nDone')
