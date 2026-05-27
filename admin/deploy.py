#!/usr/bin/env python3
"""Deploy admin backend to server - with SSH retry and fallback"""
import paramiko
import os
import time
import socket

HOST = '211.159.155.38'
USER = 'root'
PWD = 'tb|38!6@CTL}f?'
MAX_RETRIES = 3

local_dir = os.path.dirname(os.path.abspath(__file__))
remote_dir = '/www/wwwroot/admin'


def try_connect():
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f'SSH attempt {attempt}/{MAX_RETRIES}...')
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            sock = socket.create_connection((HOST, 22), timeout=30)
            transport = paramiko.Transport(sock)
            transport.banner_timeout = 30
            transport.connect(username=USER, password=PWD)
            ssh._transport = transport
            print(f'Connected!')
            return ssh
        except Exception as e:
            print(f'  Failed: {e}')
            if attempt < MAX_RETRIES:
                print(f'  Retrying in 5s...')
                time.sleep(5)
    return None


def run_cmd(ssh, cmd):
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
    out_str = out.decode().strip()
    err_str = err.decode().strip()
    if out_str:
        print(out_str)
    if err_str and 'Warning' not in err_str:
        print(f'  stderr: {err_str}')
    return out_str


ssh = try_connect()
if not ssh:
    print('\nSSH failed after retries. Trying alternative port...')
    for port in [8022, 2222]:
        try:
            print(f'Trying port {port}...')
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(HOST, port=port, username=USER, password=PWD, timeout=15, banner_timeout=30)
            print(f'Connected on port {port}!')
            break
        except Exception as e:
            print(f'  Port {port} failed: {e}')
            ssh = None

if not ssh:
    print('\n=== All SSH attempts failed ===')
    print('Please manually upload these files to /www/wwwroot/admin/ via BT Panel:')
    print(f'  1. {os.path.join(local_dir, "index.html")}')
    print(f'  2. {os.path.join(local_dir, "api.py")}')
    print('Then run: systemctl restart admin-web')
    exit(1)

sftp = paramiko.SFTPClient.from_transport(ssh._transport)

for fname in ['index.html', 'api.py']:
    local_path = os.path.join(local_dir, fname)
    remote_path = f'{remote_dir}/{fname}'
    sftp.put(local_path, remote_path)
    print(f'Uploaded: {fname}')

sftp.close()

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

print('\nStopping old service...')
run_cmd(ssh, 'systemctl stop admin-web 2>/dev/null; '
             'pkill -f "python.*http.server" 2>/dev/null; '
             'pkill -f "python.*api.py" 2>/dev/null; sleep 1')

print('Writing systemd service...')
sftp2 = paramiko.SFTPClient.from_transport(ssh._transport)
with sftp2.open('/etc/systemd/system/admin-web.service', 'w') as f:
    f.write(SERVICE)
sftp2.close()

print('Starting service...')
run_cmd(ssh, 'systemctl daemon-reload')
run_cmd(ssh, 'systemctl start admin-web')
run_cmd(ssh, 'systemctl enable admin-web 2>/dev/null')

time.sleep(3)

print('\nService status:')
run_cmd(ssh, 'systemctl status admin-web --no-pager -l')

print('\nTesting API...')
run_cmd(ssh, "curl -s -X POST http://127.0.0.1/api/cloud "
             '-H "Content-Type: application/json" '
             "-d '{\"name\":\"admin\",\"data\":{\"action\":\"dashboard\"}}' "
             '| head -c 500')

ssh.close()
print('\n\nDeploy complete!')
