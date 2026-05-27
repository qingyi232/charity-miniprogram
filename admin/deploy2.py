#!/usr/bin/env python3
"""Deploy v2 - aggressive SSH retry with multiple approaches"""
import paramiko
import socket
import os
import time
import struct

HOST = '211.159.155.38'
USER = 'root'
PWD = 'tb|38!6@CTL}f?'

local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'


def attempt_ssh(attempt_num, timeout=60):
    print(f'\n--- Attempt {attempt_num} (timeout={timeout}s) ---')
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        if hasattr(socket, 'TCP_KEEPIDLE'):
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 10)
        print(f'  Connecting socket to {HOST}:22...')
        sock.connect((HOST, 22))
        print(f'  Socket connected! Reading banner...')

        transport = paramiko.Transport(sock)
        transport.banner_timeout = timeout
        transport.handshake_timeout = timeout
        transport.auth_timeout = timeout
        transport.set_keepalive(10)
        print(f'  Starting SSH handshake...')
        transport.connect(username=USER, password=PWD)
        print(f'  SSH authenticated!')
        return transport
    except Exception as e:
        print(f'  Failed: {type(e).__name__}: {e}')
        try:
            sock.close()
        except:
            pass
        return None


def attempt_ssh_client(attempt_num, timeout=60):
    print(f'\n--- Client attempt {attempt_num} (timeout={timeout}s) ---')
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            HOST, port=22,
            username=USER, password=PWD,
            timeout=timeout,
            banner_timeout=timeout,
            auth_timeout=timeout,
            allow_agent=False,
            look_for_keys=False,
        )
        print(f'  Connected!')
        return client
    except Exception as e:
        print(f'  Failed: {type(e).__name__}: {e}')
        return None


transport = None

for i in range(1, 6):
    transport = attempt_ssh(i, timeout=60)
    if transport:
        break
    time.sleep(3)

if not transport:
    for i in range(1, 4):
        client = attempt_ssh_client(i, timeout=60)
        if client:
            transport = client.get_transport()
            break
        time.sleep(5)

if not transport:
    print('\n\n=== ALL SSH ATTEMPTS FAILED ===')
    print('SSH port 22 is blocked by the server firewall.')
    exit(1)

print('\n=== SSH Connected! Deploying... ===')

sftp = paramiko.SFTPClient.from_transport(transport)

for fname in ['index.html', 'api.py']:
    local_path = os.path.join(local_dir, fname)
    remote_path = f'{remote_dir}/{fname}'
    sftp.put(local_path, remote_path)
    print(f'  Uploaded: {fname}')

SERVICE = (
    '[Unit]\n'
    'Description=Admin Web Backend\n'
    'After=network.target\n\n'
    '[Service]\n'
    'Type=simple\n'
    'WorkingDirectory=/www/wwwroot/admin\n'
    'ExecStart=/usr/bin/python3 /www/wwwroot/admin/api.py\n'
    'Restart=always\n'
    'RestartSec=3\n\n'
    '[Install]\n'
    'WantedBy=multi-user.target\n'
)
with sftp.open('/etc/systemd/system/admin-web.service', 'w') as f:
    f.write(SERVICE)
print('  Wrote systemd service')
sftp.close()


def run(cmd):
    ch = transport.open_session()
    ch.settimeout(15)
    ch.exec_command(cmd)
    out = b''
    while True:
        if ch.recv_ready():
            out += ch.recv(4096)
        if ch.exit_status_ready():
            while ch.recv_ready():
                out += ch.recv(4096)
            break
    result = out.decode().strip()
    if result:
        print(f'  {result}')
    return result


print('\nRestarting service...')
run('systemctl stop admin-web 2>/dev/null; pkill -f "python.*http.server" 2>/dev/null; pkill -f "python.*api.py" 2>/dev/null; sleep 1')
run('systemctl daemon-reload')
run('systemctl start admin-web')
run('systemctl enable admin-web 2>/dev/null')
time.sleep(3)
run('systemctl status admin-web --no-pager -l')

print('\nTesting API...')
run("curl -s -X POST http://127.0.0.1/api/cloud -H 'Content-Type: application/json' -d '{\"name\":\"admin\",\"data\":{\"action\":\"dashboard\"}}' | head -c 500")

transport.close()
print('\n\nDEPLOY COMPLETE!')
