#!/usr/bin/env python3
"""Deep check port 80 accessibility"""
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

print('--- Full iptables INPUT chain ---')
run(ssh, 'iptables -L INPUT -n --line-numbers 2>/dev/null')

print('\n--- iptables NAT ---')
run(ssh, 'iptables -t nat -L -n 2>/dev/null | head -20')

print('\n--- Check if BT panel has firewall rules ---')
run(ssh, 'cat /www/server/panel/data/firewall.json 2>/dev/null | head -20 || echo "no BT firewall config"')

print('\n--- BT panel port list ---')
run(ssh, 'cat /www/server/panel/data/port.pl 2>/dev/null || echo "no port config"')

print('\n--- Check Tencent Cloud security ---')
run(ssh, 'which tccli 2>/dev/null && echo "tccli available" || echo "no tccli"')

print('\n--- nftables check ---')
run(ssh, 'nft list ruleset 2>/dev/null | head -30 || echo "nft not available or no rules"')

print('\n--- Alternative: Change service port to 8080 and test ---')
print('(We can use BT panel nginx reverse proxy from 80 to 8080)')

ssh.close()
print('\nDone')
