#!/usr/bin/env python3
"""Check previous deployment configuration"""
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

print('=== Check BT panel sites ===')
run(ssh, 'cat /www/server/panel/data/site.json 2>/dev/null || echo "no site.json"')

print('\n=== Check BT panel website list ===')
run(ssh, 'ls /www/server/panel/vhost/ 2>/dev/null')

print('\n=== Check nginx configs ===')
run(ssh, 'ls /www/server/panel/vhost/nginx/ 2>/dev/null || echo "no nginx vhost"')
run(ssh, 'ls /www/server/panel/vhost/apache/ 2>/dev/null || echo "no apache vhost"')

print('\n=== Check nginx site configs ===')
run(ssh, 'cat /www/server/panel/vhost/nginx/*.conf 2>/dev/null || echo "no nginx conf files"')

print('\n=== Check if nginx/apache is installed ===')
run(ssh, 'which nginx 2>/dev/null || echo "nginx not installed"')
run(ssh, 'which apache2 2>/dev/null; which httpd 2>/dev/null || echo "apache not installed"')

print('\n=== Check BT panel installed software ===')
run(ssh, 'ls /www/server/ 2>/dev/null')

print('\n=== Check systemd services related to web ===')
run(ssh, 'systemctl list-units --type=service --all 2>/dev/null | grep -i "web\\|http\\|nginx\\|apache\\|admin" | head -10')

print('\n=== Check previous nohup logs ===')
run(ssh, 'cat /tmp/admin.log 2>/dev/null')

print('\n=== History of commands ===')
run(ssh, 'history 2>/dev/null | tail -30 || cat ~/.bash_history 2>/dev/null | tail -30')

print('\n=== Check if port 80 was previously opened in BT firewall ===')
run(ssh, 'cat /www/server/panel/data/firewall_new.json 2>/dev/null | head -50 || echo "no firewall_new.json"')

ssh.close()
print('\nDone')
