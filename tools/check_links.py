#!/usr/bin/env python3
"""Check: every local href/src resolves to an existing file, AND the three
child-facing lesson pages carry no off-site URL at all (teaching-framework 六之一).

The second rule had no enforcement until 2026-08-26: 六之四 allows external links
only inside parents.html's resources block, but nothing stopped one appearing on
index/reference/review, where a child would click straight out to YouTube."""
import sys, os, re
from urllib.parse import urlparse, unquote
ROOT = os.path.abspath(sys.argv[1])
bad = 0
# 六之一: these three are the pages a child reads. parents.html is the sole page
# allowed to carry off-site URLs, and only inside its 延伸資源 block (六之四).
CHILD_PAGES = ('index.html', 'reference.html', 'review.html')
# Case-insensitive, and not limited to http(s): the rule is "no off-site URL", so any
# scheme that leaves this origin counts (ftp:, ws:, protocol-relative //host, ...).
# Local-only schemes stay allowed.
LOCAL_SCHEMES = ('mailto:', 'data:', 'javascript:', 'tel:', 'blob:', 'about:')
EXTERNAL = re.compile(r'''(?:href|src|action|poster|data)\s*=\s*["\']\s*([a-zA-Z][a-zA-Z0-9+.-]*:(?://)?[^"\']+|//[^"\']+)["\']''', re.I)
IMPORT_URL = re.compile(r'''(?:@import\s+|url\()\s*["\']?\s*([a-zA-Z][a-zA-Z0-9+.-]*://[^"\')]+|//[^"\')]+)''', re.I)
for dirpath, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in ('.git', 'teaching-workspace')]
    for f in sorted(files):
        if not f.endswith('.html'): continue
        p = os.path.join(dirpath, f)
        src = open(p, encoding='utf-8').read()
        for m in re.finditer(r'''(?:href|src)\s*=\s*["\']([^"\']+)["\']''', src):
            u = m.group(1)
            # ⚠️ 這裡要用同一份 LOCAL_SCHEMES，不可以再寫一份手打的清單：
            # 原本漏了 tel:／blob:／about:，於是一個合法的 tel: 連結會被當成
            # 「指不到檔案的站內連結」而誤報（2026-08-28 由改壞測試抓到）。
            if u.startswith(('http://','https://','#') + LOCAL_SCHEMES): continue
            path = unquote(urlparse(u).path)
            if not path: continue
            tgt = os.path.normpath(os.path.join(dirpath, path))
            ok = os.path.isfile(tgt) or (os.path.isdir(tgt) and os.path.isfile(os.path.join(tgt,'index.html')))
            if not ok:
                print(f'[LINK] {os.path.relpath(p,ROOT)}:{src[:m.start()].count(chr(10))+1} -> {u}'); bad += 1
        # off-site URLs are forbidden outright on the pages a child reads
        if f in CHILD_PAGES and os.path.basename(os.path.dirname(dirpath)) == 'math':
            for rx in (EXTERNAL, IMPORT_URL):
                for m in rx.finditer(src):
                    u = m.group(1).strip()
                    if u.lower().startswith(LOCAL_SCHEMES):
                        continue
                    line = src[:m.start()].count(chr(10)) + 1
                    print(f'[EXTERNAL] {os.path.relpath(p,ROOT)}:{line} -> {u[:70]}'
                          f'  (六之一: child-facing pages carry no off-site URL)')
                    bad += 1
        for m in re.finditer(r'''content\s*=\s*["\']\s*\d+\s*;\s*url=([^"\']+)["\']''', src):
            u = m.group(1).strip()
            if u.startswith(('http://','https://')): continue
            tgt = os.path.normpath(os.path.join(dirpath, unquote(u)))
            if not (os.path.isfile(tgt) or (os.path.isdir(tgt) and os.path.isfile(os.path.join(tgt,'index.html')))):
                print(f'[META] {os.path.relpath(p,ROOT)} -> {u}'); bad += 1
print(f'--- {bad} broken link(s)')
sys.exit(1 if bad else 0)
