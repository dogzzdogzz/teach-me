#!/usr/bin/env python3
"""Check: every local href/src resolves to an existing file."""
import sys, os, re
from urllib.parse import urlparse, unquote
ROOT = os.path.abspath(sys.argv[1])
bad = 0
for dirpath, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in ('.git', 'teaching-workspace')]
    for f in sorted(files):
        if not f.endswith('.html'): continue
        p = os.path.join(dirpath, f)
        src = open(p, encoding='utf-8').read()
        for m in re.finditer(r'''(?:href|src)\s*=\s*["\']([^"\']+)["\']''', src):
            u = m.group(1)
            if u.startswith(('http://','https://','#','mailto:','data:','javascript:')): continue
            path = unquote(urlparse(u).path)
            if not path: continue
            tgt = os.path.normpath(os.path.join(dirpath, path))
            ok = os.path.isfile(tgt) or (os.path.isdir(tgt) and os.path.isfile(os.path.join(tgt,'index.html')))
            if not ok:
                print(f'[LINK] {os.path.relpath(p,ROOT)}:{src[:m.start()].count(chr(10))+1} -> {u}'); bad += 1
        for m in re.finditer(r'''content\s*=\s*["\']\s*\d+\s*;\s*url=([^"\']+)["\']''', src):
            u = m.group(1).strip()
            if u.startswith(('http://','https://')): continue
            tgt = os.path.normpath(os.path.join(dirpath, unquote(u)))
            if not (os.path.isfile(tgt) or (os.path.isdir(tgt) and os.path.isfile(os.path.join(tgt,'index.html')))):
                print(f'[META] {os.path.relpath(p,ROOT)} -> {u}'); bad += 1
print(f'--- {bad} broken link(s)')
