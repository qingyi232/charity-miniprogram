#!/usr/bin/env python3
"""Find which ports are open in security group by testing from outside"""
import socket
import concurrent.futures

HOST = '211.159.155.38'
PORTS_TO_TEST = [22, 80, 443, 3000, 3306, 5000, 8000, 8080, 8443, 8888, 8889, 9000, 9090, 27017]

def test_port(port):
    try:
        sock = socket.create_connection((HOST, port), timeout=3)
        sock.close()
        return port, True
    except:
        return port, False

print(f'Testing ports on {HOST}...\n')
with concurrent.futures.ThreadPoolExecutor(max_workers=14) as executor:
    results = list(executor.map(test_port, PORTS_TO_TEST))

print('Port scan results:')
for port, is_open in sorted(results):
    status = 'OPEN' if is_open else 'CLOSED'
    print(f'  Port {port:5d}: {status}')

open_ports = [p for p, o in results if o]
print(f'\nOpen ports: {open_ports}')
