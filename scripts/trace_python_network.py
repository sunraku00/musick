"""
Skrip untuk merekam domain dan koneksi jaringan yang dilakukan oleh proses Python (bridge)
selama siklus cari dan resolve stream.
"""
import sys
import os
import socket
import json

# Hook socket.getaddrinfo untuk merekam seluruh resolusi DNS proses Python
resolved_hosts = set()
original_getaddrinfo = socket.getaddrinfo

def hooked_getaddrinfo(host, port, *args, **kwargs):
    if host:
        resolved_hosts.add(str(host))
    return original_getaddrinfo(host, port, *args, **kwargs)

socket.getaddrinfo = hooked_getaddrinfo

# Tambahkan direktori bridge ke sys.path
sys.path.insert(0, os.path.abspath("bridge"))
import bridge_rpc

print("--- Menjalankan Siklus Bridge Python: Search ---")
search_res = bridge_rpc.handle_search({"query": "Sheila on 7"})
print(f"Hasil search: {len(search_res['tracks'])} trek ditemukan.")

print("--- Menjalankan Siklus Bridge Python: Resolve Stream ---")
track_id = search_res['tracks'][0]['sourceId']
resolve_res = bridge_rpc.handle_resolve({"sourceId": track_id})
print(f"Hasil resolve stream URL host: {resolve_res['url'][:45]}...")

print("\n=== DAFTAR DOMAIN YANG DIHUBUNGI LANGSUNG OLEH PROSES PYTHON ===")
for h in sorted(resolved_hosts):
    print(f"- {h}")

with open("docs/python_captured_domains.json", "w", encoding="utf-8") as f:
    json.dump(sorted(list(resolved_hosts)), f, indent=2)

print("\nSelesai direkam ke docs/python_captured_domains.json")
