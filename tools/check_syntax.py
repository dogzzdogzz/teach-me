#!/usr/bin/env python3
"""Inline <script> syntax check: extract every inline script and run `node --check`."""
import sys, os, re, subprocess, tempfile
ROOT = os.path.abspath(sys.argv[1])
tmp = tempfile.mkdtemp(prefix='syncheck_')
bad = 0; n = 0
for dirpath, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in ('.git','teaching-workspace')]
    for f in sorted(files):
        if not f.endswith('.html'): continue
        p = os.path.join(dirpath, f)
        src = open(p, encoding='utf-8').read()
        for i, m in enumerate(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', src, re.S)):
            body = m.group(1)
            if not body.strip(): continue
            n += 1
            out = os.path.join(tmp, f'{n}.js')
            open(out, 'w', encoding='utf-8').write(body)
            r = subprocess.run(['node','--check',out], capture_output=True, text=True)
            if r.returncode != 0:
                offset = src[:m.start(1)].count('\n')
                print(f'[SYNTAX] {os.path.relpath(p,ROOT)} script#{i} (html line offset {offset})')
                print('\n'.join(r.stderr.splitlines()[:6])); bad += 1
print(f'--- {bad} script(s) with syntax errors, {n} inline scripts checked')
